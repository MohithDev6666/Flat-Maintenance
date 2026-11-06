package repo

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
)

type Report interface {
	// GetCollections returns every document of each named collection, newest first.
	GetCollections(ctx context.Context, collections ...string) (map[string][]bson.M, error)
	// LoadLedgerData returns the typed records the money calculations are worked out from.
	LoadLedgerData(ctx context.Context) (*LedgerData, error)
}
