package models

import "time"

type MonthLock struct {
	ID         string     `json:"id" bson:"id"`
	Month      string     `json:"month" bson:"month"`
	Locked     bool       `json:"locked" bson:"locked"`
	LockedBy   string     `json:"lockedBy" bson:"lockedBy"`
	LockedAt   *time.Time `json:"lockedAt" bson:"lockedAt"`
	UnlockedBy string     `json:"unlockedBy" bson:"unlockedBy"`
	UnlockedAt *time.Time `json:"unlockedAt" bson:"unlockedAt"`
	CreatedAt  time.Time  `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewMonthLock() *MonthLock {
	return &MonthLock{}
}

func (m *MonthLock) Collection() string {
	return "month-locks"
}
