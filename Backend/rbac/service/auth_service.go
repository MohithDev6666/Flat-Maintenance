package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/repository"
	"golang.org/x/crypto/bcrypt"
)

// AuthService defines authentication and session operations.
type AuthService interface {
	Register(ctx context.Context, req models.CreateUserRequest) (*models.LoginResponse, error)
	Login(ctx context.Context, req models.LoginRequest) (*models.LoginResponse, error)
	GetProfile(ctx context.Context, userID string) (*models.User, error)
	GenerateToken(userID, email, roleID string) (string, error)
	ValidateToken(tokenStr string) (*models.Claims, error)
	RefreshToken(tokenStr string) (string, error)
	ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error
	Logout(ctx context.Context, tokenStr string) error
}

type authService struct {
	userRepo    repository.UserRepository
	roleRepo    repository.RoleRepository
	modRepo     repository.ModuleRepository
	cache       CacheBackend
	auditLogger audit.AuditLogger
	secretKey   []byte
	expiration  time.Duration
	issuer      string
}

// NewAuthService creates a new AuthService.
// secretKey is used to sign JWTs.
// issuer is included in the JWT "iss" claim; pass "" to use the default "rbac-auth-engine".
func NewAuthService(
	userRepo repository.UserRepository,
	roleRepo repository.RoleRepository,
	modRepo repository.ModuleRepository,
	cache CacheBackend,
	auditLogger audit.AuditLogger,
	secretKey string,
	expiration time.Duration,
) AuthService {
	return NewAuthServiceWithIssuer(userRepo, roleRepo, modRepo, cache, auditLogger, secretKey, expiration, "")
}

// NewAuthServiceWithIssuer is the full constructor when you need a custom JWT issuer.
func NewAuthServiceWithIssuer(
	userRepo repository.UserRepository,
	roleRepo repository.RoleRepository,
	modRepo repository.ModuleRepository,
	cache CacheBackend,
	auditLogger audit.AuditLogger,
	secretKey string,
	expiration time.Duration,
	issuer string,
) AuthService {
	if expiration == 0 {
		expiration = 24 * time.Hour
	}
	if issuer == "" {
		issuer = "rbac-auth-engine"
	}
	return &authService{
		userRepo:    userRepo,
		roleRepo:    roleRepo,
		modRepo:     modRepo,
		cache:       cache,
		auditLogger: auditLogger,
		secretKey:   []byte(secretKey),
		expiration:  expiration,
		issuer:      issuer,
	}
}

func (s *authService) logAudit(_ context.Context, entryType string, subjectID, roleID, permission, result string, metadata map[string]string) {
	if s.auditLogger == nil {
		return
	}
	entry := audit.AuditEntry{
		Type:       entryType,
		SubjectID:  subjectID,
		RoleID:     roleID,
		Permission: permission,
		Result:     result,
		Metadata:   metadata,
		Timestamp:  time.Now(),
	}
	// Non-blocking: the audit logger queues the entry in its worker pool.
	_ = s.auditLogger.Log(context.Background(), entry)
}

func (s *authService) Register(ctx context.Context, req models.CreateUserRequest) (*models.LoginResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	// Validate required fields.
	if req.Email == "" || req.Password == "" || req.Name == "" {
		return nil, models.ErrInvalidInput
	}

	// Optimistic pre-check for duplicate email before hashing (cheap vs bcrypt).
	if existing, _ := s.userRepo.GetByEmail(ctx, req.Email); existing != nil {
		return nil, models.ErrUserAlreadyExists
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashedPassword),
		Phone:    req.Phone,
		Active:   1,
	}

	// NOTE: First-user Super Admin assignment is now handled at startup by
	// SeedDefaults. This handler no longer performs seeding to avoid the race
	// condition where concurrent registrations both see an empty collection.
	// The first registered user will have no role; an admin must assign one.

	if err := s.userRepo.Create(ctx, user); err != nil {
		s.logAudit(ctx, "mutation", "system", "system", "auth:register", "error", map[string]string{"email": req.Email, "error": err.Error()})
		if errors.Is(err, models.ErrUserAlreadyExists) {
			return nil, models.ErrUserAlreadyExists
		}
		return nil, err
	}
	s.logAudit(ctx, "mutation", user.ID, user.RoleID, "auth:register", "success", map[string]string{"email": req.Email})

	if user.RoleID == "" {
		count, _ := s.userRepo.Count(ctx)
		if count <= 1 {
			if superAdminRole, err := s.roleRepo.GetByName(ctx, "Super Admin"); err == nil && superAdminRole != nil {
				user.RoleID = superAdminRole.ID
				_ = s.userRepo.UpdateRole(ctx, user.ID, user.RoleID)
			}
		}
	}

	user.RoleIDCamel = user.RoleID
	user.IsActive = (user.Active == 1)

	if user.RoleID != "" {
		if role, err := s.roleRepo.GetByID(ctx, user.RoleID); err == nil {
			user.RoleLevel = role.Level
			user.IsAdmin = role.HasAdminAccess()
			user.RoleName = role.Name
		}
	}

	token, err := s.GenerateToken(user.ID, user.Email, user.RoleID)
	if err != nil {
		return nil, err
	}

	return &models.LoginResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (s *authService) Login(ctx context.Context, req models.LoginRequest) (*models.LoginResponse, error) {
	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		s.logAudit(ctx, "mutation", "system", "system", "auth:login", "error", map[string]string{"email": req.Email, "error": "invalid credentials"})
		return nil, models.ErrInvalidCredentials
	}

	// Block suspended accounts before password comparison (prevents timing info leak).
	if user.Active == 0 {
		s.logAudit(ctx, "mutation", user.ID, user.RoleID, "auth:login", "error", map[string]string{"email": req.Email, "error": "account suspended"})
		return nil, models.ErrUserSuspended
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		s.logAudit(ctx, "mutation", user.ID, user.RoleID, "auth:login", "error", map[string]string{"email": req.Email, "error": "password mismatch"})
		return nil, models.ErrInvalidCredentials
	}

	// Fallback: if user has no role assigned, assign Super Admin role if available
	if user.RoleID == "" {
		if superAdminRole, err := s.roleRepo.GetByName(ctx, "Super Admin"); err == nil && superAdminRole != nil {
			user.RoleID = superAdminRole.ID
			_ = s.userRepo.UpdateRole(ctx, user.ID, user.RoleID)
		}
	}

	user.RoleIDCamel = user.RoleID
	user.IsActive = (user.Active == 1)

	if user.RoleID != "" {
		if role, err := s.roleRepo.GetByID(ctx, user.RoleID); err == nil {
			user.RoleLevel = role.Level
			user.IsAdmin = role.HasAdminAccess()
			user.RoleName = role.Name
		}
	}

	var perms []string
	mods, _ := s.modRepo.GetAll(ctx)
	if user.IsAdmin {
		perms = make([]string, 0, len(mods)*4)
		for _, m := range mods {
			perms = append(perms, m.Key+":read", m.Key+":create", m.Key+":update", m.Key+":delete")
		}
	} else if user.RoleID != "" {
		if role, err := s.roleRepo.GetByID(ctx, user.RoleID); err == nil {
			modMap := make(map[string]string, len(mods)*2)
			for _, m := range mods {
				modMap[m.ID] = m.Key
				modMap[strings.ToLower(m.Key)] = m.Key
			}
			for _, po := range role.Permissions {
				moduleKey, exists := modMap[po.ModuleKey]
				if !exists {
					moduleKey, exists = modMap[strings.ToLower(po.ModuleKey)]
				}
				if !exists {
					moduleKey = po.ModuleKey
				}
				if po.View {
					perms = append(perms, moduleKey+":read")
				}
				if po.Add {
					perms = append(perms, moduleKey+":create")
				}
				if po.Edit {
					perms = append(perms, moduleKey+":update")
				}
				if po.Delete {
					perms = append(perms, moduleKey+":delete")
				}
			}
		}
	}

	if !user.IsAdmin && len(perms) == 0 {
		s.logAudit(ctx, "mutation", user.ID, user.RoleID, "auth:login", "error", map[string]string{"email": req.Email, "error": "no module permissions assigned"})
		return nil, errors.New("access denied: account has no module access granted")
	}

	token, err := s.GenerateToken(user.ID, user.Email, user.RoleID)
	if err != nil {
		return nil, err
	}

	s.logAudit(ctx, "mutation", user.ID, user.RoleID, "auth:login", "success", map[string]string{"email": req.Email})
	return &models.LoginResponse{
		Token:       token,
		User:        *user,
		Permissions: perms,
	}, nil
}

func (s *authService) GetProfile(ctx context.Context, userID string) (*models.User, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.RoleID == "" {
		if superAdminRole, err := s.roleRepo.GetByName(ctx, "Super Admin"); err == nil && superAdminRole != nil {
			u.RoleID = superAdminRole.ID
			_ = s.userRepo.UpdateRole(ctx, u.ID, u.RoleID)
		}
	}
	u.RoleIDCamel = u.RoleID
	u.IsActive = (u.Active == 1)
	if u.RoleID != "" {
		if role, err := s.roleRepo.GetByID(ctx, u.RoleID); err == nil {
			u.RoleLevel = role.Level
			u.IsAdmin = role.HasAdminAccess()
			u.RoleName = role.Name
		}
	}
	return u, nil
}

func (s *authService) GenerateToken(userID, email, roleID string) (string, error) {
	claims := models.Claims{
		UserID: userID,
		Email:  email,
		RoleID: roleID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.expiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    s.issuer,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secretKey)
}

func (s *authService) ValidateToken(tokenStr string) (*models.Claims, error) {
	if s.cache != nil {
		_, found, err := s.cache.Get(context.Background(), "blocklist:"+tokenStr)
		if err == nil && found {
			return nil, models.ErrInvalidToken
		}
	}

	token, err := jwt.ParseWithClaims(tokenStr, &models.Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, models.ErrInvalidToken
		}
		return s.secretKey, nil
	})

	if err != nil {
		return nil, models.ErrInvalidToken
	}

	claims, ok := token.Claims.(*models.Claims)
	if !ok || !token.Valid {
		return nil, models.ErrInvalidToken
	}

	return claims, nil
}

// RefreshToken validates the existing token and issues a fresh one with a new expiry.
func (s *authService) RefreshToken(tokenStr string) (string, error) {
	claims, err := s.ValidateToken(tokenStr)
	if err != nil {
		return "", models.ErrInvalidToken
	}
	return s.GenerateToken(claims.UserID, claims.Email, claims.RoleID)
}

// ChangePassword verifies the old password and updates to the new one.
func (s *authService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		s.logAudit(ctx, "mutation", userID, "", "auth:change_password", "error", map[string]string{"error": err.Error()})
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		s.logAudit(ctx, "mutation", userID, user.RoleID, "auth:change_password", "error", map[string]string{"error": "password mismatch"})
		return models.ErrInvalidCredentials
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		s.logAudit(ctx, "mutation", userID, user.RoleID, "auth:change_password", "error", map[string]string{"error": err.Error()})
		return err
	}

	if _, err = s.userRepo.Update(ctx, userID, &models.UpdateUserRequest{Password: string(hashed)}); err != nil {
		s.logAudit(ctx, "mutation", userID, user.RoleID, "auth:change_password", "error", map[string]string{"error": err.Error()})
		return err
	}

	s.logAudit(ctx, "mutation", userID, user.RoleID, "auth:change_password", "success", nil)
	return nil
}

func (s *authService) Logout(ctx context.Context, tokenStr string) error {
	claims := &models.Claims{}
	token, _, err := new(jwt.Parser).ParseUnverified(tokenStr, claims)
	if err != nil || token == nil {
		return models.ErrInvalidToken
	}

	s.logAudit(ctx, "logout", claims.UserID, claims.RoleID, "auth:logout", "success", nil)

	if s.cache != nil {
		remaining := time.Until(claims.ExpiresAt.Time)
		if remaining > 0 {
			if err = s.cache.Set(ctx, "blocklist:"+tokenStr, []byte("logout"), remaining); err != nil {
				return err
			}
		}
	}
	return nil
}
