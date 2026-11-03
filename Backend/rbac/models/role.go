package models

import (
	"encoding/json"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PermissionObject represents per-module CRUD access flags assigned to a role.
type PermissionObject struct {
	ModuleKey string `bson:"module_key" json:"module_key" db:"module_key"`
	Add       bool   `bson:"add"        json:"add"        db:"add"`
	Edit      bool   `bson:"edit"       json:"edit"       db:"edit"`
	Delete    bool   `bson:"delete"     json:"delete"     db:"delete"`
	View      bool   `bson:"view"       json:"view"       db:"view"`
}

// Role represents a named bundle of per-module permissions in the system.
type Role struct {
	ID              string             `bson:"_id,omitempty" json:"id"                         db:"id"`
	Name            string             `bson:"name"          json:"name"                       db:"name"`
	Description     string             `bson:"description"   json:"description"                db:"description"`
	Level           int                `bson:"level"         json:"level"`                      // hierarchy: higher = more privileged
	IsAdmin         bool               `bson:"is_admin"      json:"is_admin"                   db:"is_admin"`
	IsSystem        bool               `bson:"-"             json:"isSystem"                   db:"-"`
	Active          int                `bson:"active"        json:"active"                     db:"active"` // 1 = active, 0 = inactive
	Permissions     []PermissionObject `bson:"permissions"   json:"permissions_objects,omitempty" db:"permissions"`
	PermissionsFlat []string           `bson:"-"             json:"permissions"                db:"-"`
	CreatedAt       time.Time          `bson:"created_at"    json:"created_at"                 db:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at"    json:"updated_at"                 db:"updated_at"`
}

// UnmarshalBSON provides backwards-compatibility for both ObjectID and string _id.
func (r *Role) UnmarshalBSON(data []byte) error {
	type Alias Role
	var raw struct {
		Alias `bson:",inline"`
		RawID interface{} `bson:"_id"`
	}
	if err := bson.Unmarshal(data, &raw); err != nil {
		return err
	}
	*r = Role(raw.Alias)
	switch v := raw.RawID.(type) {
	case primitive.ObjectID:
		r.ID = v.Hex()
	case string:
		r.ID = v
	}
	return nil
}

// GenerateAdminPermissions builds the full set of CRUD permissions for a given list of modules.
func GenerateAdminPermissions(moduleKeys []string) []string {
	perms := make([]string, 0, len(moduleKeys)*4)
	for _, k := range moduleKeys {
		kLower := strings.ToLower(k)
		perms = append(perms, kLower+":read", kLower+":create", kLower+":update", kLower+":delete")
	}
	return perms
}

// PopulateComputed populates the frontend-friendly computed fields like PermissionsFlat and IsSystem.
// If availableModuleKeys are provided, admin roles are dynamically granted all CRUD actions for those modules.
func (r *Role) PopulateComputed(availableModuleKeys ...string) {
	r.IsSystem = r.HasAdminAccess()
	if r.HasAdminAccess() {
		if len(availableModuleKeys) > 0 {
			r.PermissionsFlat = GenerateAdminPermissions(availableModuleKeys)
		} else {
			r.PermissionsFlat = GenerateAdminPermissions([]string{"users", "roles", "modules"})
		}
	} else {
		r.PermissionsFlat = PermissionObjectsToStrings(r.Permissions)
	}
}

// HasAdminAccess returns true when this role grants full administrative access.
// A role is considered admin if it has IsAdmin set, or is at hierarchy Level 1
// (the reserved Super Admin level).
func (r *Role) HasAdminAccess() bool {
	return r.IsAdmin || r.Level == 1
}

// PermissionStringsToObjects converts flat permission strings like ["employees:read", "attendance:create"]
// into structured PermissionObjects grouped by module.
func PermissionStringsToObjects(perms []string) []PermissionObject {
	m := make(map[string]*PermissionObject)
	for _, p := range perms {
		parts := strings.SplitN(p, ":", 2)
		if len(parts) != 2 {
			continue
		}
		mod := strings.ToLower(parts[0])
		act := strings.ToLower(parts[1])

		po, exists := m[mod]
		if !exists {
			po = &PermissionObject{ModuleKey: mod}
			m[mod] = po
		}

		switch act {
		case "view", "read":
			po.View = true
		case "add", "create", "write":
			po.Add = true
		case "edit", "update":
			po.Edit = true
		case "delete":
			po.Delete = true
		case "*", "manage", "all":
			po.View = true
			po.Add = true
			po.Edit = true
			po.Delete = true
		}
	}

	res := make([]PermissionObject, 0, len(m))
	for _, po := range m {
		res = append(res, *po)
	}
	return res
}

// PermissionObjectsToStrings converts structured PermissionObjects into flat canonical strings.
func PermissionObjectsToStrings(objects []PermissionObject) []string {
	var res []string
	for _, po := range objects {
		mod := po.ModuleKey
		if po.View {
			res = append(res, mod+":read")
		}
		if po.Add {
			res = append(res, mod+":create")
		}
		if po.Edit {
			res = append(res, mod+":update")
		}
		if po.Delete {
			res = append(res, mod+":delete")
		}
	}
	if res == nil {
		res = []string{}
	}
	return res
}

// ParseRawPermissions attempts to parse raw JSON as either []PermissionObject or []string.
func ParseRawPermissions(raw json.RawMessage) []PermissionObject {
	if len(raw) == 0 {
		return []PermissionObject{}
	}

	// 1. Try []PermissionObject
	var pos []PermissionObject
	if err := json.Unmarshal(raw, &pos); err == nil && len(pos) > 0 && pos[0].ModuleKey != "" {
		return pos
	}

	// 2. Try []string
	var strList []string
	if err := json.Unmarshal(raw, &strList); err == nil {
		return PermissionStringsToObjects(strList)
	}

	// 3. Try { "permissions": []string } or { "permissions": []PermissionObject }
	var wrapped struct {
		Permissions json.RawMessage `json:"permissions"`
	}
	if err := json.Unmarshal(raw, &wrapped); err == nil && len(wrapped.Permissions) > 0 {
		return ParseRawPermissions(wrapped.Permissions)
	}

	return []PermissionObject{}
}

// CreateRoleRequest is the DTO for creating a new role.
type CreateRoleRequest struct {
	Name        string          `json:"name"        binding:"required"`
	Description string          `json:"description"`
	Level       int             `json:"level"`
	IsAdmin     bool            `json:"is_admin"`
	Active      int             `json:"active"`
	Permissions json.RawMessage `json:"permissions"`
}

// UpdateRoleRequest is the DTO for updating an existing role.
type UpdateRoleRequest struct {
	Name        string             `json:"name,omitempty"`
	Description string             `json:"description,omitempty"`
	Level       int                `json:"level,omitempty"`
	IsAdmin     *bool              `json:"is_admin,omitempty"`
	Active      *int               `json:"active,omitempty"`
	Permissions json.RawMessage    `json:"permissions,omitempty"`
	ParsedPerms []PermissionObject `json:"-"`
}
