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

// RoleRepository defines all database operations for roles.
type RoleRepository interface {
	Create(ctx context.Context, role *models.Role) error
	GetByID(ctx context.Context, id string) (*models.Role, error)
	GetByName(ctx context.Context, name string) (*models.Role, error)
	GetAll(ctx context.Context) ([]models.Role, error)
	Update(ctx context.Context, id string, req *models.UpdateRoleRequest) (*models.Role, error)
	Delete(ctx context.Context, id string) error
	UpdatePermissions(ctx context.Context, id string, perms []models.PermissionObject) error
	// MaxLevel returns the highest level value stored across all roles,
	// or 0 if there are no roles. Used to compute the next sequential level.
	MaxLevel(ctx context.Context) (int, error)
}

type mongoRoleRepo struct {
	coll *mongo.Collection
}

// NewRoleRepository creates a MongoDB-backed RoleRepository.
func NewRoleRepository(db *mongo.Database, collectionName string) RoleRepository {
	return NewMongoRoleRepository(db, collectionName)
}

// NewMongoRoleRepository creates a MongoDB-backed RoleRepository.
func NewMongoRoleRepository(db *mongo.Database, collectionName string) RoleRepository {
	coll := db.Collection(collectionName)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_, _ = coll.Indexes().CreateMany(ctx, []mongo.IndexModel{
			{
				Keys:    bson.D{{Key: "name", Value: 1}},
				Options: options.Index().SetUnique(true),
			},
			{
				Keys: bson.D{{Key: "level", Value: 1}},
			},
		})
	}()
	return &mongoRoleRepo{coll: coll}
}

func (r *mongoRoleRepo) Create(ctx context.Context, role *models.Role) error {
	if role.ID == "" {
		role.ID = primitive.NewObjectID().Hex()
	}
	now := time.Now()
	role.CreatedAt = now
	role.UpdatedAt = now
	if role.Permissions == nil {
		role.Permissions = []models.PermissionObject{}
	}
	if role.Active == 0 {
		role.Active = 1
	}

	doc := bson.M{
		"_id":         role.ID,
		"name":        role.Name,
		"description": role.Description,
		"level":       role.Level,
		"is_admin":    role.IsAdmin,
		"active":      role.Active,
		"permissions": role.Permissions,
		"created_at":  role.CreatedAt,
		"updated_at":  role.UpdatedAt,
	}
	if objID, err := primitive.ObjectIDFromHex(role.ID); err == nil {
		doc["_id"] = objID
	}

	_, err := r.coll.InsertOne(ctx, doc)
	if mongo.IsDuplicateKeyError(err) {
		return models.ErrRoleAlreadyExists
	}
	return err
}

func (r *mongoRoleRepo) GetByID(ctx context.Context, id string) (*models.Role, error) {
	var role models.Role
	if err := r.coll.FindOne(ctx, toMongoIDFilter(id)).Decode(&role); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, models.ErrRoleNotFound
		}
		return nil, fmt.Errorf("GetByID: %w", err)
	}
	return &role, nil
}

// GetByName retrieves a role by its unique name.
func (r *mongoRoleRepo) GetByName(ctx context.Context, name string) (*models.Role, error) {
	var role models.Role
	if err := r.coll.FindOne(ctx, bson.M{"name": name}).Decode(&role); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, models.ErrRoleNotFound
		}
		return nil, fmt.Errorf("GetByName: %w", err)
	}
	return &role, nil
}

// GetAll returns all roles sorted by level ascending.
func (r *mongoRoleRepo) GetAll(ctx context.Context) ([]models.Role, error) {
	opts := options.Find().SetSort(bson.D{{Key: "level", Value: 1}})
	cursor, err := r.coll.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, fmt.Errorf("GetAll: %w", err)
	}
	defer cursor.Close(ctx)
	var list []models.Role
	if err := cursor.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("GetAll decode: %w", err)
	}
	if list == nil {
		list = []models.Role{}
	}
	return list, nil
}

// MaxLevel returns the highest level value stored across all roles, or 0 when there are no roles.
func (r *mongoRoleRepo) MaxLevel(ctx context.Context) (int, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.D{{Key: "_id", Value: nil}, {Key: "max", Value: bson.D{{Key: "$max", Value: "$level"}}}}}},
	}
	cursor, err := r.coll.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, fmt.Errorf("MaxLevel: %w", err)
	}
	defer cursor.Close(ctx)

	var results []struct {
		Max int `bson:"max"`
	}
	if err := cursor.All(ctx, &results); err != nil {
		return 0, fmt.Errorf("MaxLevel decode: %w", err)
	}
	if len(results) == 0 {
		return 0, nil
	}
	return results[0].Max, nil
}

func (r *mongoRoleRepo) Update(ctx context.Context, id string, req *models.UpdateRoleRequest) (*models.Role, error) {
	fields := bson.M{"updated_at": time.Now()}
	if req.Name != "" {
		fields["name"] = req.Name
	}
	if req.Description != "" {
		fields["description"] = req.Description
	}
	if req.IsAdmin != nil {
		fields["is_admin"] = *req.IsAdmin
	}
	if req.Active != nil {
		fields["active"] = *req.Active
	}
	if req.ParsedPerms != nil {
		fields["permissions"] = req.ParsedPerms
	}
	after := options.After
	var role models.Role
	err := r.coll.FindOneAndUpdate(
		ctx,
		toMongoIDFilter(id),
		bson.M{"$set": fields},
		&options.FindOneAndUpdateOptions{ReturnDocument: &after},
	).Decode(&role)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, models.ErrRoleNotFound
	}
	if mongo.IsDuplicateKeyError(err) {
		return nil, models.ErrRoleAlreadyExists
	}
	return &role, err
}

func (r *mongoRoleRepo) Delete(ctx context.Context, id string) error {
	res, err := r.coll.DeleteOne(ctx, toMongoIDFilter(id))
	if err != nil {
		return fmt.Errorf("Delete: %w", err)
	}
	if res.DeletedCount == 0 {
		return models.ErrRoleNotFound
	}
	return nil
}

func (r *mongoRoleRepo) UpdatePermissions(ctx context.Context, id string, perms []models.PermissionObject) error {
	res, err := r.coll.UpdateOne(
		ctx,
		toMongoIDFilter(id),
		bson.M{"$set": bson.M{"permissions": perms, "updated_at": time.Now()}},
	)
	if err != nil {
		return fmt.Errorf("UpdatePermissions: %w", err)
	}
	if res.MatchedCount == 0 {
		return models.ErrRoleNotFound
	}
	return nil
}
