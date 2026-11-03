package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Module represents an application module record.
type Module struct {
	ID          string    `bson:"_id,omitempty" json:"id"          db:"id"`
	Key         string    `bson:"key"           json:"key"         db:"key"`
	Name        string    `bson:"name"          json:"name"        db:"name"`
	Description string    `bson:"description"   json:"description" db:"description"`
	IsMaster    bool      `bson:"is_master"     json:"is_master"   db:"is_master"`
	Permissions []string  `bson:"permissions"   json:"permissions" db:"permissions"`
	CreatedAt   time.Time `bson:"created_at"    json:"created_at"  db:"created_at"`
	UpdatedAt   time.Time `bson:"updated_at"    json:"updated_at"  db:"updated_at"`
}

// UnmarshalBSON provides backwards-compatibility for both ObjectID and string _id.
func (m *Module) UnmarshalBSON(data []byte) error {
	type Alias Module
	var raw struct {
		Alias `bson:",inline"`
		RawID interface{} `bson:"_id"`
	}
	if err := bson.Unmarshal(data, &raw); err != nil {
		return err
	}
	*m = Module(raw.Alias)
	switch v := raw.RawID.(type) {
	case primitive.ObjectID:
		m.ID = v.Hex()
	case string:
		m.ID = v
	}
	return nil
}

// CreateModuleRequest is the DTO for creating a new module.
type CreateModuleRequest struct {
	Key         string   `json:"key"         binding:"required"`
	Name        string   `json:"name"        binding:"required"`
	Description string   `json:"description"`
	IsMaster    bool     `json:"is_master"`
	Permissions []string `json:"permissions"`
}

// UpdateModuleRequest is the DTO for updating an existing module.
type UpdateModuleRequest struct {
	Name        string   `json:"name,omitempty"`
	Description string   `json:"description,omitempty"`
	IsMaster    *bool    `json:"is_master,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}
