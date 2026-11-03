package audit

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/handler"
)

func SetupAuditRoutes(router *gin.RouterGroup, handler handler.AuditHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("recentChanges:view"))
	router.GET("", handler.GetAllAuditEntriesHandler)
	router.GET("/:id", handler.GetAuditEntryByIDHandler)
}
