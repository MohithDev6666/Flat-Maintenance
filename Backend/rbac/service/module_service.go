package service

import (
	"context"
	"errors"
	"strings"

	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/repository"
)

// ModuleService defines business logic for module management.
type ModuleService interface {
	Create(ctx context.Context, req models.CreateModuleRequest) (*models.Module, error)
	GetByID(ctx context.Context, id string) (*models.Module, error)
	GetByKey(ctx context.Context, key string) (*models.Module, error)
	GetAll(ctx context.Context) ([]models.Module, error)
	Update(ctx context.Context, id string, req models.UpdateModuleRequest) (*models.Module, error)
	Delete(ctx context.Context, id string) error
}

type moduleService struct {
	auditHelper
	repo repository.ModuleRepository
}

// NewModuleService creates a new ModuleService backed by the given repository.
func NewModuleService(repo repository.ModuleRepository, auditLogger audit.AuditLogger) ModuleService {
	return &moduleService{
		auditHelper: auditHelper{auditLogger: auditLogger},
		repo:        repo,
	}
}

func (s *moduleService) Create(ctx context.Context, req models.CreateModuleRequest) (*models.Module, error) {
	// Validate required fields.
	req.Key = strings.TrimSpace(strings.ToLower(req.Key))
	req.Name = strings.TrimSpace(req.Name)
	if req.Key == "" || req.Name == "" {
		return nil, models.ErrInvalidInput
	}

	// Explicit pre-check for duplicate key for a cleaner error message
	// (the DB unique index is still the authoritative guard).
	if _, err := s.repo.GetByKey(ctx, req.Key); err == nil {
		return nil, models.ErrModuleAlreadyExists
	} else if !errors.Is(err, models.ErrModuleNotFound) {
		return nil, err
	}

	mod := &models.Module{
		Key:         req.Key,
		Name:        req.Name,
		Description: req.Description,
		IsMaster:    req.IsMaster,
		Permissions: req.Permissions,
	}
	if err := s.repo.Create(ctx, mod); err != nil {
		s.logAudit(ctx, "modules:create", "error", map[string]string{"key": req.Key, "error": err.Error()})
		return nil, err
	}
	s.logAudit(ctx, "modules:create", "success", map[string]string{"key": req.Key, "id": mod.ID})
	return mod, nil
}

func (s *moduleService) GetByID(ctx context.Context, id string) (*models.Module, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *moduleService) GetByKey(ctx context.Context, key string) (*models.Module, error) {
	return s.repo.GetByKey(ctx, key)
}

// GetAll returns all modules.
func (s *moduleService) GetAll(ctx context.Context) ([]models.Module, error) {
	return s.repo.GetAll(ctx)
}

func (s *moduleService) Update(ctx context.Context, id string, req models.UpdateModuleRequest) (*models.Module, error) {
	mod, err := s.repo.Update(ctx, id, req)
	if err != nil {
		s.logAudit(ctx, "modules:update", "error", map[string]string{"id": id, "error": err.Error()})
		return nil, err
	}
	s.logAudit(ctx, "modules:update", "success", map[string]string{"id": id, "name": req.Name})
	return mod, nil
}

func (s *moduleService) Delete(ctx context.Context, id string) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		s.logAudit(ctx, "modules:delete", "error", map[string]string{"id": id, "error": err.Error()})
		return err
	}
	s.logAudit(ctx, "modules:delete", "success", map[string]string{"id": id})
	return nil
}
