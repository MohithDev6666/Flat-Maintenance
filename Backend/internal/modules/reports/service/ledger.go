package service

import (
	"math"
	"sort"
	"strconv"
	"time"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	reportRepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/repo"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

// ---------------------------------------------------------------------------------------------
// Money is held in paise (whole numbers) so rupee-and-paise amounts add up exactly.
// It is sent to clients as rupees with two decimals, e.g. 500.75.

type Money int64

func (m Money) MarshalJSON() ([]byte, error) {
	return []byte(strconv.FormatFloat(float64(m)/100, 'f', 2, 64)), nil
}

func toMoney(rupees float64) Money { return Money(math.Round(rupees * 100)) }

func positive(m Money) Money {
	if m > 0 {
		return m
	}
	return 0
}

// splitEqually divides an amount across count flats to the paisa. Leftover paise go one each to
// the first flats (₹100 across 3 flats is 33.34, 33.33, 33.33), so the shares always add up.
func splitEqually(total Money, count int) []Money {
	if count <= 0 {
		return nil
	}
	base := total / Money(count)
	leftover := int(total - base*Money(count))
	shares := make([]Money, count)
	for index := range shares {
		shares[index] = base
		if index < leftover {
			shares[index]++
		}
	}
	return shares
}

const (
	statusPaid    = "Paid"
	statusPartial = "Partial"
	statusUnpaid  = "Unpaid"
)

// payStatus compares what is owed with what is covered (verified payments plus out-of-pocket credit).
func payStatus(owed, covered Money) string {
	switch {
	case owed <= 0:
		return statusPaid
	case covered <= 0:
		return statusUnpaid
	case covered >= owed:
		return statusPaid
	default:
		return statusPartial
	}
}

// ---------------------------------------------------------------------------------------------
// Response pieces shared by the report endpoints.

type monthOption struct {
	Month  string `json:"month"`
	Locked bool   `json:"locked"`
}

type flatLine struct {
	FlatID     string  `json:"flatId"`
	Number     string  `json:"number"`
	Floor      int     `json:"floor"`
	Status     string  `json:"status"`
	OwnerID    *string `json:"ownerId"`
	OwnerName  *string `json:"ownerName"`
	TenantID   *string `json:"tenantId"`
	TenantName *string `json:"tenantName"`
	OwnerDue   Money   `json:"ownerDue"`
	TenantDue  Money   `json:"tenantDue"`
}

type paymentRef struct {
	ID           string            `json:"id"`
	PayerName    string            `json:"payerName"`
	FlatID       string            `json:"flatId"`
	FlatNumber   string            `json:"flatNumber"`
	Role         string            `json:"role"`
	Month        string            `json:"month"`
	Amount       Money             `json:"amount"`
	Date         string            `json:"date"`
	Mode         string            `json:"mode"`
	Reference    string            `json:"reference"`
	Verification string            `json:"verification"`
	CheckNote    string            `json:"checkNote"`
	Screenshot   models.Attachment `json:"screenshot"`
}

// side is one resident's position for one flat and month.
type side struct {
	Due      Money        `json:"due"`
	Credit   Money        `json:"credit"`
	Paid     Money        `json:"paid"`
	Pending  Money        `json:"pending"`
	Balance  Money        `json:"balance"`
	Status   string       `json:"status"`
	Payments []paymentRef `json:"payments"`
}

// personal is one resident's month: share, credit, verified payments, arrears and what is left.
type personal struct {
	Month               string `json:"month"`
	Due                 Money  `json:"due"`
	Credit              Money  `json:"credit"`
	Arrears             Money  `json:"arrears"`
	PaidToBuilding      Money  `json:"paidToBuilding"`
	PendingVerification Money  `json:"pendingVerification"`
	OwedToYou           Money  `json:"owedToYou"`
	Balance             Money  `json:"balance"`
}

type party struct {
	Key        string `json:"key"`
	Kind       string `json:"kind"`
	ResidentID string `json:"residentId"`
	FlatID     string `json:"flatId"`
	FlatNumber string `json:"flatNumber"`
	Name       string `json:"name"`
}

type shareLine struct {
	ID             string `json:"id"`
	Category       string `json:"category"`
	Responsibility string `json:"responsibility"`
	Share          Money  `json:"share"`
}

type categoryTotal struct {
	Category       string `json:"category"`
	Amount         Money  `json:"amount"`
	Count          int    `json:"count"`
	Responsibility string `json:"responsibility"`
}

// ---------------------------------------------------------------------------------------------
// The engine works everything out from one snapshot of the data.

type monthLedger struct {
	month      string
	total      Money
	ownerPool  Money
	tenantPool Money
	lines      []flatLine
	// shares[expenseID][flatIndex] is each flat's exact share of the expense.
	shares map[string][]Money
}

type engine struct {
	today        string
	currentMonth string
	data         *reportRepo.LedgerData
	flats        []models.Flat // in flat-number order
	locked       map[string]bool
	ledgers      map[string]*monthLedger
}

func newEngine(data *reportRepo.LedgerData) *engine {
	now := time.Now()
	flats := append([]models.Flat(nil), data.Flats...)
	sort.SliceStable(flats, func(i, j int) bool { return lessFlatNumber(flats[i].Number, flats[j].Number) })
	locked := make(map[string]bool, len(data.MonthLocks))
	for _, lock := range data.MonthLocks {
		locked[lock.Month] = lock.Locked
	}
	return &engine{
		today:        now.Format(utils.DateLayout),
		currentMonth: now.Format("2006-01"),
		data:         data,
		flats:        flats,
		locked:       locked,
		ledgers:      make(map[string]*monthLedger),
	}
}

// lessFlatNumber orders flat numbers naturally: 101 before 1001, numbers before text.
func lessFlatNumber(left, right string) bool {
	a, errA := strconv.Atoi(left)
	b, errB := strconv.Atoi(right)
	if errA == nil && errB == nil {
		return a < b
	}
	if (errA == nil) != (errB == nil) {
		return errA == nil
	}
	return left < right
}

func monthOf(date string) string {
	if len(date) >= 7 {
		return date[:7]
	}
	return date
}

func strPtr(value string) *string { return &value }

func (e *engine) ownerOf(flatID string) *models.Owner {
	for index := range e.data.Owners {
		if utils.Deref(e.data.Owners[index].FlatID) == flatID {
			return &e.data.Owners[index]
		}
	}
	return nil
}

func tenantActiveOn(tenant *models.Tenant, day string) bool {
	if tenant.MoveIn > day {
		return false
	}
	if moveOut := utils.Deref(tenant.MoveOut); moveOut != "" && moveOut <= day {
		return false
	}
	return true
}

func (e *engine) tenantOn(flatID, day string) *models.Tenant {
	for index := range e.data.Tenants {
		tenant := &e.data.Tenants[index]
		if tenant.FlatID == flatID && tenantActiveOn(tenant, day) {
			return tenant
		}
	}
	return nil
}

func (e *engine) flatByID(flatID string) *models.Flat {
	for index := range e.flats {
		if e.flats[index].ID == flatID {
			return &e.flats[index]
		}
	}
	return nil
}

func (e *engine) flatNumber(flatID string) string {
	if flat := e.flatByID(flatID); flat != nil {
		return flat.Number
	}
	return ""
}

// flatStatus is Rented when a tenant lives there today, otherwise Owner-occupied or Vacant.
func (e *engine) flatStatus(flat *models.Flat) string {
	if e.tenantOn(flat.ID, e.today) != nil {
		return "Rented"
	}
	if flat.Status == "Available" || e.ownerOf(flat.ID) == nil {
		return "Vacant"
	}
	return "Owner-occupied"
}

// months lists every month that has an expense, plus the current month, oldest first.
func (e *engine) months() []string {
	seen := map[string]bool{e.currentMonth: true}
	for _, expense := range e.data.Expenses {
		seen[monthOf(expense.Date)] = true
	}
	months := make([]string, 0, len(seen))
	for month := range seen {
		months = append(months, month)
	}
	sort.Strings(months)
	return months
}

func (e *engine) monthOptions(months []string) []monthOption {
	options := make([]monthOption, 0, len(months))
	for index := len(months) - 1; index >= 0; index-- {
		options = append(options, monthOption{Month: months[index], Locked: e.locked[months[index]]})
	}
	return options
}

func (e *engine) expensesIn(month string) []models.Expense {
	items := make([]models.Expense, 0)
	for _, expense := range e.data.Expenses {
		if monthOf(expense.Date) == month {
			items = append(items, expense)
		}
	}
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Date != items[j].Date {
			return items[i].Date > items[j].Date
		}
		return items[i].ID > items[j].ID
	})
	return items
}

// ledger splits every expense of the month equally across the flats, exact to the paisa.
// Owner-tagged shares go to the owner; tenant-tagged shares go to the tenant active on the 1st,
// or to the owner when nobody was renting that day.
func (e *engine) ledger(month string) *monthLedger {
	if cached, ok := e.ledgers[month]; ok {
		return cached
	}
	first := month + "-01"
	result := &monthLedger{month: month, shares: make(map[string][]Money)}
	ownerDue := make([]Money, len(e.flats))
	tenantDue := make([]Money, len(e.flats))
	tenants := make([]*models.Tenant, len(e.flats))
	for index := range e.flats {
		tenants[index] = e.tenantOn(e.flats[index].ID, first)
	}

	for _, expense := range e.expensesIn(month) {
		amount := toMoney(expense.Amount)
		shares := splitEqually(amount, len(e.flats))
		result.shares[expense.ID] = shares
		result.total += amount
		if expense.Responsibility == "Owner" {
			result.ownerPool += amount
		} else {
			result.tenantPool += amount
		}
		for index := range e.flats {
			if expense.Responsibility == "Tenant" && tenants[index] != nil {
				tenantDue[index] += shares[index]
			} else {
				ownerDue[index] += shares[index]
			}
		}
	}

	result.lines = make([]flatLine, len(e.flats))
	for index := range e.flats {
		flat := &e.flats[index]
		line := flatLine{
			FlatID: flat.ID, Number: flat.Number, Floor: flat.Floor, Status: e.flatStatus(flat),
			OwnerDue: ownerDue[index], TenantDue: tenantDue[index],
		}
		if owner := e.ownerOf(flat.ID); owner != nil {
			line.OwnerID, line.OwnerName = strPtr(owner.ID), strPtr(owner.Name)
		}
		if tenant := tenants[index]; tenant != nil {
			line.TenantID, line.TenantName = strPtr(tenant.ID), strPtr(tenant.Name)
		}
		result.lines[index] = line
	}
	e.ledgers[month] = result
	return result
}

// userIDsFor returns the login users linked to a resident; their out-of-pocket expenses are that resident's credit.
func (e *engine) userIDsFor(kind, residentID string) map[string]bool {
	ids := make(map[string]bool)
	for _, link := range e.data.Links {
		if kind == "owner" && link.Kind == "owner" && link.OwnerID == residentID && residentID != "" {
			ids[link.UserID] = true
		}
		if kind == "tenant" && link.Kind == "tenant" && link.TenantID == residentID && residentID != "" {
			ids[link.UserID] = true
		}
	}
	return ids
}

func (e *engine) creditFor(userIDs map[string]bool, month string) Money {
	var total Money
	for _, expense := range e.data.Expenses {
		if monthOf(expense.Date) == month && expense.PaidByUserID != nil && userIDs[*expense.PaidByUserID] {
			total += toMoney(expense.Amount)
		}
	}
	return total
}

func (e *engine) toPaymentRef(payment *models.Payment) paymentRef {
	return paymentRef{
		ID: payment.ID, PayerName: payment.PayerName, FlatID: payment.FlatID, FlatNumber: e.flatNumber(payment.FlatID),
		Role: payment.Role, Month: payment.Month, Amount: toMoney(payment.Amount), Date: payment.Date, Mode: payment.Mode,
		Reference: payment.Reference, Verification: payment.VerificationLabel(), CheckNote: payment.CheckNote,
		Screenshot: payment.Screenshot,
	}
}

// paymentsWhere sums verified and pending payments matching the filter, and lists them all.
func (e *engine) paymentsWhere(match func(*models.Payment) bool) (paid, pending Money, refs []paymentRef) {
	refs = make([]paymentRef, 0)
	for index := range e.data.Payments {
		payment := &e.data.Payments[index]
		if !match(payment) {
			continue
		}
		refs = append(refs, e.toPaymentRef(payment))
		if payment.CountsAsPaid() {
			paid += toMoney(payment.Amount)
		} else if payment.AwaitingVerification() {
			pending += toMoney(payment.Amount)
		}
	}
	sort.SliceStable(refs, func(i, j int) bool { return refs[i].Date > refs[j].Date })
	return paid, pending, refs
}

func newSide(due, credit, paid, pending Money, payments []paymentRef) side {
	return side{
		Due: due, Credit: credit, Paid: paid, Pending: pending,
		Balance: due - credit - paid, Status: payStatus(due, credit+paid), Payments: payments,
	}
}

// settlement is the owner and tenant position for one flat line in the ledger's month.
func (e *engine) settlement(line flatLine, month string) (owner, tenant side) {
	ownerPaid, ownerPending, ownerRefs := e.paymentsWhere(func(p *models.Payment) bool {
		return p.FlatID == line.FlatID && p.Role == "owner" && p.Month == month
	})
	tenantPaid, tenantPending, tenantRefs := e.paymentsWhere(func(p *models.Payment) bool {
		return p.FlatID == line.FlatID && p.Role == "tenant" && p.Month == month
	})
	ownerCredit := e.creditFor(e.userIDsFor("owner", utils.Deref(line.OwnerID)), month)
	tenantCredit := e.creditFor(e.userIDsFor("tenant", utils.Deref(line.TenantID)), month)
	return newSide(line.OwnerDue, ownerCredit, ownerPaid, ownerPending, ownerRefs),
		newSide(line.TenantDue, tenantCredit, tenantPaid, tenantPending, tenantRefs)
}

func (e *engine) partyDue(ledger *monthLedger, p *party) Money {
	for _, line := range ledger.lines {
		if line.FlatID != p.FlatID {
			continue
		}
		if p.Kind == "owner" {
			return line.OwnerDue
		}
		if utils.Deref(line.TenantID) == p.ResidentID {
			return line.TenantDue
		}
		return 0
	}
	return 0
}

// history is the resident's months, oldest first: share, credit, verified payments, and the balance
// carried forward as next month's arrears.
func (e *engine) history(p *party) []personal {
	userIDs := e.userIDsFor(p.Kind, p.ResidentID)
	var carry Money
	rows := make([]personal, 0)
	for _, month := range e.months() {
		due := e.partyDue(e.ledger(month), p)
		credit := e.creditFor(userIDs, month)
		paid, pending, _ := e.paymentsWhere(func(payment *models.Payment) bool {
			return payment.Role == p.Kind && payment.ResidentID == p.ResidentID && payment.Month == month
		})
		net := due + carry - credit - paid
		row := personal{
			Month: month, Due: due, Credit: credit, Arrears: carry, PaidToBuilding: paid, PendingVerification: pending,
			OwedToYou: positive(-net), Balance: positive(net),
		}
		carry = row.Balance
		rows = append(rows, row)
	}
	return rows
}

func findMonth(rows []personal, month string) *personal {
	for index := range rows {
		if rows[index].Month == month {
			return &rows[index]
		}
	}
	return nil
}

// shareLines lists the resident's share of each expense of the month.
func (e *engine) shareLines(p *party, month string) []shareLine {
	lines := make([]shareLine, 0)
	flatIndex := -1
	for index := range e.flats {
		if e.flats[index].ID == p.FlatID {
			flatIndex = index
		}
	}
	if flatIndex < 0 {
		return lines
	}
	ledger := e.ledger(month)
	tenant := e.tenantOn(p.FlatID, month+"-01")
	for _, expense := range e.expensesIn(month) {
		include := false
		if p.Kind == "owner" {
			include = expense.Responsibility == "Owner" || tenant == nil
		} else {
			include = tenant != nil && tenant.ID == p.ResidentID && expense.Responsibility == "Tenant"
		}
		if include {
			lines = append(lines, shareLine{
				ID: expense.ID, Category: expense.Category, Responsibility: expense.Responsibility,
				Share: ledger.shares[expense.ID][flatIndex],
			})
		}
	}
	return lines
}

func (e *engine) categoryTotals(month string) []categoryTotal {
	totals := make([]categoryTotal, 0)
	index := make(map[string]int)
	for _, expense := range e.expensesIn(month) {
		position, seen := index[expense.Category]
		if !seen {
			index[expense.Category] = len(totals)
			totals = append(totals, categoryTotal{
				Category: expense.Category, Amount: toMoney(expense.Amount), Count: 1, Responsibility: expense.Responsibility,
			})
			continue
		}
		current := &totals[position]
		current.Amount += toMoney(expense.Amount)
		current.Count++
		if current.Responsibility != expense.Responsibility {
			current.Responsibility = "Mixed"
		}
	}
	sort.SliceStable(totals, func(i, j int) bool { return totals[i].Amount > totals[j].Amount })
	return totals
}

// partyForLink is the owner or tenant record a resident login is linked to.
func (e *engine) partyForLink(link *models.UserLink) *party {
	if link == nil {
		return nil
	}
	if link.Kind == "owner" {
		for _, owner := range e.data.Owners {
			if owner.ID == link.OwnerID {
				flatID := utils.Deref(owner.FlatID)
				return &party{Key: "owner:" + owner.ID, Kind: "owner", ResidentID: owner.ID, FlatID: flatID, FlatNumber: e.flatNumber(flatID), Name: owner.Name}
			}
		}
	}
	if link.Kind == "tenant" {
		for _, tenant := range e.data.Tenants {
			if tenant.ID == link.TenantID {
				return &party{Key: "tenant:" + tenant.ID, Kind: "tenant", ResidentID: tenant.ID, FlatID: tenant.FlatID, FlatNumber: e.flatNumber(tenant.FlatID), Name: tenant.Name}
			}
		}
	}
	return nil
}

// allParties is every owner and tenant, in flat-number order, owners first.
func (e *engine) allParties() []party {
	parties := make([]party, 0, len(e.data.Owners)+len(e.data.Tenants))
	for _, owner := range e.data.Owners {
		flatID := utils.Deref(owner.FlatID)
		parties = append(parties, party{Key: "owner:" + owner.ID, Kind: "owner", ResidentID: owner.ID, FlatID: flatID, FlatNumber: e.flatNumber(flatID), Name: owner.Name})
	}
	for _, tenant := range e.data.Tenants {
		parties = append(parties, party{Key: "tenant:" + tenant.ID, Kind: "tenant", ResidentID: tenant.ID, FlatID: tenant.FlatID, FlatNumber: e.flatNumber(tenant.FlatID), Name: tenant.Name})
	}
	sort.SliceStable(parties, func(i, j int) bool {
		if parties[i].FlatNumber != parties[j].FlatNumber {
			return lessFlatNumber(parties[i].FlatNumber, parties[j].FlatNumber)
		}
		return parties[i].Kind < parties[j].Kind
	})
	return parties
}

func (e *engine) recentExpenses(limit int) []models.Expense {
	items := append([]models.Expense(nil), e.data.Expenses...)
	sort.SliceStable(items, func(i, j int) bool {
		if items[i].Date != items[j].Date {
			return items[i].Date > items[j].Date
		}
		return items[i].ID > items[j].ID
	})
	if len(items) > limit {
		items = items[:limit]
	}
	return items
}
