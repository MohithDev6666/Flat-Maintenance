package rbac

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/handler"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/repository"
	"github.com/trideadmin/rbac/service"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	DefaultTableUsers     = "rbac_users"
	DefaultTableRoles     = "rbac_roles"
	DefaultTableModules   = "rbac_modules"
	DefaultTableAuditLogs = "rbac_audit_logs"

	// Backward-compatibility aliases for MongoDB collections
	DefaultCollectionUsers     = DefaultTableUsers
	DefaultCollectionRoles     = DefaultTableRoles
	DefaultCollectionModules   = DefaultTableModules
	DefaultCollectionAuditLogs = DefaultTableAuditLogs
)

// CacheBackend defines the contract for caching implementations (e.g. Memory, Redis).
type CacheBackend interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// RBACService is the central entry point that exposes all entity repositories,
// services, and handlers. Import and wire once in your application's main.go.
type RBACService struct {
	// Repositories (DIP Interfaces)
	ModuleRepo repository.ModuleRepository
	RoleRepo   repository.RoleRepository
	UserRepo   repository.UserRepository

	// Services
	Modules service.ModuleService
	Roles   service.RoleService
	Users   service.UserService
	Checker service.Checker
	Auth    service.AuthService

	// Handlers
	ModuleHandler *handler.ModuleHandler
	RoleHandler   *handler.RoleHandler
	UserHandler   *handler.UserHandler
	AuthHandler   *handler.AuthHandler
}

// Config allows optional configuration overrides.
type Config struct {
	// Cache is the cache backend for permission lookups.
	// When nil, defaults to no caching.
	Cache CacheBackend

	// CacheTTL overrides the default 5-minute cache TTL.
	CacheTTL time.Duration

	// JWTSecretKey is the secret key used for signing authentication tokens.
	// If empty, a default fallback secret is used.
	JWTSecretKey string

	// JWTExpiration defines the TTL duration of signed auth tokens.
	// If 0, defaults to 24 hours.
	JWTExpiration time.Duration

	// JWTIssuer is the "iss" claim embedded in tokens.
	// If empty, defaults to "rbac-auth-engine".
	JWTIssuer string

	// Table / Collection naming overrides
	TableUsers     string
	TableRoles     string
	TableModules   string
	TableAuditLogs string

	// Collection naming aliases (for MongoDB backwards compatibility)
	CollectionUsers     string
	CollectionRoles     string
	CollectionModules   string
	CollectionAuditLogs string

	// DisableAutoMigrate disables automatic table/index creation on startup (PostgreSQL only).
	DisableAutoMigrate bool

	// InitialModules optionally declares application-specific modules to seed on startup.
	InitialModules []models.CreateModuleRequest

	// InitialRoles optionally declares application-specific roles to seed on startup.
	InitialRoles []models.Role
}

func (c *Config) GetTableUsers() string {
	if c.TableUsers != "" {
		return c.TableUsers
	}
	if c.CollectionUsers != "" {
		return c.CollectionUsers
	}
	return DefaultTableUsers
}

func (c *Config) GetTableRoles() string {
	if c.TableRoles != "" {
		return c.TableRoles
	}
	if c.CollectionRoles != "" {
		return c.CollectionRoles
	}
	return DefaultTableRoles
}

func (c *Config) GetTableModules() string {
	if c.TableModules != "" {
		return c.TableModules
	}
	if c.CollectionModules != "" {
		return c.CollectionModules
	}
	return DefaultTableModules
}

func (c *Config) GetTableAuditLogs() string {
	if c.TableAuditLogs != "" {
		return c.TableAuditLogs
	}
	if c.CollectionAuditLogs != "" {
		return c.CollectionAuditLogs
	}
	return DefaultTableAuditLogs
}

func applyConfigDefaults(cfg *Config) *Config {
	if cfg == nil {
		cfg = &Config{}
	}
	if cfg.CacheTTL == 0 {
		cfg.CacheTTL = 5 * time.Minute
	}
	if cfg.JWTSecretKey == "" {
		cfg.JWTSecretKey = "rbac-default-dev-secret-key-change-in-prod"
	}
	if cfg.JWTExpiration == 0 {
		cfg.JWTExpiration = 24 * time.Hour
	}
	if cfg.JWTIssuer == "" {
		cfg.JWTIssuer = "rbac-auth-engine"
	}
	return cfg
}

// New creates and wires all RBAC components from a MongoDB database (backward-compatible alias).
func New(db *mongo.Database, cfg *Config) (*RBACService, error) {
	return NewWithMongo(db, cfg)
}

// NewWithMongo creates and wires all RBAC components using MongoDB as the storage engine.
func NewWithMongo(db *mongo.Database, cfg *Config) (*RBACService, error) {
	if db == nil {
		return nil, errors.New("rbac.NewWithMongo: db is required")
	}
	cfg = applyConfigDefaults(cfg)

	auditLogger := audit.NewMongoLogger(db, cfg.GetTableAuditLogs())
	modRepo := repository.NewMongoModuleRepository(db, cfg.GetTableModules())
	roleRepo := repository.NewMongoRoleRepository(db, cfg.GetTableRoles())
	userRepo := repository.NewMongoUserRepository(db, cfg.GetTableUsers())

	return wireRBAC(modRepo, roleRepo, userRepo, auditLogger, cfg)
}

// NewWithPostgres creates and wires all RBAC components using PostgreSQL (*pgxpool.Pool) as the storage engine.
// By default, it automatically verifies and creates the required tables and indexes unless DisableAutoMigrate is true.
func NewWithPostgres(pool *pgxpool.Pool, cfg *Config) (*RBACService, error) {
	if pool == nil {
		return nil, errors.New("rbac.NewWithPostgres: pool is required")
	}
	cfg = applyConfigDefaults(cfg)

	tables := repository.PostgresTables{
		Users:     cfg.GetTableUsers(),
		Roles:     cfg.GetTableRoles(),
		Modules:   cfg.GetTableModules(),
		AuditLogs: cfg.GetTableAuditLogs(),
	}

	if !cfg.DisableAutoMigrate {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := repository.MigratePostgresSchema(ctx, pool, tables); err != nil {
			return nil, err
		}
	}

	auditLogger := audit.NewPostgresLogger(pool, tables.AuditLogs)
	modRepo := repository.NewPostgresModuleRepository(pool, tables.Modules)
	roleRepo := repository.NewPostgresRoleRepository(pool, tables.Roles)
	userRepo := repository.NewPostgresUserRepository(pool, tables.Users)

	return wireRBAC(modRepo, roleRepo, userRepo, auditLogger, cfg)
}

// wireRBAC wires repositories, services, handlers, and startup seeding.
func wireRBAC(
	modRepo repository.ModuleRepository,
	roleRepo repository.RoleRepository,
	userRepo repository.UserRepository,
	auditLogger audit.AuditLogger,
	cfg *Config,
) (*RBACService, error) {
	// Entity Services
	modSvc := service.NewModuleService(modRepo, auditLogger)
	roleSvc := service.NewRoleServiceWithModules(roleRepo, modRepo, cfg.Cache, cfg.CacheTTL, auditLogger)
	userSvc := service.NewUserService(userRepo, roleRepo, modRepo, auditLogger)
	authSvc := service.NewAuthServiceWithIssuer(userRepo, roleRepo, modRepo, cfg.Cache, auditLogger, cfg.JWTSecretKey, cfg.JWTExpiration, cfg.JWTIssuer)

	// Permission Enforcement
	checker := service.NewEnforcer(roleSvc, modSvc, auditLogger)

	// Handlers
	modHandler := handler.NewModuleHandler(modSvc, roleSvc, checker)
	roleHandler := handler.NewRoleHandler(roleSvc)
	userHandler := handler.NewUserHandler(userSvc)
	authHandler := handler.NewAuthHandler(authSvc, checker)

	// Idempotent startup seeding — 30 seconds for cold-start environments.
	// Seeding failures are logged but do not prevent the service from starting.
	seedCtx, seedCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer seedCancel()
	if err := service.SeedDefaults(seedCtx, roleRepo, modRepo, cfg.InitialModules, cfg.InitialRoles...); err != nil {
		log.Printf("[rbac] WARN: startup seeding failed: %v", err)
	}

	return &RBACService{
		ModuleRepo: modRepo,
		RoleRepo:   roleRepo,
		UserRepo:   userRepo,

		Modules: modSvc,
		Roles:   roleSvc,
		Users:   userSvc,
		Checker: checker,
		Auth:    authSvc,

		ModuleHandler: modHandler,
		RoleHandler:   roleHandler,
		UserHandler:   userHandler,
		AuthHandler:   authHandler,
	}, nil
}
