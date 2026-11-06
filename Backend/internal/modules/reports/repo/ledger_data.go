package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// LedgerData is every record the money calculations read: flats, residents, expenses, payments,
// month locks, categories and the user-to-resident links (for out-of-pocket credit).
type LedgerData struct {
	Flats      []models.Flat
	Owners     []models.Owner
	Tenants    []models.Tenant
	Categories []models.Category
	Expenses   []models.Expense
	Payments   []models.Payment
	MonthLocks []models.MonthLock
	Links      []models.UserLink
}

func findAll[T any](ctx context.Context, collection *mongo.Collection) ([]T, error) {
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		logs.ErrorLogger.Println("Error fetching report collection:", collection.Name(), err)
		return nil, err
	}
	defer cursor.Close(ctx)
	items := make([]T, 0)
	if err := cursor.All(ctx, &items); err != nil {
		logs.ErrorLogger.Println("Error decoding report collection:", collection.Name(), err)
		return nil, err
	}
	return items, nil
}

func (repo *MongoReportRepo) LoadLedgerData(ctx context.Context) (*LedgerData, error) {
	db := repo.client.Database(repo.Database)
	data := &LedgerData{}
	var err error
	if data.Flats, err = findAll[models.Flat](ctx, db.Collection(models.NewFlat().Collection())); err != nil {
		return nil, err
	}
	if data.Owners, err = findAll[models.Owner](ctx, db.Collection(models.NewOwner().Collection())); err != nil {
		return nil, err
	}
	if data.Tenants, err = findAll[models.Tenant](ctx, db.Collection(models.NewTenant().Collection())); err != nil {
		return nil, err
	}
	if data.Categories, err = findAll[models.Category](ctx, db.Collection(models.NewCategory().Collection())); err != nil {
		return nil, err
	}
	if data.Expenses, err = findAll[models.Expense](ctx, db.Collection(models.NewExpense().Collection())); err != nil {
		return nil, err
	}
	if data.Payments, err = findAll[models.Payment](ctx, db.Collection(models.NewPayment().Collection())); err != nil {
		return nil, err
	}
	if data.MonthLocks, err = findAll[models.MonthLock](ctx, db.Collection(models.NewMonthLock().Collection())); err != nil {
		return nil, err
	}
	if data.Links, err = findAll[models.UserLink](ctx, db.Collection(models.NewUserLink().Collection())); err != nil {
		return nil, err
	}
	return data, nil
}
