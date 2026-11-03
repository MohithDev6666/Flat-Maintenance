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

// UserRepository defines all database operations for users.
type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	GetByID(ctx context.Context, id string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetAll(ctx context.Context) ([]models.User, error)
	Update(ctx context.Context, id string, req *models.UpdateUserRequest) (*models.User, error)
	Delete(ctx context.Context, id string) error
	UpdateRole(ctx context.Context, userID, roleID string) error
	// Count returns the total number of users. Used to check for first-user
	// without loading the full collection.
	Count(ctx context.Context) (int64, error)
}

func toMongoIDFilter(id string) bson.M {
	if objID, err := primitive.ObjectIDFromHex(id); err == nil {
		return bson.M{"$or": []bson.M{{"_id": objID}, {"_id": id}}}
	}
	return bson.M{"_id": id}
}

type mongoUserRepo struct {
	coll *mongo.Collection
}

// NewUserRepository creates a MongoDB-backed UserRepository.
func NewUserRepository(db *mongo.Database, collectionName string) UserRepository {
	return NewMongoUserRepository(db, collectionName)
}

// NewMongoUserRepository creates a MongoDB-backed UserRepository.
func NewMongoUserRepository(db *mongo.Database, collectionName string) UserRepository {
	coll := db.Collection(collectionName)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_, _ = coll.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		})
	}()
	return &mongoUserRepo{coll: coll}
}

func (r *mongoUserRepo) Create(ctx context.Context, user *models.User) error {
	if user.ID == "" {
		user.ID = primitive.NewObjectID().Hex()
	}
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now
	if user.Active == 0 {
		user.Active = 1 // default to active
	}

	doc := bson.M{
		"_id":           user.ID,
		"name":          user.Name,
		"email":         user.Email,
		"password_hash": user.Password,
		"phone":         user.Phone,
		"role_id":       user.RoleID,
		"active":        user.Active,
		"created_at":    user.CreatedAt,
		"updated_at":    user.UpdatedAt,
	}
	if objID, err := primitive.ObjectIDFromHex(user.ID); err == nil {
		doc["_id"] = objID
	}

	_, err := r.coll.InsertOne(ctx, doc)
	if mongo.IsDuplicateKeyError(err) {
		return models.ErrUserAlreadyExists
	}
	return err
}

func (r *mongoUserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	var user models.User
	if err := r.coll.FindOne(ctx, toMongoIDFilter(id)).Decode(&user); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, models.ErrUserNotFound
		}
		return nil, fmt.Errorf("GetByID: %w", err)
	}
	return &user, nil
}

func (r *mongoUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	if err := r.coll.FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, models.ErrUserNotFound
		}
		return nil, fmt.Errorf("GetByEmail: %w", err)
	}
	return &user, nil
}

// GetAll returns all users sorted by creation date descending.
func (r *mongoUserRepo) GetAll(ctx context.Context) ([]models.User, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.coll.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, fmt.Errorf("GetAll: %w", err)
	}
	defer cursor.Close(ctx)
	var list []models.User
	if err := cursor.All(ctx, &list); err != nil {
		return nil, fmt.Errorf("GetAll decode: %w", err)
	}
	if list == nil {
		list = []models.User{}
	}
	return list, nil
}

// Count returns the total number of user documents without fetching them.
func (r *mongoUserRepo) Count(ctx context.Context) (int64, error) {
	n, err := r.coll.CountDocuments(ctx, bson.M{})
	if err != nil {
		return 0, fmt.Errorf("Count: %w", err)
	}
	return n, nil
}

func (r *mongoUserRepo) Update(ctx context.Context, id string, req *models.UpdateUserRequest) (*models.User, error) {
	fields := bson.M{"updated_at": time.Now()}
	if req.Name != "" {
		fields["name"] = req.Name
	}
	if req.Email != "" {
		fields["email"] = req.Email
	}
	if req.Password != "" {
		fields["password_hash"] = req.Password
	}
	if req.Phone != "" {
		fields["phone"] = req.Phone
	}
	if req.Active != nil {
		fields["active"] = *req.Active
	}
	after := options.After
	var user models.User
	err := r.coll.FindOneAndUpdate(
		ctx,
		toMongoIDFilter(id),
		bson.M{"$set": fields},
		&options.FindOneAndUpdateOptions{ReturnDocument: &after},
	).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, models.ErrUserNotFound
	}
	if mongo.IsDuplicateKeyError(err) {
		return nil, models.ErrEmailAlreadyTaken
	}
	return &user, err
}

func (r *mongoUserRepo) Delete(ctx context.Context, id string) error {
	res, err := r.coll.DeleteOne(ctx, toMongoIDFilter(id))
	if err != nil {
		return fmt.Errorf("Delete: %w", err)
	}
	if res.DeletedCount == 0 {
		return models.ErrUserNotFound
	}
	return nil
}

// UpdateRole assigns a new role to a user and stamps updated_at.
func (r *mongoUserRepo) UpdateRole(ctx context.Context, userID, roleID string) error {
	res, err := r.coll.UpdateOne(
		ctx,
		toMongoIDFilter(userID),
		bson.M{"$set": bson.M{"role_id": roleID, "updated_at": time.Now()}},
	)
	if err != nil {
		return fmt.Errorf("UpdateRole: %w", err)
	}
	if res.MatchedCount == 0 {
		return models.ErrUserNotFound
	}
	return nil
}
