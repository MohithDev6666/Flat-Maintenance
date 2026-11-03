package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a user stored in MongoDB or PostgreSQL.
type User struct {
	ID          string    `bson:"_id,omitempty" json:"id"        db:"id"`
	Name        string    `bson:"name"          json:"name"      db:"name"`
	Email       string    `bson:"email"         json:"email"     db:"email"`
	Password    string    `bson:"password_hash" json:"-"         db:"password_hash"`
	Phone       string    `bson:"phone"         json:"phone"     db:"phone"`
	RoleID      string    `bson:"role_id"       json:"role_id"   db:"role_id"`
	RoleIDCamel string    `bson:"-"             json:"roleId"    db:"-"`
	RoleName    string    `bson:"-"             json:"roleName,omitempty" db:"-"`
	Active      int       `bson:"active"        json:"active"    db:"active"` // 1=active, 0=suspended
	IsActive    bool      `bson:"-"             json:"isActive"  db:"-"`
	CreatedAt   time.Time `bson:"created_at"    json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `bson:"updated_at"    json:"updated_at" db:"updated_at"`
	RoleLevel   int       `bson:"-"             json:"role_level,omitempty" db:"-"`
	IsAdmin     bool      `bson:"-"             json:"is_admin"  db:"-"`
}

// UnmarshalBSON provides backwards-compatibility for variations in MongoDB field naming and types
// (e.g. roleId as ObjectID vs string, password vs password_hash, createdAt vs created_at).
func (u *User) UnmarshalBSON(data []byte) error {
	var m bson.M
	if err := bson.Unmarshal(data, &m); err != nil {
		return err
	}

	if id, ok := m["_id"].(primitive.ObjectID); ok {
		u.ID = id.Hex()
	} else if idStr, ok := m["_id"].(string); ok {
		u.ID = idStr
	} else if idStr, ok := m["id"].(string); ok {
		u.ID = idStr
	}

	if name, ok := m["name"].(string); ok {
		u.Name = name
	}
	if email, ok := m["email"].(string); ok {
		u.Email = email
	}
	if phone, ok := m["phone"].(string); ok {
		u.Phone = phone
	}

	// Password: check password_hash first, then password
	if pass, ok := m["password_hash"].(string); ok && pass != "" {
		u.Password = pass
	} else if pass, ok := m["password"].(string); ok {
		u.Password = pass
	}

	// RoleID: check role_id, then roleId (string or ObjectID)
	if r, ok := m["role_id"].(string); ok && r != "" {
		u.RoleID = r
	} else if r, ok := m["roleId"].(string); ok && r != "" {
		u.RoleID = r
	} else if rObj, ok := m["role_id"].(primitive.ObjectID); ok && !rObj.IsZero() {
		u.RoleID = rObj.Hex()
	} else if rObj, ok := m["roleId"].(primitive.ObjectID); ok && !rObj.IsZero() {
		u.RoleID = rObj.Hex()
	}

	// Active status
	if act, ok := m["active"].(int32); ok {
		u.Active = int(act)
	} else if act, ok := m["active"].(int64); ok {
		u.Active = int(act)
	} else if act, ok := m["active"].(int); ok {
		u.Active = act
	} else if isAct, ok := m["isActive"].(bool); ok {
		if isAct {
			u.Active = 1
		} else {
			u.Active = 0
		}
	} else {
		u.Active = 1
	}

	// CreatedAt / UpdatedAt
	if ca, ok := m["created_at"].(primitive.DateTime); ok {
		u.CreatedAt = ca.Time()
	} else if ca, ok := m["createdAt"].(primitive.DateTime); ok {
		u.CreatedAt = ca.Time()
	} else if ca, ok := m["created_at"].(time.Time); ok {
		u.CreatedAt = ca
	} else if ca, ok := m["createdAt"].(time.Time); ok {
		u.CreatedAt = ca
	}

	if ua, ok := m["updated_at"].(primitive.DateTime); ok {
		u.UpdatedAt = ua.Time()
	} else if ua, ok := m["updatedAt"].(primitive.DateTime); ok {
		u.UpdatedAt = ua.Time()
	} else if ua, ok := m["updated_at"].(time.Time); ok {
		u.UpdatedAt = ua
	} else if ua, ok := m["updatedAt"].(time.Time); ok {
		u.UpdatedAt = ua
	}

	u.RoleIDCamel = u.RoleID
	u.IsActive = (u.Active == 1)

	return nil
}

// CreateUserRequest is the DTO for creating a new user.
type CreateUserRequest struct {
	Name        string `json:"name"                  binding:"required"`
	Email       string `json:"email"                 binding:"required,email"`
	Password    string `json:"password"              binding:"required,min=4"`
	Phone       string `json:"phone,omitempty"`
	RoleID      string `json:"role_id,omitempty"`
	RoleIDCamel string `json:"roleId,omitempty"`
}

// UpdateUserRequest is the DTO for updating an existing user.
type UpdateUserRequest struct {
	Name        string `json:"name,omitempty"`
	Email       string `json:"email,omitempty"`
	Password    string `json:"password,omitempty"`
	Phone       string `json:"phone,omitempty"`
	RoleID      string `json:"role_id,omitempty"`
	RoleIDCamel string `json:"roleId,omitempty"`
	Active      *int   `json:"active,omitempty"` // pointer so 0 is distinguishable from unset
	IsActive    *bool  `json:"isActive,omitempty"`
}

// LoginRequest is the DTO for authenticating a user.
type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse carries the JWT token and the authenticated user.
type LoginResponse struct {
	Token       string   `json:"token"`
	User        User     `json:"user"`
	Permissions []string `json:"permissions,omitempty"`
}
