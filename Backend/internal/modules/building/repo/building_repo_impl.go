package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoBuildingRepo struct {
	client   *mongo.Client
	Database string
}

func NewMongoBuildingRepo(client *mongo.Client, Database string) Building {
	return &MongoBuildingRepo{
		client:   client,
		Database: Database,
	}
}

func (repo *MongoBuildingRepo) collection() *mongo.Collection {
	return repo.client.Database(repo.Database).Collection(models.NewBuilding().Collection())
}

func (repo *MongoBuildingRepo) GetBuilding(ctx context.Context) (*models.Building, error) {
	var building models.Building
	if err := repo.collection().FindOne(ctx, bson.M{"id": models.BuildingID}).Decode(&building); err != nil {
		return nil, err
	}
	return &building, nil
}

func (repo *MongoBuildingRepo) SaveBuilding(ctx context.Context, building *models.Building) error {
	building.ID = models.BuildingID
	_, err := repo.collection().ReplaceOne(ctx, bson.M{"id": models.BuildingID}, building, options.Replace().SetUpsert(true))
	if err != nil {
		logs.ErrorLogger.Println("Error saving building:", err)
		return err
	}
	return nil
}
