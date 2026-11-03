package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type CategoryService interface {
	GetAllCategories(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Category, error)
	GetCategoryByID(ctx context.Context, id string) (*models.Category, error)
	CreateCategory(ctx context.Context, actor string, category *models.Category) (*models.Category, error)
	UpdateCategory(ctx context.Context, actor, id string, category *models.Category) (*models.Category, error)
	DeleteCategory(ctx context.Context, actor, id string) error
}
