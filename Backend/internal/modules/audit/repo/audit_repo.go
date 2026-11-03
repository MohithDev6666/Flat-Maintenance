package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type Audit interface {
	GetAllAuditEntries(ctx context.Context, filter bson.M, limit, offset int) ([]*models.AuditEntry, error)
	GetAuditEntryByID(ctx context.Context, id string) (*models.AuditEntry, error)
	CreateAuditEntry(ctx context.Context, entry *models.AuditEntry) error
}
