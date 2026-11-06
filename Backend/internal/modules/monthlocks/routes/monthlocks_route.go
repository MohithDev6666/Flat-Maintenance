package monthlocks

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/handler"
)

// SetupMonthLockRoutes registers the month lock routes. Reads are also open to users who
// can view expenses or payments, so their forms can warn about locked months.
func SetupMonthLockRoutes(router *gin.RouterGroup, handler handler.MonthLockHandler, require func(string) gin.HandlerFunc, requireAny func(...string) gin.HandlerFunc) {
	read := requireAny("lockMonth:view", "expenses:view", "payments:view")
	router.GET("", read, handler.GetAllMonthLocksHandler)
	router.GET("/:month", read, handler.GetMonthLockHandler)
	router.PUT("/:month", require("lockMonth:manage"), handler.SetMonthLockHandler)
}
