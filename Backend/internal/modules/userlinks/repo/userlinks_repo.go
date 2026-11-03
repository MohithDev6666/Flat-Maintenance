package repo

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
)

type UserLinks interface {
	GetAllUserLinks(ctx context.Context) ([]*models.UserLink, error)
	GetUserLinkByUserID(ctx context.Context, userID string) (*models.UserLink, error)
	CountLinksByOwner(ctx context.Context, ownerID string) (int64, error)
	CountLinksByTenant(ctx context.Context, tenantID string) (int64, error)
	UpsertUserLink(ctx context.Context, link *models.UserLink) error
	DeleteUserLink(ctx context.Context, userID string) error
	// GetRBACUser and GetRBACRole read the RBAC package's collections without modifying them.
	GetRBACUser(ctx context.Context, userID string) (bson.M, error)
	GetRBACRole(ctx context.Context, roleID string) (bson.M, error)
}
