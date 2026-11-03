package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type Flats interface {
	GetAllFlats(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Flat, error)
	GetFlatByID(ctx context.Context, id string) (*models.Flat, error)
	CreateFlat(ctx context.Context, flat *models.Flat) error
	UpdateFlat(ctx context.Context, flat *models.Flat) error
	DeleteFlat(ctx context.Context, id string) error
	UpdateFlatStatus(ctx context.Context, id, status string) error
}
