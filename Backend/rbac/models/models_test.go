package models_test

import (
	"testing"
	"time"

	"github.com/trideadmin/rbac/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestRoleHasAdminAccess(t *testing.T) {
	adminRole := &models.Role{
		IsAdmin: true,
		Level:   5,
	}
	if !adminRole.HasAdminAccess() {
		t.Errorf("expected HasAdminAccess() == true for IsAdmin=true")
	}

	superAdminRole := &models.Role{
		IsAdmin: false,
		Level:   1,
	}
	if !superAdminRole.HasAdminAccess() {
		t.Errorf("expected HasAdminAccess() == true for Level=1")
	}

	regularRole := &models.Role{
		IsAdmin: false,
		Level:   2,
	}
	if regularRole.HasAdminAccess() {
		t.Errorf("expected HasAdminAccess() == false for non-admin role")
	}
}

func TestGenerateAdminPermissions(t *testing.T) {
	mods := []string{"users", "roles"}
	perms := models.GenerateAdminPermissions(mods)
	expectedCount := 8 // 4 per module
	if len(perms) != expectedCount {
		t.Fatalf("expected %d perms, got %d", expectedCount, len(perms))
	}
}

func TestRoleUnmarshalBSON(t *testing.T) {
	// Test ObjectID unmarshal
	oid := primitive.NewObjectID()
	bsonData, err := bson.Marshal(bson.M{
		"_id":   oid,
		"name":  "test-role",
		"level": 2,
	})
	if err != nil {
		t.Fatalf("marshal bson: %v", err)
	}

	var r models.Role
	if err := bson.Unmarshal(bsonData, &r); err != nil {
		t.Fatalf("unmarshal bson: %v", err)
	}
	if r.ID != oid.Hex() {
		t.Errorf("expected ID %s, got %s", oid.Hex(), r.ID)
	}
	if r.Name != "test-role" {
		t.Errorf("expected Name 'test-role', got %s", r.Name)
	}

	// Test UUID string unmarshal
	uuidStr := "123e4567-e89b-12d3-a456-426614174000"
	bsonDataStr, err := bson.Marshal(bson.M{
		"_id":   uuidStr,
		"name":  "uuid-role",
		"level": 3,
	})
	if err != nil {
		t.Fatalf("marshal bson: %v", err)
	}

	var r2 models.Role
	if err := bson.Unmarshal(bsonDataStr, &r2); err != nil {
		t.Fatalf("unmarshal bson: %v", err)
	}
	if r2.ID != uuidStr {
		t.Errorf("expected ID %s, got %s", uuidStr, r2.ID)
	}
}

func TestUserUnmarshalBSON(t *testing.T) {
	oid := primitive.NewObjectID()
	roleOid := primitive.NewObjectID()
	now := time.Now().Truncate(time.Millisecond)

	bsonData, err := bson.Marshal(bson.M{
		"_id":           oid,
		"name":          "Jane Doe",
		"email":         "jane@example.com",
		"password_hash": "hashed_pw",
		"role_id":       roleOid,
		"active":        int32(1),
		"created_at":    primitive.NewDateTimeFromTime(now),
	})
	if err != nil {
		t.Fatalf("marshal bson: %v", err)
	}

	var u models.User
	if err := bson.Unmarshal(bsonData, &u); err != nil {
		t.Fatalf("unmarshal bson: %v", err)
	}
	if u.ID != oid.Hex() {
		t.Errorf("expected ID %s, got %s", oid.Hex(), u.ID)
	}
	if u.RoleID != roleOid.Hex() {
		t.Errorf("expected RoleID %s, got %s", roleOid.Hex(), u.RoleID)
	}
	if u.Email != "jane@example.com" {
		t.Errorf("expected Email 'jane@example.com', got %s", u.Email)
	}
}

func TestModuleUnmarshalBSON(t *testing.T) {
	oid := primitive.NewObjectID()
	bsonData, err := bson.Marshal(bson.M{
		"_id":  oid,
		"key":  "billing",
		"name": "Billing",
	})
	if err != nil {
		t.Fatalf("marshal bson: %v", err)
	}

	var m models.Module
	if err := bson.Unmarshal(bsonData, &m); err != nil {
		t.Fatalf("unmarshal bson: %v", err)
	}
	if m.ID != oid.Hex() {
		t.Errorf("expected ID %s, got %s", oid.Hex(), m.ID)
	}
	if m.Key != "billing" {
		t.Errorf("expected Key 'billing', got %s", m.Key)
	}
}
