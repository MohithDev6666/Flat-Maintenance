package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type TenantsHandlerImpl struct {
	tenantService service.TenantService
}

func NewTenantsHandler(tenantService service.TenantService) TenantHandler {
	return &TenantsHandlerImpl{
		tenantService: tenantService,
	}
}

func (th *TenantsHandlerImpl) GetAllTenantsHandler(c *gin.Context) {
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	data, err := th.tenantService.GetAllTenants(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (th *TenantsHandlerImpl) GetTenantByIDHandler(c *gin.Context) {
	data, err := th.tenantService.GetTenantByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (th *TenantsHandlerImpl) CreateTenantHandler(c *gin.Context) {
	var tenant models.Tenant
	if err := c.ShouldBindJSON(&tenant); err != nil {
		logs.WarningLogger.Println("Invalid tenant payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := th.tenantService.CreateTenant(c, utils.Actor(c), &tenant)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

func (th *TenantsHandlerImpl) UpdateTenantHandler(c *gin.Context) {
	var tenant models.Tenant
	if err := c.ShouldBindJSON(&tenant); err != nil {
		logs.WarningLogger.Println("Invalid tenant payload for update:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := th.tenantService.UpdateTenant(c, utils.Actor(c), c.Param("id"), &tenant)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (th *TenantsHandlerImpl) DeleteTenantHandler(c *gin.Context) {
	if err := th.tenantService.DeleteTenant(c, utils.Actor(c), c.Param("id")); err != nil {
		utils.RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
