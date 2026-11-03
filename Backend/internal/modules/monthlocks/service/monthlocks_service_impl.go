package service

import (
	"context"
	"errors"
	"time"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	monthLockRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/repo"
	"go.mongodb.org/mongo-driver/mongo"
)

type monthLockServiceImpl struct {
	monthLockRepo monthLockRepo.MonthLocks
	auditRepo     auditRepo.Audit
}

func NewMonthLockService(monthLockRepo monthLockRepo.MonthLocks, auditRepo auditRepo.Audit) MonthLockService {
	return &monthLockServiceImpl{
		monthLockRepo: monthLockRepo,
		auditRepo:     auditRepo,
	}
}

func (ms *monthLockServiceImpl) GetAllMonthLocks(ctx context.Context) ([]*models.MonthLock, error) {
	return ms.monthLockRepo.GetAllMonthLocks(ctx, 500, 0)
}

func (ms *monthLockServiceImpl) GetMonthLock(ctx context.Context, month string) (*models.MonthLock, error) {
	return ms.monthLockRepo.GetMonthLockByMonth(ctx, month)
}

func (ms *monthLockServiceImpl) SetMonthLock(ctx context.Context, actor, month string, locked bool) (*models.MonthLock, error) {
	old, err := ms.monthLockRepo.GetMonthLockByMonth(ctx, month)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}

	now := time.Now().UTC()
	lock := &models.MonthLock{ID: month, Month: month, Locked: locked, CreatedAt: now, UpdatedAt: now}
	if old != nil {
		lock.LockedBy, lock.LockedAt = old.LockedBy, old.LockedAt
		lock.UnlockedBy, lock.UnlockedAt = old.UnlockedBy, old.UnlockedAt
		lock.CreatedAt = old.CreatedAt
	}
	action, previous, next := "Locked", "Open", "Locked"
	if locked {
		lock.LockedBy, lock.LockedAt = actor, &now
		lock.UnlockedBy, lock.UnlockedAt = "", nil
	} else {
		lock.UnlockedBy, lock.UnlockedAt = actor, &now
		action, previous, next = "Unlocked", "Locked", "Open"
	}

	if err := ms.monthLockRepo.UpsertMonthLock(ctx, lock); err != nil {
		return nil, err
	}
	if err := ms.auditRepo.CreateAuditEntry(ctx, models.NewAuditRecord(actor, "Month lock", action, month, previous, next)); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Month", month, action, "by", actor)
	return lock, nil
}
