package models

// UserLink connects an RBAC user to an owner or tenant profile.
type UserLink struct {
	UserID   string `json:"userId" bson:"userId"`
	Kind     string `json:"kind" bson:"kind"`
	OwnerID  string `json:"ownerId,omitempty" bson:"ownerId,omitempty"`
	TenantID string `json:"tenantId,omitempty" bson:"tenantId,omitempty"`
	RoleID   string `json:"roleId" bson:"roleId"`
}

func NewUserLink() *UserLink {
	return &UserLink{}
}

func (u *UserLink) Collection() string {
	return "user-profile-links"
}
