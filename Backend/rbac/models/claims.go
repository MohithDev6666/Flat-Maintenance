package models

import "github.com/golang-jwt/jwt/v5"

// Claims contains the JWT payload including the UserID, Email, and RBAC RoleID.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	RoleID string `json:"role_id"`
	jwt.RegisteredClaims
}
