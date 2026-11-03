package models

import "errors"

var (
	// Entity Not Found
	ErrRoleNotFound   = errors.New("role not found")
	ErrModuleNotFound = errors.New("module not found")
	ErrUserNotFound   = errors.New("user not found")

	// Conflict / Already Exists
	ErrRoleAlreadyExists   = errors.New("role already exists")
	ErrModuleAlreadyExists = errors.New("module already exists")
	ErrUserAlreadyExists   = errors.New("user with this email already exists") // #2 #9
	ErrEmailAlreadyTaken   = errors.New("email address is already taken")      // #6 #9

	// Auth Errors
	ErrInvalidCredentials = errors.New("invalid email or password") // #9
	ErrInvalidToken       = errors.New("invalid or expired token")  // #9
	ErrUserSuspended      = errors.New("account is suspended")      // #7

	// Permission
	ErrPermissionDenied = errors.New("permission denied")

	// Misc
	ErrInvalidRoleLevel = errors.New("invalid role level")
	ErrUserRoleNotFound = errors.New("user role assignment not found")
	ErrInvalidInput     = errors.New("invalid input data")
	ErrInvalidSubject   = errors.New("invalid subject context")
	ErrUserInvalidID    = errors.New("invalid user ID")
	ErrRoleInvalidID    = errors.New("invalid role ID")
	ErrModuleInvalidID  = errors.New("invalid module ID")
)
