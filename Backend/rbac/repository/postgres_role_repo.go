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

type postgresRoleRepo struct {
	pool      *pgxpool.Pool
	tableName string
}

// NewPostgresRoleRepository creates a PostgreSQL-backed RoleRepository.
func NewPostgresRoleRepository(pool *pgxpool.Pool, tableName string) RoleRepository {
	if tableName == "" {
		tableName = "rbac_roles"
	}
	return &postgresRoleRepo{
		pool:      pool,
		tableName: tableName,
	}
}

func (r *postgresRoleRepo) isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func (r *postgresRoleRepo) Create(ctx context.Context, role *models.Role) error {
	if role.ID == "" {
		role.ID = uuid.NewString()
	}
	now := time.Now()
	role.CreatedAt = now
	role.UpdatedAt = now
	if role.Active == 0 {
		role.Active = 1
	}
	if role.Permissions == nil {
		role.Permissions = []models.PermissionObject{}
	}

	permsJSON, err := json.Marshal(role.Permissions)
	if err != nil {
		return fmt.Errorf("marshal permissions: %w", err)
	}

	query := fmt.Sprintf(`
		INSERT INTO %s (id, name, description, level, is_admin, active, permissions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, r.tableName)

	_, err = r.pool.Exec(ctx, query,
		role.ID,
		role.Name,
		role.Description,
		role.Level,
		role.IsAdmin,
		role.Active,
		permsJSON,
		role.CreatedAt,
		role.UpdatedAt,
	)
	if err != nil {
		if r.isUniqueViolation(err) {
			return models.ErrRoleAlreadyExists
		}
		return fmt.Errorf("postgres Create role: %w", err)
	}
	return nil
}

func (r *postgresRoleRepo) GetByID(ctx context.Context, id string) (*models.Role, error) {
	query := fmt.Sprintf(`
		SELECT id, name, description, level, is_admin, active, permissions, created_at, updated_at
		FROM %s WHERE id = $1
	`, r.tableName)

	var role models.Role
	var permsBytes []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&role.ID,
		&role.Name,
		&role.Description,
		&role.Level,
		&role.IsAdmin,
		&role.Active,
		&permsBytes,
		&role.CreatedAt,
		&role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrRoleNotFound
		}
		return nil, fmt.Errorf("postgres GetByID role: %w", err)
	}

	if len(permsBytes) > 0 {
		if err := json.Unmarshal(permsBytes, &role.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	} else {
		role.Permissions = []models.PermissionObject{}
	}
	return &role, nil
}

func (r *postgresRoleRepo) GetByName(ctx context.Context, name string) (*models.Role, error) {
	query := fmt.Sprintf(`
		SELECT id, name, description, level, is_admin, active, permissions, created_at, updated_at
		FROM %s WHERE name = $1
	`, r.tableName)

	var role models.Role
	var permsBytes []byte
	err := r.pool.QueryRow(ctx, query, name).Scan(
		&role.ID,
		&role.Name,
		&role.Description,
		&role.Level,
		&role.IsAdmin,
		&role.Active,
		&permsBytes,
		&role.CreatedAt,
		&role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrRoleNotFound
		}
		return nil, fmt.Errorf("postgres GetByName role: %w", err)
	}

	if len(permsBytes) > 0 {
		if err := json.Unmarshal(permsBytes, &role.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	} else {
		role.Permissions = []models.PermissionObject{}
	}
	return &role, nil
}

func (r *postgresRoleRepo) GetAll(ctx context.Context) ([]models.Role, error) {
	query := fmt.Sprintf(`
		SELECT id, name, description, level, is_admin, active, permissions, created_at, updated_at
		FROM %s ORDER BY level ASC
	`, r.tableName)

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("postgres GetAll roles: %w", err)
	}
	defer rows.Close()

	list := make([]models.Role, 0)
	for rows.Next() {
		var role models.Role
		var permsBytes []byte
		if err := rows.Scan(
			&role.ID,
			&role.Name,
			&role.Description,
			&role.Level,
			&role.IsAdmin,
			&role.Active,
			&permsBytes,
			&role.CreatedAt,
			&role.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres GetAll scan role: %w", err)
		}

		if len(permsBytes) > 0 {
			if err := json.Unmarshal(permsBytes, &role.Permissions); err != nil {
				return nil, fmt.Errorf("unmarshal permissions: %w", err)
			}
		} else {
			role.Permissions = []models.PermissionObject{}
		}
		list = append(list, role)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres GetAll rows role: %w", err)
	}
	return list, nil
}

func (r *postgresRoleRepo) MaxLevel(ctx context.Context) (int, error) {
	query := fmt.Sprintf(`SELECT COALESCE(MAX(level), 0) FROM %s`, r.tableName)
	var maxLevel int
	if err := r.pool.QueryRow(ctx, query).Scan(&maxLevel); err != nil {
		return 0, fmt.Errorf("postgres MaxLevel roles: %w", err)
	}
	return maxLevel, nil
}

func (r *postgresRoleRepo) Update(ctx context.Context, id string, req *models.UpdateRoleRequest) (*models.Role, error) {
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
	if req.IsAdmin != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_admin = $%d", idx))
		args = append(args, *req.IsAdmin)
		idx++
	}
	if req.Active != nil {
		setClauses = append(setClauses, fmt.Sprintf("active = $%d", idx))
		args = append(args, *req.Active)
		idx++
	}
	if req.ParsedPerms != nil {
		permsJSON, err := json.Marshal(req.ParsedPerms)
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
		RETURNING id, name, description, level, is_admin, active, permissions, created_at, updated_at
	`, r.tableName, strings.Join(setClauses, ", "), idx)

	var role models.Role
	var permsBytes []byte
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&role.ID,
		&role.Name,
		&role.Description,
		&role.Level,
		&role.IsAdmin,
		&role.Active,
		&permsBytes,
		&role.CreatedAt,
		&role.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrRoleNotFound
		}
		if r.isUniqueViolation(err) {
			return nil, models.ErrRoleAlreadyExists
		}
		return nil, fmt.Errorf("postgres Update role: %w", err)
	}

	if len(permsBytes) > 0 {
		if err := json.Unmarshal(permsBytes, &role.Permissions); err != nil {
			return nil, fmt.Errorf("unmarshal permissions: %w", err)
		}
	} else {
		role.Permissions = []models.PermissionObject{}
	}
	return &role, nil
}

func (r *postgresRoleRepo) Delete(ctx context.Context, id string) error {
	query := fmt.Sprintf(`DELETE FROM %s WHERE id = $1`, r.tableName)
	ct, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("postgres Delete role: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrRoleNotFound
	}
	return nil
}

func (r *postgresRoleRepo) UpdatePermissions(ctx context.Context, id string, perms []models.PermissionObject) error {
	permsJSON, err := json.Marshal(perms)
	if err != nil {
		return fmt.Errorf("marshal permissions: %w", err)
	}
	query := fmt.Sprintf(`UPDATE %s SET permissions = $1, updated_at = $2 WHERE id = $3`, r.tableName)
	ct, err := r.pool.Exec(ctx, query, permsJSON, time.Now(), id)
	if err != nil {
		return fmt.Errorf("postgres UpdatePermissions: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrRoleNotFound
	}
	return nil
}
