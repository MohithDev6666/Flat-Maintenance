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
	// Status is Pending until an admin verifies a resident's upload; admin-recorded payments start Verified.
	// Records saved before verification existed have no status and count as Verified.
	Status    string    `json:"status" bson:"status"`
	CreatedAt time.Time `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt,omitzero" bson:"updatedAt"`
}

const (
	PaymentPending  = "Pending"
	PaymentVerified = "Verified"
)

// CountsAsPaid reports whether the payment reduces what the resident owes:
// verified (or saved before verification existed) and not flagged as needing a check.
func (p *Payment) CountsAsPaid() bool {
	return !p.NeedsCheck && p.Status != PaymentPending
}

// AwaitingVerification reports whether an admin still has to verify the payment.
func (p *Payment) AwaitingVerification() bool {
	return !p.NeedsCheck && p.Status == PaymentPending
}

// VerificationLabel is the payment's review state as residents and admins see it.
func (p *Payment) VerificationLabel() string {
	if p.NeedsCheck {
		return "Needs check"
	}
	if p.Status == PaymentPending {
		return "Pending verification"
	}
	return PaymentVerified
}

func NewPayment() *Payment {
	return &Payment{}
}

func (p *Payment) Collection() string {
	return "payments"
}
