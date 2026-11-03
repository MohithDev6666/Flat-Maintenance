package repository

import (
	"context"
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

type postgresUserRepo struct {
	pool      *pgxpool.Pool
	tableName string
}

// NewPostgresUserRepository creates a PostgreSQL-backed UserRepository.
func NewPostgresUserRepository(pool *pgxpool.Pool, tableName string) UserRepository {
	if tableName == "" {
		tableName = "rbac_users"
	}
	return &postgresUserRepo{
		pool:      pool,
		tableName: tableName,
	}
}

func (r *postgresUserRepo) isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func (r *postgresUserRepo) Create(ctx context.Context, user *models.User) error {
	if user.ID == "" {
		user.ID = uuid.NewString()
	}
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now
	if user.Active == 0 {
		user.Active = 1
	}

	query := fmt.Sprintf(`
		INSERT INTO %s (id, name, email, password_hash, phone, role_id, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, r.tableName)

	_, err := r.pool.Exec(ctx, query,
		user.ID,
		user.Name,
		user.Email,
		user.Password,
		user.Phone,
		user.RoleID,
		user.Active,
		user.CreatedAt,
		user.UpdatedAt,
	)
	if err != nil {
		if r.isUniqueViolation(err) {
			return models.ErrUserAlreadyExists
		}
		return fmt.Errorf("postgres Create user: %w", err)
	}
	return nil
}

func (r *postgresUserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	query := fmt.Sprintf(`
		SELECT id, name, email, password_hash, phone, role_id, active, created_at, updated_at
		FROM %s WHERE id = $1
	`, r.tableName)

	var u models.User
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&u.ID,
		&u.Name,
		&u.Email,
		&u.Password,
		&u.Phone,
		&u.RoleID,
		&u.Active,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrUserNotFound
		}
		return nil, fmt.Errorf("postgres GetByID user: %w", err)
	}
	return &u, nil
}

func (r *postgresUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := fmt.Sprintf(`
		SELECT id, name, email, password_hash, phone, role_id, active, created_at, updated_at
		FROM %s WHERE email = $1
	`, r.tableName)

	var u models.User
	err := r.pool.QueryRow(ctx, query, email).Scan(
		&u.ID,
		&u.Name,
		&u.Email,
		&u.Password,
		&u.Phone,
		&u.RoleID,
		&u.Active,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrUserNotFound
		}
		return nil, fmt.Errorf("postgres GetByEmail user: %w", err)
	}
	return &u, nil
}

func (r *postgresUserRepo) GetAll(ctx context.Context) ([]models.User, error) {
	query := fmt.Sprintf(`
		SELECT id, name, email, password_hash, phone, role_id, active, created_at, updated_at
		FROM %s ORDER BY created_at DESC
	`, r.tableName)

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("postgres GetAll users: %w", err)
	}
	defer rows.Close()

	list := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(
			&u.ID,
			&u.Name,
			&u.Email,
			&u.Password,
			&u.Phone,
			&u.RoleID,
			&u.Active,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("postgres GetAll scan user: %w", err)
		}
		list = append(list, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres GetAll rows user: %w", err)
	}
	return list, nil
}

func (r *postgresUserRepo) Count(ctx context.Context) (int64, error) {
	query := fmt.Sprintf(`SELECT COUNT(*) FROM %s`, r.tableName)
	var count int64
	if err := r.pool.QueryRow(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("postgres Count users: %w", err)
	}
	return count, nil
}

func (r *postgresUserRepo) Update(ctx context.Context, id string, req *models.UpdateUserRequest) (*models.User, error) {
	setClauses := []string{"updated_at = $1"}
	args := []interface{}{time.Now()}
	idx := 2

	if req.Name != "" {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", idx))
		args = append(args, req.Name)
		idx++
	}
	if req.Email != "" {
		setClauses = append(setClauses, fmt.Sprintf("email = $%d", idx))
		args = append(args, req.Email)
		idx++
	}
	if req.Password != "" {
		setClauses = append(setClauses, fmt.Sprintf("password_hash = $%d", idx))
		args = append(args, req.Password)
		idx++
	}
	if req.Phone != "" {
		setClauses = append(setClauses, fmt.Sprintf("phone = $%d", idx))
		args = append(args, req.Phone)
		idx++
	}
	if req.Active != nil {
		setClauses = append(setClauses, fmt.Sprintf("active = $%d", idx))
		args = append(args, *req.Active)
		idx++
	}

	args = append(args, id)
	query := fmt.Sprintf(`
		UPDATE %s
		SET %s
		WHERE id = $%d
		RETURNING id, name, email, password_hash, phone, role_id, active, created_at, updated_at
	`, r.tableName, strings.Join(setClauses, ", "), idx)

	var u models.User
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&u.ID,
		&u.Name,
		&u.Email,
		&u.Password,
		&u.Phone,
		&u.RoleID,
		&u.Active,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, models.ErrUserNotFound
		}
		if r.isUniqueViolation(err) {
			return nil, models.ErrEmailAlreadyTaken
		}
		return nil, fmt.Errorf("postgres Update user: %w", err)
	}
	return &u, nil
}

func (r *postgresUserRepo) Delete(ctx context.Context, id string) error {
	query := fmt.Sprintf(`DELETE FROM %s WHERE id = $1`, r.tableName)
	ct, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("postgres Delete user: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrUserNotFound
	}
	return nil
}

func (r *postgresUserRepo) UpdateRole(ctx context.Context, userID, roleID string) error {
	query := fmt.Sprintf(`UPDATE %s SET role_id = $1, updated_at = $2 WHERE id = $3`, r.tableName)
	ct, err := r.pool.Exec(ctx, query, roleID, time.Now(), userID)
	if err != nil {
		return fmt.Errorf("postgres UpdateRole: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return models.ErrUserNotFound
	}
	return nil
}
