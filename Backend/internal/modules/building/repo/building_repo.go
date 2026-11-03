package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
)

type Building interface {
	GetBuilding(ctx context.Context) (*models.Building, error)
	SaveBuilding(ctx context.Context, building *models.Building) error
}
