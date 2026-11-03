package service

import (
	"context"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	flatRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/repo"
	paymentRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/repo"
	tenantRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/repo"
	userLinkRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
)

type tenantServiceImpl struct {
	tenantRepo   tenantRepo.Tenants
	flatRepo     flatRepo.Flats
	paymentRepo  paymentRepo.Payments
	userLinkRepo userLinkRepo.UserLinks
	auditRepo    auditRepo.Audit
}

func NewTenantService(tenantRepo tenantRepo.Tenants, flatRepo flatRepo.Flats, paymentRepo paymentRepo.Payments, userLinkRepo userLinkRepo.UserLinks, auditRepo auditRepo.Audit) TenantService {
	return &tenantServiceImpl{
		tenantRepo:   tenantRepo,
		flatRepo:     flatRepo,
		paymentRepo:  paymentRepo,
		userLinkRepo: userLinkRepo,
		auditRepo:    auditRepo,
	}
}

func (ts *tenantServiceImpl) GetAllTenants(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Tenant, error) {
	return ts.tenantRepo.GetAllTenants(ctx, filter, limit, offset)
}

func (ts *tenantServiceImpl) GetTenantByID(ctx context.Context, id string) (*models.Tenant, error) {
	return ts.tenantRepo.GetTenantByID(ctx, id)
}

func (ts *tenantServiceImpl) CreateTenant(ctx context.Context, actor string, tenant *models.Tenant) (*models.Tenant, error) {
	if err := ts.prepare(ctx, "", tenant); err != nil {
		return nil, err
	}
	occupancy, err := ts.occupancySnapshot(ctx, tenant.FlatID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(tenant.ID) == "" {
		tenant.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	tenant.CreatedAt, tenant.UpdatedAt = now, now
	if err := ts.tenantRepo.CreateTenant(ctx, tenant); err != nil {
		return nil, err
	}
	if err := ts.syncOccupancy(ctx, occupancy); err != nil {
		return nil, err
	}
	if err := ts.audit(ctx, actor, "Created", nil, tenant); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Tenant created successfully:", tenant.ID)
	return tenant, nil
}

func (ts *tenantServiceImpl) UpdateTenant(ctx context.Context, actor, id string, tenant *models.Tenant) (*models.Tenant, error) {
	old, err := ts.tenantRepo.GetTenantByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := ts.prepare(ctx, id, tenant); err != nil {
		return nil, err
	}
	occupancy, err := ts.occupancySnapshot(ctx, old.FlatID, tenant.FlatID)
	if err != nil {
		return nil, err
	}
	tenant.ID, tenant.CreatedAt, tenant.UpdatedAt = id, old.CreatedAt, time.Now().UTC()
	if err := ts.tenantRepo.UpdateTenant(ctx, tenant); err != nil {
		return nil, err
	}
	if err := ts.syncOccupancy(ctx, occupancy); err != nil {
		return nil, err
	}
	if err := ts.audit(ctx, actor, "Edited", old, tenant); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Tenant updated successfully:", id)
	return tenant, nil
}

func (ts *tenantServiceImpl) DeleteTenant(ctx context.Context, actor, id string) error {
	old, err := ts.tenantRepo.GetTenantByID(ctx, id)
	if err != nil {
		return err
	}
	links, err := ts.userLinkRepo.CountLinksByTenant(ctx, id)
	if err != nil {
		return err
	}
	if links > 0 {
		return utils.Conflict("tenant is linked to a user account")
	}
	payments, err := ts.paymentRepo.CountPaymentsByResident(ctx, "tenant", id)
	if err != nil {
		return err
	}
	if payments > 0 {
		return utils.Conflict("tenant has payment history; record a move-out date instead")
	}
	if err := ts.tenantRepo.DeleteTenant(ctx, id); err != nil {
		return err
	}
	logs.InfoLogger.Println("Tenant deleted successfully:", id)
	return ts.audit(ctx, actor, "Deleted", old, nil)
}

// prepare normalizes and validates a tenant, its flat and its tenancy dates.
func (ts *tenantServiceImpl) prepare(ctx context.Context, id string, tenant *models.Tenant) error {
	tenant.Name = strings.TrimSpace(tenant.Name)
	tenant.Phone = strings.TrimSpace(tenant.Phone)
	tenant.Email = strings.ToLower(strings.TrimSpace(tenant.Email))
	tenant.Emergency = strings.TrimSpace(tenant.Emergency)
	tenant.Vehicle = strings.TrimSpace(tenant.Vehicle)
	tenant.FlatID = strings.TrimSpace(tenant.FlatID)
	tenant.MoveIn = strings.TrimSpace(tenant.MoveIn)
	tenant.AgreementEnd = strings.TrimSpace(tenant.AgreementEnd)
	tenant.IDProofType = strings.TrimSpace(tenant.IDProofType)
	for _, field := range []struct{ name, value string }{
		{"name", tenant.Name}, {"phone", tenant.Phone}, {"email", tenant.Email}, {"emergency", tenant.Emergency},
		{"flatId", tenant.FlatID}, {"moveIn", tenant.MoveIn}, {"agreementEnd", tenant.AgreementEnd},
		{"idProofType", tenant.IDProofType},
	} {
		if field.value == "" {
			return utils.BadRequest(field.name + " is required")
		}
	}
	if _, err := mail.ParseAddress(tenant.Email); err != nil {
		return utils.BadRequest("email must be valid")
	}
	if !utils.IsDate(tenant.MoveIn) {
		return utils.BadRequest("moveIn must use YYYY-MM-DD format")
	}
	if !utils.IsDate(tenant.AgreementEnd) {
		return utils.BadRequest("agreementEnd must use YYYY-MM-DD format")
	}
	moveOut := utils.Deref(tenant.MoveOut)
	if moveOut != "" {
		if !utils.IsDate(moveOut) {
			return utils.BadRequest("moveOut must use YYYY-MM-DD format")
		}
		if moveOut < tenant.MoveIn {
			return utils.BadRequest("moveOut cannot be before moveIn")
		}
	}
	if tenant.Occupants < 1 {
		return utils.BadRequest("occupants must be a positive integer")
	}

	if _, err := ts.flatRepo.GetFlatByID(ctx, tenant.FlatID); err != nil {
		return utils.ReferenceError(err, "flat")
	}
	overlaps, err := ts.tenantRepo.HasOverlappingTenancy(ctx, tenant.FlatID, id, tenant.MoveIn, moveOut)
	if err != nil {
		return err
	}
	if overlaps {
		return utils.Conflict("tenant dates overlap another tenancy for this flat")
	}
	return nil
}

// occupancySnapshot records whether each affected flat has an active tenant before a write.
func (ts *tenantServiceImpl) occupancySnapshot(ctx context.Context, flatIDs ...string) (map[string]bool, error) {
	snapshot := make(map[string]bool, len(flatIDs))
	today := utils.Today()
	for _, flatID := range flatIDs {
		if flatID == "" {
			continue
		}
		if _, seen := snapshot[flatID]; seen {
			continue
		}
		active, err := ts.tenantRepo.HasActiveTenant(ctx, flatID, today)
		if err != nil {
			return nil, err
		}
		snapshot[flatID] = active
	}
	return snapshot, nil
}

// syncOccupancy marks flats Occupied when they gained an active tenant and Available when they lost one.
func (ts *tenantServiceImpl) syncOccupancy(ctx context.Context, before map[string]bool) error {
	today := utils.Today()
	for flatID, activeBefore := range before {
		activeAfter, err := ts.tenantRepo.HasActiveTenant(ctx, flatID, today)
		if err != nil {
			return err
		}
		var status string
		if activeAfter {
			status = "Occupied"
		} else if activeBefore {
			status = "Available"
		} else {
			continue
		}
		if err := ts.flatRepo.UpdateFlatStatus(ctx, flatID, status); err != nil {
			return err
		}
	}
	return nil
}

func (ts *tenantServiceImpl) audit(ctx context.Context, actor, action string, old, next *models.Tenant) error {
	record := next
	if record == nil {
		record = old
	}
	entry := models.NewAuditRecord(actor, "Tenant", action, record.Name, utils.JSONString(old), utils.JSONString(next))
	return ts.auditRepo.CreateAuditEntry(ctx, entry)
}
