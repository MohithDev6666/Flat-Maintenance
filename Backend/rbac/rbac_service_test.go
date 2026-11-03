package rbac_test

import (
	"testing"

	"github.com/trideadmin/rbac"
)

func TestConfigDefaults(t *testing.T) {
	cfg := &rbac.Config{
		TableUsers: "custom_users",
	}

	if cfg.GetTableUsers() != "custom_users" {
		t.Errorf("expected custom_users, got %s", cfg.GetTableUsers())
	}
	if cfg.GetTableRoles() != rbac.DefaultTableRoles {
		t.Errorf("expected %s, got %s", rbac.DefaultTableRoles, cfg.GetTableRoles())
	}
	if cfg.GetTableModules() != rbac.DefaultTableModules {
		t.Errorf("expected %s, got %s", rbac.DefaultTableModules, cfg.GetTableModules())
	}
	if cfg.GetTableAuditLogs() != rbac.DefaultTableAuditLogs {
		t.Errorf("expected %s, got %s", rbac.DefaultTableAuditLogs, cfg.GetTableAuditLogs())
	}

	// Test MongoDB legacy fallback
	cfgMongo := &rbac.Config{
		CollectionRoles: "mongo_roles",
	}
	if cfgMongo.GetTableRoles() != "mongo_roles" {
		t.Errorf("expected mongo_roles, got %s", cfgMongo.GetTableRoles())
	}
}

func TestNilConnections(t *testing.T) {
	_, err := rbac.NewWithMongo(nil, nil)
	if err == nil {
		t.Errorf("expected error when mongo db is nil")
	}

	_, err = rbac.NewWithPostgres(nil, nil)
	if err == nil {
		t.Errorf("expected error when pgx pool is nil")
	}
}
