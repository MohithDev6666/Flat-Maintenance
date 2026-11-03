package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type Owners interface {
	GetAllOwners(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Owner, error)
	GetOwnerByID(ctx context.Context, id string) (*models.Owner, error)
	// GetOwnerByFlatID returns the owner of flatID other than excludeID.
	GetOwnerByFlatID(ctx context.Context, flatID, excludeID string) (*models.Owner, error)
	CountOwnersByFlat(ctx context.Context, flatID string) (int64, error)
	CreateOwner(ctx context.Context, owner *models.Owner) error
	UpdateOwner(ctx context.Context, owner *models.Owner) error
	SetOwnerFlat(ctx context.Context, id, flatID string) error
	DeleteOwner(ctx context.Context, id string) error
}
