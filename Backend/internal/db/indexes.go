package db

import (
	"context"
	"fmt"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var caseInsensitive = &options.Collation{Locale: "en", Strength: 2}

// EnsureIndexes creates the application collection indexes.
func EnsureIndexes(ctx context.Context, client *mongo.Client, database string) error {
	if client == nil {
		return fmt.Errorf("MongoDB client is required")
	}
	specs := map[string][]mongo.IndexModel{
		models.NewFlat().Collection(): {
			{Keys: bson.D{{Key: "number", Value: 1}}, Options: options.Index().SetUnique(true).SetCollation(caseInsensitive)},
		},
		models.NewCategory().Collection(): {
			{Keys: bson.D{{Key: "name", Value: 1}}, Options: options.Index().SetUnique(true).SetCollation(caseInsensitive)},
		},
		models.NewOwner().Collection(): {
			{Keys: bson.D{{Key: "flatId", Value: 1}}, Options: options.Index().SetUnique(true).SetPartialFilterExpression(
				bson.M{"flatId": bson.M{"$type": "string", "$gt": ""}},
			)},
		},
		models.NewTenant().Collection(): {
			{Keys: bson.D{{Key: "flatId", Value: 1}, {Key: "moveIn", Value: 1}}},
			{Keys: bson.D{{Key: "email", Value: 1}}},
		},
		models.NewPayment().Collection(): {
			{Keys: bson.D{{Key: "flatId", Value: 1}, {Key: "month", Value: 1}}},
			{Keys: bson.D{{Key: "residentId", Value: 1}, {Key: "month", Value: 1}}},
		},
		models.NewExpense().Collection(): {
			{Keys: bson.D{{Key: "date", Value: -1}}},
		},
		models.NewAuditEntry().Collection(): {
			{Keys: bson.D{{Key: "at", Value: -1}}},
		},
		models.NewMonthLock().Collection(): {
			{Keys: bson.D{{Key: "month", Value: 1}}, Options: options.Index().SetUnique(true)},
		},
		models.NewUserLink().Collection(): {
			{Keys: bson.D{{Key: "userId", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "ownerId", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
			{Keys: bson.D{{Key: "tenantId", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
		},
	}
	for collection, indexes := range specs {
		if _, err := client.Database(database).Collection(collection).Indexes().CreateMany(ctx, indexes); err != nil {
			return fmt.Errorf("create %s indexes: %w", collection, err)
		}
	}
	return nil
}
