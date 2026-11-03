package service

import (
	"context"
	"strings"
	"time"

	"github.com/trideadmin/rbac/audit"
	"github.com/trideadmin/rbac/models"
)

// Checker is the core authorization interface for evaluating permissions.
type Checker interface {
	Can(ctx context.Context, subj models.Subject, permission string) (bool, error)
	CanAny(ctx context.Context, subj models.Subject, permissions ...string) (bool, error)
	CanAll(ctx context.Context, subj models.Subject, permissions ...string) (bool, error)
	GetPermissions(ctx context.Context, subj models.Subject) ([]string, error)
}

type enforcer struct {
	roleSvc     RoleService
	modSvc      ModuleService
	auditLogger audit.AuditLogger
}

// NewEnforcer creates a Checker implementation that resolves permissions
// using the structured RoleService, ModuleService, and logs via the optional AuditLogger.
func NewEnforcer(roleSvc RoleService, modSvc ModuleService, auditLogger audit.AuditLogger) Checker {
	return &enforcer{
		roleSvc:     roleSvc,
		modSvc:      modSvc,
		auditLogger: auditLogger,
	}
}

// Can checks if the Subject has permission for a specific "module:action".
// The module key→ID map is built once per call so a single GetAll is performed
// rather than one DB round-trip per permission string.
func (e *enforcer) Can(ctx context.Context, subj models.Subject, permission string) (bool, error) {
	if subj.UserID == "" {
		return false, models.ErrInvalidSubject
	}
	if subj.RoleID == "" {
		return false, nil
	}

	role, err := e.roleSvc.GetByID(ctx, subj.RoleID)
	if err != nil {
		e.logAudit(ctx, "check", subj, permission, "error", map[string]string{"error": err.Error()})
		return false, err
	}

	// Admin bypass — no module lookup needed.
	if role.HasAdminAccess() {
		e.logAudit(ctx, "check", subj, permission, "allow", nil)
		return true, nil
	}

	// Resolve module key → module ID once, then check.
	modMap, err := e.buildModMap(ctx)
	if err != nil {
		return false, err
	}

	allowed := checkPermissionWithMap(role, permission, modMap)
	result := "deny"
	if allowed {
		result = "allow"
	}
	e.logAudit(ctx, "check", subj, permission, result, nil)
	return allowed, nil
}

// CanAny checks if the Subject has at least one of the specified permissions.
func (e *enforcer) CanAny(ctx context.Context, subj models.Subject, permissions ...string) (bool, error) {
	if subj.UserID == "" {
		return false, models.ErrInvalidSubject
	}
	if subj.RoleID == "" {
		return false, nil
	}

	role, err := e.roleSvc.GetByID(ctx, subj.RoleID)
	if err != nil {
		return false, err
	}

	if role.HasAdminAccess() {
		for _, p := range permissions {
			e.logAudit(ctx, "check", subj, p, "allow", nil)
		}
		return true, nil
	}

	modMap, err := e.buildModMap(ctx)
	if err != nil {
		return false, err
	}

	for _, p := range permissions {
		if checkPermissionWithMap(role, p, modMap) {
			e.logAudit(ctx, "check", subj, p, "allow", nil)
			return true, nil
		}
	}

	for _, p := range permissions {
		e.logAudit(ctx, "check", subj, p, "deny", nil)
	}
	return false, nil
}

// CanAll checks if the Subject has all of the specified permissions.
func (e *enforcer) CanAll(ctx context.Context, subj models.Subject, permissions ...string) (bool, error) {
	if subj.UserID == "" {
		return false, models.ErrInvalidSubject
	}
	if subj.RoleID == "" {
		return false, nil
	}

	role, err := e.roleSvc.GetByID(ctx, subj.RoleID)
	if err != nil {
		return false, err
	}

	if role.HasAdminAccess() {
		for _, p := range permissions {
			e.logAudit(ctx, "check", subj, p, "allow", nil)
		}
		return true, nil
	}

	modMap, err := e.buildModMap(ctx)
	if err != nil {
		return false, err
	}

	for _, p := range permissions {
		if !checkPermissionWithMap(role, p, modMap) {
			e.logAudit(ctx, "check", subj, p, "deny", nil)
			return false, nil
		}
	}

	for _, p := range permissions {
		e.logAudit(ctx, "check", subj, p, "allow", nil)
	}
	return true, nil
}

// GetPermissions returns a flat list of canonical "module:action" strings for the Subject.
func (e *enforcer) GetPermissions(ctx context.Context, subj models.Subject) ([]string, error) {
	role, err := e.roleSvc.GetByID(ctx, subj.RoleID)
	if err != nil {
		return nil, err
	}

	// Fetch all modules once.
	mods, err := e.modSvc.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	// Admin role — grant all permissions for all registered modules.
	if role.HasAdminAccess() {
		flat := make([]string, 0, len(mods)*4)
		for _, m := range mods {
			flat = append(flat, m.Key+":read", m.Key+":create", m.Key+":update", m.Key+":delete")
		}
		return flat, nil
	}

	// Build key→ID map and key→key map.
	modMap := make(map[string]string, len(mods)*2)
	for _, m := range mods {
		modMap[m.ID] = m.Key
		modMap[strings.ToLower(m.Key)] = m.Key
	}

	var flat []string
	for _, po := range role.Permissions {
		moduleKey, exists := modMap[po.ModuleKey]
		if !exists {
			moduleKey, exists = modMap[strings.ToLower(po.ModuleKey)]
		}
		if !exists {
			moduleKey = po.ModuleKey
		}
		if po.View {
			flat = append(flat, moduleKey+":read")
		}
		if po.Add {
			flat = append(flat, moduleKey+":create")
		}
		if po.Edit {
			flat = append(flat, moduleKey+":update")
		}
		if po.Delete {
			flat = append(flat, moduleKey+":delete")
		}
	}
	return flat, nil
}

// buildModMap returns a map of module key → module ID by fetching all modules once.
// This is the single GetAll call that replaces one DB lookup per permission check.
func (e *enforcer) buildModMap(ctx context.Context) (map[string]string, error) {
	mods, err := e.modSvc.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	m := make(map[string]string, len(mods))
	for _, mod := range mods {
		m[mod.Key] = mod.ID
	}
	return m, nil
}

// checkPermissionWithMap evaluates a single "moduleKey:action" permission string
// against the role using a pre-built key→ID map, eliminating any DB lookup.
func checkPermissionWithMap(role *models.Role, permission string, modMap map[string]string) bool {
	parts := strings.SplitN(permission, ":", 2)
	if len(parts) != 2 {
		return false
	}
	moduleKey := strings.ToLower(parts[0])
	action := strings.ToLower(parts[1])

	modID := modMap[moduleKey]

	for _, po := range role.Permissions {
		if (modID != "" && po.ModuleKey == modID) || strings.EqualFold(po.ModuleKey, moduleKey) {
			switch action {
			case "view", "read":
				return po.View
			case "add", "create", "write":
				return po.Add
			case "edit", "update":
				return po.Edit
			case "delete":
				return po.Delete
			case "*", "manage", "all":
				return po.View || po.Add || po.Edit || po.Delete
			}
		}
	}
	return false
}

func (e *enforcer) logAudit(_ context.Context, entryType string, subj models.Subject, permission string, result string, metadata map[string]string) {
	if e.auditLogger == nil {
		return
	}
	entry := audit.AuditEntry{
		Type:       entryType,
		SubjectID:  subj.UserID,
		RoleID:     subj.RoleID,
		Permission: permission,
		Result:     result,
		Metadata:   metadata,
		Timestamp:  time.Now(),
	}
	// Non-blocking: the audit logger's worker pool handles the write.
	_ = e.auditLogger.Log(context.Background(), entry)
}
