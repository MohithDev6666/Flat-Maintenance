package handler

import "github.com/gin-gonic/gin"

type UserLinkHandler interface {
	GetMyProfileLinkHandler(c *gin.Context)
	GetAllUserLinksHandler(c *gin.Context)
	SetUserLinkHandler(c *gin.Context)
	DeleteUserLinkHandler(c *gin.Context)
}
