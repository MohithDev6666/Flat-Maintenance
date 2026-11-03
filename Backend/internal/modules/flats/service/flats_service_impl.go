package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	flatRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/repo"
	ownerRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/repo"
	paymentRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/repo"
	tenantRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
)

type flatServiceImpl struct {
	flatRepo    flatRepo.Flats
	ownerRepo   ownerRepo.Owners
	tenantRepo  tenantRepo.Tenants
	paymentRepo paymentRepo.Payments
	auditRepo   auditRepo.Audit
}

func NewFlatService(flatRepo flatRepo.Flats, ownerRepo ownerRepo.Owners, tenantRepo tenantRepo.Tenants, paymentRepo paymentRepo.Payments, auditRepo auditRepo.Audit) FlatService {
	return &flatServiceImpl{
		flatRepo:    flatRepo,
		ownerRepo:   ownerRepo,
		tenantRepo:  tenantRepo,
		paymentRepo: paymentRepo,
		auditRepo:   auditRepo,
	}
}

func (fs *flatServiceImpl) GetAllFlats(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Flat, error) {
	return fs.flatRepo.GetAllFlats(ctx, filter, limit, offset)
}

func (fs *flatServiceImpl) GetFlatByID(ctx context.Context, id string) (*models.Flat, error) {
	return fs.flatRepo.GetFlatByID(ctx, id)
}

func (fs *flatServiceImpl) CreateFlat(ctx context.Context, actor string, flat *models.Flat) (*models.Flat, error) {
	flat.Number = strings.TrimSpace(flat.Number)
	if err := validateFlat(flat); err != nil {
		return nil, err
	}
	if strings.TrimSpace(flat.ID) == "" {
		flat.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	flat.CreatedAt, flat.UpdatedAt = now, now
	if err := fs.flatRepo.CreateFlat(ctx, flat); err != nil {
		return nil, err
	}
	if err := fs.audit(ctx, actor, "Created", nil, flat); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Flat created successfully:", flat.ID)
	return flat, nil
}

func (fs *flatServiceImpl) UpdateFlat(ctx context.Context, actor, id string, flat *models.Flat) (*models.Flat, error) {
	old, err := fs.flatRepo.GetFlatByID(ctx, id)
	if err != nil {
		return nil, err
	}
	flat.Number = strings.TrimSpace(flat.Number)
	if err := validateFlat(flat); err != nil {
		return nil, err
	}
	flat.ID, flat.CreatedAt, flat.UpdatedAt = id, old.CreatedAt, time.Now().UTC()
	if err := fs.flatRepo.UpdateFlat(ctx, flat); err != nil {
		return nil, err
	}
	if err := fs.audit(ctx, actor, "Edited", old, flat); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Flat updated successfully:", id)
	return flat, nil
}

func (fs *flatServiceImpl) DeleteFlat(ctx context.Context, actor, id string) error {
	old, err := fs.flatRepo.GetFlatByID(ctx, id)
	if err != nil {
		return err
	}
	for _, count := range []func(context.Context, string) (int64, error){
		fs.ownerRepo.CountOwnersByFlat, fs.tenantRepo.CountTenantsByFlat, fs.paymentRepo.CountPaymentsByFlat,
	} {
		linked, err := count(ctx, id)
		if err != nil {
			return err
		}
		if linked > 0 {
			return utils.Conflict("flat has linked owner, tenant, or payment records")
		}
	}
	if err := fs.flatRepo.DeleteFlat(ctx, id); err != nil {
		return err
	}
	logs.InfoLogger.Println("Flat deleted successfully:", id)
	return fs.audit(ctx, actor, "Deleted", old, nil)
}

func (fs *flatServiceImpl) audit(ctx context.Context, actor, action string, old, next *models.Flat) error {
	record := next
	if record == nil {
		record = old
	}
	entry := models.NewAuditRecord(actor, "Flat", action, "Flat "+record.Number, utils.JSONString(old), utils.JSONString(next))
	return fs.auditRepo.CreateAuditEntry(ctx, entry)
}

func validateFlat(flat *models.Flat) error {
	if flat.Number == "" {
		return utils.BadRequest("number is required")
	}
	if flat.Floor < 1 {
		return utils.BadRequest("floor must be a positive integer")
	}
	if !utils.OneOf(flat.Status, "Occupied", "Available") {
		return utils.BadRequest("status must be Occupied or Available")
	}
	return nil
}
