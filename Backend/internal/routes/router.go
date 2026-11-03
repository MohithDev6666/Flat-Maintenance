package routes

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/db"
	"github.com/trideadmin/rbac"
	ginrbac "github.com/trideadmin/rbac/middleware/gin"
	"go.mongodb.org/mongo-driver/mongo"
)

// RegisterRoutes central entrypoint
func RegisterRoutes(router *gin.Engine, client *mongo.Client, Database string, service *rbac.RBACService) error {
	if router == nil || client == nil || service == nil {
		return fmt.Errorf("router requires a Gin engine, Mongo client, and initialized RBAC service")
	}
	if err := db.EnsureIndexes(context.Background(), client, Database); err != nil {
		return err
	}

	middleware := ginrbac.New(service.Checker, service.Auth)
	api := router.Group("/api")

	// 1. RBAC routes (public auth endpoints + authenticated RBAC management)
	protected := SetUpRBACRoutes(api, service, middleware)

	// 2. Protected application routes (JWT + RBAC permissions)
	SetUpProtectedRoutes(protected, client, Database, middleware.Require)
	return nil
}
