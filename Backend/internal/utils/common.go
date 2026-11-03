package utils

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"time"
)

const DateLayout = "2006-01-02"

// Deref returns the trimmed value of an optional string.
func Deref(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func OneOf(value string, choices ...string) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}

func IsDate(value string) bool {
	_, err := time.Parse(DateLayout, value)
	return err == nil
}

func Today() string { return time.Now().Format(DateLayout) }

// JSONString serializes a record for the audit log; nil records become "".
func JSONString(value any) string {
	if value == nil {
		return ""
	}
	if rv := reflect.ValueOf(value); rv.Kind() == reflect.Pointer && rv.IsNil() {
		return ""
	}
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprint(value)
	}
	return string(data)
}
