package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type TenantService interface {
	GetAllTenants(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Tenant, error)
	GetTenantByID(ctx context.Context, id string) (*models.Tenant, error)
	CreateTenant(ctx context.Context, actor string, tenant *models.Tenant) (*models.Tenant, error)
	UpdateTenant(ctx context.Context, actor, id string, tenant *models.Tenant) (*models.Tenant, error)
	DeleteTenant(ctx context.Context, actor, id string) error
}
