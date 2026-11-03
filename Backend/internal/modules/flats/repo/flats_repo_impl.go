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

type MongoFlatsRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoFlatsRepo(client *mongo.Client, Database string) Flats {
	return &MongoFlatsRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoFlatsRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewFlat().Collection())
}

func (repo *MongoFlatsRepo) GetAllFlats(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Flat, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, filter, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching flats:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	flats := make([]*models.Flat, 0)
	if err := cursor.All(ctx, &flats); err != nil {
		logs.ErrorLogger.Println("Error decoding flats:", err)
		return nil, err
	}
	return flats, nil
}

func (repo *MongoFlatsRepo) GetFlatByID(ctx context.Context, id string) (*models.Flat, error) {
	var flat models.Flat
	if err := repo.collection().FindOne(ctx, bson.M{"id": id}).Decode(&flat); err != nil {
		return nil, err
	}
	return &flat, nil
}

func (repo *MongoFlatsRepo) CreateFlat(ctx context.Context, flat *models.Flat) error {
	_, err := repo.collection().InsertOne(ctx, flat)
	return err
}

func (repo *MongoFlatsRepo) UpdateFlat(ctx context.Context, flat *models.Flat) error {
	result, err := repo.collection().ReplaceOne(ctx, bson.M{"id": flat.ID}, flat)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoFlatsRepo) DeleteFlat(ctx context.Context, id string) error {
	result, err := repo.collection().DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoFlatsRepo) UpdateFlatStatus(ctx context.Context, id, status string) error {
	_, err := repo.collection().UpdateOne(ctx, bson.M{"id": id}, bson.M{
		"$set": bson.M{"status": status, "updatedAt": time.Now().UTC()},
	})
	return err
}
