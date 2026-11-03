package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/repository"
)

// CacheBackend defines cache operations for RBAC services.
type CacheBackend interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// RoleService defines business logic for role management.
type RoleService interface {
	Create(ctx context.Context, req models.CreateRoleRequest) (*models.Role, error)
	GetByID(ctx context.Context, id string) (*models.Role, error)
	GetByName(ctx context.Context, name string) (*models.Role, error)
	GetAll(ctx context.Context) ([]models.Role, error)
	Update(ctx context.Context, id string, req models.UpdateRoleRequest) (*models.Role, error)
	Delete(ctx context.Context, id string) error
	UpdatePermissions(ctx context.Context, id string, perms []models.PermissionObject) error
}

type roleService struct {
	auditHelper
	repo    repository.RoleRepository
	modRepo repository.ModuleRepository
	cache   CacheBackend
	ttl     time.Duration
}

// NewRoleService creates a new RoleService backed by the given repository and optional cache.
func NewRoleService(repo repository.RoleRepository, cache CacheBackend, ttl time.Duration, auditLogger audit.AuditLogger) RoleService {
	return NewRoleServiceWithModules(repo, nil, cache, ttl, auditLogger)
}

// NewRoleServiceWithModules creates a RoleService that dynamically queries registered modules for admin permissions.
func NewRoleServiceWithModules(repo repository.RoleRepository, modRepo repository.ModuleRepository, cache CacheBackend, ttl time.Duration, auditLogger audit.AuditLogger) RoleService {
	if ttl == 0 {
		ttl = 5 * time.Minute
	}
	return &roleService{
		auditHelper: auditHelper{auditLogger: auditLogger},
		repo:        repo,
		modRepo:     modRepo,
		cache:       cache,
		ttl:         ttl,
	}
}

func (s *roleService) getModuleKeys(ctx context.Context) []string {
	if s.modRepo == nil {
		return []string{"users", "roles", "modules"}
	}
	mods, err := s.modRepo.GetAll(ctx)
	if err != nil || len(mods) == 0 {
		return []string{"users", "roles", "modules"}
	}
	keys := make([]string, 0, len(mods))
	for _, m := range mods {
		keys = append(keys, m.Key)
	}
	return keys
}

func (s *roleService) Create(ctx context.Context, req models.CreateRoleRequest) (*models.Role, error) {
	// Validate required fields.
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return nil, models.ErrInvalidInput
	}

	// Use MaxLevel instead of GetAll to avoid loading all roles just to find the max.
	maxLvl, err := s.repo.MaxLevel(ctx)
	if err != nil {
		return nil, err
	}
	nextLevel := maxLvl + 1

	perms := models.ParseRawPermissions(req.Permissions)

	role := &models.Role{
		Name:        req.Name,
		Description: req.Description,
		Level:       nextLevel,
		IsAdmin:     req.IsAdmin || (nextLevel == 1),
		Active:      req.Active,
		Permissions: perms,
	}
	if role.Active == 0 {
		role.Active = 1
	}
	if err := s.repo.Create(ctx, role); err != nil {
		s.logAudit(ctx, "roles:create", "error", map[string]string{"name": req.Name, "error": err.Error()})
		return nil, err
	}
	role.PopulateComputed(s.getModuleKeys(ctx)...)
	s.logAudit(ctx, "roles:create", "success", map[string]string{"name": req.Name, "id": role.ID})
	return role, nil
}

func (s *roleService) GetByID(ctx context.Context, id string) (*models.Role, error) {
	cacheKey := fmt.Sprintf("rbac:role:%s", id)

	if s.cache != nil {
		if data, ok, err := s.cache.Get(ctx, cacheKey); err == nil && ok {
			var role models.Role
			if err := json.Unmarshal(data, &role); err == nil {
				role.PopulateComputed(s.getModuleKeys(ctx)...)
				return &role, nil
			}
		}
	}

	role, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		if data, err := json.Marshal(role); err == nil {
			_ = s.cache.Set(ctx, cacheKey, data, s.ttl)
		}
	}

	role.PopulateComputed(s.getModuleKeys(ctx)...)
	return role, nil
}

// GetByName retrieves a role by its unique name.
func (s *roleService) GetByName(ctx context.Context, name string) (*models.Role, error) {
	role, err := s.repo.GetByName(ctx, name)
	if err != nil {
		return nil, err
	}
	role.PopulateComputed(s.getModuleKeys(ctx)...)
	return role, nil
}

// GetAll returns roles sorted by level ascending.
func (s *roleService) GetAll(ctx context.Context) ([]models.Role, error) {
	roles, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	modKeys := s.getModuleKeys(ctx)
	for i := range roles {
		roles[i].PopulateComputed(modKeys...)
	}
	return roles, nil
}

func (s *roleService) Update(ctx context.Context, id string, req models.UpdateRoleRequest) (*models.Role, error) {
	req.Level = 0 // Level is immutable and managed sequentially on create
	if len(req.Permissions) > 0 {
		req.ParsedPerms = models.ParseRawPermissions(req.Permissions)
	}
	role, err := s.repo.Update(ctx, id, &req)
	if err != nil {
		s.logAudit(ctx, "roles:update", "error", map[string]string{"id": id, "error": err.Error()})
		return nil, err
	}

	s.logAudit(ctx, "roles:update", "success", map[string]string{"id": id, "name": req.Name})
	s.invalidateCache(ctx, id)
	role.PopulateComputed(s.getModuleKeys(ctx)...)
	return role, nil
}

func (s *roleService) Delete(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		s.logAudit(ctx, "roles:delete", "error", map[string]string{"id": id, "error": err.Error()})
		return err
	}

	s.logAudit(ctx, "roles:delete", "success", map[string]string{"id": id})
	s.invalidateCache(ctx, id)
	return nil
}

func (s *roleService) UpdatePermissions(ctx context.Context, id string, perms []models.PermissionObject) error {
	if err := s.repo.UpdatePermissions(ctx, id, perms); err != nil {
		s.logAudit(ctx, "roles:permissions", "error", map[string]string{"id": id, "error": err.Error()})
		return err
	}

	s.logAudit(ctx, "roles:permissions", "success", map[string]string{"id": id})
	s.invalidateCache(ctx, id)
	return nil
}

func (s *roleService) invalidateCache(ctx context.Context, id string) {
	if s.cache != nil {
		cacheKey := fmt.Sprintf("rbac:role:%s", id)
		_ = s.cache.Delete(ctx, cacheKey)
	}
}
