package models

import "time"

type Flat struct {
	ID        string    `json:"id" bson:"id"`
	Number    string    `json:"number" bson:"number"`
	Floor     int       `json:"floor" bson:"floor"`
	Status    string    `json:"status" bson:"status"`
	CreatedAt time.Time `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewFlat() *Flat {
	return &Flat{}
}

func (f *Flat) Collection() string {
	return "flats"
}
