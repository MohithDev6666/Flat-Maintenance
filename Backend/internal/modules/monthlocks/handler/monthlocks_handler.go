package handler

import "github.com/gin-gonic/gin"

type MonthLockHandler interface {
	GetAllMonthLocksHandler(c *gin.Context)
	GetMonthLockHandler(c *gin.Context)
	SetMonthLockHandler(c *gin.Context)
}
