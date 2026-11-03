package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	flatService "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type FlatManagementHandlerImpl struct {
	flatService flatService.FlatService
}

func NewFlatManagementHandler(flatService flatService.FlatService) FlatManagementHandler {
	return &FlatManagementHandlerImpl{
		flatService: flatService,
	}
}

func (fm *FlatManagementHandlerImpl) GetAllFlatsHandler(c *gin.Context) {
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	data, err := fm.flatService.GetAllFlats(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (fm *FlatManagementHandlerImpl) GetFlatByIDHandler(c *gin.Context) {
	data, err := fm.flatService.GetFlatByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (fm *FlatManagementHandlerImpl) CreateFlatHandler(c *gin.Context) {
	var flat models.Flat
	if err := c.ShouldBindJSON(&flat); err != nil {
		logs.WarningLogger.Println("Invalid flat payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := fm.flatService.CreateFlat(c, utils.Actor(c), &flat)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

func (fm *FlatManagementHandlerImpl) UpdateFlatHandler(c *gin.Context) {
	var flat models.Flat
	if err := c.ShouldBindJSON(&flat); err != nil {
		logs.WarningLogger.Println("Invalid flat payload for update:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := fm.flatService.UpdateFlat(c, utils.Actor(c), c.Param("id"), &flat)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (fm *FlatManagementHandlerImpl) DeleteFlatHandler(c *gin.Context) {
	if err := fm.flatService.DeleteFlat(c, utils.Actor(c), c.Param("id")); err != nil {
		utils.RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
