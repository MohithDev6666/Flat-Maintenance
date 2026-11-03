package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
)

type BuildingService interface {
	GetBuilding(ctx context.Context) (*models.Building, error)
	SaveBuilding(ctx context.Context, actor string, building *models.Building) (*models.Building, error)
}
