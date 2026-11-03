package monthlocks

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/handler"
)

func SetupMonthLockRoutes(router *gin.RouterGroup, handler handler.MonthLockHandler, require func(string) gin.HandlerFunc) {
	router.GET("", require("lockMonth:view"), handler.GetAllMonthLocksHandler)
	router.GET("/:month", require("lockMonth:view"), handler.GetMonthLockHandler)
	router.PUT("/:month", require("lockMonth:manage"), handler.SetMonthLockHandler)
}
