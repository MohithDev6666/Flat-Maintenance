package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	rbacUsersCollection = "rbac_users"
	rbacRolesCollection = "rbac_roles"
)

type MongoUserLinksRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoUserLinksRepo(client *mongo.Client, Database string) UserLinks {
	return &MongoUserLinksRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoUserLinksRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewUserLink().Collection())
}

func (repo *MongoUserLinksRepo) GetAllUserLinks(ctx context.Context) ([]*models.UserLink, error) {
	cursor, err := repo.collection().Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "userId", Value: 1}}))
	if err != nil {
		logs.ErrorLogger.Println("Error fetching user profile links:", err)
		return nil, err
	}
	defer cursor.Close(ctx)
	links := make([]*models.UserLink, 0)
	if err := cursor.All(ctx, &links); err != nil {
		logs.ErrorLogger.Println("Error decoding user profile links:", err)
		return nil, err
	}
	return links, nil
}

func (repo *MongoUserLinksRepo) GetUserLinkByUserID(ctx context.Context, userID string) (*models.UserLink, error) {
	var link models.UserLink
	if err := repo.collection().FindOne(ctx, bson.M{"userId": userID}).Decode(&link); err != nil {
		return nil, err
	}
	return &link, nil
}

func (repo *MongoUserLinksRepo) CountLinksByOwner(ctx context.Context, ownerID string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"ownerId": ownerID})
}

func (repo *MongoUserLinksRepo) CountLinksByTenant(ctx context.Context, tenantID string) (int64, error) {
	return repo.collection().CountDocuments(ctx, bson.M{"tenantId": tenantID})
}

func (repo *MongoUserLinksRepo) UpsertUserLink(ctx context.Context, link *models.UserLink) error {
	_, err := repo.collection().ReplaceOne(ctx, bson.M{"userId": link.UserID}, link, options.Replace().SetUpsert(true))
	return err
}

func (repo *MongoUserLinksRepo) DeleteUserLink(ctx context.Context, userID string) error {
	result, err := repo.collection().DeleteOne(ctx, bson.M{"userId": userID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

func (repo *MongoUserLinksRepo) GetRBACUser(ctx context.Context, userID string) (bson.M, error) {
	var user bson.M
	err := repo.client.Database(repo.Database).Collection(rbacUsersCollection).FindOne(ctx, idFilter(userID)).Decode(&user)
	return user, err
}

func (repo *MongoUserLinksRepo) GetRBACRole(ctx context.Context, roleID string) (bson.M, error) {
	var role bson.M
	err := repo.client.Database(repo.Database).Collection(rbacRolesCollection).FindOne(ctx, idFilter(roleID)).Decode(&role)
	return role, err
}

func idFilter(id string) bson.M {
	values := []bson.M{{"_id": id}, {"id": id}}
	if objectID, err := primitive.ObjectIDFromHex(id); err == nil {
		values = append(values, bson.M{"_id": objectID})
	}
	return bson.M{"$or": values}
}
