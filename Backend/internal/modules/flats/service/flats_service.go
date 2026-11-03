package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type FlatService interface {
	GetAllFlats(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Flat, error)
	GetFlatByID(ctx context.Context, id string) (*models.Flat, error)
	CreateFlat(ctx context.Context, actor string, flat *models.Flat) (*models.Flat, error)
	UpdateFlat(ctx context.Context, actor, id string, flat *models.Flat) (*models.Flat, error)
	DeleteFlat(ctx context.Context, actor, id string) error
}
