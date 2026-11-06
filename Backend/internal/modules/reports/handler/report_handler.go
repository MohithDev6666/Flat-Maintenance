package handler

import "github.com/gin-gonic/gin"

type ReportHandler interface {
	GetDashboardHandler(c *gin.Context)
	GetSummaryHandler(c *gin.Context)
	GetContributionHandler(c *gin.Context)
	GetPayStatusHandler(c *gin.Context)
}
