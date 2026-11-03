package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/mongo"
)

type UserLinksHandlerImpl struct {
	userLinkService service.UserLinkService
}

func NewUserLinksHandler(userLinkService service.UserLinkService) UserLinkHandler {
	return &UserLinksHandlerImpl{
		userLinkService: userLinkService,
	}
}

func (uh *UserLinksHandlerImpl) GetMyProfileLinkHandler(c *gin.Context) {
	data, err := uh.userLinkService.GetUserLink(c, utils.UserID(c))
	if err != nil {
		switch {
		case errors.Is(err, mongo.ErrNoDocuments):
			c.JSON(http.StatusNotFound, gin.H{"error": "profile link not found"})
		case errors.Is(err, service.ErrInactiveIdentity), errors.Is(err, service.ErrStaleProfile):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		default:
			logs.ErrorLogger.Println("Error retrieving profile link:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "profile lookup failed"})
		}
		return
	}
	c.JSON(http.StatusOK, data)
}

func (uh *UserLinksHandlerImpl) GetAllUserLinksHandler(c *gin.Context) {
	if !uh.requireAdmin(c) {
		return
	}
	data, err := uh.userLinkService.GetAllUserLinks(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (uh *UserLinksHandlerImpl) SetUserLinkHandler(c *gin.Context) {
	if !uh.requireAdmin(c) {
		return
	}
	var request struct {
		Kind     string  `json:"kind"`
		OwnerID  *string `json:"ownerId"`
		TenantID *string `json:"tenantId"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		logs.WarningLogger.Println("Invalid profile link payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON body required"})
		return
	}
	ownerID, tenantID := "", ""
	if request.OwnerID != nil {
		ownerID = *request.OwnerID
	}
	if request.TenantID != nil {
		tenantID = *request.TenantID
	}
	data, err := uh.userLinkService.SetUserLink(c, utils.Actor(c), c.Param("id"), request.Kind, ownerID, tenantID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrProfileConflict), mongo.IsDuplicateKeyError(err):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrInvalidProfile):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, mongo.ErrNoDocuments):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			logs.ErrorLogger.Println("Error linking profile:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "RBAC profile link operation failed"})
		}
		return
	}
	c.JSON(http.StatusOK, data)
}

func (uh *UserLinksHandlerImpl) DeleteUserLinkHandler(c *gin.Context) {
	if !uh.requireAdmin(c) {
		return
	}
	if err := uh.userLinkService.DeleteUserLink(c, utils.Actor(c), c.Param("id")); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, mongo.ErrNoDocuments) {
			status = http.StatusNotFound
		} else {
			logs.ErrorLogger.Println("Error removing profile link:", err)
		}
		c.JSON(status, gin.H{"error": "profile link could not be removed"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (uh *UserLinksHandlerImpl) requireAdmin(c *gin.Context) bool {
	admin, err := uh.userLinkService.IsAdministrator(c, utils.UserID(c))
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) || errors.Is(err, service.ErrInactiveIdentity) {
			c.JSON(http.StatusForbidden, gin.H{"error": "current RBAC administrator is required"})
			return false
		}
		logs.ErrorLogger.Println("RBAC profile lookup failed:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "RBAC profile lookup failed"})
		return false
	}
	if !admin {
		c.JSON(http.StatusForbidden, gin.H{"error": "current RBAC administrator is required"})
		return false
	}
	return true
}
