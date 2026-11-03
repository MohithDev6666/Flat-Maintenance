package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoPaymentsRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoPaymentsRepo(client *mongo.Client, Database string) Payments {
	return &MongoPaymentsRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoPaymentsRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewPayment().Collection())
}

func (repo *MongoPaymentsRepo) GetAllPayments(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Payment, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, filter, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching payments:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	payments := make([]*models.Payment, 0)
	if err := cursor.All(ctx, &payments); err != nil {
		logs.ErrorLogger.Println("Error decoding payments:", err)
		return nil, err
	}
	return payments, nil
}

func (repo *MongoPaymentsRepo) GetPaymentByID(ctx context.Context, id string) (*models.Payment, error) {
	var payment models.Payment
	if err := repo.collection().FindOne(ctx, bson.M{"id": id}).Decode(&payment); err != nil {
		return nil, err
	}
	return &payment, nil
}

func (repo *MongoPaymentsRepo) CountPaymentsByFlat(ctx context.Context, flatID string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"flatId": flatID})
}

func (repo *MongoPaymentsRepo) CountPaymentsByResident(ctx context.Context, role, residentID string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"role": role, "residentId": residentID})
}

func (repo *MongoPaymentsRepo) CreatePayment(ctx context.Context, payment *models.Payment) error {
	_, err := repo.collection().InsertOne(ctx, payment)
	return err
}

func (repo *MongoPaymentsRepo) UpdatePayment(ctx context.Context, payment *models.Payment) error {
	result, err := repo.collection().ReplaceOne(ctx, bson.M{"id": payment.ID}, payment)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoPaymentsRepo) DeletePayment(ctx context.Context, id string) error {
	result, err := repo.collection().DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}
