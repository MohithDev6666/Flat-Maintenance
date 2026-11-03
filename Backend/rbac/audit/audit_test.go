package audit_test

import (
	"context"
	"testing"
	"time"

	"github.com/trideadmin/rbac/audit"
)

func TestNoopLogger(t *testing.T) {
	logger := audit.NewNoopLogger()
	err := logger.Log(context.Background(), audit.AuditEntry{
		Type:       "mutation",
		SubjectID:  "user-123",
		Permission: "users:create",
		Result:     "success",
		Timestamp:  time.Now(),
	})
	if err != nil {
		t.Errorf("noop logger should not return error, got %v", err)
	}
}
