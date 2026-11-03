package flatmanagement

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/flatmanagement/handler"
)

func SetupFlatManagementRoutes(router *gin.RouterGroup, handler handler.FlatManagementHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("flatManagement:view"))
	router.GET("", handler.GetAllFlatsHandler)
	router.GET("/:id", handler.GetFlatByIDHandler)
	router.POST("", require("flatManagement:add"), handler.CreateFlatHandler)
	router.PUT("/:id", require("flatManagement:edit"), handler.UpdateFlatHandler)
	router.DELETE("/:id", require("flatManagement:delete"), handler.DeleteFlatHandler)
}
