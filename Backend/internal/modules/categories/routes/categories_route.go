package categories

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/handler"
)

// SetupCategoryRoutes registers the category routes. Reads are also open to users who
// can view expenses, because the Add / Edit Expense form needs the category dropdown.
func SetupCategoryRoutes(router *gin.RouterGroup, handler handler.CategoryHandler, require func(string) gin.HandlerFunc, requireAny func(...string) gin.HandlerFunc) {
	read := requireAny("categories:view", "expenses:view")
	router.GET("", read, handler.GetAllCategoriesHandler)
	router.GET("/:id", read, handler.GetCategoryByIDHandler)
	router.POST("", require("categories:add"), handler.CreateCategoryHandler)
	router.PUT("/:id", require("categories:edit"), handler.UpdateCategoryHandler)
	router.DELETE("/:id", require("categories:delete"), handler.DeleteCategoryHandler)
}
