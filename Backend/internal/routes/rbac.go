package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac"
	ginrbac "github.com/trideadmin/rbac/middleware/gin"
	rbacmodels "github.com/trideadmin/rbac/models"
)

// SetUpRBACRoutes registers the RBAC auth, module, role and user routes and
// returns the authenticated group the application routes are mounted on.
func SetUpRBACRoutes(api *gin.RouterGroup, service *rbac.RBACService, middleware *ginrbac.Middleware) *gin.RouterGroup {
	auth := api.Group("/auth")
	auth.POST("/register", service.AuthHandler.Register)
	auth.POST("/login", service.AuthHandler.Login)
	auth.POST("/refresh", service.AuthHandler.RefreshToken)

	protected := api.Group("", middleware.Authenticate())
	protected.GET("/auth/me", service.AuthHandler.GetMe)
	protected.GET("/auth/permissions", service.AuthHandler.GetMyPermissions)
	protected.POST("/auth/logout", service.AuthHandler.Logout)
	protected.PUT("/auth/password", service.AuthHandler.ChangePassword)

	modules := protected.Group("/modules")
	modules.GET("", service.ModuleHandler.GetAll)
	modules.POST("", middleware.Require("modules:create"), service.ModuleHandler.Create)
	modules.GET("/:id", middleware.Require("modules:read"), service.ModuleHandler.GetByID)
	modules.PUT("/:id", middleware.Require("modules:update"), service.ModuleHandler.Update)
	modules.DELETE("/:id", middleware.Require("modules:delete"), service.ModuleHandler.Delete)

	roles := protected.Group("/roles", middleware.Require("roles:read"))
	roles.GET("", service.RoleHandler.GetAll)
	roles.POST("", middleware.Require("roles:create"), service.RoleHandler.Create)
	roles.GET("/:id", service.RoleHandler.GetByID)
	roles.PUT("/:id", middleware.Require("roles:update"), service.RoleHandler.Update)
	roles.DELETE("/:id", middleware.Require("roles:delete"), service.RoleHandler.Delete)
	roles.PUT("/:id/permissions", middleware.Require("roles:update"), service.RoleHandler.UpdatePermissions)

	users := protected.Group("/users", middleware.Require("users:read"))
	users.GET("", service.UserHandler.GetAll)
	users.POST("", middleware.Require("users:create"), service.UserHandler.Create)
	users.GET("/:id", service.UserHandler.GetByID)
	users.PUT("/:id", middleware.Require("users:update"), service.UserHandler.Update)
	users.DELETE("/:id", middleware.Require("users:delete"), service.UserHandler.Delete)
	users.PUT("/:id/role", middleware.Require("users:update"), service.UserHandler.UpdateRole)

	return protected
}

// ApplicationModules lists the application modules seeded into RBAC.
func ApplicationModules() []rbacmodels.CreateModuleRequest {
	keys := []struct {
		key  string
		name string
	}{
		{"dashboard", "Dashboard"},
		{"expenses", "Expenses"},
		{"payments", "Payments"},
		{"contribution", "Contribution"},
		{"summary", "Month Summary"},
		{"flats", "Resident Flats"},
		{"flatManagement", "Flat Management"},
		{"building", "Building Information"},
		{"owners", "Owners"},
		{"tenants", "Tenants"},
		{"categories", "Expense Categories"},
		{"recentChanges", "Recent Changes"},
		{"lockMonth", "Month Lock"},
	}
	modules := make([]rbacmodels.CreateModuleRequest, 0, len(keys))
	for _, module := range keys {
		modules = append(modules, rbacmodels.CreateModuleRequest{
			Key: module.key, Name: module.name,
			Description: module.name + " application module",
			Permissions: []string{"read", "create", "update", "delete"},
		})
	}
	return modules
}
