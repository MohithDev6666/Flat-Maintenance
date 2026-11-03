package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	categoryRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/repo"
	expenseRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
)

type categoryServiceImpl struct {
	categoryRepo categoryRepo.Categories
	expenseRepo  expenseRepo.Expenses
	auditRepo    auditRepo.Audit
}

func NewCategoryService(categoryRepo categoryRepo.Categories, expenseRepo expenseRepo.Expenses, auditRepo auditRepo.Audit) CategoryService {
	return &categoryServiceImpl{
		categoryRepo: categoryRepo,
		expenseRepo:  expenseRepo,
		auditRepo:    auditRepo,
	}
}

func (cs *categoryServiceImpl) GetAllCategories(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Category, error) {
	return cs.categoryRepo.GetAllCategories(ctx, filter, limit, offset)
}

func (cs *categoryServiceImpl) GetCategoryByID(ctx context.Context, id string) (*models.Category, error) {
	return cs.categoryRepo.GetCategoryByID(ctx, id)
}

func (cs *categoryServiceImpl) CreateCategory(ctx context.Context, actor string, category *models.Category) (*models.Category, error) {
	if err := prepareCategory(category); err != nil {
		return nil, err
	}
	if strings.TrimSpace(category.ID) == "" {
		category.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	category.CreatedAt, category.UpdatedAt = now, now
	if err := cs.categoryRepo.CreateCategory(ctx, category); err != nil {
		return nil, err
	}
	if err := cs.audit(ctx, actor, "Created", nil, category); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Category created successfully:", category.ID)
	return category, nil
}

func (cs *categoryServiceImpl) UpdateCategory(ctx context.Context, actor, id string, category *models.Category) (*models.Category, error) {
	old, err := cs.categoryRepo.GetCategoryByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := prepareCategory(category); err != nil {
		return nil, err
	}
	category.ID, category.CreatedAt, category.UpdatedAt = id, old.CreatedAt, time.Now().UTC()
	if err := cs.categoryRepo.UpdateCategory(ctx, category); err != nil {
		return nil, err
	}
	if old.Name != category.Name {
		if err := cs.expenseRepo.RenameCategory(ctx, old.Name, category.Name); err != nil {
			return nil, err
		}
	}
	if err := cs.audit(ctx, actor, "Edited", old, category); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Category updated successfully:", id)
	return category, nil
}

func (cs *categoryServiceImpl) DeleteCategory(ctx context.Context, actor, id string) error {
	old, err := cs.categoryRepo.GetCategoryByID(ctx, id)
	if err != nil {
		return err
	}
	used, err := cs.expenseRepo.CountExpensesByCategory(ctx, old.Name)
	if err != nil {
		return err
	}
	if used > 0 {
		return utils.Conflict("category is used by an expense; mark it Inactive instead")
	}
	if err := cs.categoryRepo.DeleteCategory(ctx, id); err != nil {
		return err
	}
	logs.InfoLogger.Println("Category deleted successfully:", id)
	return cs.audit(ctx, actor, "Deleted", old, nil)
}

func (cs *categoryServiceImpl) audit(ctx context.Context, actor, action string, old, next *models.Category) error {
	record := next
	if record == nil {
		record = old
	}
	entry := models.NewAuditRecord(actor, "Category", action, record.Name, utils.JSONString(old), utils.JSONString(next))
	return cs.auditRepo.CreateAuditEntry(ctx, entry)
}

func prepareCategory(category *models.Category) error {
	category.Name = strings.TrimSpace(category.Name)
	category.Description = strings.TrimSpace(category.Description)
	for _, field := range []struct{ name, value string }{
		{"name", category.Name}, {"defaultTag", category.DefaultTag}, {"status", category.Status},
	} {
		if strings.TrimSpace(field.value) == "" {
			return utils.BadRequest(field.name + " is required")
		}
	}
	if !utils.OneOf(category.DefaultTag, "Owner", "Tenant", "Other") || !utils.OneOf(category.Status, "Active", "Inactive") {
		return utils.BadRequest("defaultTag or status is invalid")
	}
	return nil
}
