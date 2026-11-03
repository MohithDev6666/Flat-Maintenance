package utils

import "github.com/gin-gonic/gin"

// UserID returns the RBAC user ID set by the authentication middleware.
func UserID(c *gin.Context) string {
	value, _ := c.Get("userID")
	id, _ := value.(string)
	return id
}

// Actor returns the user recorded in audit entries.
func Actor(c *gin.Context) string {
	if value, ok := c.Get("userEmail"); ok {
		if email, valid := value.(string); valid && email != "" {
			return email
		}
	}
	if id := UserID(c); id != "" {
		return id
	}
	return "unknown"
}
