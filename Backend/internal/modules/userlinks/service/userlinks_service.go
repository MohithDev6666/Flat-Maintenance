package service

import (
	"context"
	"errors"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
)

var (
	ErrProfileConflict  = errors.New("owner or tenant already has a linked login")
	ErrInvalidProfile   = errors.New("invalid profile link")
	ErrInactiveIdentity = errors.New("RBAC user or role is inactive or unassigned")
	ErrStaleProfile     = errors.New("profile role no longer matches the RBAC user")
)

type UserLinkService interface {
	GetUserLink(ctx context.Context, userID string) (*models.UserLink, error)
	GetAllUserLinks(ctx context.Context) ([]*models.UserLink, error)
	SetUserLink(ctx context.Context, actor, userID, kind, ownerID, tenantID string) (*models.UserLink, error)
	DeleteUserLink(ctx context.Context, actor, userID string) error
	IsAdministrator(ctx context.Context, userID string) (bool, error)
	// ResolveResident returns the caller's profile and whether they are an administrator.
	// Non-administrators must have a valid owner or tenant link.
	ResolveResident(ctx context.Context, userID string) (*models.UserLink, bool, error)
}
