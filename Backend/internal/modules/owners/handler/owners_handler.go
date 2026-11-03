package handler

import "github.com/gin-gonic/gin"

type OwnerHandler interface {
	GetAllOwnersHandler(c *gin.Context)
	GetOwnerByIDHandler(c *gin.Context)
	CreateOwnerHandler(c *gin.Context)
	UpdateOwnerHandler(c *gin.Context)
	DeleteOwnerHandler(c *gin.Context)
}
