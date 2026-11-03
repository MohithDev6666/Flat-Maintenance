package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/service"
	"github.com/trideadmin/rbac/utils"
)

// AuthHandler handles HTTP requests for user authentication (registration, login, profile).
type AuthHandler struct {
	svc     service.AuthService
	checker service.Checker
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(svc service.AuthService, checker service.Checker) *AuthHandler {
	return &AuthHandler{svc: svc, checker: checker}
}

// Register handles POST /auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid request body", err)
		return
	}
	resp, err := h.svc.Register(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			utils.RespondWithError(c, http.StatusConflict, err.Error(), err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "registration failed", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusCreated, resp)
}

// Login handles POST /auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid login body", err)
		return
	}
	resp, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, models.ErrUserSuspended) {
			utils.RespondWithError(c, http.StatusForbidden, err.Error(), err)
			return
		}
		utils.RespondWithError(c, http.StatusUnauthorized, "login failed", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, resp)
}

// GetMe handles GET /auth/me
func (h *AuthHandler) GetMe(c *gin.Context) {
	subj, err := utils.SubjectFromGin(c)
	if err != nil {
		utils.RespondWithError(c, http.StatusUnauthorized, "unauthorized", err)
		return
	}
	user, err := h.svc.GetProfile(c.Request.Context(), subj.UserID)
	if err != nil {
		utils.RespondWithError(c, http.StatusNotFound, "user profile not found", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, user)
}

type TokenResponse struct {
	Token string `json:"token"`
}

// RefreshToken handles POST /auth/refresh — issues a new JWT from a valid (non-expired) token.
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		utils.RespondWithError(c, http.StatusUnauthorized, "missing or malformed Authorization header", nil)
		return
	}
	newToken, err := h.svc.RefreshToken(parts[1])
	if err != nil {
		utils.RespondWithError(c, http.StatusUnauthorized, "token is invalid or expired", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, TokenResponse{Token: newToken})
}

// ChangePassword handles PUT /auth/password — requires an authenticated user.
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	subj, err := utils.SubjectFromGin(c)
	if err != nil {
		utils.RespondWithError(c, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=4"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid update body", err)
		return
	}

	if err := h.svc.ChangePassword(c.Request.Context(), subj.UserID, req.OldPassword, req.NewPassword); err != nil {
		if errors.Is(err, models.ErrInvalidCredentials) {
			utils.RespondWithError(c, http.StatusBadRequest, "incorrect current password", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to update password", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, "password updated successfully")
}

// Logout handles POST /auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		utils.RespondWithError(c, http.StatusBadRequest, "missing or malformed Authorization header", nil)
		return
	}
	err := h.svc.Logout(c.Request.Context(), parts[1])
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to logout", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, "logged out successfully")
}

// GetMyPermissions handles GET /auth/permissions
func (h *AuthHandler) GetMyPermissions(c *gin.Context) {
	subj, err := utils.SubjectFromGin(c)
	if err != nil {
		utils.RespondWithError(c, http.StatusUnauthorized, "unauthorized", err)
		return
	}

	perms, err := h.checker.GetPermissions(c.Request.Context(), models.Subject{
		UserID: subj.UserID,
		RoleID: subj.RoleID,
	})
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to retrieve permissions", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, perms)
}
