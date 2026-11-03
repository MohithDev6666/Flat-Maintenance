package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type ExpenseService interface {
	GetAllExpenses(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Expense, error)
	GetExpenseByID(ctx context.Context, id string) (*models.Expense, error)
	CreateExpense(ctx context.Context, actor string, expense *models.Expense) (*models.Expense, error)
	UpdateExpense(ctx context.Context, actor, id string, expense *models.Expense) (*models.Expense, error)
	DeleteExpense(ctx context.Context, actor, id string) error
	// ApplyResidentIdentity sets paidBy and paidByUserId from the resident linked to profile.
	ApplyResidentIdentity(ctx context.Context, profile *models.UserLink, userID string, expense *models.Expense) error
}
