package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type Expenses interface {
	GetAllExpenses(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Expense, error)
	GetExpenseByID(ctx context.Context, id string) (*models.Expense, error)
	CountExpensesByCategory(ctx context.Context, category string) (int64, error)
	CreateExpense(ctx context.Context, expense *models.Expense) error
	UpdateExpense(ctx context.Context, expense *models.Expense) error
	RenameCategory(ctx context.Context, oldName, newName string) error
	DeleteExpense(ctx context.Context, id string) error
}
