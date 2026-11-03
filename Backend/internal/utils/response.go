package utils

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"go.mongodb.org/mongo-driver/mongo"
)

// RespondError maps service and MongoDB errors to the API error response.
func RespondError(c *gin.Context, err error) {
	var httpErr *HTTPError
	if errors.As(err, &httpErr) {
		if httpErr.Status >= http.StatusInternalServerError {
			logs.ErrorLogger.Println(c.Request.Method, c.FullPath(), "error:", httpErr.Message)
		}
		c.JSON(httpErr.Status, gin.H{"error": httpErr.Message})
		return
	}
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}
	if mongo.IsDuplicateKeyError(err) {
		c.JSON(http.StatusConflict, gin.H{"error": "record already exists"})
		return
	}
	logs.ErrorLogger.Println(c.Request.Method, c.FullPath(), "error:", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "application database operation failed"})
}
