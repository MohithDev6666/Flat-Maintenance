package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type OwnersHandlerImpl struct {
	ownerService service.OwnerService
}

func NewOwnersHandler(ownerService service.OwnerService) OwnerHandler {
	return &OwnersHandlerImpl{
		ownerService: ownerService,
	}
}

func (oh *OwnersHandlerImpl) GetAllOwnersHandler(c *gin.Context) {
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	data, err := oh.ownerService.GetAllOwners(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (oh *OwnersHandlerImpl) GetOwnerByIDHandler(c *gin.Context) {
	data, err := oh.ownerService.GetOwnerByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (oh *OwnersHandlerImpl) CreateOwnerHandler(c *gin.Context) {
	var owner models.Owner
	if err := c.ShouldBindJSON(&owner); err != nil {
		logs.WarningLogger.Println("Invalid owner payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := oh.ownerService.CreateOwner(c, utils.Actor(c), &owner)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

func (oh *OwnersHandlerImpl) UpdateOwnerHandler(c *gin.Context) {
	var owner models.Owner
	if err := c.ShouldBindJSON(&owner); err != nil {
		logs.WarningLogger.Println("Invalid owner payload for update:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := oh.ownerService.UpdateOwner(c, utils.Actor(c), c.Param("id"), &owner)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (oh *OwnersHandlerImpl) DeleteOwnerHandler(c *gin.Context) {
	if err := oh.ownerService.DeleteOwner(c, utils.Actor(c), c.Param("id")); err != nil {
		utils.RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
