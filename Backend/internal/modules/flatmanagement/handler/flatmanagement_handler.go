package handler

import "github.com/gin-gonic/gin"

// FlatManagementHandler manages the same flats collection as the flats module
// behind the flatManagement RBAC permissions.
type FlatManagementHandler interface {
	GetAllFlatsHandler(c *gin.Context)
	GetFlatByIDHandler(c *gin.Context)
	CreateFlatHandler(c *gin.Context)
	UpdateFlatHandler(c *gin.Context)
	DeleteFlatHandler(c *gin.Context)
}
