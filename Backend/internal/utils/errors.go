package utils

import (
	"errors"
	"net/http"

	"go.mongodb.org/mongo-driver/mongo"
)

// HTTPError is a service error that carries the HTTP status to return.
type HTTPError struct {
	Status  int
	Message string
}

func (e *HTTPError) Error() string { return e.Message }

func BadRequest(message string) error {
	return &HTTPError{Status: http.StatusBadRequest, Message: message}
}
func Forbidden(message string) error {
	return &HTTPError{Status: http.StatusForbidden, Message: message}
}
func NotFound(message string) error { return &HTTPError{Status: http.StatusNotFound, Message: message} }
func Conflict(message string) error { return &HTTPError{Status: http.StatusConflict, Message: message} }
func Internal(message string) error {
	return &HTTPError{Status: http.StatusInternalServerError, Message: message}
}

// ReferenceError maps a failed lookup of a referenced record (label) to a conflict.
func ReferenceError(err error, label string) error {
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Conflict(label + " record does not exist")
	}
	return err
}
