package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
)

type MonthLockService interface {
	GetAllMonthLocks(ctx context.Context) ([]*models.MonthLock, error)
	GetMonthLock(ctx context.Context, month string) (*models.MonthLock, error)
	SetMonthLock(ctx context.Context, actor, month string, locked bool) (*models.MonthLock, error)
}
