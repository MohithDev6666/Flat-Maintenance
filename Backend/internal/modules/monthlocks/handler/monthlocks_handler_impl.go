package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/mongo"
)

type MonthLocksHandlerImpl struct {
	monthLockService service.MonthLockService
}

func NewMonthLocksHandler(monthLockService service.MonthLockService) MonthLockHandler {
	return &MonthLocksHandlerImpl{
		monthLockService: monthLockService,
	}
}

func (mh *MonthLocksHandlerImpl) GetAllMonthLocksHandler(c *gin.Context) {
	data, err := mh.monthLockService.GetAllMonthLocks(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (mh *MonthLocksHandlerImpl) GetMonthLockHandler(c *gin.Context) {
	data, err := mh.monthLockService.GetMonthLock(c, c.Param("month"))
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusNotFound, gin.H{"error": "month lock not found"})
			return
		}
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (mh *MonthLocksHandlerImpl) SetMonthLockHandler(c *gin.Context) {
	month := c.Param("month")
	if _, err := time.Parse("2006-01", month); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month must use YYYY-MM format"})
		return
	}
	var body struct {
		Locked *bool `json:"locked"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Locked == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "locked is required"})
		return
	}
	data, err := mh.monthLockService.SetMonthLock(c, utils.Actor(c), month, *body.Locked)
	if err != nil {
		logs.ErrorLogger.Println("Error updating month lock:", month, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "month lock update failed"})
		return
	}
	c.JSON(http.StatusOK, data)
}
