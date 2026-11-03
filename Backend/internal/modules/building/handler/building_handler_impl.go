package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/building/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type BuildingHandlerImpl struct {
	buildingService service.BuildingService
}

func NewBuildingHandler(buildingService service.BuildingService) BuildingHandler {
	return &BuildingHandlerImpl{
		buildingService: buildingService,
	}
}

func (bh *BuildingHandlerImpl) GetBuildingHandler(c *gin.Context) {
	data, err := bh.buildingService.GetBuilding(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (bh *BuildingHandlerImpl) SaveBuildingHandler(c *gin.Context) {
	var building models.Building
	if err := c.ShouldBindJSON(&building); err != nil {
		logs.WarningLogger.Println("Invalid building payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := bh.buildingService.SaveBuilding(c, utils.Actor(c), &building)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}
