package handler

import "github.com/gin-gonic/gin"

type BuildingHandler interface {
	GetBuildingHandler(c *gin.Context)
	SaveBuildingHandler(c *gin.Context)
}
