package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoCategoriesRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoCategoriesRepo(client *mongo.Client, Database string) Categories {
	return &MongoCategoriesRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoCategoriesRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewCategory().Collection())
}

func (repo *MongoCategoriesRepo) GetAllCategories(ctx context.Context, filter bson.M, limit, offset int) ([]*models.Category, error) {
	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(offset))
	cursor, err := repo.collection().Find(ctx, filter, opts)
	if err != nil {
		logs.ErrorLogger.Println("Error fetching categories:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	categories := make([]*models.Category, 0)
	if err := cursor.All(ctx, &categories); err != nil {
		logs.ErrorLogger.Println("Error decoding categories:", err)
		return nil, err
	}
	return categories, nil
}

func (repo *MongoCategoriesRepo) GetCategoryByID(ctx context.Context, id string) (*models.Category, error) {
	var category models.Category
	if err := repo.collection().FindOne(ctx, bson.M{"id": id}).Decode(&category); err != nil {
		return nil, err
	}
	return &category, nil
}

func (repo *MongoCategoriesRepo) CountCategoriesByName(ctx context.Context, name string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"name": name})
}

func (repo *MongoCategoriesRepo) CreateCategory(ctx context.Context, category *models.Category) error {
	_, err := repo.collection().InsertOne(ctx, category)
	return err
}

func (repo *MongoCategoriesRepo) UpdateCategory(ctx context.Context, category *models.Category) error {
	result, err := repo.collection().ReplaceOne(ctx, bson.M{"id": category.ID}, category)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoCategoriesRepo) DeleteCategory(ctx context.Context, id string) error {
	result, err := repo.collection().DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}
