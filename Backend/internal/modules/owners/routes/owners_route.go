package owners

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/handler"
)

// SetupOwnerRoutes registers the owners routes. Reads are also open to users who can view
// flats, because the common Flats page and the signed-in session show the flat's residents.
func SetupOwnerRoutes(router *gin.RouterGroup, handler handler.OwnerHandler, require func(string) gin.HandlerFunc, requireAny func(...string) gin.HandlerFunc) {
	read := requireAny("owners:view", "flats:view")
	router.GET("", read, handler.GetAllOwnersHandler)
	router.GET("/:id", read, handler.GetOwnerByIDHandler)
	router.POST("", require("owners:add"), handler.CreateOwnerHandler)
	router.PUT("/:id", require("owners:edit"), handler.UpdateOwnerHandler)
	router.DELETE("/:id", require("owners:delete"), handler.DeleteOwnerHandler)
}
