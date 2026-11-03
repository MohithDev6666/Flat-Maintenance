package models

import "time"

type Owner struct {
	ID        string    `json:"id" bson:"id"`
	Name      string    `json:"name" bson:"name"`
	Phone     string    `json:"phone" bson:"phone"`
	Email     string    `json:"email" bson:"email"`
	FlatID    *string   `json:"flatId" bson:"flatId"`
	Address   string    `json:"address" bson:"address"`
	Emergency string    `json:"emergency" bson:"emergency"`
	CreatedAt time.Time `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewOwner() *Owner {
	return &Owner{}
}

func (o *Owner) Collection() string {
	return "owners"
}
