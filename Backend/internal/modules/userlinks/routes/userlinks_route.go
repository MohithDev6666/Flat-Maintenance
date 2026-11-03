package userlinks

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/handler"
)

func SetupUserLinkRoutes(router *gin.RouterGroup, handler handler.UserLinkHandler, require func(string) gin.HandlerFunc) {
	router.GET("/me/profile-link", handler.GetMyProfileLinkHandler)
	router.GET("/user-profile-links", require("users:view"), handler.GetAllUserLinksHandler)
	router.PUT("/users/:id/profile-link", require("users:edit"), handler.SetUserLinkHandler)
	router.DELETE("/users/:id/profile-link", require("users:edit"), handler.DeleteUserLinkHandler)
}
