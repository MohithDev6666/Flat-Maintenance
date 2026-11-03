package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresTables holds configurable table names for PostgreSQL.
type PostgresTables struct {
	Users     string
	Roles     string
	Modules   string
	AuditLogs string
}

// DefaultPostgresTables returns the default table names.
func DefaultPostgresTables() PostgresTables {
	return PostgresTables{
		Users:     "rbac_users",
		Roles:     "rbac_roles",
		Modules:   "rbac_modules",
		AuditLogs: "rbac_audit_logs",
	}
}

// cleanIdentifier strips dots and special characters for generating safe index names.
func cleanIdentifier(name string) string {
	r := strings.NewReplacer(".", "_", "-", "_", " ", "_", "\"", "")
	return r.Replace(name)
}

// MigratePostgresSchema creates all required tables and indexes if they do not exist.
func MigratePostgresSchema(ctx context.Context, pool *pgxpool.Pool, tables PostgresTables) error {
	if tables.Users == "" {
		tables.Users = "rbac_users"
	}
	if tables.Roles == "" {
		tables.Roles = "rbac_roles"
	}
	if tables.Modules == "" {
		tables.Modules = "rbac_modules"
	}
	if tables.AuditLogs == "" {
		tables.AuditLogs = "rbac_audit_logs"
	}

	cleanUsers := cleanIdentifier(tables.Users)
	cleanRoles := cleanIdentifier(tables.Roles)
	cleanModules := cleanIdentifier(tables.Modules)
	cleanAudit := cleanIdentifier(tables.AuditLogs)

	queries := []string{
		// 1. Modules table
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s (
			id VARCHAR(64) PRIMARY KEY,
			key VARCHAR(100) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			is_master BOOLEAN NOT NULL DEFAULT FALSE,
			permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);`, tables.Modules),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_key ON %s(key);`, cleanModules, tables.Modules),

		// 2. Roles table
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) UNIQUE NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			level INT NOT NULL DEFAULT 0,
			is_admin BOOLEAN NOT NULL DEFAULT FALSE,
			active INT NOT NULL DEFAULT 1,
			permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);`, tables.Roles),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_name ON %s(name);`, cleanRoles, tables.Roles),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_level ON %s(level);`, cleanRoles, tables.Roles),

		// 3. Users table
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			phone VARCHAR(50) NOT NULL DEFAULT '',
			role_id VARCHAR(64) NOT NULL,
			active INT NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);`, tables.Users),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_email ON %s(email);`, cleanUsers, tables.Users),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_role_id ON %s(role_id);`, cleanUsers, tables.Users),

		// 4. Audit Logs table
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s (
			id BIGSERIAL PRIMARY KEY,
			type VARCHAR(50) NOT NULL,
			subject_id VARCHAR(64) NOT NULL DEFAULT '',
			role_id VARCHAR(64) NOT NULL DEFAULT '',
			permission VARCHAR(100) NOT NULL DEFAULT '',
			result VARCHAR(50) NOT NULL DEFAULT '',
			metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);`, tables.AuditLogs),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_timestamp ON %s(timestamp);`, cleanAudit, tables.AuditLogs),
		fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_subject_id ON %s(subject_id);`, cleanAudit, tables.AuditLogs),
	}

	for _, q := range queries {
		if _, err := pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("migrating schema failed on statement [%s]: %w", q, err)
		}
	}

	return nil
}
