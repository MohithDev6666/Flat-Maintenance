package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type AuditHandlerImpl struct {
	auditService service.AuditService
}

func NewAuditHandler(auditService service.AuditService) AuditHandler {
	return &AuditHandlerImpl{
		auditService: auditService,
	}
}

func (ah *AuditHandlerImpl) GetAllAuditEntriesHandler(c *gin.Context) {
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	data, err := ah.auditService.GetAllAuditEntries(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (ah *AuditHandlerImpl) GetAuditEntryByIDHandler(c *gin.Context) {
	data, err := ah.auditService.GetAuditEntryByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}
