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

type MongoMonthLocksRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoMonthLocksRepo(client *mongo.Client, Database string) MonthLocks {
	return &MongoMonthLocksRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoMonthLocksRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewMonthLock().Collection())
}

func (repo *MongoMonthLocksRepo) GetAllMonthLocks(ctx context.Context, limit, offset int) ([]*models.MonthLock, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, bson.M{}, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching month locks:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	locks := make([]*models.MonthLock, 0)
	if err := cursor.All(ctx, &locks); err != nil {
		logs.ErrorLogger.Println("Error decoding month locks:", err)
		return nil, err
	}
	return locks, nil
}

func (repo *MongoMonthLocksRepo) GetMonthLockByMonth(ctx context.Context, month string) (*models.MonthLock, error) {
	var lock models.MonthLock
	if err := repo.collection().FindOne(ctx, bson.M{"month": month}).Decode(&lock); err != nil {
		return nil, err
	}
	return &lock, nil
}

func (repo *MongoMonthLocksRepo) IsMonthLocked(ctx context.Context, month string) (bool, error) {
	lock, err := repo.GetMonthLockByMonth(ctx, month)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return lock.Locked, nil
}

func (repo *MongoMonthLocksRepo) UpsertMonthLock(ctx context.Context, lock *models.MonthLock) error {
	_, err := repo.collection().ReplaceOne(ctx, bson.M{"month": lock.Month}, lock, options.Replace().SetUpsert(true))
	if err != nil {
		logs.ErrorLogger.Println("Error saving month lock:", lock.Month, err)
	}
	return err
}
