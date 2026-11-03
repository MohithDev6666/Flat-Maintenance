package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type Payments interface {
	GetAllPayments(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Payment, error)
	GetPaymentByID(ctx context.Context, id string) (*models.Payment, error)
	CountPaymentsByFlat(ctx context.Context, flatID string) (int64, error)
	CountPaymentsByResident(ctx context.Context, role, residentID string) (int64, error)
	CreatePayment(ctx context.Context, payment *models.Payment) error
	UpdatePayment(ctx context.Context, payment *models.Payment) error
	DeletePayment(ctx context.Context, id string) error
}
