package handler

import "github.com/gin-gonic/gin"

type CategoryHandler interface {
	GetAllCategoriesHandler(c *gin.Context)
	GetCategoryByIDHandler(c *gin.Context)
	CreateCategoryHandler(c *gin.Context)
	UpdateCategoryHandler(c *gin.Context)
	DeleteCategoryHandler(c *gin.Context)
}
