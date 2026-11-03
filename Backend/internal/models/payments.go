package models

import "time"

type Payment struct {
	ID         string     `json:"id" bson:"id"`
	UserID     string     `json:"userId" bson:"userId"`
	PayerName  string     `json:"payerName" bson:"payerName"`
	FlatID     string     `json:"flatId" bson:"flatId"`
	Role       string     `json:"role" bson:"role"`
	ResidentID string     `json:"residentId" bson:"residentId"`
	Month      string     `json:"month" bson:"month"`
	Amount     float64    `json:"amount" bson:"amount"`
	Date       string     `json:"date" bson:"date"`
	Mode       string     `json:"mode" bson:"mode"`
	Reference  string     `json:"reference" bson:"reference"`
	Screenshot Attachment `json:"screenshot" bson:"screenshot"`
	NeedsCheck bool       `json:"needsCheck" bson:"needsCheck"`
	CheckNote  string     `json:"checkNote" bson:"checkNote"`
	CreatedAt  time.Time  `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewPayment() *Payment {
	return &Payment{}
}

func (p *Payment) Collection() string {
	return "payments"
}
