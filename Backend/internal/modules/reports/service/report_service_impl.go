package service

import (
	"context"
	"regexp"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	reportRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type reportServiceImpl struct {
	reportRepo reportRepo.Report
}

func NewReportService(reportRepo reportRepo.Report) ReportService {
	return &reportServiceImpl{
		reportRepo: reportRepo,
	}
}

var monthPattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

func (rs *reportServiceImpl) load(ctx context.Context) (*engine, error) {
	data, err := rs.reportRepo.LoadLedgerData(ctx)
	if err != nil {
		return nil, err
	}
	return newEngine(data), nil
}

// pickMonth validates ?month=YYYY-MM, defaulting to the current month.
func pickMonth(e *engine, month string) (string, error) {
	if month == "" {
		return e.currentMonth, nil
	}
	if !monthPattern.MatchString(month) {
		return "", utils.BadRequest("month must use YYYY-MM format")
	}
	return month, nil
}

// ---------------------------------------------------------------------------------------------
// Dashboard

type poolTotals struct {
	Total      Money `json:"total"`
	OwnerPool  Money `json:"ownerPool"`
	TenantPool Money `json:"tenantPool"`
}

type contact struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type myFlat struct {
	FlatID string   `json:"flatId"`
	Number string   `json:"number"`
	Floor  int      `json:"floor"`
	Status string   `json:"status"`
	Owner  *contact `json:"owner"`
	Tenant *contact `json:"tenant"`
}

type DashboardReport struct {
	Month          string             `json:"month"`
	Locked         bool               `json:"locked"`
	FlatCount      int                `json:"flatCount"`
	Totals         poolTotals         `json:"totals"`
	Party          *party             `json:"party"`
	Snapshot       *personal          `json:"snapshot"`
	ShareLines     []shareLine        `json:"shareLines"`
	Flagged        []paymentRef       `json:"flagged"`
	PendingCount   int                `json:"pendingCount"`
	MyFlat         *myFlat            `json:"myFlat"`
	RecentExpenses []models.Expense   `json:"recentExpenses"`
	Categories     []models.Category  `json:"categories"`
	MonthLocks     []models.MonthLock `json:"monthLocks"`
}

func (rs *reportServiceImpl) GetDashboard(ctx context.Context, viewer Viewer) (*DashboardReport, error) {
	e, err := rs.load(ctx)
	if err != nil {
		return nil, err
	}
	month := e.currentMonth
	ledger := e.ledger(month)
	report := &DashboardReport{
		Month: month, Locked: e.locked[month], FlatCount: len(e.flats),
		Totals:         poolTotals{Total: ledger.total, OwnerPool: ledger.ownerPool, TenantPool: ledger.tenantPool},
		ShareLines:     []shareLine{},
		Flagged:        []paymentRef{},
		RecentExpenses: e.recentExpenses(5),
		Categories:     e.data.Categories,
		MonthLocks:     e.data.MonthLocks,
	}

	if viewer.Admin {
		// The admin reviews every flagged payment and every upload still waiting for verification.
		for index := range e.data.Payments {
			payment := &e.data.Payments[index]
			if payment.NeedsCheck {
				report.Flagged = append(report.Flagged, e.toPaymentRef(payment))
			}
			if payment.AwaitingVerification() {
				report.PendingCount++
			}
		}
		return report, nil
	}

	p := e.partyForLink(viewer.Link)
	report.Party = p
	if p == nil {
		report.Snapshot = &personal{Month: month}
		return report, nil
	}
	report.Snapshot = findMonth(e.history(p), month)
	if report.Snapshot == nil {
		report.Snapshot = &personal{Month: month}
	}
	report.ShareLines = e.shareLines(p, month)
	for index := range e.data.Payments {
		payment := &e.data.Payments[index]
		mine := payment.UserID == viewer.Link.UserID || (payment.Role == p.Kind && payment.ResidentID == p.ResidentID)
		if mine && payment.NeedsCheck {
			report.Flagged = append(report.Flagged, e.toPaymentRef(payment))
		}
		if mine && payment.AwaitingVerification() {
			report.PendingCount++
		}
	}
	if flat := e.flatByID(p.FlatID); flat != nil {
		card := &myFlat{FlatID: flat.ID, Number: flat.Number, Floor: flat.Floor, Status: e.flatStatus(flat)}
		if owner := e.ownerOf(flat.ID); owner != nil {
			card.Owner = &contact{Name: owner.Name, Phone: owner.Phone}
		}
		if tenant := e.tenantOn(flat.ID, e.today); tenant != nil {
			card.Tenant = &contact{Name: tenant.Name, Phone: tenant.Phone}
		}
		report.MyFlat = card
	}
	return report, nil
}

// ---------------------------------------------------------------------------------------------
// Month summary

type summaryTotals struct {
	Total       Money `json:"total"`
	OwnerPool   Money `json:"ownerPool"`
	TenantPool  Money `json:"tenantPool"`
	Collected   Money `json:"collected"`
	Pending     Money `json:"pending"`
	Outstanding Money `json:"outstanding"`
}

type summaryRow struct {
	flatLine
	Owner  *side `json:"owner"`
	Tenant side  `json:"tenant"`
}

type SummaryReport struct {
	Month      string           `json:"month"`
	Months     []monthOption    `json:"months"`
	Locked     bool             `json:"locked"`
	FlatCount  int              `json:"flatCount"`
	Scope      string           `json:"scope"`
	Totals     summaryTotals    `json:"totals"`
	Categories []categoryTotal  `json:"categories"`
	Flats      []summaryRow     `json:"flats"`
	Bills      []models.Expense `json:"bills"`
}

func (rs *reportServiceImpl) GetSummary(ctx context.Context, viewer Viewer, month string) (*SummaryReport, error) {
	e, err := rs.load(ctx)
	if err != nil {
		return nil, err
	}
	if month, err = pickMonth(e, month); err != nil {
		return nil, err
	}
	ledger := e.ledger(month)
	report := &SummaryReport{
		Month: month, Months: e.monthOptions(e.months()), Locked: e.locked[month], FlatCount: len(e.flats),
		Scope:      "all",
		Totals:     summaryTotals{Total: ledger.total, OwnerPool: ledger.ownerPool, TenantPool: ledger.tenantPool},
		Categories: e.categoryTotals(month),
		Flats:      []summaryRow{},
		Bills:      e.expensesIn(month),
	}

	// Building totals cover every flat; the rows are limited to what the viewer may see.
	var p *party
	if !viewer.Admin {
		p = e.partyForLink(viewer.Link)
		report.Scope = "none"
		if p != nil {
			report.Scope = p.Kind
		}
	}
	for _, line := range ledger.lines {
		owner, tenant := e.settlement(line, month)
		report.Totals.Collected += owner.Paid + tenant.Paid
		report.Totals.Pending += owner.Pending + tenant.Pending
		report.Totals.Outstanding += positive(owner.Balance) + positive(tenant.Balance)

		if !viewer.Admin && (p == nil || line.FlatID != p.FlatID) {
			continue
		}
		row := summaryRow{flatLine: line, Owner: &owner, Tenant: tenant}
		if p != nil && p.Kind == "tenant" {
			// A tenant sees only their own side, not the owner's.
			row.Owner, row.OwnerID, row.OwnerName, row.OwnerDue = nil, nil, nil, 0
		}
		report.Flats = append(report.Flats, row)
	}
	return report, nil
}

// ---------------------------------------------------------------------------------------------
// Contribution

type monthTotals struct {
	Month      string `json:"month"`
	Total      Money  `json:"total"`
	OwnerPool  Money  `json:"ownerPool"`
	TenantPool Money  `json:"tenantPool"`
}

type buildingTotals struct {
	Rows       []monthTotals `json:"rows"`
	Total      Money         `json:"total"`
	OwnerPool  Money         `json:"ownerPool"`
	TenantPool Money         `json:"tenantPool"`
}

type yearToDate struct {
	Share  Money `json:"share"`
	Credit Money `json:"credit"`
	Paid   Money `json:"paid"`
}

type statement struct {
	History    []personal       `json:"history"`
	Selected   *personal        `json:"selected"`
	YearToDate yearToDate       `json:"yearToDate"`
	Pocket     []models.Expense `json:"pocket"`
	Payments   []paymentRef     `json:"payments"`
}

type ContributionReport struct {
	Month     string          `json:"month"`
	Months    []monthOption   `json:"months"`
	FlatCount int             `json:"flatCount"`
	Parties   []party         `json:"parties"`
	Party     *party          `json:"party"`
	Building  *buildingTotals `json:"building"`
	Statement *statement      `json:"statement"`
}

func (rs *reportServiceImpl) GetContribution(ctx context.Context, viewer Viewer, month, partyKey string) (*ContributionReport, error) {
	e, err := rs.load(ctx)
	if err != nil {
		return nil, err
	}
	if month, err = pickMonth(e, month); err != nil {
		return nil, err
	}
	months := e.months()
	report := &ContributionReport{Month: month, Months: e.monthOptions(months), FlatCount: len(e.flats), Parties: []party{}}

	// Residents always see their own record; the admin may pick anyone, or the building totals.
	if viewer.Admin {
		report.Parties = e.allParties()
		for index := range report.Parties {
			if report.Parties[index].Key == partyKey {
				report.Party = &report.Parties[index]
			}
		}
	} else {
		report.Party = e.partyForLink(viewer.Link)
	}

	if report.Party == nil {
		totals := &buildingTotals{Rows: make([]monthTotals, 0, len(months))}
		for _, value := range months {
			ledger := e.ledger(value)
			totals.Rows = append(totals.Rows, monthTotals{Month: value, Total: ledger.total, OwnerPool: ledger.ownerPool, TenantPool: ledger.tenantPool})
			totals.Total += ledger.total
			totals.OwnerPool += ledger.ownerPool
			totals.TenantPool += ledger.tenantPool
		}
		report.Building = totals
		return report, nil
	}

	p := report.Party
	history := e.history(p)
	result := &statement{History: history, Pocket: []models.Expense{}}
	result.Selected = findMonth(history, month)
	if result.Selected == nil && len(history) > 0 {
		result.Selected = &history[len(history)-1]
	}
	for _, row := range history {
		if row.Month[:4] == month[:4] && row.Month <= month {
			result.YearToDate.Share += row.Due
			result.YearToDate.Credit += row.Credit
			result.YearToDate.Paid += row.PaidToBuilding
		}
	}
	userIDs := e.userIDsFor(p.Kind, p.ResidentID)
	for _, expense := range e.expensesIn(month) {
		if expense.PaidByUserID != nil && userIDs[*expense.PaidByUserID] {
			result.Pocket = append(result.Pocket, expense)
		}
	}
	_, _, result.Payments = e.paymentsWhere(func(payment *models.Payment) bool {
		return payment.Month == month && payment.Role == p.Kind && payment.ResidentID == p.ResidentID
	})
	report.Statement = result
	return report, nil
}

// ---------------------------------------------------------------------------------------------
// Pay / Upload

type PayStatusReport struct {
	Month   string        `json:"month"`
	Months  []monthOption `json:"months"`
	Party   *party        `json:"party"`
	Row     *personal     `json:"row"`
	Owing   Money         `json:"owing"`
	Covered Money         `json:"covered"`
	Status  string        `json:"status"`
}

// GetPayStatus is the resident's position for a month on the Pay screen. Only verified payments
// count: owing is the month's share plus arrears, covered is out-of-pocket credit plus verified payments.
func (rs *reportServiceImpl) GetPayStatus(ctx context.Context, viewer Viewer, month string) (*PayStatusReport, error) {
	e, err := rs.load(ctx)
	if err != nil {
		return nil, err
	}
	if month, err = pickMonth(e, month); err != nil {
		return nil, err
	}
	months := e.months()
	present := false
	for _, value := range months {
		present = present || value == month
	}
	if !present {
		months = append(months, month)
	}
	report := &PayStatusReport{Month: month, Months: e.monthOptions(sortedMonths(months))}
	if viewer.Admin {
		return report, nil
	}
	p := e.partyForLink(viewer.Link)
	report.Party = p
	if p == nil {
		return report, nil
	}
	row := findMonth(e.history(p), month)
	if row == nil {
		row = &personal{Month: month}
	}
	report.Row = row
	report.Owing = row.Due + row.Arrears
	report.Covered = row.Credit + row.PaidToBuilding
	report.Status = payStatus(report.Owing, report.Covered)
	return report, nil
}

func sortedMonths(months []string) []string {
	result := append([]string(nil), months...)
	for i := 1; i < len(result); i++ {
		for j := i; j > 0 && result[j] < result[j-1]; j-- {
			result[j], result[j-1] = result[j-1], result[j]
		}
	}
	return result
}
