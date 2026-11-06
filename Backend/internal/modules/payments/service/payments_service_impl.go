package service

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	flatRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/repo"
	monthLockRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/repo"
	ownerRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/repo"
	paymentRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/repo"
	tenantRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

var errResidentUnavailable = utils.Forbidden("linked resident record is unavailable")

type paymentServiceImpl struct {
	paymentRepo   paymentRepo.Payments
	flatRepo      flatRepo.Flats
	ownerRepo     ownerRepo.Owners
	tenantRepo    tenantRepo.Tenants
	monthLockRepo monthLockRepo.MonthLocks
	auditRepo     auditRepo.Audit
}

func NewPaymentService(paymentRepo paymentRepo.Payments, flatRepo flatRepo.Flats, ownerRepo ownerRepo.Owners, tenantRepo tenantRepo.Tenants, monthLockRepo monthLockRepo.MonthLocks, auditRepo auditRepo.Audit) PaymentService {
	return &paymentServiceImpl{
		paymentRepo:   paymentRepo,
		flatRepo:      flatRepo,
		ownerRepo:     ownerRepo,
		tenantRepo:    tenantRepo,
		monthLockRepo: monthLockRepo,
		auditRepo:     auditRepo,
	}
}

func (ps *paymentServiceImpl) GetAllPayments(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Payment, error) {
	return ps.paymentRepo.GetAllPayments(ctx, filter, limit, offset)
}

func (ps *paymentServiceImpl) GetPaymentByID(ctx context.Context, id string) (*models.Payment, error) {
	return ps.paymentRepo.GetPaymentByID(ctx, id)
}

func (ps *paymentServiceImpl) CreatePayment(ctx context.Context, actor string, payment *models.Payment) (*models.Payment, error) {
	if err := ps.prepare(ctx, payment); err != nil {
		return nil, err
	}
	if err := ps.ensureMonthOpen(ctx, payment.Month); err != nil {
		return nil, err
	}
	if strings.TrimSpace(payment.ID) == "" {
		payment.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	payment.CreatedAt, payment.UpdatedAt = now, now
	if err := ps.paymentRepo.CreatePayment(ctx, payment); err != nil {
		return nil, err
	}
	if err := ps.audit(ctx, actor, "Created", nil, payment); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Payment created successfully:", payment.ID)
	return payment, nil
}

func (ps *paymentServiceImpl) UpdatePayment(ctx context.Context, actor, id string, payment *models.Payment) (*models.Payment, error) {
	old, err := ps.paymentRepo.GetPaymentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := ps.prepare(ctx, payment); err != nil {
		return nil, err
	}
	if err := ps.ensureMonthOpen(ctx, payment.Month); err != nil {
		return nil, err
	}
	payment.ID, payment.CreatedAt, payment.UpdatedAt = id, old.CreatedAt, time.Now().UTC()
	// Verification only changes through review (flag / mark as checked), never through an edit.
	payment.Status, payment.NeedsCheck, payment.CheckNote = old.Status, old.NeedsCheck, old.CheckNote
	if err := ps.paymentRepo.UpdatePayment(ctx, payment); err != nil {
		return nil, err
	}
	if err := ps.audit(ctx, actor, "Edited", old, payment); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Payment updated successfully:", id)
	return payment, nil
}

func (ps *paymentServiceImpl) DeletePayment(ctx context.Context, actor, id string) error {
	old, err := ps.paymentRepo.GetPaymentByID(ctx, id)
	if err != nil {
		return err
	}
	if err := ps.ensureMonthOpen(ctx, old.Month); err != nil {
		return err
	}
	if err := ps.paymentRepo.DeletePayment(ctx, id); err != nil {
		return err
	}
	logs.InfoLogger.Println("Payment deleted successfully:", id)
	return ps.audit(ctx, actor, "Deleted", old, nil)
}

func (ps *paymentServiceImpl) SetPaymentFlag(ctx context.Context, actor, id string, flagged bool, note string) (*models.Payment, error) {
	old, err := ps.paymentRepo.GetPaymentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := ps.ensureMonthOpen(ctx, old.Month); err != nil {
		return nil, err
	}
	action := "Verified"
	if flagged {
		action = "Flagged"
	} else {
		note = ""
	}
	next := *old
	next.NeedsCheck = flagged
	next.CheckNote = strings.TrimSpace(note)
	if !flagged {
		// Marking a payment as checked verifies it, so it now counts towards what was paid.
		next.Status = models.PaymentVerified
	}
	next.UpdatedAt = time.Now().UTC()
	if err := ps.paymentRepo.UpdatePayment(ctx, &next); err != nil {
		return nil, err
	}
	if err := ps.audit(ctx, actor, action, old, &next); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Payment", action, "successfully:", id)
	return &next, nil
}

func (ps *paymentServiceImpl) ApplyResidentIdentity(ctx context.Context, profile *models.UserLink, payment *models.Payment) error {
	var name, flatID, residentID, role string
	if profile.Kind == "tenant" {
		tenant, err := ps.tenantRepo.GetTenantByID(ctx, profile.TenantID)
		if err != nil {
			return residentLookupError(err)
		}
		name, flatID, residentID, role = tenant.Name, tenant.FlatID, tenant.ID, "tenant"
	} else {
		owner, err := ps.ownerRepo.GetOwnerByID(ctx, profile.OwnerID)
		if err != nil {
			return residentLookupError(err)
		}
		name, flatID, residentID, role = owner.Name, utils.Deref(owner.FlatID), owner.ID, "owner"
	}
	if flatID == "" || name == "" {
		return errResidentUnavailable
	}
	payment.UserID = profile.UserID
	payment.PayerName = name
	payment.FlatID = flatID
	payment.Role = role
	payment.ResidentID = residentID
	return nil
}

func (ps *paymentServiceImpl) ScopeToResident(ctx context.Context, profile *models.UserLink, filter bson.M) error {
	if profile.Kind == "owner" {
		flatID, err := ps.ownerFlatID(ctx, profile)
		if err != nil {
			return err
		}
		filter["role"] = "owner"
		filter["flatId"] = flatID
		return nil
	}
	filter["role"] = "tenant"
	filter["residentId"] = profile.TenantID
	return nil
}

func (ps *paymentServiceImpl) MatchesResident(ctx context.Context, profile *models.UserLink, payment *models.Payment) (bool, error) {
	if profile.Kind == "owner" {
		flatID, err := ps.ownerFlatID(ctx, profile)
		if err != nil {
			return false, err
		}
		return payment.Role == "owner" && payment.FlatID == flatID, nil
	}
	return profile.Kind == "tenant" && payment.Role == "tenant" && payment.ResidentID == profile.TenantID, nil
}

func (ps *paymentServiceImpl) ownerFlatID(ctx context.Context, profile *models.UserLink) (string, error) {
	owner, err := ps.ownerRepo.GetOwnerByID(ctx, profile.OwnerID)
	if err != nil {
		return "", err
	}
	flatID := utils.Deref(owner.FlatID)
	if flatID == "" {
		return "", errors.New("linked owner is not assigned to a flat")
	}
	return flatID, nil
}

// prepare normalizes and validates a payment, its flat and its resident.
func (ps *paymentServiceImpl) prepare(ctx context.Context, payment *models.Payment) error {
	payment.PayerName = strings.TrimSpace(payment.PayerName)
	payment.Reference = strings.TrimSpace(payment.Reference)
	for _, field := range []struct{ name, value string }{
		{"userId", payment.UserID}, {"payerName", payment.PayerName}, {"flatId", payment.FlatID},
		{"role", payment.Role}, {"residentId", payment.ResidentID}, {"month", payment.Month},
		{"date", payment.Date}, {"mode", payment.Mode},
	} {
		if strings.TrimSpace(field.value) == "" {
			return utils.BadRequest(field.name + " is required")
		}
	}
	// Rupees and paise: keep exactly two decimal places.
	payment.Amount = math.Round(payment.Amount*100) / 100
	if payment.Amount <= 0 {
		return utils.BadRequest("amount must be greater than zero")
	}
	if payment.Mode != "Cash" && payment.Reference == "" {
		return utils.BadRequest("reference is required for non-cash payments")
	}
	if !utils.OneOf(payment.Role, "owner", "tenant") {
		return utils.BadRequest("role must be owner or tenant")
	}
	if !utils.OneOf(payment.Mode, "Cash", "UPI", "Bank") {
		return utils.BadRequest("mode must be Cash, UPI or Bank")
	}
	if strings.TrimSpace(payment.Screenshot.Name) == "" || !utils.OneOf(payment.Screenshot.Kind, "image", "pdf") {
		return utils.BadRequest("screenshot is required")
	}

	if _, err := ps.flatRepo.GetFlatByID(ctx, payment.FlatID); err != nil {
		return utils.ReferenceError(err, "flat")
	}
	var err error
	if payment.Role == "tenant" {
		_, err = ps.tenantRepo.GetTenantByID(ctx, payment.ResidentID)
	} else {
		_, err = ps.ownerRepo.GetOwnerByID(ctx, payment.ResidentID)
	}
	if err != nil {
		return utils.ReferenceError(err, "resident")
	}
	return nil
}

func (ps *paymentServiceImpl) ensureMonthOpen(ctx context.Context, month string) error {
	if month == "" {
		return nil
	}
	locked, err := ps.monthLockRepo.IsMonthLocked(ctx, month)
	if err != nil {
		return err
	}
	if locked {
		return utils.Conflict(month + " is locked")
	}
	return nil
}

func (ps *paymentServiceImpl) audit(ctx context.Context, actor, action string, old, next *models.Payment) error {
	record := next
	if record == nil {
		record = old
	}
	description := "Flat " + record.FlatID + " · " + record.Month
	entry := models.NewAuditRecord(actor, "Payment", action, description, utils.JSONString(old), utils.JSONString(next))
	return ps.auditRepo.CreateAuditEntry(ctx, entry)
}

func residentLookupError(err error) error {
	if errors.Is(err, mongo.ErrNoDocuments) {
		return errResidentUnavailable
	}
	return err
}
