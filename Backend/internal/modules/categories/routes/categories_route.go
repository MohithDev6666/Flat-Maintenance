package categories

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/handler"
)

func SetupCategoryRoutes(router *gin.RouterGroup, handler handler.CategoryHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("categories:view"))
	router.GET("", handler.GetAllCategoriesHandler)
	router.GET("/:id", handler.GetCategoryByIDHandler)
	router.POST("", require("categories:add"), handler.CreateCategoryHandler)
	router.PUT("/:id", require("categories:edit"), handler.UpdateCategoryHandler)
	router.DELETE("/:id", require("categories:delete"), handler.DeleteCategoryHandler)
}
