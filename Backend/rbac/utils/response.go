package utils

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/rbac/models"
)

// RespondWithSuccess sends a JSON response with the provided status code and payload.
func RespondWithSuccess(c *gin.Context, code int, payload interface{}) {
	response := models.JSONResponse{
		Status: http.StatusText(code),
		Code:   code,
		Data:   payload,
	}
	c.JSON(code, response)
}

// RespondWithError sends a JSON error response with the provided status code and error message,
// logging the detailed technical error on the server side.
func RespondWithError(c *gin.Context, code int, message string, err error) {
	if err != nil {
		log.Printf("Error: %s, Detail: %v, Status: %d", message, err, code)
	} else {
		log.Printf("Error: %s, Status: %d", message, code)
	}
	response := models.JSONResponse{
		Status: http.StatusText(code),
		Code:   code,
		Error:  message,
	}
	c.AbortWithStatusJSON(code, response)
}
