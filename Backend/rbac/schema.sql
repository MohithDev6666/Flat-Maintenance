-- ============================================================================
-- TRIDE RBAC - PostgreSQL Database Schema
-- ============================================================================
-- Note: When using `rbac.NewWithPostgres`, these tables and indexes are created
-- automatically if they do not already exist.
-- You may also execute this script directly via psql or your migration tool.
-- ============================================================================

-- 1. Modules Table
CREATE TABLE IF NOT EXISTS rbac_modules (
    id VARCHAR(64) PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_master BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_modules_key ON rbac_modules(key);

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS rbac_roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    level INT NOT NULL DEFAULT 0,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    active INT NOT NULL DEFAULT 1,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_roles_name ON rbac_roles(name);
CREATE INDEX IF NOT EXISTS idx_rbac_roles_level ON rbac_roles(level);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS rbac_users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    role_id VARCHAR(64) NOT NULL,
    active INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_users_email ON rbac_users(email);
CREATE INDEX IF NOT EXISTS idx_rbac_users_role_id ON rbac_users(role_id);

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS rbac_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    subject_id VARCHAR(64) NOT NULL DEFAULT '',
    role_id VARCHAR(64) NOT NULL DEFAULT '',
    permission VARCHAR(100) NOT NULL DEFAULT '',
    result VARCHAR(50) NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbac_audit_logs_timestamp ON rbac_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_logs_subject_id ON rbac_audit_logs(subject_id);
