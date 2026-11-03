package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	"go.mongodb.org/mongo-driver/bson"
)

type auditServiceImpl struct {
	auditRepo auditRepo.Audit
}

func NewAuditService(auditRepo auditRepo.Audit) AuditService {
	return &auditServiceImpl{
		auditRepo: auditRepo,
	}
}

func (as *auditServiceImpl) GetAllAuditEntries(ctx context.Context, filter bson.M, limit, offset int) ([]*models.AuditEntry, error) {
	return as.auditRepo.GetAllAuditEntries(ctx, filter, limit, offset)
}

func (as *auditServiceImpl) GetAuditEntryByID(ctx context.Context, id string) (*models.AuditEntry, error) {
	return as.auditRepo.GetAuditEntryByID(ctx, id)
}
