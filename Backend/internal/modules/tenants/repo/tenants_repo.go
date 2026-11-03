package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type Tenants interface {
	GetAllTenants(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Tenant, error)
	GetTenantByID(ctx context.Context, id string) (*models.Tenant, error)
	CountTenantsByFlat(ctx context.Context, flatID string) (int64, error)
	// HasOverlappingTenancy reports whether another tenancy of flatID overlaps [moveIn, moveOut).
	HasOverlappingTenancy(ctx context.Context, flatID, excludeID, moveIn, moveOut string) (bool, error)
	HasActiveTenant(ctx context.Context, flatID, today string) (bool, error)
	CreateTenant(ctx context.Context, tenant *models.Tenant) error
	UpdateTenant(ctx context.Context, tenant *models.Tenant) error
	DeleteTenant(ctx context.Context, id string) error
}
