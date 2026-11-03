package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	categoryRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/repo"
	expenseRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/repo"
	monthLockRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/repo"
	ownerRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/repo"
	tenantRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

var errResidentUnavailable = utils.Forbidden("linked resident record is unavailable")

type expenseServiceImpl struct {
	expenseRepo   expenseRepo.Expenses
	categoryRepo  categoryRepo.Categories
	monthLockRepo monthLockRepo.MonthLocks
	ownerRepo     ownerRepo.Owners
	tenantRepo    tenantRepo.Tenants
	auditRepo     auditRepo.Audit
}

func NewExpenseService(expenseRepo expenseRepo.Expenses, categoryRepo categoryRepo.Categories, monthLockRepo monthLockRepo.MonthLocks, ownerRepo ownerRepo.Owners, tenantRepo tenantRepo.Tenants, auditRepo auditRepo.Audit) ExpenseService {
	return &expenseServiceImpl{
		expenseRepo:   expenseRepo,
		categoryRepo:  categoryRepo,
		monthLockRepo: monthLockRepo,
		ownerRepo:     ownerRepo,
		tenantRepo:    tenantRepo,
		auditRepo:     auditRepo,
	}
}

func (es *expenseServiceImpl) GetAllExpenses(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Expense, error) {
	return es.expenseRepo.GetAllExpenses(ctx, filter, limit, offset)
}

func (es *expenseServiceImpl) GetExpenseByID(ctx context.Context, id string) (*models.Expense, error) {
	return es.expenseRepo.GetExpenseByID(ctx, id)
}

func (es *expenseServiceImpl) CreateExpense(ctx context.Context, actor string, expense *models.Expense) (*models.Expense, error) {
	if err := es.prepare(ctx, expense); err != nil {
		return nil, err
	}
	if err := es.ensureMonthOpen(ctx, month(expense.Date)); err != nil {
		return nil, err
	}
	if strings.TrimSpace(expense.ID) == "" {
		expense.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	expense.CreatedAt, expense.UpdatedAt = now, now
	if err := es.expenseRepo.CreateExpense(ctx, expense); err != nil {
		return nil, err
	}
	if err := es.audit(ctx, actor, "Created", nil, expense); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Expense created successfully:", expense.ID)
	return expense, nil
}

func (es *expenseServiceImpl) UpdateExpense(ctx context.Context, actor, id string, expense *models.Expense) (*models.Expense, error) {
	old, err := es.expenseRepo.GetExpenseByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := es.prepare(ctx, expense); err != nil {
		return nil, err
	}
	if oldMonth := month(old.Date); oldMonth != "" && oldMonth != month(expense.Date) {
		if err := es.ensureMonthOpen(ctx, oldMonth); err != nil {
			return nil, err
		}
	}
	if err := es.ensureMonthOpen(ctx, month(expense.Date)); err != nil {
		return nil, err
	}
	expense.ID, expense.CreatedAt, expense.UpdatedAt = id, old.CreatedAt, time.Now().UTC()
	if err := es.expenseRepo.UpdateExpense(ctx, expense); err != nil {
		return nil, err
	}
	if err := es.audit(ctx, actor, "Edited", old, expense); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Expense updated successfully:", id)
	return expense, nil
}

func (es *expenseServiceImpl) DeleteExpense(ctx context.Context, actor, id string) error {
	old, err := es.expenseRepo.GetExpenseByID(ctx, id)
	if err != nil {
		return err
	}
	if err := es.ensureMonthOpen(ctx, month(old.Date)); err != nil {
		return err
	}
	if err := es.expenseRepo.DeleteExpense(ctx, id); err != nil {
		return err
	}
	logs.InfoLogger.Println("Expense deleted successfully:", id)
	return es.audit(ctx, actor, "Deleted", old, nil)
}

func (es *expenseServiceImpl) ApplyResidentIdentity(ctx context.Context, profile *models.UserLink, userID string, expense *models.Expense) error {
	var name string
	if profile.Kind == "tenant" {
		tenant, err := es.tenantRepo.GetTenantByID(ctx, profile.TenantID)
		if err != nil {
			return residentLookupError(err)
		}
		name = tenant.Name
	} else {
		owner, err := es.ownerRepo.GetOwnerByID(ctx, profile.OwnerID)
		if err != nil {
			return residentLookupError(err)
		}
		name = owner.Name
	}
	if name == "" {
		return errResidentUnavailable
	}
	expense.PaidBy = name
	expense.PaidByUserID = &userID
	return nil
}

// prepare normalizes and validates an expense and its category.
func (es *expenseServiceImpl) prepare(ctx context.Context, expense *models.Expense) error {
	expense.Category = strings.TrimSpace(expense.Category)
	expense.Description = strings.TrimSpace(expense.Description)
	expense.VendorName = strings.TrimSpace(expense.VendorName)
	expense.VendorPhone = strings.TrimSpace(expense.VendorPhone)
	expense.PaidBy = strings.TrimSpace(expense.PaidBy)
	for _, field := range []struct{ name, value string }{
		{"date", expense.Date}, {"category", expense.Category}, {"responsibility", expense.Responsibility},
		{"description", expense.Description}, {"paymentMode", expense.PaymentMode}, {"paidBy", expense.PaidBy},
	} {
		if strings.TrimSpace(field.value) == "" {
			return utils.BadRequest(field.name + " is required")
		}
	}
	if expense.Amount <= 0 {
		return utils.BadRequest("amount must be greater than zero")
	}
	count, err := es.categoryRepo.CountCategoriesByName(ctx, expense.Category)
	if err != nil {
		return err
	}
	if count == 0 {
		return utils.Conflict("expense category does not exist")
	}
	return nil
}

func (es *expenseServiceImpl) ensureMonthOpen(ctx context.Context, month string) error {
	if month == "" {
		return nil
	}
	locked, err := es.monthLockRepo.IsMonthLocked(ctx, month)
	if err != nil {
		return err
	}
	if locked {
		return utils.Conflict(month + " is locked")
	}
	return nil
}

func (es *expenseServiceImpl) audit(ctx context.Context, actor, action string, old, next *models.Expense) error {
	record := next
	if record == nil {
		record = old
	}
	entry := models.NewAuditRecord(actor, "Expense", action, record.Category, utils.JSONString(old), utils.JSONString(next))
	return es.auditRepo.CreateAuditEntry(ctx, entry)
}

func residentLookupError(err error) error {
	if errors.Is(err, mongo.ErrNoDocuments) {
		return errResidentUnavailable
	}
	return err
}

// month returns the YYYY-MM prefix of a YYYY-MM-DD date.
func month(date string) string {
	if len(date) >= 7 {
		return date[:7]
	}
	return ""
}
