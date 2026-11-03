package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/service"
	"github.com/trideadmin/rbac/utils"
)

// UserHandler handles HTTP requests for user management and role assignment.
type UserHandler struct {
	svc service.UserService
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(svc service.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

// Create handles POST /users
func (h *UserHandler) Create(c *gin.Context) {
	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid request body", err)
		return
	}
	user, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, models.ErrUserAlreadyExists) {
			utils.RespondWithError(c, http.StatusConflict, err.Error(), err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to create user", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusCreated, user)
}

// GetAll handles GET /users
func (h *UserHandler) GetAll(c *gin.Context) {
	list, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to retrieve users", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, list)
}

// GetByID handles GET /users/:id
func (h *UserHandler) GetByID(c *gin.Context) {
	user, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "user not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusBadRequest, err.Error(), err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, user)
}

// Update handles PUT /users/:id
func (h *UserHandler) Update(c *gin.Context) {
	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid request body", err)
		return
	}
	user, err := h.svc.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "user not found", err)
			return
		}
		if errors.Is(err, models.ErrEmailAlreadyTaken) {
			utils.RespondWithError(c, http.StatusConflict, err.Error(), err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to update user", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, user)
}

// Delete handles DELETE /users/:id
func (h *UserHandler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.Param("id")); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "user not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to delete user", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, "user deleted")
}

// UpdateRole handles PUT /users/:id/role
func (h *UserHandler) UpdateRole(c *gin.Context) {
	var body struct {
		RoleID      string `json:"role_id"`
		RoleIDCamel string `json:"roleId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid role assignment payload", err)
		return
	}
	rID := body.RoleID
	if rID == "" {
		rID = body.RoleIDCamel
	}
	if rID == "" {
		utils.RespondWithError(c, http.StatusBadRequest, "role_id is required", nil)
		return
	}
	if err := h.svc.UpdateRole(c.Request.Context(), c.Param("id"), rID); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "user not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to update user role", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, "user role updated")
}
