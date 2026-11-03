package handler

import "github.com/gin-gonic/gin"

type AuditHandler interface {
	GetAllAuditEntriesHandler(c *gin.Context)
	GetAuditEntryByIDHandler(c *gin.Context)
}
