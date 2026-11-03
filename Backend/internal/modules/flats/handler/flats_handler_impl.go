package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type FlatsHandlerImpl struct {
	flatService service.FlatService
}

func NewFlatsHandler(flatService service.FlatService) FlatHandler {
	return &FlatsHandlerImpl{
		flatService: flatService,
	}
}

func (fh *FlatsHandlerImpl) GetAllFlatsHandler(c *gin.Context) {
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	data, err := fh.flatService.GetAllFlats(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (fh *FlatsHandlerImpl) GetFlatByIDHandler(c *gin.Context) {
	data, err := fh.flatService.GetFlatByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (fh *FlatsHandlerImpl) CreateFlatHandler(c *gin.Context) {
	var flat models.Flat
	if err := c.ShouldBindJSON(&flat); err != nil {
		logs.WarningLogger.Println("Invalid flat payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := fh.flatService.CreateFlat(c, utils.Actor(c), &flat)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

func (fh *FlatsHandlerImpl) UpdateFlatHandler(c *gin.Context) {
	var flat models.Flat
	if err := c.ShouldBindJSON(&flat); err != nil {
		logs.WarningLogger.Println("Invalid flat payload for update:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := fh.flatService.UpdateFlat(c, utils.Actor(c), c.Param("id"), &flat)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (fh *FlatsHandlerImpl) DeleteFlatHandler(c *gin.Context) {
	if err := fh.flatService.DeleteFlat(c, utils.Actor(c), c.Param("id")); err != nil {
		utils.RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
