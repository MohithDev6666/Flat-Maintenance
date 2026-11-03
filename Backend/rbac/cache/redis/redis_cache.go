package redis

import (
	"context"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheBackend defines the contract for caching implementations.
type CacheBackend interface {
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
}

// Cache implements CacheBackend using go-redis.
type Cache struct {
	client redis.UniversalClient
}

// New creates a new Redis Cache backend wrapping redis.UniversalClient.
func New(client redis.UniversalClient) *Cache {
	return &Cache{client: client}
}

// Interfaces validation
var _ CacheBackend = (*Cache)(nil)

// Get retrieves a key from Redis.
func (c *Cache) Get(ctx context.Context, key string) ([]byte, bool, error) {
	val, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return val, true, nil
}

// Set stores a key in Redis with the given TTL.
func (c *Cache) Set(ctx context.Context, key string, val []byte, ttl time.Duration) error {
	return c.client.Set(ctx, key, val, ttl).Err()
}

// Delete removes a key from Redis.
func (c *Cache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}
