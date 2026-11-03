package models

import "time"

// BuildingID is the fixed document ID of the single building record.
const BuildingID = "building"

type Building struct {
	ID           string    `json:"id,omitempty" bson:"id"`
	Name         string    `json:"name" bson:"name"`
	Address      string    `json:"address" bson:"address"`
	TotalFlats   int       `json:"totalFlats" bson:"totalFlats"`
	Floors       int       `json:"floors" bson:"floors"`
	ContactPhone string    `json:"contactPhone" bson:"contactPhone"`
	CreatedAt    time.Time `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewBuilding() *Building {
	return &Building{}
}

func (b *Building) Collection() string {
	return "building"
}
