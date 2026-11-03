package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/service"
	"github.com/trideadmin/rbac/utils"
)

// RoleHandler handles HTTP requests for role management.
type RoleHandler struct {
	svc service.RoleService
}

// NewRoleHandler creates a new RoleHandler.
func NewRoleHandler(svc service.RoleService) *RoleHandler {
	return &RoleHandler{svc: svc}
}

// Create handles POST /roles
func (h *RoleHandler) Create(c *gin.Context) {
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid request body", err)
		return
	}
	role, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, models.ErrRoleAlreadyExists) {
			utils.RespondWithError(c, http.StatusConflict, "role already exists", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to create role", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusCreated, role)
}

// GetAll handles GET /roles
func (h *RoleHandler) GetAll(c *gin.Context) {
	list, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to retrieve roles", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, list)
}

// GetByID handles GET /roles/:id
func (h *RoleHandler) GetByID(c *gin.Context) {
	role, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, models.ErrRoleNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "role not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusBadRequest, err.Error(), err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, role)
}

// Update handles PUT /roles/:id
func (h *RoleHandler) Update(c *gin.Context) {
	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid request body", err)
		return
	}
	role, err := h.svc.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		if errors.Is(err, models.ErrRoleNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "role not found", err)
			return
		}
		if errors.Is(err, models.ErrRoleAlreadyExists) {
			utils.RespondWithError(c, http.StatusConflict, "role name is already taken", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to update role", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, role)
}

// Delete handles DELETE /roles/:id
func (h *RoleHandler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.Param("id")); err != nil {
		if errors.Is(err, models.ErrRoleNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "role not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to delete role", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, "role deleted")
}

// UpdatePermissions handles PUT /roles/:id/permissions
func (h *RoleHandler) UpdatePermissions(c *gin.Context) {
	var raw json.RawMessage
	if err := c.ShouldBindJSON(&raw); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid permissions payload", err)
		return
	}
	perms := models.ParseRawPermissions(raw)
	if err := h.svc.UpdatePermissions(c.Request.Context(), c.Param("id"), perms); err != nil {
		if errors.Is(err, models.ErrRoleNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "role not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to update role permissions", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, "permissions updated")
}
