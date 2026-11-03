package building

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/building/handler"
)

func SetupBuildingRoutes(router *gin.RouterGroup, handler handler.BuildingHandler, require func(string) gin.HandlerFunc) {
	router.GET("", require("building:view"), handler.GetBuildingHandler)
	router.PUT("", require("building:edit"), handler.SaveBuildingHandler)
}
