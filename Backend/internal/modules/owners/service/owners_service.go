package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type OwnerService interface {
	GetAllOwners(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Owner, error)
	GetOwnerByID(ctx context.Context, id string) (*models.Owner, error)
	CreateOwner(ctx context.Context, actor string, owner *models.Owner) (*models.Owner, error)
	UpdateOwner(ctx context.Context, actor, id string, owner *models.Owner) (*models.Owner, error)
	DeleteOwner(ctx context.Context, actor, id string) error
}
