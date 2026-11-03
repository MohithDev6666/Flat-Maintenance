package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type PaymentService interface {
	GetAllPayments(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Payment, error)
	GetPaymentByID(ctx context.Context, id string) (*models.Payment, error)
	CreatePayment(ctx context.Context, actor string, payment *models.Payment) (*models.Payment, error)
	UpdatePayment(ctx context.Context, actor, id string, payment *models.Payment) (*models.Payment, error)
	DeletePayment(ctx context.Context, actor, id string) error
	SetPaymentFlag(ctx context.Context, actor, id string, flagged bool, note string) (*models.Payment, error)
	// ApplyResidentIdentity fills the payer fields from the resident linked to profile.
	ApplyResidentIdentity(ctx context.Context, profile *models.UserLink, payment *models.Payment) error
	// ScopeToResident restricts filter to the payments visible to profile.
	ScopeToResident(ctx context.Context, profile *models.UserLink, filter bson.M) error
	MatchesResident(ctx context.Context, profile *models.UserLink, payment *models.Payment) (bool, error)
}
