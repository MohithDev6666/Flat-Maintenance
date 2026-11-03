package models

import "time"

type Category struct {
	ID          string    `json:"id" bson:"id"`
	Name        string    `json:"name" bson:"name"`
	Description string    `json:"description" bson:"description"`
	DefaultTag  string    `json:"defaultTag" bson:"defaultTag"`
	Status      string    `json:"status" bson:"status"`
	CreatedAt   time.Time `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewCategory() *Category {
	return &Category{}
}

func (c *Category) Collection() string {
	return "categories"
}
