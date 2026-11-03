package handler

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
)

type ReportHandlerImpl struct {
	reportService service.ReportService
}

func NewReportHandler(reportService service.ReportService) ReportHandler {
	return &ReportHandlerImpl{
		reportService: reportService,
	}
}

func (rh *ReportHandlerImpl) GetDashboardHandler(c *gin.Context) {
	respondReport(c, rh.reportService.GetDashboard)
}

func (rh *ReportHandlerImpl) GetSummaryHandler(c *gin.Context) {
	respondReport(c, rh.reportService.GetSummary)
}

func (rh *ReportHandlerImpl) GetContributionHandler(c *gin.Context) {
	respondReport(c, rh.reportService.GetContribution)
}

func respondReport(c *gin.Context, load func(context.Context) (map[string][]bson.M, error)) {
	data, err := load(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}
