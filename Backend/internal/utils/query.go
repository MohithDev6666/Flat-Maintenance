package utils

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

// ParseListQuery reads limit, offset and the supported filter fields.
func ParseListQuery(c *gin.Context) (int, int, bson.M, error) {
	limit := 100
	if raw := c.Query("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 500 {
			return 0, 0, nil, BadRequest("limit must be between 1 and 500")
		}
		limit = value
	}
	offset := 0
	if raw := c.Query("offset"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 0 {
			return 0, 0, nil, BadRequest("offset must be a non-negative integer")
		}
		offset = value
	}
	filter := bson.M{}
	for _, field := range []string{"month", "flatId", "status"} {
		if value := c.Query(field); value != "" {
			filter[field] = value
		}
	}
	if value := c.Query("needsCheck"); value != "" {
		parsed, err := strconv.ParseBool(value)
		if err != nil {
			return 0, 0, nil, BadRequest("needsCheck must be true or false")
		}
		filter["needsCheck"] = parsed
	}
	return limit, offset, filter, nil
}
