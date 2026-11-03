package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	reportRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/repo"
	"go.mongodb.org/mongo-driver/bson"
)

type reportServiceImpl struct {
	reportRepo reportRepo.Report
}

func NewReportService(reportRepo reportRepo.Report) ReportService {
	return &reportServiceImpl{
		reportRepo: reportRepo,
	}
}

func (rs *reportServiceImpl) GetDashboard(ctx context.Context) (map[string][]bson.M, error) {
	return rs.reportRepo.GetCollections(ctx,
		models.NewFlat().Collection(), models.NewOwner().Collection(), models.NewTenant().Collection(),
		models.NewCategory().Collection(), models.NewExpense().Collection(), models.NewPayment().Collection(),
		models.NewMonthLock().Collection(),
	)
}

func (rs *reportServiceImpl) GetSummary(ctx context.Context) (map[string][]bson.M, error) {
	return rs.reportRepo.GetCollections(ctx,
		models.NewFlat().Collection(), models.NewOwner().Collection(), models.NewTenant().Collection(),
		models.NewExpense().Collection(), models.NewPayment().Collection(), models.NewMonthLock().Collection(),
	)
}

func (rs *reportServiceImpl) GetContribution(ctx context.Context) (map[string][]bson.M, error) {
	return rs.reportRepo.GetCollections(ctx,
		models.NewFlat().Collection(), models.NewOwner().Collection(), models.NewTenant().Collection(),
		models.NewExpense().Collection(), models.NewPayment().Collection(),
	)
}
