package service

import (
	"context"
	"errors"
	"strings"

	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/repository"
	"golang.org/x/crypto/bcrypt"
)

// UserService defines business logic for user management.
type UserService interface {
	Create(ctx context.Context, req models.CreateUserRequest) (*models.User, error)
	GetByID(ctx context.Context, id string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetAll(ctx context.Context) ([]models.User, error)
	Update(ctx context.Context, id string, req models.UpdateUserRequest) (*models.User, error)
	Delete(ctx context.Context, id string) error
	UpdateRole(ctx context.Context, userID, roleID string) error
}

type userService struct {
	auditHelper
	repo     repository.UserRepository
	roleRepo repository.RoleRepository
	modRepo  repository.ModuleRepository
}

// NewUserService creates a new UserService backed by the given repository.
func NewUserService(
	repo repository.UserRepository,
	roleRepo repository.RoleRepository,
	modRepo repository.ModuleRepository,
	auditLogger audit.AuditLogger,
) UserService {
	return &userService{
		auditHelper: auditHelper{auditLogger: auditLogger},
		repo:        repo,
		roleRepo:    roleRepo,
		modRepo:     modRepo,
	}
}

func (s *userService) Create(ctx context.Context, req models.CreateUserRequest) (*models.User, error) {
	// Validate required fields.
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Name == "" || req.Email == "" || req.Password == "" {
		return nil, models.ErrInvalidInput
	}

	rID := req.RoleID
	if rID == "" {
		rID = req.RoleIDCamel
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := &models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashed),
		Phone:    req.Phone,
		RoleID:   rID,
		Active:   1,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		s.logAudit(ctx, "users:create", "error", map[string]string{"email": req.Email, "error": err.Error()})
		return nil, err
	}
	s.logAudit(ctx, "users:create", "success", map[string]string{"email": req.Email, "id": user.ID})

	user.RoleIDCamel = user.RoleID
	user.IsActive = (user.Active == 1)

	if user.RoleID != "" {
		if role, err := s.roleRepo.GetByID(ctx, user.RoleID); err == nil {
			user.RoleLevel = role.Level
			user.IsAdmin = role.HasAdminAccess()
			user.RoleName = role.Name
		}
	}
	return user, nil
}

func (s *userService) GetByID(ctx context.Context, id string) (*models.User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
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

func (s *userService) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	u, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
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

// GetAll returns users with their role level and admin status populated.
func (s *userService) GetAll(ctx context.Context) ([]models.User, error) {
	users, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	roles, err := s.roleRepo.GetAll(ctx)
	type roleInfo struct {
		name    string
		level   int
		isAdmin bool
	}
	roleMap := make(map[string]roleInfo, len(roles))
	if err == nil {
		for _, r := range roles {
			roleMap[r.ID] = roleInfo{name: r.Name, level: r.Level, isAdmin: r.HasAdminAccess()}
		}
	}

	for i := range users {
		users[i].RoleIDCamel = users[i].RoleID
		users[i].IsActive = (users[i].Active == 1)
		if ri, exists := roleMap[users[i].RoleID]; exists {
			users[i].RoleLevel = ri.level
			users[i].IsAdmin = ri.isAdmin
			users[i].RoleName = ri.name
		}
	}
	return users, nil
}

func (s *userService) Update(ctx context.Context, id string, req models.UpdateUserRequest) (*models.User, error) {
	// Validate: new email must not already be taken by another user.
	if req.Email != "" {
		req.Email = strings.TrimSpace(strings.ToLower(req.Email))
		existing, err := s.repo.GetByEmail(ctx, req.Email)
		if err == nil && existing != nil && existing.ID != id {
			return nil, models.ErrEmailAlreadyTaken
		}
	}

	if req.RoleID == "" && req.RoleIDCamel != "" {
		req.RoleID = req.RoleIDCamel
	}

	if req.Active == nil && req.IsActive != nil {
		act := 0
		if *req.IsActive {
			act = 1
		}
		req.Active = &act
	}

	// Hash new password in service layer before passing to repo.
	if req.Password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		req.Password = string(hashed)
	}

	updated, err := s.repo.Update(ctx, id, &req)
	if err != nil {
		s.logAudit(ctx, "users:update", "error", map[string]string{"id": id, "error": err.Error()})
		if errors.Is(err, models.ErrEmailAlreadyTaken) {
			return nil, models.ErrEmailAlreadyTaken
		}
		return nil, err
	}

	if req.RoleID != "" {
		_ = s.repo.UpdateRole(ctx, id, req.RoleID)
		updated.RoleID = req.RoleID
	}

	s.logAudit(ctx, "users:update", "success", map[string]string{"id": id, "email": req.Email})

	updated.RoleIDCamel = updated.RoleID
	updated.IsActive = (updated.Active == 1)

	if updated.RoleID != "" {
		if role, err := s.roleRepo.GetByID(ctx, updated.RoleID); err == nil {
			updated.RoleLevel = role.Level
			updated.IsAdmin = role.HasAdminAccess()
			updated.RoleName = role.Name
		}
	}
	return updated, nil
}

func (s *userService) Delete(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		s.logAudit(ctx, "users:delete", "error", map[string]string{"id": id, "error": err.Error()})
		return err
	}
	s.logAudit(ctx, "users:delete", "success", map[string]string{"id": id})
	return nil
}

func (s *userService) UpdateRole(ctx context.Context, userID, roleID string) error {
	if err := s.repo.UpdateRole(ctx, userID, roleID); err != nil {
		s.logAudit(ctx, "users:role", "error", map[string]string{"user_id": userID, "role_id": roleID, "error": err.Error()})
		return err
	}
	s.logAudit(ctx, "users:role", "success", map[string]string{"user_id": userID, "role_id": roleID})
	return nil
}
