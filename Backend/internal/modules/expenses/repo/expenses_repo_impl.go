package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoExpensesRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoExpensesRepo(client *mongo.Client, Database string) Expenses {
	return &MongoExpensesRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoExpensesRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewExpense().Collection())
}

func (repo *MongoExpensesRepo) GetAllExpenses(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Expense, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, filter, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching expenses:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	expenses := make([]*models.Expense, 0)
	if err := cursor.All(ctx, &expenses); err != nil {
		logs.ErrorLogger.Println("Error decoding expenses:", err)
		return nil, err
	}
	return expenses, nil
}

func (repo *MongoExpensesRepo) GetExpenseByID(ctx context.Context, id string) (*models.Expense, error) {
	var expense models.Expense
	if err := repo.collection().FindOne(ctx, bson.M{"id": id}).Decode(&expense); err != nil {
		return nil, err
	}
	return &expense, nil
}

func (repo *MongoExpensesRepo) CountExpensesByCategory(ctx context.Context, category string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"category": category})
}

func (repo *MongoExpensesRepo) CreateExpense(ctx context.Context, expense *models.Expense) error {
	_, err := repo.collection().InsertOne(ctx, expense)
	return err
}

func (repo *MongoExpensesRepo) UpdateExpense(ctx context.Context, expense *models.Expense) error {
	result, err := repo.collection().ReplaceOne(ctx, bson.M{"id": expense.ID}, expense)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoExpensesRepo) RenameCategory(ctx context.Context, oldName, newName string) error {
	_, err := repo.collection().UpdateMany(ctx, bson.M{"category": oldName}, bson.M{"$set": bson.M{"category": newName}})
	return err
}

func (repo *MongoExpensesRepo) DeleteExpense(ctx context.Context, id string) error {
	result, err := repo.collection().DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}
