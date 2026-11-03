package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	auditRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	buildingRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/building/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/mongo"
)

type buildingServiceImpl struct {
	buildingRepo buildingRepo.Building
	auditRepo    auditRepo.Audit
}

func NewBuildingService(buildingRepo buildingRepo.Building, auditRepo auditRepo.Audit) BuildingService {
	return &buildingServiceImpl{
		buildingRepo: buildingRepo,
		auditRepo:    auditRepo,
	}
}

func (bs *buildingServiceImpl) GetBuilding(ctx context.Context) (*models.Building, error) {
	building, err := bs.buildingRepo.GetBuilding(ctx)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return models.NewBuilding(), nil
	}
	return building, err
}

func (bs *buildingServiceImpl) SaveBuilding(ctx context.Context, actor string, building *models.Building) (*models.Building, error) {
	building.Name = strings.TrimSpace(building.Name)
	building.Address = strings.TrimSpace(building.Address)
	building.ContactPhone = strings.TrimSpace(building.ContactPhone)
	if err := validateBuilding(building); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	action := "Edited"
	old, err := bs.buildingRepo.GetBuilding(ctx)
	switch {
	case errors.Is(err, mongo.ErrNoDocuments):
		action, old = "Created", nil
		building.CreatedAt = now
	case err != nil:
		return nil, err
	default:
		building.CreatedAt = old.CreatedAt
	}
	building.UpdatedAt = now

	if err := bs.buildingRepo.SaveBuilding(ctx, building); err != nil {
		return nil, err
	}
	entry := models.NewAuditRecord(actor, "Building", action, building.Name, utils.JSONString(old), utils.JSONString(building))
	if err := bs.auditRepo.CreateAuditEntry(ctx, entry); err != nil {
		return nil, err
	}
	logs.InfoLogger.Println("Building saved successfully")
	return building, nil
}

func validateBuilding(building *models.Building) error {
	for _, field := range []struct{ name, value string }{
		{"name", building.Name}, {"address", building.Address}, {"contactPhone", building.ContactPhone},
	} {
		if field.value == "" {
			return utils.BadRequest(field.name + " is required")
		}
	}
	if building.TotalFlats < 1 || building.Floors < 1 {
		return utils.BadRequest("totalFlats and floors must be positive integers")
	}
	return nil
}
