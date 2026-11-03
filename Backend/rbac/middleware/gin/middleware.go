package ginrbac

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/service"
	"github.com/trideadmin/rbac/utils"
)

// Middleware wraps the Checker and AuthService to provide Gin authentication and authorization guards.
type Middleware struct {
	checker service.Checker
	authSvc service.AuthService
}

// New creates a new Gin middleware instance.
func New(checker service.Checker, authSvc service.AuthService) *Middleware {
	return &Middleware{
		checker: checker,
		authSvc: authSvc,
	}
}

// Authenticate returns a Gin Middleware handler that validates JWT tokens,
// builds the RBAC Subject, and injects it into the request context.
func (m *Middleware) Authenticate() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.RespondWithError(c, http.StatusUnauthorized, "authorization header is required", nil)
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			utils.RespondWithError(c, http.StatusUnauthorized, "authorization format must be Bearer <token>", nil)
			c.Abort()
			return
		}

		claims, err := m.authSvc.ValidateToken(parts[1])
		if err != nil {
			utils.RespondWithError(c, http.StatusUnauthorized, "invalid or expired token", err)
			c.Abort()
			return
		}

		// Resolve roleID from claims or user profile fallback if token had empty RoleID
		roleID := claims.RoleID
		if roleID == "" && claims.UserID != "" {
			if u, err := m.authSvc.GetProfile(c.Request.Context(), claims.UserID); err == nil && u != nil && u.RoleID != "" {
				roleID = u.RoleID
			}
		}

		// Inject RBAC Subject into the request context for use by RBAC guards
		subj := models.Subject{
			UserID: claims.UserID,
			RoleID: roleID,
		}
		ctx := utils.InjectSubject(c.Request.Context(), subj)
		c.Request = c.Request.WithContext(ctx)

		// Set gin keys for backward-compatibility with downstream handlers
		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("roleID", roleID)

		c.Next()
	}
}

// Require returns a Gin HandlerFunc that enforces a single permission check.
func (m *Middleware) Require(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		subj, err := utils.SubjectFromGin(c)
		if err != nil {
			utils.RespondWithError(c, http.StatusUnauthorized, "unauthorized: failed to extract identity", err)
			c.Abort()
			return
		}

		allowed, err := m.checker.Can(c.Request.Context(), subj, permission)
		if err != nil {
			utils.RespondWithError(c, http.StatusForbidden, "forbidden: access check failed", err)
			c.Abort()
			return
		}

		if !allowed {
			utils.RespondWithError(c, http.StatusForbidden, "forbidden: insufficient permissions", nil)
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAny returns a Gin HandlerFunc that enforces that the Subject has at least one of the specified permissions.
func (m *Middleware) RequireAny(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if len(permissions) == 0 {
			c.Next()
			return
		}

		subj, err := utils.SubjectFromGin(c)
		if err != nil {
			utils.RespondWithError(c, http.StatusUnauthorized, "unauthorized: failed to extract identity", err)
			c.Abort()
			return
		}

		allowed, err := m.checker.CanAny(c.Request.Context(), subj, permissions...)
		if err != nil {
			utils.RespondWithError(c, http.StatusForbidden, "forbidden: access check failed", err)
			c.Abort()
			return
		}

		if !allowed {
			utils.RespondWithError(c, http.StatusForbidden, "forbidden: insufficient permissions", nil)
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAll returns a Gin HandlerFunc that enforces that the Subject has all of the specified permissions.
func (m *Middleware) RequireAll(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if len(permissions) == 0 {
			c.Next()
			return
		}

		subj, err := utils.SubjectFromGin(c)
		if err != nil {
			utils.RespondWithError(c, http.StatusUnauthorized, "unauthorized: failed to extract identity", err)
			c.Abort()
			return
		}

		allowed, err := m.checker.CanAll(c.Request.Context(), subj, permissions...)
		if err != nil {
			utils.RespondWithError(c, http.StatusForbidden, "forbidden: access check failed", err)
			c.Abort()
			return
		}

		if !allowed {
			utils.RespondWithError(c, http.StatusForbidden, "forbidden: insufficient permissions", nil)
			c.Abort()
			return
		}

		c.Next()
	}
}
