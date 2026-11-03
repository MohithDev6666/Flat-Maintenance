package models

// Subject represents the authenticated user and their active role.
// This is typically populated from JWT claims in the middleware.
type Subject struct {
	UserID string `json:"user_id"`
	RoleID string `json:"role_id"`
}
