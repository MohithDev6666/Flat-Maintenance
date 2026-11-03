package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AuditEntry records a security-relevant event in the system.
type AuditEntry struct {
	Type       string            `json:"type"                bson:"type"` // "mutation", "check", "login", "logout"
	SubjectID  string            `json:"subject_id"          bson:"subject_id"`
	RoleID     string            `json:"role_id"             bson:"role_id"`
	Permission string            `json:"permission"          bson:"permission"`
	Result     string            `json:"result"              bson:"result"` // "success", "error", "allow", "deny"
	Metadata   map[string]string `json:"metadata,omitempty"  bson:"metadata,omitempty"`
	Timestamp  time.Time         `json:"timestamp"           bson:"timestamp"`
}

// AuditLogger defines the interface for persisting audit events.
type AuditLogger interface {
	Log(ctx context.Context, entry AuditEntry) error
}

const (
	// auditWorkers is the fixed number of background goroutines draining the write queue.
	auditWorkers = 4
	// auditBufferSize is the max number of entries that can be queued before drops begin.
	auditBufferSize = 256
)

// mongoLogger writes audit events to MongoDB via a bounded worker pool.
type mongoLogger struct {
	coll  *mongo.Collection
	queue chan AuditEntry
}

// NewLogger creates a MongoDB-backed AuditLogger that persists every audit
// event as a document in the given collection.
// Internally it maintains a pool of auditWorkers goroutines draining an
// auditBufferSize-entry channel. Entries are dropped (not buffered indefinitely)
// when the channel is full to keep memory bounded.
func NewLogger(db *mongo.Database, collectionName string) AuditLogger {
	return NewMongoLogger(db, collectionName)
}

// NewMongoLogger creates a MongoDB-backed AuditLogger.
func NewMongoLogger(db *mongo.Database, collectionName string) AuditLogger {
	coll := db.Collection(collectionName)

	// Create TTL index in background — 90-day retention.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		expireAfter := int32(90 * 24 * 60 * 60) // 90 days in seconds
		_, _ = coll.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys:    bson.D{{Key: "timestamp", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(expireAfter),
		})
	}()

	l := &mongoLogger{
		coll:  coll,
		queue: make(chan AuditEntry, auditBufferSize),
	}

	// Start the fixed-size worker pool.
	for i := 0; i < auditWorkers; i++ {
		go l.worker()
	}

	return l
}

// worker drains the queue channel and writes entries to MongoDB.
func (l *mongoLogger) worker() {
	for entry := range l.queue {
		if entry.Timestamp.IsZero() {
			entry.Timestamp = time.Now()
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, _ = l.coll.InsertOne(ctx, entry)
		cancel()
	}
}

// Log enqueues an audit entry. If the buffer is full the entry is silently
// dropped rather than blocking the caller or spawning an extra goroutine.
func (l *mongoLogger) Log(_ context.Context, entry AuditEntry) error {
	select {
	case l.queue <- entry:
	default:
		// Buffer full — drop to keep the caller non-blocking.
	}
	return nil
}

// postgresLogger writes audit events to PostgreSQL via a bounded worker pool.
type postgresLogger struct {
	pool      *pgxpool.Pool
	tableName string
	queue     chan AuditEntry
}

// NewPostgresLogger creates a PostgreSQL-backed AuditLogger that persists every audit
// event to the designated audit table.
func NewPostgresLogger(pool *pgxpool.Pool, tableName string) AuditLogger {
	if tableName == "" {
		tableName = "rbac_audit_logs"
	}

	l := &postgresLogger{
		pool:      pool,
		tableName: tableName,
		queue:     make(chan AuditEntry, auditBufferSize),
	}

	for i := 0; i < auditWorkers; i++ {
		go l.worker()
	}

	return l
}

func (l *postgresLogger) worker() {
	query := fmt.Sprintf(`
		INSERT INTO %s (type, subject_id, role_id, permission, result, metadata, timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, l.tableName)

	for entry := range l.queue {
		if entry.Timestamp.IsZero() {
			entry.Timestamp = time.Now()
		}
		var metaJSON []byte
		if entry.Metadata != nil {
			metaJSON, _ = json.Marshal(entry.Metadata)
		} else {
			metaJSON = []byte("{}")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, _ = l.pool.Exec(ctx, query,
			entry.Type,
			entry.SubjectID,
			entry.RoleID,
			entry.Permission,
			entry.Result,
			metaJSON,
			entry.Timestamp,
		)
		cancel()
	}
}

func (l *postgresLogger) Log(_ context.Context, entry AuditEntry) error {
	select {
	case l.queue <- entry:
	default:
		// Buffer full — drop to keep the caller non-blocking.
	}
	return nil
}

// noopLogger implements AuditLogger without performing any actions.
type noopLogger struct{}

// NewNoopLogger creates a no-op AuditLogger.
func NewNoopLogger() AuditLogger {
	return &noopLogger{}
}

func (n *noopLogger) Log(_ context.Context, _ AuditEntry) error {
	return nil
}
