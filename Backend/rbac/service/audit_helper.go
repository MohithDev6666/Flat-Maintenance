package service

import (
	"context"
	"time"

	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/utils"
)

// auditHelper is an embeddable struct that provides a single logAudit method
// shared across all service types, eliminating the duplicated implementation
// that previously existed in moduleService, roleService, and userService.
type auditHelper struct {
	auditLogger audit.AuditLogger
}

// logAudit enqueues an audit entry. It reads the acting subject from the
// request context (injected by the auth middleware) and falls back to "system"
// when the context carries no subject (e.g. during startup seeding).
func (h *auditHelper) logAudit(ctx context.Context, permission, result string, metadata map[string]string) {
	if h.auditLogger == nil {
		return
	}
	subjectID := "system"
	roleID := "system"
	if subj, ok := utils.SubjectFromContext(ctx); ok {
		subjectID = subj.UserID
		roleID = subj.RoleID
	}
	entry := audit.AuditEntry{
		Type:       "mutation",
		SubjectID:  subjectID,
		RoleID:     roleID,
		Permission: permission,
		Result:     result,
		Metadata:   metadata,
		Timestamp:  time.Now(),
	}
	// Log is non-blocking: the logger queues the entry in its worker pool.
	_ = h.auditLogger.Log(context.Background(), entry)
}
