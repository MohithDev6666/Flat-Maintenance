package models

import "time"

type Expense struct {
	ID             string      `json:"id" bson:"id"`
	Date           string      `json:"date" bson:"date"`
	Category       string      `json:"category" bson:"category"`
	Responsibility string      `json:"responsibility" bson:"responsibility"`
	Description    string      `json:"description" bson:"description"`
	Amount         float64     `json:"amount" bson:"amount"`
	VendorName     string      `json:"vendorName" bson:"vendorName"`
	VendorPhone    string      `json:"vendorPhone" bson:"vendorPhone"`
	PaymentMode    string      `json:"paymentMode" bson:"paymentMode"`
	PaidBy         string      `json:"paidBy" bson:"paidBy"`
	PaidByUserID   *string     `json:"paidByUserId" bson:"paidByUserId"`
	Bill           *Attachment `json:"bill" bson:"bill"`
	CreatedAt      time.Time   `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt      time.Time   `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewExpense() *Expense {
	return &Expense{}
}

func (e *Expense) Collection() string {
	return "expenses"
}
