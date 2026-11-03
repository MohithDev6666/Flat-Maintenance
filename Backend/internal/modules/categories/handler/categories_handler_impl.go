package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type CategoriesHandlerImpl struct {
	categoryService service.CategoryService
}

func NewCategoriesHandler(categoryService service.CategoryService) CategoryHandler {
	return &CategoriesHandlerImpl{
		categoryService: categoryService,
	}
}

func (cl *CategoriesHandlerImpl) GetAllCategoriesHandler(c *gin.Context) {
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	data, err := cl.categoryService.GetAllCategories(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (cl *CategoriesHandlerImpl) GetCategoryByIDHandler(c *gin.Context) {
	data, err := cl.categoryService.GetCategoryByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (cl *CategoriesHandlerImpl) CreateCategoryHandler(c *gin.Context) {
	var category models.Category
	if err := c.ShouldBindJSON(&category); err != nil {
		logs.WarningLogger.Println("Invalid category payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := cl.categoryService.CreateCategory(c, utils.Actor(c), &category)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

func (cl *CategoriesHandlerImpl) UpdateCategoryHandler(c *gin.Context) {
	var category models.Category
	if err := c.ShouldBindJSON(&category); err != nil {
		logs.WarningLogger.Println("Invalid category payload for update:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := cl.categoryService.UpdateCategory(c, utils.Actor(c), c.Param("id"), &category)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (cl *CategoriesHandlerImpl) DeleteCategoryHandler(c *gin.Context) {
	if err := cl.categoryService.DeleteCategory(c, utils.Actor(c), c.Param("id")); err != nil {
		utils.RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
