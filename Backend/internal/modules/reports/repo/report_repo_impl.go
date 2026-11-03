package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoReportRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoReportRepo(client *mongo.Client, Database string) Report {
	return &MongoReportRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoReportRepo) GetCollections(ctx context.Context, collections ...string) (map[string][]bson.M, error) {
	result := make(map[string][]bson.M, len(collections))
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}})
	for _, name := range collections {
		cursor, err := repo.client.Database(repo.Database).Collection(name).Find(ctx, bson.M{}, opts)
		if err != nil {
			logs.ErrorLogger.Println("Error fetching report collection:", name, err)
			return nil, err
		}
		items := make([]bson.M, 0)
		err = cursor.All(ctx, &items)
		_ = cursor.Close(ctx)
		if err != nil {
			logs.ErrorLogger.Println("Error decoding report collection:", name, err)
			return nil, err
		}
		result[name] = items
	}
	return result, nil
}
