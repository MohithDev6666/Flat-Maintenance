package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	flatRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/repo"
	ownerRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/repo"
	tenantRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/repo"
	"go.mongodb.org/mongo-driver/bson"
)

type auditServiceImpl struct {
	auditRepo  auditRepo.Audit
	flatRepo   flatRepo.Flats
	ownerRepo  ownerRepo.Owners
	tenantRepo tenantRepo.Tenants
}

// NewAuditService reads the audit trail; the flat, owner and tenant repos turn stored IDs into names.
func NewAuditService(auditRepo auditRepo.Audit, flatRepo flatRepo.Flats, ownerRepo ownerRepo.Owners, tenantRepo tenantRepo.Tenants) AuditService {
	return &auditServiceImpl{
		auditRepo:  auditRepo,
		flatRepo:   flatRepo,
		ownerRepo:  ownerRepo,
		tenantRepo: tenantRepo,
	}
}

func (as *auditServiceImpl) GetAllAuditEntries(ctx context.Context, filter bson.M, limit, offset int) ([]*models.AuditEntry, error) {
	entries, err := as.auditRepo.GetAllAuditEntries(ctx, filter, limit, offset)
	if err != nil {
		return nil, err
	}
	resolver := as.resolver(ctx)
	for _, entry := range entries {
		resolver.decodeChanges(entry)
	}
	return entries, nil
}

func (as *auditServiceImpl) GetAuditEntryByID(ctx context.Context, id string) (*models.AuditEntry, error) {
	entry, err := as.auditRepo.GetAuditEntryByID(ctx, id)
	if err != nil {
		return nil, err
	}
	as.resolver(ctx).decodeChanges(entry)
	return entry, nil
}

func (as *auditServiceImpl) resolver(ctx context.Context) *referenceResolver {
	return &referenceResolver{ctx: ctx, svc: as, cache: make(map[string]string)}
}
