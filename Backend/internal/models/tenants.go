package models

import "time"

type Tenant struct {
	ID           string      `json:"id" bson:"id"`
	Name         string      `json:"name" bson:"name"`
	Phone        string      `json:"phone" bson:"phone"`
	Email        string      `json:"email" bson:"email"`
	FlatID       string      `json:"flatId" bson:"flatId"`
	Occupants    int         `json:"occupants" bson:"occupants"`
	MoveIn       string      `json:"moveIn" bson:"moveIn"`
	MoveOut      *string     `json:"moveOut" bson:"moveOut"`
	AgreementEnd string      `json:"agreementEnd" bson:"agreementEnd"`
	IDProofType  string      `json:"idProofType" bson:"idProofType"`
	IDProof      *Attachment `json:"idProof" bson:"idProof"`
	Emergency    string      `json:"emergency" bson:"emergency"`
	Vehicle      string      `json:"vehicle" bson:"vehicle"`
	CreatedAt    time.Time   `json:"createdAt,omitzero" bson:"createdAt"`
	UpdatedAt    time.Time   `json:"updatedAt,omitzero" bson:"updatedAt"`
}

func NewTenant() *Tenant {
	return &Tenant{}
}

func (t *Tenant) Collection() string {
	return "tenants"
}
