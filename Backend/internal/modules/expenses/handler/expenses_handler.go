package handler

import "github.com/gin-gonic/gin"

type ExpenseHandler interface {
	GetAllExpensesHandler(c *gin.Context)
	GetExpenseByIDHandler(c *gin.Context)
	CreateExpenseHandler(c *gin.Context)
	UpdateExpenseHandler(c *gin.Context)
	DeleteExpenseHandler(c *gin.Context)
}
