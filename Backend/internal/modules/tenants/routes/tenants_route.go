package tenants

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/handler"
)

func SetupTenantRoutes(router *gin.RouterGroup, handler handler.TenantHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("tenants:view"))
	router.GET("", handler.GetAllTenantsHandler)
	router.GET("/:id", handler.GetTenantByIDHandler)
	router.POST("", require("tenants:add"), handler.CreateTenantHandler)
	router.PUT("/:id", require("tenants:edit"), handler.UpdateTenantHandler)
	router.DELETE("/:id", require("tenants:delete"), handler.DeleteTenantHandler)
}
