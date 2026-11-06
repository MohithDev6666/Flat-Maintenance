package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/service"
	userLinkService "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type ReportHandlerImpl struct {
	reportService   service.ReportService
	userLinkService userLinkService.UserLinkService
}

func NewReportHandler(reportService service.ReportService, userLinkService userLinkService.UserLinkService) ReportHandler {
	return &ReportHandlerImpl{
		reportService:   reportService,
		userLinkService: userLinkService,
	}
}

// viewer resolves who is asking. A resident without a valid profile link still gets the building-level
// figures, just no personal ones.
func (rh *ReportHandlerImpl) viewer(c *gin.Context) (service.Viewer, bool) {
	admin, err := rh.userLinkService.IsAdministrator(c, utils.UserID(c))
	if err != nil {
		// Same failure handling as the other resident-scoped endpoints.
		if _, _, resolveErr := rh.userLinkService.ResolveResident(c, utils.UserID(c)); resolveErr != nil {
			utils.RespondError(c, resolveErr)
			return service.Viewer{}, false
		}
		utils.RespondError(c, err)
		return service.Viewer{}, false
	}
	if admin {
		return service.Viewer{Admin: true}, true
	}
	profile, _, err := rh.userLinkService.ResolveResident(c, utils.UserID(c))
	if err != nil {
		return service.Viewer{}, true
	}
	return service.Viewer{Link: profile}, true
}

func respond(c *gin.Context, data any, err error) {
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (rh *ReportHandlerImpl) GetDashboardHandler(c *gin.Context) {
	viewer, ok := rh.viewer(c)
	if !ok {
		return
	}
	data, err := rh.reportService.GetDashboard(c, viewer)
	respond(c, data, err)
}

func (rh *ReportHandlerImpl) GetSummaryHandler(c *gin.Context) {
	viewer, ok := rh.viewer(c)
	if !ok {
		return
	}
	data, err := rh.reportService.GetSummary(c, viewer, c.Query("month"))
	respond(c, data, err)
}

func (rh *ReportHandlerImpl) GetContributionHandler(c *gin.Context) {
	viewer, ok := rh.viewer(c)
	if !ok {
		return
	}
	data, err := rh.reportService.GetContribution(c, viewer, c.Query("month"), c.Query("party"))
	respond(c, data, err)
}

func (rh *ReportHandlerImpl) GetPayStatusHandler(c *gin.Context) {
	viewer, ok := rh.viewer(c)
	if !ok {
		return
	}
	data, err := rh.reportService.GetPayStatus(c, viewer, c.Query("month"))
	respond(c, data, err)
}
