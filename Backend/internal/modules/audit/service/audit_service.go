package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type AuditService interface {
	GetAllAuditEntries(ctx context.Context, filter bson.M, limit, offset int) ([]*models.AuditEntry, error)
	GetAuditEntryByID(ctx context.Context, id string) (*models.AuditEntry, error)
}
