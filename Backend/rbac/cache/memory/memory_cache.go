package memory

import (
	"context"
	"sync"
	"time"
)

// CacheBackend defines the contract for caching implementations.
type CacheBackend interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

type cacheEntry struct {
	value     []byte
	expiresAt time.Time
}

// Cache implements CacheBackend using a sync.Map.
type Cache struct {
	store sync.Map
}

// New creates a new in-memory Cache.
func New() *Cache {
	return &Cache{}
}

// Interfaces validation
var _ CacheBackend = (*Cache)(nil)

// Get retrieves a value from the cache.
func (c *Cache) Get(ctx context.Context, key string) ([]byte, bool, error) {
	val, ok := c.store.Load(key)
	if !ok {
		return nil, false, nil
	}

	entry, ok := val.(cacheEntry)
	if !ok {
		return nil, false, nil
	}

	if time.Now().After(entry.expiresAt) {
		c.store.Delete(key)
		return nil, false, nil
	}

	copied := make([]byte, len(entry.value))
	copy(copied, entry.value)
	return copied, true, nil
}

// Set stores a value in the cache with the given TTL.
func (c *Cache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
	copied := make([]byte, len(val))
	copy(copied, val)

	entry := cacheEntry{
		value:     copied,
		expiresAt: time.Now().Add(ttl),
	}
	c.store.Store(key, entry)
	return nil
}

// Delete removes the key from the cache.
func (c *Cache) Delete(ctx context.Context, key string) error {
	c.store.Delete(key)
	return nil
}
