package service

import (
	"context"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
)

// Viewer is who asks for a report: an administrator, or a resident with their profile link
// (nil when the resident is not linked to an owner or tenant record yet).
type Viewer struct {
	Admin bool
	Link  *models.UserLink
}

// ReportService works out every money figure the screens show: shares, dues, credit, payments,
// arrears, balances and Paid / Partial / Unpaid status. Residents only receive their own flat.
type ReportService interface {
	GetDashboard(ctx context.Context, viewer Viewer) (*DashboardReport, error)
	GetSummary(ctx context.Context, viewer Viewer, month string) (*SummaryReport, error)
	GetContribution(ctx context.Context, viewer Viewer, month, partyKey string) (*ContributionReport, error)
	GetPayStatus(ctx context.Context, viewer Viewer, month string) (*PayStatusReport, error)
}
