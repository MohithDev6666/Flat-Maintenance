package expenses

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/handler"
)

func SetupExpenseRoutes(router *gin.RouterGroup, handler handler.ExpenseHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("expenses:view"))
	router.GET("", handler.GetAllExpensesHandler)
	router.GET("/:id", handler.GetExpenseByIDHandler)
	router.POST("", require("expenses:add"), handler.CreateExpenseHandler)
	router.PUT("/:id", require("expenses:edit"), handler.UpdateExpenseHandler)
	router.DELETE("/:id", require("expenses:delete"), handler.DeleteExpenseHandler)
}
