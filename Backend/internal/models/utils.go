package models

// Attachment is an uploaded file reference such as a bill or ID proof.
type Attachment struct {
	Name string  `json:"name" bson:"name"`
	URL  *string `json:"url" bson:"url"`
	Kind string  `json:"kind" bson:"kind"`
}
