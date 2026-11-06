package tenants

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/handler"
)

// SetupTenantRoutes registers the tenants routes. Reads are also open to users who can view
// flats, because the common Flats page and the signed-in session show the flat's residents.
func SetupTenantRoutes(router *gin.RouterGroup, handler handler.TenantHandler, require func(string) gin.HandlerFunc, requireAny func(...string) gin.HandlerFunc) {
	read := requireAny("tenants:view", "flats:view")
	router.GET("", read, handler.GetAllTenantsHandler)
	router.GET("/:id", read, handler.GetTenantByIDHandler)
	router.POST("", require("tenants:add"), handler.CreateTenantHandler)
	router.PUT("/:id", require("tenants:edit"), handler.UpdateTenantHandler)
	router.DELETE("/:id", require("tenants:delete"), handler.DeleteTenantHandler)
}
