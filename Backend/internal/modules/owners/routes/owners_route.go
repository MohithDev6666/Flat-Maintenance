package owners

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/handler"
)

func SetupOwnerRoutes(router *gin.RouterGroup, handler handler.OwnerHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("owners:view"))
	router.GET("", handler.GetAllOwnersHandler)
	router.GET("/:id", handler.GetOwnerByIDHandler)
	router.POST("", require("owners:add"), handler.CreateOwnerHandler)
	router.PUT("/:id", require("owners:edit"), handler.UpdateOwnerHandler)
	router.DELETE("/:id", require("owners:delete"), handler.DeleteOwnerHandler)
}
