package repo

import (
	"context"
	"errors"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoTenantsRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoTenantsRepo(client *mongo.Client, Database string) Tenants {
	return &MongoTenantsRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoTenantsRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewTenant().Collection())
}

func (repo *MongoTenantsRepo) GetAllTenants(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Tenant, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, filter, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching tenants:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	tenants := make([]*models.Tenant, 0)
	if err := cursor.All(ctx, &tenants); err != nil {
		logs.ErrorLogger.Println("Error decoding tenants:", err)
		return nil, err
	}
	return tenants, nil
}

func (repo *MongoTenantsRepo) GetTenantByID(ctx context.Context, id string) (*models.Tenant, error) {
	var tenant models.Tenant
	if err := repo.collection().FindOne(ctx, bson.M{"id": id}).Decode(&tenant); err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (repo *MongoTenantsRepo) CountTenantsByFlat(ctx context.Context, flatID string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"flatId": flatID})
}

func (repo *MongoTenantsRepo) HasOverlappingTenancy(ctx context.Context, flatID, excludeID, moveIn, moveOut string) (bool, error) {
	if moveOut == "" {
		moveOut = "9999-12-31"
	}
	filter := bson.M{
		"flatId": flatID,
		"id":     bson.M{"$ne": excludeID},
		"moveIn": bson.M{"$lt": moveOut},
		"$or": []bson.M{
			{"moveOut": ""},
			{"moveOut": nil},
			{"moveOut": bson.M{"$gt": moveIn}},
		},
	}
	err := repo.collection().FindOne(ctx, filter).Err()
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	return err == nil, err
}

func (repo *MongoTenantsRepo) HasActiveTenant(ctx context.Context, flatID, today string) (bool, error) {
	count, err := repo.collection().CountDocuments(ctx, bson.M{
		"flatId": flatID,
		"moveIn": bson.M{"$lte": today},
		"$or": []bson.M{
			{"moveOut": ""},
			{"moveOut": nil},
			{"moveOut": bson.M{"$gt": today}},
		},
	})
	return count > 0, err
}

func (repo *MongoTenantsRepo) CreateTenant(ctx context.Context, tenant *models.Tenant) error {
	_, err := repo.collection().InsertOne(ctx, tenant)
	return err
}

func (repo *MongoTenantsRepo) UpdateTenant(ctx context.Context, tenant *models.Tenant) error {
	result, err := repo.collection().ReplaceOne(ctx, bson.M{"id": tenant.ID}, tenant)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoTenantsRepo) DeleteTenant(ctx context.Context, id string) error {
	result, err := repo.collection().DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}
