package handler

import "github.com/gin-gonic/gin"

type FlatHandler interface {
	GetAllFlatsHandler(c *gin.Context)
	GetFlatByIDHandler(c *gin.Context)
	CreateFlatHandler(c *gin.Context)
	UpdateFlatHandler(c *gin.Context)
	DeleteFlatHandler(c *gin.Context)
}
