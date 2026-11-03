package service

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	flatRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/repo"
	ownerRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/repo"
	paymentRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/repo"
	userLinkRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type ownerServiceImpl struct {
	ownerRepo    ownerRepo.Owners
	flatRepo     flatRepo.Flats
	paymentRepo  paymentRepo.Payments
	userLinkRepo userLinkRepo.UserLinks
	auditRepo    auditRepo.Audit
}

func NewOwnerService(ownerRepo ownerRepo.Owners, flatRepo flatRepo.Flats, paymentRepo paymentRepo.Payments, userLinkRepo userLinkRepo.UserLinks, auditRepo auditRepo.Audit) OwnerService {
	return &ownerServiceImpl{
		ownerRepo:    ownerRepo,
		flatRepo:     flatRepo,
		paymentRepo:  paymentRepo,
		userLinkRepo: userLinkRepo,
		auditRepo:    auditRepo,
	}
}

func (ow *ownerServiceImpl) GetAllOwners(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Owner, error) {
	return ow.ownerRepo.GetAllOwners(ctx, filter, limit, offset)
}

func (ow *ownerServiceImpl) GetOwnerByID(ctx context.Context, id string) (*models.Owner, error) {
	return ow.ownerRepo.GetOwnerByID(ctx, id)
}

func (ow *ownerServiceImpl) CreateOwner(ctx context.Context, actor string, owner *models.Owner) (*models.Owner, error) {
	if err := ow.prepare(ctx, owner); err != nil {
		return nil, err
	}
	previous, err := ow.releasePreviousOwner(ctx, "", utils.Deref(owner.FlatID))
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(owner.ID) == "" {
		owner.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	owner.CreatedAt, owner.UpdatedAt = now, now
	if err := ow.ownerRepo.CreateOwner(ctx, owner); err != nil {
		return nil, ow.restoreOwner(ctx, previous, "create new owner", err)
	}
	if err := ow.recordTransfer(ctx, actor, previous); err != nil {
		return nil, err
	}
	if err := ow.audit(ctx, actor, "Created", nil, owner); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Owner created successfully:", owner.ID)
	return owner, nil
}

func (ow *ownerServiceImpl) UpdateOwner(ctx context.Context, actor, id string, owner *models.Owner) (*models.Owner, error) {
	old, err := ow.ownerRepo.GetOwnerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := ow.prepare(ctx, owner); err != nil {
		return nil, err
	}
	previous, err := ow.releasePreviousOwner(ctx, id, utils.Deref(owner.FlatID))
	if err != nil {
		return nil, err
	}
	owner.ID, owner.CreatedAt, owner.UpdatedAt = id, old.CreatedAt, time.Now().UTC()
	if err := ow.ownerRepo.UpdateOwner(ctx, owner); err != nil {
		return nil, ow.restoreOwner(ctx, previous, "save new owner", err)
	}
	if err := ow.recordTransfer(ctx, actor, previous); err != nil {
		return nil, err
	}
	if err := ow.audit(ctx, actor, "Edited", old, owner); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Owner updated successfully:", id)
	return owner, nil
}

func (ow *ownerServiceImpl) DeleteOwner(ctx context.Context, actor, id string) error {
	old, err := ow.ownerRepo.GetOwnerByID(ctx, id)
	if err != nil {
		return err
	}
	if utils.Deref(old.FlatID) != "" {
		return utils.Conflict("owner still owns a flat; transfer ownership before deleting")
	}
	links, err := ow.userLinkRepo.CountLinksByOwner(ctx, id)
	if err != nil {
		return err
	}
	if links > 0 {
		return utils.Conflict("owner is linked to a user account")
	}
	payments, err := ow.paymentRepo.CountPaymentsByResident(ctx, "owner", id)
	if err != nil {
		return err
	}
	if payments > 0 {
		return utils.Conflict("owner has payment history")
	}
	if err := ow.ownerRepo.DeleteOwner(ctx, id); err != nil {
		return err
	}
	logs.InfoLogger.Println("Owner deleted successfully:", id)
	return ow.audit(ctx, actor, "Deleted", old, nil)
}

// prepare normalizes and validates an owner and its flat reference.
func (ow *ownerServiceImpl) prepare(ctx context.Context, owner *models.Owner) error {
	owner.Name = strings.TrimSpace(owner.Name)
	owner.Phone = strings.TrimSpace(owner.Phone)
	owner.Email = strings.ToLower(strings.TrimSpace(owner.Email))
	owner.Address = strings.TrimSpace(owner.Address)
	owner.Emergency = strings.TrimSpace(owner.Emergency)
	for _, field := range []struct{ name, value string }{
		{"name", owner.Name}, {"phone", owner.Phone}, {"email", owner.Email},
		{"emergency", owner.Emergency}, {"address", owner.Address},
	} {
		if field.value == "" {
			return utils.BadRequest(field.name + " is required")
		}
	}
	if _, err := mail.ParseAddress(owner.Email); err != nil {
		return utils.BadRequest("email must be valid")
	}
	if flatID := utils.Deref(owner.FlatID); flatID != "" {
		if _, err := ow.flatRepo.GetFlatByID(ctx, flatID); err != nil {
			return utils.ReferenceError(err, "flat")
		}
	}
	return nil
}

// releasePreviousOwner unassigns flatID from any other owner and returns that owner.
func (ow *ownerServiceImpl) releasePreviousOwner(ctx context.Context, id, flatID string) (*models.Owner, error) {
	if flatID == "" {
		return nil, nil
	}
	previous, err := ow.ownerRepo.GetOwnerByFlatID(ctx, flatID, id)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return previous, ow.ownerRepo.SetOwnerFlat(ctx, previous.ID, "")
}

// restoreOwner rolls back a released owner after a failed save and returns the save error.
func (ow *ownerServiceImpl) restoreOwner(ctx context.Context, previous *models.Owner, operation string, err error) error {
	if previous == nil {
		return err
	}
	if rollbackErr := ow.ownerRepo.SetOwnerFlat(ctx, previous.ID, utils.Deref(previous.FlatID)); rollbackErr != nil {
		return fmt.Errorf("%s: %v; restore previous owner: %w", operation, err, rollbackErr)
	}
	return err
}

func (ow *ownerServiceImpl) recordTransfer(ctx context.Context, actor string, previous *models.Owner) error {
	if previous == nil {
		return nil
	}
	released, err := ow.ownerRepo.GetOwnerByID(ctx, previous.ID)
	if err != nil {
		return err
	}
	return ow.audit(ctx, actor, "Transferred", previous, released)
}

func (ow *ownerServiceImpl) audit(ctx context.Context, actor, action string, old, next *models.Owner) error {
	record := next
	if record == nil {
		record = old
	}
	entry := models.NewAuditRecord(actor, "Owner", action, record.Name, utils.JSONString(old), utils.JSONString(next))
	return ow.auditRepo.CreateAuditEntry(ctx, entry)
}
