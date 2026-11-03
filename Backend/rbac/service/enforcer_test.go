package service_test

import (
	"context"
	"testing"

	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/service"
)

// mockRoleService implements service.RoleService for testing
type mockRoleService struct {
	roles map[string]*models.Role
}

func (m *mockRoleService) Create(ctx context.Context, req models.CreateRoleRequest) (*models.Role, error) {
	return nil, nil
}
func (m *mockRoleService) GetByID(ctx context.Context, id string) (*models.Role, error) {
	if r, ok := m.roles[id]; ok {
		return r, nil
	}
	return nil, models.ErrRoleNotFound
}
func (m *mockRoleService) GetByName(ctx context.Context, name string) (*models.Role, error) {
	for _, r := range m.roles {
		if r.Name == name {
			return r, nil
		}
	}
	return nil, models.ErrRoleNotFound
}
func (m *mockRoleService) GetAll(ctx context.Context) ([]models.Role, error) {
	list := make([]models.Role, 0, len(m.roles))
	for _, r := range m.roles {
		list = append(list, *r)
	}
	return list, nil
}
func (m *mockRoleService) Update(ctx context.Context, id string, req models.UpdateRoleRequest) (*models.Role, error) {
	return nil, nil
}
func (m *mockRoleService) Delete(ctx context.Context, id string) error {
	return nil
}
func (m *mockRoleService) UpdatePermissions(ctx context.Context, id string, perms []models.PermissionObject) error {
	return nil
}

// mockModuleService implements service.ModuleService for testing
type mockModuleService struct {
	modules []models.Module
}

func (m *mockModuleService) Create(ctx context.Context, req models.CreateModuleRequest) (*models.Module, error) {
	return nil, nil
}
func (m *mockModuleService) GetByID(ctx context.Context, id string) (*models.Module, error) {
	for _, mod := range m.modules {
		if mod.ID == id {
			return &mod, nil
		}
	}
	return nil, models.ErrModuleNotFound
}
func (m *mockModuleService) GetByKey(ctx context.Context, key string) (*models.Module, error) {
	for _, mod := range m.modules {
		if mod.Key == key {
			return &mod, nil
		}
	}
	return nil, models.ErrModuleNotFound
}
func (m *mockModuleService) GetAll(ctx context.Context) ([]models.Module, error) {
	return m.modules, nil
}
func (m *mockModuleService) Update(ctx context.Context, id string, req models.UpdateModuleRequest) (*models.Module, error) {
	return nil, nil
}
func (m *mockModuleService) Delete(ctx context.Context, id string) error {
	return nil
}

func TestEnforcer(t *testing.T) {
	ctx := context.Background()

	mockMods := &mockModuleService{
		modules: []models.Module{
			{ID: "mod-1", Key: "users", Name: "Users"},
			{ID: "mod-2", Key: "billing", Name: "Billing"},
		},
	}

	adminRole := &models.Role{
		ID:      "role-admin",
		Name:    "Admin",
		IsAdmin: true,
		Level:   1,
	}

	editorRole := &models.Role{
		ID:      "role-editor",
		Name:    "Editor",
		Level:   3,
		Permissions: []models.PermissionObject{
			{ModuleKey: "users", Add: true, Edit: true, View: true, Delete: false},
			{ModuleKey: "billing", View: true},
		},
	}

	mockRoles := &mockRoleService{
		roles: map[string]*models.Role{
			"role-admin":  adminRole,
			"role-editor": editorRole,
		},
	}

	checker := service.NewEnforcer(mockRoles, mockMods, audit.NewNoopLogger())

	// 1. Admin can do everything
	adminSubj := models.Subject{UserID: "u1", RoleID: "role-admin"}
	can, err := checker.Can(ctx, adminSubj, "users:delete")
	if err != nil || !can {
		t.Errorf("admin should have users:delete, got can=%v err=%v", can, err)
	}
	canBilling, err := checker.Can(ctx, adminSubj, "billing:delete")
	if err != nil || !canBilling {
		t.Errorf("admin should have billing:delete, got can=%v err=%v", canBilling, err)
	}

	// 2. Editor permissions
	editorSubj := models.Subject{UserID: "u2", RoleID: "role-editor"}

	// users:add -> allowed
	canAdd, err := checker.Can(ctx, editorSubj, "users:add")
	if err != nil || !canAdd {
		t.Errorf("editor should have users:add, got can=%v err=%v", canAdd, err)
	}

	// users:create (action alias for add) -> allowed
	canCreate, err := checker.Can(ctx, editorSubj, "users:create")
	if err != nil || !canCreate {
		t.Errorf("editor should have users:create via alias, got can=%v err=%v", canCreate, err)
	}

	// users:delete -> denied
	canDel, err := checker.Can(ctx, editorSubj, "users:delete")
	if err != nil || canDel {
		t.Errorf("editor should NOT have users:delete, got can=%v err=%v", canDel, err)
	}

	// billing:view -> allowed
	canViewBilling, err := checker.Can(ctx, editorSubj, "billing:view")
	if err != nil || !canViewBilling {
		t.Errorf("editor should have billing:view, got can=%v err=%v", canViewBilling, err)
	}

	// billing:edit -> denied
	canEditBilling, err := checker.Can(ctx, editorSubj, "billing:edit")
	if err != nil || canEditBilling {
		t.Errorf("editor should NOT have billing:edit, got can=%v err=%v", canEditBilling, err)
	}

	// 3. CanAny and CanAll
	canAny, err := checker.CanAny(ctx, editorSubj, "billing:edit", "billing:view")
	if err != nil || !canAny {
		t.Errorf("CanAny should be true when one permission matches")
	}

	canAll, err := checker.CanAll(ctx, editorSubj, "users:add", "billing:edit")
	if err != nil || canAll {
		t.Errorf("CanAll should be false when one permission is missing")
	}

	// 4. Invalid subject
	_, err = checker.Can(ctx, models.Subject{}, "users:view")
	if err != models.ErrInvalidSubject {
		t.Errorf("expected ErrInvalidSubject, got %v", err)
	}
}
