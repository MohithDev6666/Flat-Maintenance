package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	ownerRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/repo"
	tenantRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/repo"
	userLinkRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type userLinkServiceImpl struct {
	userLinkRepo userLinkRepo.UserLinks
	ownerRepo    ownerRepo.Owners
	tenantRepo   tenantRepo.Tenants
	auditRepo    auditRepo.Audit
}

func NewUserLinkService(userLinkRepo userLinkRepo.UserLinks, ownerRepo ownerRepo.Owners, tenantRepo tenantRepo.Tenants, auditRepo auditRepo.Audit) UserLinkService {
	return &userLinkServiceImpl{
		userLinkRepo: userLinkRepo,
		ownerRepo:    ownerRepo,
		tenantRepo:   tenantRepo,
		auditRepo:    auditRepo,
	}
}

func (us *userLinkServiceImpl) GetUserLink(ctx context.Context, userID string) (*models.UserLink, error) {
	profile, err := us.userLinkRepo.GetUserLinkByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	roleID, admin, err := us.currentRole(ctx, userID)
	if err != nil {
		return nil, err
	}
	if profile.RoleID != roleID || (profile.Kind == "admin") != admin {
		return nil, ErrStaleProfile
	}
	switch profile.Kind {
	case "admin":
		if profile.OwnerID != "" || profile.TenantID != "" {
			return nil, ErrStaleProfile
		}
	case "owner":
		if profile.OwnerID == "" || profile.TenantID != "" {
			return nil, ErrStaleProfile
		}
		owner, err := us.ownerRepo.GetOwnerByID(ctx, profile.OwnerID)
		if err != nil {
			return nil, err
		}
		if utils.Deref(owner.FlatID) == "" {
			return nil, ErrStaleProfile
		}
	case "tenant":
		if profile.TenantID == "" || profile.OwnerID != "" {
			return nil, ErrStaleProfile
		}
		if _, err := us.tenantRepo.GetTenantByID(ctx, profile.TenantID); err != nil {
			return nil, err
		}
	default:
		return nil, ErrStaleProfile
	}
	return profile, nil
}

func (us *userLinkServiceImpl) GetAllUserLinks(ctx context.Context) ([]*models.UserLink, error) {
	return us.userLinkRepo.GetAllUserLinks(ctx)
}

func (us *userLinkServiceImpl) SetUserLink(ctx context.Context, actor, userID, kind, ownerID, tenantID string) (*models.UserLink, error) {
	targetRole, admin, err := us.currentRole(ctx, userID)
	if err != nil {
		return nil, err
	}
	if (kind == "admin") != admin {
		return nil, fmt.Errorf("%w: kind must match the user's RBAC administrator status", ErrInvalidProfile)
	}
	switch kind {
	case "admin":
		if ownerID != "" || tenantID != "" {
			return nil, fmt.Errorf("%w: admin profiles cannot link to an owner or tenant", ErrInvalidProfile)
		}
	case "owner":
		if ownerID == "" || tenantID != "" {
			return nil, fmt.Errorf("%w: owner profile requires ownerId only", ErrInvalidProfile)
		}
		owner, err := us.ownerRepo.GetOwnerByID(ctx, ownerID)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				return nil, fmt.Errorf("%w: owner record does not exist", ErrInvalidProfile)
			}
			return nil, err
		}
		if utils.Deref(owner.FlatID) == "" {
			return nil, fmt.Errorf("%w: owner must be assigned to a flat before login", ErrInvalidProfile)
		}
	case "tenant":
		if tenantID == "" || ownerID != "" {
			return nil, fmt.Errorf("%w: tenant profile requires tenantId only", ErrInvalidProfile)
		}
		if _, err := us.tenantRepo.GetTenantByID(ctx, tenantID); err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				return nil, fmt.Errorf("%w: tenant record does not exist", ErrInvalidProfile)
			}
			return nil, err
		}
	default:
		return nil, fmt.Errorf("%w: kind must be admin, owner, or tenant", ErrInvalidProfile)
	}

	profile := &models.UserLink{UserID: userID, Kind: kind, OwnerID: ownerID, TenantID: tenantID, RoleID: targetRole}
	err = us.userLinkRepo.UpsertUserLink(ctx, profile)
	if mongo.IsDuplicateKeyError(err) {
		return nil, fmt.Errorf("%w: %v", ErrProfileConflict, err)
	}
	if err != nil {
		return nil, err
	}
	if err := us.auditRepo.CreateAuditEntry(ctx, models.NewAuditRecord(actor, "User", "Profile linked", userID, "", kind)); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Profile linked for user:", userID, "kind:", kind)
	return profile, nil
}

func (us *userLinkServiceImpl) DeleteUserLink(ctx context.Context, actor, userID string) error {
	if err := us.userLinkRepo.DeleteUserLink(ctx, userID); err != nil {
		return err
	}
	logs.InfoLogger.Println("Profile unlinked for user:", userID)
	return us.auditRepo.CreateAuditEntry(ctx, models.NewAuditRecord(actor, "User", "Profile unlinked", userID, "", ""))
}

func (us *userLinkServiceImpl) IsAdministrator(ctx context.Context, userID string) (bool, error) {
	_, admin, err := us.currentRole(ctx, userID)
	return admin, err
}

func (us *userLinkServiceImpl) ResolveResident(ctx context.Context, userID string) (*models.UserLink, bool, error) {
	admin, err := us.IsAdministrator(ctx, userID)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) || errors.Is(err, ErrInactiveIdentity) {
			return nil, false, utils.Forbidden("RBAC profile is unavailable")
		}
		logs.ErrorLogger.Println("RBAC profile lookup failed:", err)
		return nil, false, utils.Internal("RBAC profile lookup failed")
	}
	if admin {
		return &models.UserLink{UserID: userID, Kind: "admin"}, true, nil
	}
	profile, err := us.GetUserLink(ctx, userID)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) || errors.Is(err, ErrInactiveIdentity) || errors.Is(err, ErrStaleProfile) {
			return nil, false, utils.Forbidden("a valid owner or tenant profile link is required")
		}
		logs.ErrorLogger.Println("Application profile lookup failed:", err)
		return nil, false, utils.Internal("application profile lookup failed")
	}
	if profile.Kind != "owner" && profile.Kind != "tenant" {
		return nil, false, utils.Forbidden("a resident profile is required")
	}
	return profile, false, nil
}

// currentRole reads the user's RBAC role and whether it is an administrator role.
func (us *userLinkServiceImpl) currentRole(ctx context.Context, userID string) (string, bool, error) {
	user, err := us.userLinkRepo.GetRBACUser(ctx, userID)
	if err != nil {
		return "", false, err
	}
	if active, exists := user["active"]; exists && numeric(active) == 0 {
		return "", false, ErrInactiveIdentity
	}
	roleID := stringField(user, "role_id")
	if roleID == "" {
		roleID = stringField(user, "roleId")
	}
	if roleID == "" {
		return "", false, ErrInactiveIdentity
	}
	role, err := us.userLinkRepo.GetRBACRole(ctx, roleID)
	if err != nil {
		return "", false, err
	}
	if active, exists := role["active"]; exists && numeric(active) == 0 {
		return "", false, ErrInactiveIdentity
	}
	admin, _ := role["is_admin"].(bool)
	admin = admin || numeric(role["level"]) == 1
	return roleID, admin, nil
}

func stringField(doc bson.M, key string) string {
	value, _ := doc[key].(string)
	return strings.TrimSpace(value)
}

func numeric(value any) int {
	switch number := value.(type) {
	case int:
		return number
	case int32:
		return int(number)
	case int64:
		return int(number)
	case float64:
		return int(number)
	default:
		return 0
	}
}
