package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac/models"
	"github.com/trideadmin/rbac/service"
	"github.com/trideadmin/rbac/utils"
)

// ModuleHandler handles HTTP requests for module management.
type ModuleHandler struct {
	svc     service.ModuleService
	roleSvc service.RoleService
	checker service.Checker
}

// NewModuleHandler creates a new ModuleHandler.
func NewModuleHandler(svc service.ModuleService, roleSvc service.RoleService, checker service.Checker) *ModuleHandler {
	return &ModuleHandler{svc: svc, roleSvc: roleSvc, checker: checker}
}

// Create handles POST /modules
func (h *ModuleHandler) Create(c *gin.Context) {
	var req models.CreateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid request body", err)
		return
	}
	mod, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, models.ErrModuleAlreadyExists) {
			utils.RespondWithError(c, http.StatusConflict, err.Error(), err)
			return
		}
		if errors.Is(err, models.ErrInvalidInput) {
			utils.RespondWithError(c, http.StatusBadRequest, "key and name are required", err)
			return
		}
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to register module", err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusCreated, mod)
}

// GetAll handles GET /modules
// Admin users (IsAdmin flag on their role) see all modules including master ones.
// Non-admin users only see non-master modules for which their role has view access.
func (h *ModuleHandler) GetAll(c *gin.Context) {
	list, err := h.svc.GetAll(c.Request.Context())
	if err != nil {
		utils.RespondWithError(c, http.StatusInternalServerError, "failed to retrieve modules", err)
		return
	}

	subj, subjectErr := utils.SubjectFromGin(c)
	if subjectErr != nil || h.roleSvc == nil {
		// No authenticated subject — return empty list rather than leaking data.
		utils.RespondWithSuccess(c, http.StatusOK, []models.Module{})
		return
	}

	// Load the role directly to check IsAdmin reliably, even before any modules
	// are assigned. This replaces the fragile reverse-engineering of admin status
	// from the flat permission list (which broke when no modules were seeded yet).
	role, err := h.roleSvc.GetByID(c.Request.Context(), subj.RoleID)
	if err != nil {
		// Role not found or no role assigned — show nothing.
		utils.RespondWithSuccess(c, http.StatusOK, []models.Module{})
		return
	}

	if role.HasAdminAccess() {
		// Admins see everything.
		utils.RespondWithSuccess(c, http.StatusOK, list)
		return
	}

	// Non-admins: filter out master modules and modules the role cannot view.
	perms, permsErr := h.checker.GetPermissions(c.Request.Context(), subj)
	if permsErr != nil {
		utils.RespondWithSuccess(c, http.StatusOK, []models.Module{})
		return
	}

	// Build a set of module keys the user has at least read access to.
	readable := make(map[string]bool, len(perms))
	for _, p := range perms {
		readable[p] = true
	}

	filtered := make([]models.Module, 0, len(list))
	for _, m := range list {
		if m.IsMaster {
			continue
		}
		if readable[m.Key+":read"] || readable[m.Key+":view"] || readable[m.Key+":*"] {
			filtered = append(filtered, m)
		}
	}
	utils.RespondWithSuccess(c, http.StatusOK, filtered)
}

// GetByID handles GET /modules/:id
func (h *ModuleHandler) GetByID(c *gin.Context) {
	mod, err := h.svc.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, models.ErrModuleNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "module not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusBadRequest, err.Error(), err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, mod)
}

// Update handles PUT /modules/:id
func (h *ModuleHandler) Update(c *gin.Context) {
	var req models.UpdateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondWithError(c, http.StatusBadRequest, "invalid request body", err)
		return
	}
	mod, err := h.svc.Update(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		if errors.Is(err, models.ErrModuleNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "module not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusBadRequest, err.Error(), err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, mod)
}

// Delete handles DELETE /modules/:id
func (h *ModuleHandler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.Param("id")); err != nil {
		if errors.Is(err, models.ErrModuleNotFound) {
			utils.RespondWithError(c, http.StatusNotFound, "module not found", err)
			return
		}
		utils.RespondWithError(c, http.StatusBadRequest, err.Error(), err)
		return
	}
	utils.RespondWithSuccess(c, http.StatusOK, "module deleted")
}
