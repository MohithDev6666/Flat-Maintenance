package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/trideadmin/rbac/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ModuleRepository defines all database operations for modules.
type ModuleRepository interface {
	Create(ctx context.Context, mod *models.Module) error
	GetByID(ctx context.Context, id string) (*models.Module, error)
	GetByKey(ctx context.Context, key string) (*models.Module, error)
	GetAll(ctx context.Context) ([]models.Module, error)
	Update(ctx context.Context, id string, req models.UpdateModuleRequest) (*models.Module, error)
	Delete(ctx context.Context, id string) error
}

type mongoModuleRepo struct {
	coll *mongo.Collection
}

// NewModuleRepository creates a MongoDB-backed ModuleRepository.
func NewModuleRepository(db *mongo.Database, collectionName string) ModuleRepository {
	return NewMongoModuleRepository(db, collectionName)
}

// NewMongoModuleRepository creates a MongoDB-backed ModuleRepository.
func NewMongoModuleRepository(db *mongo.Database, collectionName string) ModuleRepository {
	coll := db.Collection(collectionName)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_, _ = coll.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys:    bson.D{{Key: "key", Value: 1}},
			Options: options.Index().SetUnique(true),
		})
	}()
	return &mongoModuleRepo{coll: coll}
}

func (r *mongoModuleRepo) Create(ctx context.Context, mod *models.Module) error {
	if mod.ID == "" {
		mod.ID = primitive.NewObjectID().Hex()
	}
	now := time.Now()
	mod.CreatedAt = now
	mod.UpdatedAt = now
	if mod.Permissions == nil {
		mod.Permissions = []string{}
	}

	doc := bson.M{
		"_id":         mod.ID,
		"key":         mod.Key,
		"name":        mod.Name,
		"description": mod.Description,
		"is_master":   mod.IsMaster,
		"permissions": mod.Permissions,
		"created_at":  mod.CreatedAt,
		"updated_at":  mod.UpdatedAt,
	}
	if objID, err := primitive.ObjectIDFromHex(mod.ID); err == nil {
		doc["_id"] = objID
	}

	_, err := r.coll.InsertOne(ctx, doc)
	if mongo.IsDuplicateKeyError(err) {
		return models.ErrModuleAlreadyExists
	}
	return err
}

func (r *mongoModuleRepo) GetByID(ctx context.Context, id string) (*models.Module, error) {
	var mod models.Module
	if err := r.coll.FindOne(ctx, toMongoIDFilter(id)).Decode(&mod); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, models.ErrModuleNotFound
		}
		return nil, fmt.Errorf("GetByID: %w", err)
	}
	return &mod, nil
}

func (r *mongoModuleRepo) GetByKey(ctx context.Context, key string) (*models.Module, error) {
	var mod models.Module
	if err := r.coll.FindOne(ctx, bson.M{"key": key}).Decode(&mod); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, models.ErrModuleNotFound
		}
		return nil, fmt.Errorf("GetByKey: %w", err)
	}
	return &mod, nil
}

func (r *mongoModuleRepo) GetAll(ctx context.Context) ([]models.Module, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}})
	cursor, err := r.coll.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, fmt.Errorf("GetAll: %w", err)
	}
	defer cursor.Close(ctx)
	var list []models.Module
	if err := cursor.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("GetAll decode: %w", err)
	}
	if list == nil {
		list = []models.Module{}
	}
	return list, nil
}

func (r *mongoModuleRepo) Update(ctx context.Context, id string, req models.UpdateModuleRequest) (*models.Module, error) {
	fields := bson.M{"updated_at": time.Now()}
	if req.Name != "" {
		fields["name"] = req.Name
	}
	if req.Description != "" {
		fields["description"] = req.Description
	}
	if req.IsMaster != nil {
		fields["is_master"] = *req.IsMaster
	}
	if req.Permissions != nil {
		fields["permissions"] = req.Permissions
	}
	after := options.After
	var mod models.Module
	err := r.coll.FindOneAndUpdate(
		ctx,
		toMongoIDFilter(id),
		bson.M{"$set": fields},
		&options.FindOneAndUpdateOptions{ReturnDocument: &after},
	).Decode(&mod)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, models.ErrModuleNotFound
	}
	return &mod, err
}

func (r *mongoModuleRepo) Delete(ctx context.Context, id string) error {
	res, err := r.coll.DeleteOne(ctx, toMongoIDFilter(id))
	if err != nil {
		return fmt.Errorf("Delete: %w", err)
	}
	if res.DeletedCount == 0 {
		return models.ErrModuleNotFound
	}
	return nil
}
