package service

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
)

type ReportService interface {
	GetDashboard(ctx context.Context) (map[string][]bson.M, error)
	GetSummary(ctx context.Context) (map[string][]bson.M, error)
	GetContribution(ctx context.Context) (map[string][]bson.M, error)
}
