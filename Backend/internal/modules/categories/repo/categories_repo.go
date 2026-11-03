package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type Categories interface {
	GetAllCategories(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Category, error)
	GetCategoryByID(ctx context.Context, id string) (*models.Category, error)
	CountCategoriesByName(ctx context.Context, name string) (int64, error)
	CreateCategory(ctx context.Context, category *models.Category) error
	UpdateCategory(ctx context.Context, category *models.Category) error
	DeleteCategory(ctx context.Context, id string) error
}
