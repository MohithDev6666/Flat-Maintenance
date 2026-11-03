package repo

import (
	"context"
	"time"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoOwnersRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoOwnersRepo(client *mongo.Client, Database string) Owners {
	return &MongoOwnersRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoOwnersRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewOwner().Collection())
}

func (repo *MongoOwnersRepo) GetAllOwners(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Owner, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, filter, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching owners:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	owners := make([]*models.Owner, 0)
	if err := cursor.All(ctx, &owners); err != nil {
		logs.ErrorLogger.Println("Error decoding owners:", err)
		return nil, err
	}
	return owners, nil
}

func (repo *MongoOwnersRepo) GetOwnerByID(ctx context.Context, id string) (*models.Owner, error) {
	var owner models.Owner
	if err := repo.collection().FindOne(ctx, bson.M{"id": id}).Decode(&owner); err != nil {
		return nil, err
	}
	return &owner, nil
}

func (repo *MongoOwnersRepo) GetOwnerByFlatID(ctx context.Context, flatID, excludeID string) (*models.Owner, error) {
	var owner models.Owner
	err := repo.collection().FindOne(ctx, bson.M{"flatId": flatID, "id": bson.M{"$ne": excludeID}}).Decode(&owner)
	if err != nil {
		return nil, err
	}
	return &owner, nil
}

func (repo *MongoOwnersRepo) CountOwnersByFlat(ctx context.Context, flatID string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"flatId": flatID})
}

func (repo *MongoOwnersRepo) CreateOwner(ctx context.Context, owner *models.Owner) error {
	_, err := repo.collection().InsertOne(ctx, owner)
	return err
}

func (repo *MongoOwnersRepo) UpdateOwner(ctx context.Context, owner *models.Owner) error {
	result, err := repo.collection().ReplaceOne(ctx, bson.M{"id": owner.ID}, owner)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoOwnersRepo) SetOwnerFlat(ctx context.Context, id, flatID string) error {
	_, err := repo.collection().UpdateOne(ctx, bson.M{"id": id}, bson.M{
		"$set": bson.M{"flatId": flatID, "updatedAt": time.Now().UTC()},
	})
	return err
}

func (repo *MongoOwnersRepo) DeleteOwner(ctx context.Context, id string) error {
	result, err := repo.collection().DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}
