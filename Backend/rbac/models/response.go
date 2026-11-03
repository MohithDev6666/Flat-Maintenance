package models

// JSONResponse defines a standardized envelope format for all API responses.
type JSONResponse struct {
	Status string      `json:"status"`
	Code   int         `json:"code"`
	Data   interface{} `json:"data,omitempty"`
	Error  string      `json:"error,omitempty"`
}
