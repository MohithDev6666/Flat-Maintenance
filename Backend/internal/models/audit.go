package models

import (
	"time"

	"github.com/google/uuid"
)

type AuditEntry struct {
	ID          string    `json:"id" bson:"id"`
	At          time.Time `json:"at" bson:"at"`
	Actor       string    `json:"actor" bson:"actor"`
	RecordType  string    `json:"recordType" bson:"recordType"`
	Action      string    `json:"action" bson:"action"`
	Description string    `json:"description" bson:"description"`
	OldValue    string    `json:"oldValue" bson:"oldValue"`
	NewValue    string    `json:"newValue" bson:"newValue"`
	CreatedAt   time.Time `json:"createdAt,omitzero" bson:"createdAt"`
	// Changes is the readable field-by-field difference, worked out when the entry is read; it is not stored.
	Changes []AuditChange `json:"changes" bson:"-"`
}

// AuditChange is one field that differs between an audit entry's old and new values.
type AuditChange struct {
	Field string `json:"field"`
	Label string `json:"label"`
	Old   string `json:"old"`
	New   string `json:"new"`
}

func NewAuditEntry() *AuditEntry {
	return &AuditEntry{}
}

func (a *AuditEntry) Collection() string {
	return "audit"
}

// NewAuditRecord builds a timestamped audit entry for a change.
func NewAuditRecord(actor, recordType, action, description, oldValue, newValue string) *AuditEntry {
	now := time.Now().UTC()
	return &AuditEntry{
		ID: uuid.NewString(), At: now, CreatedAt: now, Actor: actor,
		RecordType: recordType, Action: action, Description: description,
		OldValue: oldValue, NewValue: newValue,
	}
}
