package handler

import "github.com/gin-gonic/gin"

type TenantHandler interface {
	GetAllTenantsHandler(c *gin.Context)
	GetTenantByIDHandler(c *gin.Context)
	CreateTenantHandler(c *gin.Context)
	UpdateTenantHandler(c *gin.Context)
	DeleteTenantHandler(c *gin.Context)
}
