package reports

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/handler"
)

func SetupReportRoutes(router *gin.RouterGroup, handler handler.ReportHandler, require func(string) gin.HandlerFunc) {
	router.GET("/dashboard", require("dashboard:view"), handler.GetDashboardHandler)
	router.GET("/summary", require("summary:view"), handler.GetSummaryHandler)
	router.GET("/contribution", require("contribution:view"), handler.GetContributionHandler)
}
