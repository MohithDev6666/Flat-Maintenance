package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
)

type MonthLocks interface {
	GetAllMonthLocks(ctx context.Context, limit, offset int) ([]*models.MonthLock, error)
	GetMonthLockByMonth(ctx context.Context, month string) (*models.MonthLock, error)
	IsMonthLocked(ctx context.Context, month string) (bool, error)
	UpsertMonthLock(ctx context.Context, lock *models.MonthLock) error
}
