package utils

import (
	"context"
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac/models"
)

type contextKey string

const contextKeySubject contextKey = "rbac_subject"

// context.Value extractor
// Used by services and any code that only has access to a plain context.Context.

// InjectSubject stores a Subject into a context.Context.
// Called by the Gin authentication middleware after validating the JWT.
func InjectSubject(ctx context.Context, subj models.Subject) context.Context {
	return context.WithValue(ctx, contextKeySubject, subj)
}

// SubjectFromContext retrieves the Subject previously stored by InjectSubject.
// Returns (zero-value, false) when no subject has been injected.
func SubjectFromContext(ctx context.Context) (models.Subject, bool) {
	subj, ok := ctx.Value(contextKeySubject).(models.Subject)
	return subj, ok
}

// c.Set / c.Get extractor
// Used by Gin handlers and the RBAC Gin middleware that calls c.Set().

// SubjectFromGin rebuilds an RBAC Subject from the Gin-specific keys that the
// authentication middleware stores via c.Set("userID", ...) / c.Set("roleID", ...).
// Returns an error when either key is absent.
func SubjectFromGin(c *gin.Context) (models.Subject, error) {
	userID, ok := c.Get("userID")
	if !ok {
		return models.Subject{}, errors.New("userID not found in gin context")
	}
	roleID, _ := c.Get("roleID") // roleID is optional — a user may have no role yet

	return models.Subject{
		UserID: userID.(string),
		RoleID: func() string {
			if roleID != nil {
				return roleID.(string)
			}
			return ""
		}(),
	}, nil
}
