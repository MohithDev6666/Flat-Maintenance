# Tride RBAC

A robust, enterprise-grade Role-Based Access Control (RBAC) package for Go. Built with **dual-engine storage support** for **PostgreSQL** (via `pgxpool.Pool`) and **MongoDB** (via `mongo.Database`), optional in-memory LRU or Redis caching, an asynchronous bounded audit worker pool, and single-call initialization facades (`rbac.NewWithPostgres`, `rbac.NewWithMongo`) that automatically handle schema/index creation and idempotent startup seeding.

**Module path:** `github.com/trideadmin/rbac`

---

## Table of Contents

1. [Features](#features)
2. [Package Architecture & File Structure](#package-architecture--file-structure)
3. [How It Works](#how-it-works)
4. [Usage Mode 1: Using Entire RBAC Package Directly (`go get`)](#usage-mode-1-using-entire-rbac-package-directly-go-get)
   - [Installation](#1-installation)
   - [Complete PostgreSQL Example (`main.go`)](#2-complete-postgresql-example-maingo)
   - [Complete MongoDB Example (`main.go`)](#3-complete-mongodb-example-maingo)
   - [Protecting Custom Business Routes](#4-protecting-custom-business-routes)
   - [Reading Authenticated Subject in Handlers](#5-reading-authenticated-subject-in-handlers)
5. [Usage Mode 2: Re-Using RBAC Code Files Directly (Monorepo / Clean Architecture)](#usage-mode-2-re-using-rbac-code-files-directly-monorepo--clean-architecture)
   - [Embedding RBAC Code into Your Project](#1-embedding-rbac-code-into-your-project)
   - [Framework-Agnostic / Non-HTTP Usage (gRPC, Fiber, Echo, Background Jobs)](#2-framework-agnostic--non-http-usage-grpc-fiber-echo-background-jobs)
   - [Programmatic Authentication & Token Validation](#3-programmatic-authentication--token-validation)
   - [Direct Service Layer Usage (`Users`, `Roles`, `Modules`)](#4-direct-service-layer-usage-users-roles-modules)
6. [PostgreSQL Schema & Migrations](#postgresql-schema--migrations)
7. [Configuration Reference](#configuration-reference)
8. [Middleware Reference](#middleware-reference)
9. [Permission String Format & Aliases](#permission-string-format--aliases)
10. [Caching (In-Memory & Redis)](#caching-in-memory--redis)
11. [Audit Logging](#audit-logging)
12. [Startup Seeding](#startup-seeding)
13. [Error Sentinels](#error-sentinels)
14. [Route Wiring Reference](#route-wiring-reference)

---

## Features

- **Dual Database Storage:** Native PostgreSQL (`github.com/jackc/pgx/v5/pgxpool`) and MongoDB (`go.mongodb.org/mongo-driver/mongo`). Switch engines with zero changes to business logic or routing.
- **Dependency Inversion (DIP):** Services and handlers consume standard repository interfaces (`UserRepository`, `RoleRepository`, `ModuleRepository`, `AuditLogger`).
- **Universal IDs:** Uniform string IDs (UUIDs for PostgreSQL, ObjectID hex or string for MongoDB).
- **Auto Schema & Index Migration:** Tables, columns, JSONB fields, and B-Tree indexes are created automatically on boot (`CREATE TABLE/INDEX IF NOT EXISTS`). A standalone `schema.sql` is also included for manual DDL or tools like Flyway and golang-migrate.
- **Dynamic Hierarchy & Admin Bypass:** Roles with `IsAdmin = true` or `Level = 1` bypass module lookups entirely for zero-overhead checks.
- **High-Performance Caching:** Optional In-Memory LRU or distributed Redis cache for permission lookups. Cache entries auto-invalidate on role mutations.
- **Bounded Audit Worker Pool:** 4 worker goroutines draining a 256-buffered channel to guarantee non-blocking request execution.
- **Ready-to-Use Handlers & Middleware:** Full Gin middleware suite (`Authenticate`, `Require`, `RequireAny`, `RequireAll`) + REST handlers for Auth, Users, Roles, and Modules.

---

## Package Architecture & File Structure

```
.
├── rbac_service.go          — rbac.NewWithPostgres(), rbac.NewWithMongo(), facade wiring
├── schema.sql               — PostgreSQL reference DDL script
├── go.mod                   — module github.com/trideadmin/rbac
├── audit/
│   ├── audit.go             — AuditLogger interface, PostgreSQL & MongoDB worker pools
│   └── audit_test.go        — Unit tests
├── cache/
│   ├── memory/              — In-process LRU cache backend (implements CacheBackend)
│   └── redis/               — Redis cache backend (implements CacheBackend)
├── handler/
│   ├── auth_handler.go      — Register, Login, Logout, Me, Permissions, Refresh, ChangePassword
│   ├── module_handler.go    — CRUD + role-scoped GetAll
│   ├── role_handler.go      — CRUD + UpdatePermissions
│   └── user_handler.go      — CRUD + UpdateRole
├── middleware/
│   └── gin/
│       └── middleware.go    — Authenticate(), Require(), RequireAny(), RequireAll()
├── models/                  — DTOs & Models: User, Role, Module, Subject, Claims, errors
├── repository/
│   ├── user_repository.go   — UserRepository interface + MongoDB implementation
│   ├── role_repository.go   — RoleRepository interface + MongoDB implementation
│   ├── module_repository.go — ModuleRepository interface + MongoDB implementation
│   ├── postgres_schema.go   — Auto DDL migration for PostgreSQL
│   ├── postgres_user_repo.go— PostgreSQL UserRepository (pgxpool)
│   ├── postgres_role_repo.go— PostgreSQL RoleRepository (pgxpool)
│   └── postgres_module_repo.go— PostgreSQL ModuleRepository (pgxpool)
├── service/                 — AuthService, RoleService, UserService, ModuleService, Checker
└── utils/
    ├── context.go           — Subject context propagation
    └── response.go          — Standard JSON response envelopes
```

---

## How It Works

```
HTTP Request
    │
    ▼
ginrbac.Authenticate()          — validates Bearer JWT, injects Subject into context
    │
    ▼
ginrbac.Require("module:action") — calls enforcer.Can(), checks role permissions
    │
    ▼
Handler                         — reads subject from ctx, calls service layer
    │
    ▼
Service Layer                   — UserService / RoleService / ModuleService / AuthService
    │
    ▼
Repository Interface            — UserRepository / RoleRepository / ModuleRepository
 ┌──────────────────────┴──────────────────────┐
 ▼                                             ▼
PostgreSQL (pgxpool)                         MongoDB
    │                                          │
    ▼                                          ▼
Postgres Audit Worker                      Mongo Audit Worker
```

---

## Usage Mode 1: Using Entire RBAC Package Directly (`go get`)

### 1. Installation

```bash
go get github.com/trideadmin/rbac
```

For PostgreSQL, ensure `pgx/v5` is available:
```bash
go get github.com/jackc/pgx/v5/pgxpool
```

---

### 2. Complete PostgreSQL Example (`main.go`)

Copy and paste this complete, runnable example into your application:

```go
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trideadmin/rbac"
	memorycache "github.com/trideadmin/rbac/cache/memory"
	ginrbac "github.com/trideadmin/rbac/middleware/gin"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/utils"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Connect to PostgreSQL via pgxpool
	connString := "postgres://postgres:postgres@localhost:5432/my_app?sslmode=disable"
	poolConfig, err := pgxpool.ParseConfig(connString)
	if err != nil {
		log.Fatalf("invalid postgres config: %v", err)
	}
	poolConfig.MaxConns = 25
	poolConfig.MinConns = 5

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("postgres ping failed: %v", err)
	}

	// 2. Initialize RBAC with PostgreSQL (creates tables & indexes automatically)
	rbacSvc, err := rbac.NewWithPostgres(pool, &rbac.Config{
		Cache:         memorycache.New(),
		CacheTTL:      5 * time.Minute,
		JWTSecretKey:  "my-super-secret-jwt-key",
		JWTExpiration: 24 * time.Hour,
		JWTIssuer:     "my-application-api",

		// Optional: Custom table names (defaults to rbac_users, rbac_roles, etc.)
		TableUsers:     "rbac_users",
		TableRoles:     "rbac_roles",
		TableModules:   "rbac_modules",
		TableAuditLogs: "rbac_audit_logs",

		// Seed initial business modules
		InitialModules: []models.CreateModuleRequest{
			{Key: "projects", Name: "Projects", Description: "Project Management", Permissions: []string{"read", "create", "update", "delete"}},
			{Key: "invoices", Name: "Invoices", Description: "Billing & Invoices", Permissions: []string{"read", "create", "update", "delete"}},
		},

		// Seed default roles
		InitialRoles: []models.Role{
			{
				Name:        "Project Manager",
				Description: "Can manage projects and view invoices",
				Level:       2,
				Permissions: models.PermissionStringsToObjects([]string{
					"projects:read", "projects:create", "projects:update",
					"invoices:read",
				}),
			},
		},
	})
	if err != nil {
		log.Fatalf("failed to initialize RBAC: %v", err)
	}

	// 3. Initialize Gin Router and RBAC Middleware
	router := gin.Default()
	rbacMW := ginrbac.New(rbacSvc.Checker, rbacSvc.Auth)

	// 4. Mount Built-in RBAC Routes
	mountRBACRoutes(router, rbacSvc, rbacMW)

	// 5. Mount Protected Custom Application Routes
	mountAppRoutes(router, rbacMW)

	log.Println("Server running on http://localhost:8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func mountRBACRoutes(r *gin.Engine, svc *rbac.RBACService, mw *ginrbac.Middleware) {
	v1 := r.Group("/api/v1")

	// Public Auth endpoints
	auth := v1.Group("/auth")
	auth.POST("/register", svc.AuthHandler.Register)
	auth.POST("/login", svc.AuthHandler.Login)
	auth.POST("/refresh", svc.AuthHandler.RefreshToken)

	// Protected Auth endpoints
	authProtected := auth.Group("", mw.Authenticate())
	authProtected.GET("/me", svc.AuthHandler.GetMe)
	authProtected.GET("/permissions", svc.AuthHandler.GetMyPermissions)
	authProtected.POST("/logout", svc.AuthHandler.Logout)
	authProtected.PUT("/password", svc.AuthHandler.ChangePassword)

	// RBAC Management endpoints
	adminGroup := v1.Group("", mw.Authenticate())

	// Modules
	modules := adminGroup.Group("/modules")
	modules.GET("", svc.ModuleHandler.GetAll)
	modules.POST("", mw.Require("modules:create"), svc.ModuleHandler.Create)
	modules.GET("/:id", mw.Require("modules:read"), svc.ModuleHandler.GetByID)
	modules.PUT("/:id", mw.Require("modules:update"), svc.ModuleHandler.Update)
	modules.DELETE("/:id", mw.Require("modules:delete"), svc.ModuleHandler.Delete)

	// Roles
	roles := adminGroup.Group("/roles", mw.Require("roles:read"))
	roles.GET("", svc.RoleHandler.GetAll)
	roles.POST("", mw.Require("roles:create"), svc.RoleHandler.Create)
	roles.GET("/:id", svc.RoleHandler.GetByID)
	roles.PUT("/:id", mw.Require("roles:update"), svc.RoleHandler.Update)
	roles.DELETE("/:id", mw.Require("roles:delete"), svc.RoleHandler.Delete)
	roles.PUT("/:id/permissions", mw.Require("roles:update"), svc.RoleHandler.UpdatePermissions)

	// Users
	users := adminGroup.Group("/users", mw.Require("users:read"))
	users.GET("", svc.UserHandler.GetAll)
	users.POST("", mw.Require("users:create"), svc.UserHandler.Create)
	users.GET("/:id", svc.UserHandler.GetByID)
	users.PUT("/:id", mw.Require("users:update"), svc.UserHandler.Update)
	users.DELETE("/:id", mw.Require("users:delete"), svc.UserHandler.Delete)
	users.PUT("/:id/role", mw.Require("users:update"), svc.UserHandler.UpdateRole)
}

func mountAppRoutes(r *gin.Engine, mw *ginrbac.Middleware) {
	api := r.Group("/api/v1", mw.Authenticate())

	// Protected projects endpoints
	projects := api.Group("/projects")
	projects.GET("", mw.Require("projects:read"), func(c *gin.Context) {
		subj, _ := utils.SubjectFromGin(c)
		c.JSON(http.StatusOK, gin.H{"message": "project list", "caller_user_id": subj.UserID})
	})
	projects.POST("", mw.Require("projects:create"), func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"message": "project created"})
	})

	// Protected invoices endpoints
	invoices := api.Group("/invoices")
	invoices.GET("", mw.RequireAny("invoices:read", "invoices:view"), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "invoices list"})
	})
}
```

---

### 3. Complete MongoDB Example (`main.go`)

To run with MongoDB instead, simply change step 1 & 2:

```go
package main

import (
	"context"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac"
	memorycache "github.com/trideadmin/rbac/cache/memory"
	ginrbac "github.com/trideadmin/rbac/middleware/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Connect to MongoDB
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
	if err != nil {
		log.Fatalf("failed to connect to mongodb: %v", err)
	}
	defer client.Disconnect(context.Background())
	db := client.Database("my_application")

	// 2. Initialize RBAC with MongoDB
	rbacSvc, err := rbac.NewWithMongo(db, &rbac.Config{
		Cache:         memorycache.New(),
		CacheTTL:      5 * time.Minute,
		JWTSecretKey:  "my-super-secret-jwt-key",
		JWTExpiration: 24 * time.Hour,
	})
	if err != nil {
		log.Fatalf("failed to initialize RBAC: %v", err)
	}

	// 3. Setup Gin router (identical to PostgreSQL!)
	router := gin.Default()
	rbacMW := ginrbac.New(rbacSvc.Checker, rbacSvc.Auth)

	// Register routes as shown in the PostgreSQL example...
	_ = rbacMW
	router.Run(":8080")
}
```

---

### 4. Protecting Custom Business Routes

```go
authMW := mw.Authenticate()

// Require a single permission
router.POST("/projects", authMW, mw.Require("projects:create"), handleCreateProject)

// Require ANY of the listed permissions
router.GET("/reports", authMW, mw.RequireAny("reports:read", "admin:all"), handleGetReports)

// Require ALL of the listed permissions
router.DELETE("/invoices/:id", authMW, mw.RequireAll("invoices:delete", "finance:approve"), handleDeleteInvoice)
```

---

### 5. Reading Authenticated Subject in Handlers

```go
// From gin.Context directly:
userID := c.GetString("userID")
userEmail := c.GetString("userEmail")
roleID := c.GetString("roleID")

// Or as a typed models.Subject struct:
subj, err := utils.SubjectFromGin(c)
if err == nil {
    log.Printf("User %s with Role %s requested action", subj.UserID, subj.RoleID)
}

// Or from standard context.Context (propagated down services):
subj, ok := utils.SubjectFromContext(c.Request.Context())
```

---

## Usage Mode 2: Re-Using RBAC Code Files Directly (Monorepo / Clean Architecture)

### 1. Embedding RBAC Code into Your Project

If you copy the package source into your own repository:

#### Option A: Keep module name with `go.mod` replace
```go
// in your app's go.mod
module myapp

go 1.25.0

require github.com/trideadmin/rbac v0.0.0

replace github.com/trideadmin/rbac => ./pkg/rbac
```

#### Option B: Embed into `internal/rbac`
Move the files to `myapp/internal/rbac`, and replace import statements from `github.com/trideadmin/rbac/...` to `myapp/internal/rbac/...`.

---

### 2. Framework-Agnostic / Non-HTTP Usage (gRPC, Fiber, Echo, Background Jobs)

RBAC is completely decoupled from Gin and HTTP. Use `Checker`, `Auth`, and repositories directly in gRPC interceptors, CLI scripts, or message queues:

```go
package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trideadmin/rbac"
	"github.com/trideadmin/rbac/models"
)

func CheckUserAccess(pool *pgxpool.Pool, userID, roleID, permission string) (bool, error) {
	ctx := context.Background()

	rbacSvc, err := rbac.NewWithPostgres(pool, &rbac.Config{
		JWTSecretKey: "secret-key",
	})
	if err != nil {
		return false, err
	}

	subj := models.Subject{
		UserID: userID,
		RoleID: roleID,
	}

	// 1. Check single permission
	allowed, err := rbacSvc.Checker.Can(ctx, subj, permission)
	if err != nil {
		return false, err
	}

	// 2. Fetch all effective flat permission strings for the subject
	perms, err := rbacSvc.Checker.GetPermissions(ctx, subj)
	log.Printf("Granted permissions: %v", perms)

	return allowed, nil
}
```

---

### 3. Programmatic Authentication & Token Validation

```go
// 1. Authenticate user credentials
loginResp, err := rbacSvc.Auth.Login(ctx, models.LoginRequest{
	Email:    "operator@example.com",
	Password: "password123",
})
if err != nil {
	log.Fatalf("login failed: %v", err)
}
log.Printf("JWT Token: %s", loginResp.Token)

// 2. Validate token in a gRPC interceptor or middleware
claims, err := rbacSvc.Auth.ValidateToken(loginResp.Token)
if err != nil {
	log.Fatalf("invalid token: %v", err)
}
log.Printf("Authenticated User: %s, Role: %s", claims.UserID, claims.RoleID)

// 3. Refresh token
newToken, err := rbacSvc.Auth.RefreshToken(loginResp.Token)

// 4. Fetch profile
profile, err := rbacSvc.Auth.GetProfile(ctx, claims.UserID)
```

---

### 4. Direct Service Layer Usage (`Users`, `Roles`, `Modules`)

```go
// Create a new role
newRole, err := rbacSvc.Roles.Create(ctx, models.CreateRoleRequest{
	Name:        "Billing Auditor",
	Description: "Read-only access to invoices and logs",
	Permissions: models.PermissionStringsToObjects([]string{"invoices:read", "audit:read"}),
})

// Assign role to user
err = rbacSvc.Users.UpdateRole(ctx, targetUserID, newRole.ID)

// Create a new module dynamically
newMod, err := rbacSvc.Modules.Create(ctx, models.CreateModuleRequest{
	Key:         "inventory",
	Name:        "Inventory Module",
	Description: "Warehouse stock management",
	Permissions: []string{"read", "create", "update", "delete"},
})
```

---

## PostgreSQL Schema & Migrations

When using `rbac.NewWithPostgres`, all tables and indexes are created automatically with `CREATE TABLE/INDEX IF NOT EXISTS`.

If you prefer applying schema migrations via your own CI/CD or migration runner, set `DisableAutoMigrate: true` in `Config` and execute [`schema.sql`](file:///C:/Users/venky/OneDrive/Desktop/tride/mvp_app/schema.sql):

```sql
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
```

---

## Configuration Reference

```go
rbac.Config{
    // Optional cache backend for role permission lookups (memorycache.New() or rediscache.New(rdb))
    Cache rbac.CacheBackend

    // Role cache expiration duration. Default: 5 minutes.
    CacheTTL time.Duration

    // Secret key for signing JWT tokens. Default: fallback dev secret.
    JWTSecretKey string

    // JWT token expiration duration. Default: 24 hours.
    JWTExpiration time.Duration

    // JWT "iss" claim. Default: "rbac-auth-engine".
    JWTIssuer string

    // Table / Collection naming overrides (defaults shown):
    TableUsers     string  // "rbac_users"
    TableRoles     string  // "rbac_roles"
    TableModules   string  // "rbac_modules"
    TableAuditLogs string  // "rbac_audit_logs"

    // Set to true to disable automatic schema execution on PostgreSQL startup
    DisableAutoMigrate bool

    // Application modules to automatically register and seed at startup
    InitialModules []models.CreateModuleRequest

    // Application roles to automatically ensure exist at startup
    InitialRoles []models.Role
}
```

---

## Middleware Reference

| Middleware Method | Description |
|-------------------|-------------|
| `mw.Authenticate()` | Verifies Bearer JWT, injects `models.Subject` into context and Gin keys (`userID`, `userEmail`, `roleID`). Returns `401 Unauthorized` on failure. |
| `mw.Require("mod:action")` | Verifies the subject has the specified permission. Admin bypasses all checks. Returns `403 Forbidden` on failure. |
| `mw.RequireAny("p1", "p2")` | Verifies the subject has at least one of the listed permissions. |
| `mw.RequireAll("p1", "p2")` | Verifies the subject has all of the listed permissions. |

---

## Permission String Format & Aliases

Permission checks follow the canonical format: **`moduleKey:action`** (case-insensitive).

Supported action aliases:

| Canonical | Aliases |
|-----------|---------|
| `read`    | `view` |
| `create`  | `add`, `write` |
| `update`  | `edit` |
| `delete`  | — |
| `*`       | `all`, `manage` (grants all actions) |

---

## Caching (In-Memory & Redis)

### In-Memory Cache
```go
import memorycache "github.com/trideadmin/rbac/cache/memory"

cfg := &rbac.Config{
    Cache:    memorycache.New(),
    CacheTTL: 5 * time.Minute,
}
```

### Redis Cache
```go
import (
    "github.com/redis/go-redis/v9"
    rediscache "github.com/trideadmin/rbac/cache/redis"
)

rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
cfg := &rbac.Config{
    Cache:    rediscache.New(rdb),
    CacheTTL: 10 * time.Minute,
}
```

Role updates and deletes automatically invalidate their cache entry.

---

## Audit Logging

All security mutations and checks are sent to the audit table/collection through an asynchronous **bounded worker pool** (4 workers, 256-entry buffer).

- **Non-blocking:** If the queue is full under heavy load, log entries are dropped rather than slowing down request processing.
- **Structured JSONB / BSON:** Stores `type`, `subject_id`, `role_id`, `permission`, `result`, `metadata`, and `timestamp`.

---

## Startup Seeding

When `rbac.NewWithPostgres()` or `rbac.NewWithMongo()` is called, it executes `service.SeedDefaults()` with a 30-second timeout:

1. Ensures core RBAC modules exist (`users`, `roles`, `modules`).
2. Registers any modules supplied in `cfg.InitialModules`.
3. Ensures the `Super Admin` role exists (Level 1, full access bypass).
4. Seeds any application roles supplied in `cfg.InitialRoles`.

Startup seeding is idempotent and safe across multi-instance restarts.

---

## Error Sentinels

All errors are defined in `models/errors.go` and can be checked with `errors.Is(err, ...)`:

```go
// Not Found
models.ErrRoleNotFound
models.ErrModuleNotFound
models.ErrUserNotFound

// Conflicts
models.ErrRoleAlreadyExists
models.ErrModuleAlreadyExists
models.ErrUserAlreadyExists
models.ErrEmailAlreadyTaken

// Auth & Access
models.ErrInvalidCredentials
models.ErrInvalidToken
models.ErrUserSuspended
models.ErrPermissionDenied
models.ErrInvalidSubject
models.ErrInvalidInput
```

---

## Route Wiring Reference

| Method | Path | Permission Required | Handler |
|--------|------|---------------------|---------|
| `POST` | `/auth/register` | Public | `AuthHandler.Register` |
| `POST` | `/auth/login` | Public | `AuthHandler.Login` |
| `POST` | `/auth/refresh` | Public (valid token) | `AuthHandler.RefreshToken` |
| `GET`  | `/auth/me` | Authenticated | `AuthHandler.GetMe` |
| `GET`  | `/auth/permissions` | Authenticated | `AuthHandler.GetMyPermissions` |
| `POST` | `/auth/logout` | Authenticated | `AuthHandler.Logout` |
| `PUT`  | `/auth/password` | Authenticated | `AuthHandler.ChangePassword` |
| `GET`  | `/modules` | Authenticated (filtered) | `ModuleHandler.GetAll` |
| `POST` | `/modules` | `modules:create` | `ModuleHandler.Create` |
| `GET`  | `/modules/:id` | `modules:read` | `ModuleHandler.GetByID` |
| `PUT`  | `/modules/:id` | `modules:update` | `ModuleHandler.Update` |
| `DELETE` | `/modules/:id` | `modules:delete` | `ModuleHandler.Delete` |
| `GET`  | `/roles` | `roles:read` | `RoleHandler.GetAll` |
| `POST` | `/roles` | `roles:create` | `RoleHandler.Create` |
| `GET`  | `/roles/:id` | `roles:read` | `RoleHandler.GetByID` |
| `PUT`  | `/roles/:id` | `roles:update` | `RoleHandler.Update` |
| `DELETE` | `/roles/:id` | `roles:delete` | `RoleHandler.Delete` |
| `PUT`  | `/roles/:id/permissions` | `roles:update` | `RoleHandler.UpdatePermissions` |
| `GET`  | `/users` | `users:read` | `UserHandler.GetAll` |
| `POST` | `/users` | `users:create` | `UserHandler.Create` |
| `GET`  | `/users/:id` | `users:read` | `UserHandler.GetByID` |
| `PUT`  | `/users/:id` | `users:update` | `UserHandler.Update` |
| `DELETE` | `/users/:id` | `users:delete` | `UserHandler.Delete` |
| `PUT`  | `/users/:id/role` | `users:update` | `UserHandler.UpdateRole` |