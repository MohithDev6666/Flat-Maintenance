package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/repository"
)

// CoreRBACModules defines the built-in essential modules required by any RBAC installation.
var CoreRBACModules = []models.CreateModuleRequest{
	{Key: "users", Name: "Users Management", Description: "System user management and assignments", IsMaster: true, Permissions: []string{"read", "create", "update", "delete"}},
	{Key: "roles", Name: "Roles & Permissions", Description: "System roles and rights management", IsMaster: true, Permissions: []string{"read", "create", "update", "delete"}},
	{Key: "modules", Name: "Module Registry", Description: "System module registry and dynamic scopes", IsMaster: true, Permissions: []string{"read", "create", "update", "delete"}},
}

// SeedDefaults idempotently ensures the core RBAC modules and Super Admin role exist.
// It also seeds any application-specific modules and roles supplied by the host application.
func SeedDefaults(
	ctx context.Context,
	roleRepo repository.RoleRepository,
	modRepo repository.ModuleRepository,
	appModules []models.CreateModuleRequest,
	appRoles ...models.Role,
) error {
	// ── Step 1: Ensure core modules + host application modules ────────────────
	allModules := make([]models.CreateModuleRequest, 0, len(CoreRBACModules)+len(appModules))
	allModules = append(allModules, CoreRBACModules...)
	allModules = append(allModules, appModules...)

	seededMods := make([]*models.Module, 0, len(allModules))

	for _, cm := range allModules {
		mod, err := modRepo.GetByKey(ctx, cm.Key)
		if err == nil {
			seededMods = append(seededMods, mod)
			continue
		}
		if !errors.Is(err, models.ErrModuleNotFound) {
			return fmt.Errorf("SeedDefaults: look up module %q: %w", cm.Key, err)
		}

		newMod := &models.Module{
			Key:         cm.Key,
			Name:        cm.Name,
			Description: cm.Description,
			IsMaster:    cm.IsMaster,
			Permissions: cm.Permissions,
		}
		if len(newMod.Permissions) == 0 {
			newMod.Permissions = []string{"read", "create", "update", "delete"}
		}
		if createErr := modRepo.Create(ctx, newMod); createErr != nil {
			if existing, lookupErr := modRepo.GetByKey(ctx, cm.Key); lookupErr == nil {
				seededMods = append(seededMods, existing)
				continue
			}
			return fmt.Errorf("SeedDefaults: create module %q: %w", cm.Key, createErr)
		}
		seededMods = append(seededMods, newMod)
	}

	// ── Step 2: Ensure Super Admin role ──────────────────────────────────────
	const adminRoleName = "Super Admin"

	superAdminRole, err := roleRepo.GetByName(ctx, adminRoleName)
	if err != nil && !errors.Is(err, models.ErrRoleNotFound) {
		return fmt.Errorf("SeedDefaults: look up role %q: %w", adminRoleName, err)
	}

	if superAdminRole == nil {
		perms := make([]models.PermissionObject, 0, len(seededMods))
		for _, sm := range seededMods {
			perms = append(perms, models.PermissionObject{
				ModuleKey: sm.ID,
				View:      true,
				Add:       true,
				Edit:      true,
				Delete:    true,
			})
		}

		role := &models.Role{
			Name:        adminRoleName,
			Description: "Full system access. Level 1 bypasses all permission checks.",
			Level:       1,
			IsAdmin:     true,
			Active:      1,
			Permissions: perms,
		}

		if err := roleRepo.Create(ctx, role); err != nil && !errors.Is(err, models.ErrRoleAlreadyExists) {
			return fmt.Errorf("SeedDefaults: create role %q: %w", adminRoleName, err)
		}
	}

	// ── Step 3: Ensure any application-provided roles ────────────────────────
	for _, ar := range appRoles {
		if _, err := roleRepo.GetByName(ctx, ar.Name); err == nil {
			continue // Role already exists
		} else if !errors.Is(err, models.ErrRoleNotFound) {
			return fmt.Errorf("SeedDefaults: look up role %q: %w", ar.Name, err)
		}

		roleCopy := ar
		if roleCopy.Active == 0 {
			roleCopy.Active = 1
		}
		if err := roleRepo.Create(ctx, &roleCopy); err != nil && !errors.Is(err, models.ErrRoleAlreadyExists) {
			return fmt.Errorf("SeedDefaults: create role %q: %w\n", roleCopy.Name, err)
		}
	}

	log.Printf("[rbac] seeded %d modules and ensured default system roles", len(seededMods))
	return nil
}
