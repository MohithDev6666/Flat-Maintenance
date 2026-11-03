package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trideadmin/rbac/models"
)

type postgresModuleRepo struct {
	pool      *pgxpool.Pool
	tableName string
}

// NewPostgresModuleRepository creates a PostgreSQL-backed ModuleRepository.
func NewPostgresModuleRepository(pool *pgxpool.Pool, tableName string) ModuleRepository {
	if tableName == "" {
		tableName = "rbac_modules"
	}
	return &postgresModuleRepo{
		pool:      pool,
		tableName: tableName,
	}
}

func (r *postgresModuleRepo) isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func (r *postgresModuleRepo) Create(ctx context.Context, mod *models.Module) error {
	if mod.ID == "" {
		mod.ID = uuid.NewString()
	}
	now := time.Now()
	mod.CreatedAt = now
	mod.UpdatedAt = now
	if mod.Permissions == nil {
		mod.Permissions = []string{}
	}

	permsJSON, err := json.Marshal(mod.Permissions)
	if err != nil {
		return fmt.Errorf("marshal permissions: %w", err)
	}

	query := fmt.Sprintf(`
		INSERT INTO %s (id, key, name, description, is_master, permissions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, r.tableName)

	_, err = r.pool.Exec(ctx, query,
		mod.ID,
		mod.Key,
		mod.Name,
		mod.Description,
		mod.IsMaster,
		permsJSON,
		mod.CreatedAt,
		mod.UpdatedAt,
	)
	if err != nil {
		if r.isUniqueViolation(err) {
			return models.ErrModuleAlreadyExists
		}
		return fmt.Errorf("postgres Create module: %w", err)
	}
	return nil
}

func (r *postgresModuleRepo) GetByID(ctx context.Context, id string) (*models.Module, error) {
	query := fmt.Sprintf(`
		SELECT id, key, name, description, is_master, permissions, created_at, updated_at
		FROM %s WHERE id = $1
	`, r.tableName)

	var mod models.Module
	var permsBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&mod.ID,
		&mod.Key,
		&mod.Name,
		&mod.Description,
		&mod.IsMaster,
		&permsBytes,
		&mod.CreatedAt,
		&mod.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrModuleNotFound
		}
		return nil, fmt.Errorf("postgres GetByID module: %w", err)
	}

	if len(permsBytes) > 0 {
		if err := json.Unmarshal(permsBytes, &mod.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	} else {
		mod.Permissions = []string{}
	}
	return &mod, nil
}

func (r *postgresModuleRepo) GetByKey(ctx context.Context, key string) (*models.Module, error) {
	query := fmt.Sprintf(`
		SELECT id, key, name, description, is_master, permissions, created_at, updated_at
		FROM %s WHERE key = $1
	`, r.tableName)

	var mod models.Module
	var permsBytes []byte
	err := r.pool.QueryRow(ctx, query, key).Scan(
		&mod.ID,
		&mod.Key,
		&mod.Name,
		&mod.Description,
		&mod.IsMaster,
		&permsBytes,
		&mod.CreatedAt,
		&mod.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrModuleNotFound
		}
		return nil, fmt.Errorf("postgres GetByKey module: %w", err)
	}

	if len(permsBytes) > 0 {
		if err := json.Unmarshal(permsBytes, &mod.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	} else {
		mod.Permissions = []string{}
	}
	return &mod, nil
}

func (r *postgresModuleRepo) GetAll(ctx context.Context) ([]models.Module, error) {
	query := fmt.Sprintf(`
		SELECT id, key, name, description, is_master, permissions, created_at, updated_at
		FROM %s ORDER BY created_at ASC
	`, r.tableName)

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("postgres GetAll modules: %w", err)
	}
	defer rows.Close()

	list := make([]models.Module, 0)
	for rows.Next() {
		var mod models.Module
		var permsBytes []byte
		if err := rows.Scan(
			&mod.ID,
			&mod.Key,
			&mod.Name,
			&mod.Description,
			&mod.IsMaster,
			&permsBytes,
			&mod.CreatedAt,
			&mod.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres GetAll scan module: %w", err)
		}

		if len(permsBytes) > 0 {
			if err := json.Unmarshal(permsBytes, &mod.Permissions); err != nil {
				return nil, fmt.Errorf("unmarshal permissions: %w", err)
			}
		} else {
			mod.Permissions = []string{}
		}
		list = append(list, mod)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres GetAll rows module: %w", err)
	}
	return list, nil
}

func (r *postgresModuleRepo) Update(ctx context.Context, id string, req models.UpdateModuleRequest) (*models.Module, error) {
	setClauses := []string{"updated_at = $1"}
	args := []interface{}{time.Now()}
	idx := 2

	if req.Name != "" {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", idx))
		args = append(args, req.Name)
		idx++
	}
	if req.Description != "" {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", idx))
		args = append(args, req.Description)
		idx++
	}
	if req.IsMaster != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_master = $%d", idx))
		args = append(args, *req.IsMaster)
		idx++
	}
	if req.Permissions != nil {
		permsJSON, err := json.Marshal(req.Permissions)
		if err != nil {
			return nil, fmt.Errorf("marshal permissions: %w", err)
		}
		setClauses = append(setClauses, fmt.Sprintf("permissions = $%d", idx))
		args = append(args, permsJSON)
		idx++
	}

	args = append(args, id)
	query := fmt.Sprintf(`
		UPDATE %s
		SET %s
		WHERE id = $%d
		RETURNING id, key, name, description, is_master, permissions, created_at, updated_at
	`, r.tableName, strings.Join(setClauses, ", "), idx)

	var mod models.Module
	var permsBytes []byte
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&mod.ID,
		&mod.Key,
		&mod.Name,
		&mod.Description,
		&mod.IsMaster,
		&permsBytes,
		&mod.CreatedAt,
		&mod.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrModuleNotFound
		}
		if r.isUniqueViolation(err) {
			return nil, models.ErrModuleAlreadyExists
		}
		return nil, fmt.Errorf("postgres Update module: %w", err)
	}

	if len(permsBytes) > 0 {
		if err := json.Unmarshal(permsBytes, &mod.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	} else {
		mod.Permissions = []string{}
	}
	return &mod, nil
}

func (r *postgresModuleRepo) Delete(ctx context.Context, id string) error {
	query := fmt.Sprintf(`DELETE FROM %s WHERE id = $1`, r.tableName)
	ct, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("postgres Delete module: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrModuleNotFound
	}
	return nil
}
