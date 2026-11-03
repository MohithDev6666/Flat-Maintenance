package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoAuditRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoAuditRepo(client *mongo.Client, Database string) Audit {
	return &MongoAuditRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoAuditRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewAuditEntry().Collection())
}

func (repo *MongoAuditRepo) GetAllAuditEntries(ctx context.Context, filter bson.M, limit, offset int) ([]*models.AuditEntry, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, filter, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching audit entries:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	entries := make([]*models.AuditEntry, 0)
	if err := cursor.All(ctx, &entries); err != nil {
		logs.ErrorLogger.Println("Error decoding audit entries:", err)
		return nil, err
	}
	return entries, nil
}

func (repo *MongoAuditRepo) GetAuditEntryByID(ctx context.Context, id string) (*models.AuditEntry, error) {
	var entry models.AuditEntry
	if err := repo.collection().FindOne(ctx, bson.M{"id": id}).Decode(&entry); err != nil {
		return nil, err
	}
	return &entry, nil
}

func (repo *MongoAuditRepo) CreateAuditEntry(ctx context.Context, entry *models.AuditEntry) error {
	if _, err := repo.collection().InsertOne(ctx, entry); err != nil {
		logs.ErrorLogger.Println("Error creating audit entry:", err)
		return err
	}
	return nil
}
