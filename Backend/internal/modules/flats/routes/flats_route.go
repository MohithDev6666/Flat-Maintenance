package flats

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/handler"
)

func SetupFlatRoutes(router *gin.RouterGroup, handler handler.FlatHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("flats:view"))
	router.GET("", handler.GetAllFlatsHandler)
	router.GET("/:id", handler.GetFlatByIDHandler)
	router.POST("", require("flats:add"), handler.CreateFlatHandler)
	router.PUT("/:id", require("flats:edit"), handler.UpdateFlatHandler)
	router.DELETE("/:id", require("flats:delete"), handler.DeleteFlatHandler)
}
