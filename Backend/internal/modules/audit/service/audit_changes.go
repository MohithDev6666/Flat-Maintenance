package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/trideadmin/flat-maintenance/backend/internal/models"
)

// hiddenFields are bookkeeping values that mean nothing to a reader of the audit trail.
var hiddenFields = map[string]bool{
	"id": true, "createdAt": true, "updatedAt": true, "userId": true, "paidByUserId": true,
}

// fieldLabels gives each known record field a readable name; anything else is split from camelCase.
var fieldLabels = map[string]string{
	"name": "Name", "phone": "Phone", "email": "Email", "address": "Address", "emergency": "Emergency contact",
	"flatId": "Flat", "number": "Flat number", "floor": "Floor", "status": "Status",
	"occupants": "Occupants", "moveIn": "Move-in date", "moveOut": "Move-out date", "agreementEnd": "Agreement end date",
	"idProofType": "ID proof type", "idProof": "ID proof", "vehicle": "Vehicle number",
	"description": "Description", "defaultTag": "Default tag",
	"date": "Date", "category": "Category", "responsibility": "Responsibility", "amount": "Amount",
	"vendorName": "Vendor name", "vendorPhone": "Vendor phone", "paymentMode": "Payment mode", "paidBy": "Paid by", "bill": "Bill",
	"payerName": "Payer", "role": "Paid as", "residentId": "Resident", "month": "Month", "mode": "Payment mode",
	"reference": "Reference", "screenshot": "Screenshot", "needsCheck": "Needs check", "checkNote": "Check note",
	"totalFlats": "Total flats", "floors": "Floors", "contactPhone": "Contact phone",
	"locked": "Locked", "lockedBy": "Locked by", "lockedAt": "Locked at", "unlockedBy": "Unlocked by", "unlockedAt": "Unlocked at",
	"kind": "Linked as", "ownerId": "Owner", "tenantId": "Tenant", "roleId": "Role",
}

// fieldOrder keeps the most telling fields first in a change list.
var fieldOrder = []string{
	"name", "number", "date", "month", "category", "amount", "payerName", "flatId", "residentId", "role", "status",
	"description", "responsibility", "phone", "email", "floor",
}

var (
	datePattern  = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	monthPattern = regexp.MustCompile(`^\d{4}-\d{2}$`)
)

// referenceResolver turns stored IDs into names, remembering each lookup for the rest of the request.
type referenceResolver struct {
	ctx   context.Context
	svc   *auditServiceImpl
	cache map[string]string
}

func (r *referenceResolver) lookup(kind, id string, find func() (string, error)) string {
	key := kind + ":" + id
	if name, ok := r.cache[key]; ok {
		return name
	}
	name, err := find()
	if err != nil || name == "" {
		name = "Removed " + kind
	}
	r.cache[key] = name
	return name
}

func (r *referenceResolver) flat(id string) string {
	if r.svc.flatRepo == nil {
		return id
	}
	return r.lookup("flat", id, func() (string, error) {
		flat, err := r.svc.flatRepo.GetFlatByID(r.ctx, id)
		if err != nil {
			return "", err
		}
		return "Flat " + flat.Number, nil
	})
}

func (r *referenceResolver) owner(id string) string {
	if r.svc.ownerRepo == nil {
		return id
	}
	return r.lookup("owner", id, func() (string, error) {
		owner, err := r.svc.ownerRepo.GetOwnerByID(r.ctx, id)
		if err != nil {
			return "", err
		}
		return owner.Name, nil
	})
}

func (r *referenceResolver) tenant(id string) string {
	if r.svc.tenantRepo == nil {
		return id
	}
	return r.lookup("tenant", id, func() (string, error) {
		tenant, err := r.svc.tenantRepo.GetTenantByID(r.ctx, id)
		if err != nil {
			return "", err
		}
		return tenant.Name, nil
	})
}

// decodeChanges fills entry.Changes with the fields that differ between the old and new values.
func (r *referenceResolver) decodeChanges(entry *models.AuditEntry) {
	oldRecord, oldIsJSON := parseRecord(entry.OldValue)
	newRecord, newIsJSON := parseRecord(entry.NewValue)
	if !oldIsJSON || !newIsJSON {
		// Plain-text values, such as a month lock going from Open to Locked.
		label := "Value"
		if entry.RecordType == "Month lock" {
			label = "Status"
		} else if entry.RecordType == "User" {
			label = "Linked as"
		}
		entry.Changes = []models.AuditChange{}
		if entry.OldValue != "" || entry.NewValue != "" {
			entry.Changes = append(entry.Changes, models.AuditChange{
				Field: "value", Label: label, Old: titleCase(entry.OldValue), New: titleCase(entry.NewValue),
			})
		}
		return
	}

	keys := make(map[string]bool)
	for key := range oldRecord {
		keys[key] = true
	}
	for key := range newRecord {
		keys[key] = true
	}
	ordered := make([]string, 0, len(keys))
	for key := range keys {
		if !hiddenFields[key] {
			ordered = append(ordered, key)
		}
	}
	sort.Slice(ordered, func(i, j int) bool {
		left, right := rank(ordered[i]), rank(ordered[j])
		if left != right {
			return left < right
		}
		return ordered[i] < ordered[j]
	})

	changes := make([]models.AuditChange, 0, len(ordered))
	for _, key := range ordered {
		oldText := r.format(key, oldRecord[key], oldRecord)
		newText := r.format(key, newRecord[key], newRecord)
		if oldText == newText {
			continue
		}
		changes = append(changes, models.AuditChange{Field: key, Label: labelFor(key), Old: oldText, New: newText})
	}
	entry.Changes = changes
}

// parseRecord reads a JSON object; an empty value counts as an empty record.
func parseRecord(value string) (map[string]any, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return map[string]any{}, true
	}
	if !strings.HasPrefix(value, "{") {
		return nil, false
	}
	var record map[string]any
	if err := json.Unmarshal([]byte(value), &record); err != nil {
		return nil, false
	}
	return record, true
}

func rank(key string) int {
	for index, known := range fieldOrder {
		if known == key {
			return index
		}
	}
	return len(fieldOrder)
}

func labelFor(key string) string {
	if label, ok := fieldLabels[key]; ok {
		return label
	}
	var words []string
	start := 0
	for index, char := range key {
		if index > 0 && unicode.IsUpper(char) {
			words = append(words, key[start:index])
			start = index
		}
	}
	words = append(words, key[start:])
	return titleCase(strings.ToLower(strings.Join(words, " ")))
}

func titleCase(value string) string {
	if value == "" {
		return value
	}
	return strings.ToUpper(value[:1]) + value[1:]
}

// format renders one field value the way the screens show it.
func (r *referenceResolver) format(key string, value any, record map[string]any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case bool:
		if typed {
			return "Yes"
		}
		return "No"
	case float64:
		if key == "amount" {
			return formatRupees(typed)
		}
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case map[string]any:
		// Attachments: show the file name, never the stored file data.
		if name, ok := typed["name"].(string); ok && name != "" {
			return name
		}
		if url, ok := typed["url"].(string); ok && url != "" {
			return "Attached"
		}
		return ""
	case []any:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			parts = append(parts, r.format(key, item, record))
		}
		return strings.Join(parts, ", ")
	case string:
		text := strings.TrimSpace(typed)
		if text == "" {
			return ""
		}
		switch key {
		case "flatId":
			return r.flat(text)
		case "ownerId":
			return r.owner(text)
		case "tenantId":
			return r.tenant(text)
		case "residentId":
			if role, _ := record["role"].(string); role == "tenant" {
				return r.tenant(text)
			}
			return r.owner(text)
		case "role", "kind":
			return titleCase(text)
		}
		if datePattern.MatchString(text) {
			if day, err := time.Parse("2006-01-02", text); err == nil {
				return day.Format("02-01-2006")
			}
		}
		if monthPattern.MatchString(text) {
			if month, err := time.Parse("2006-01", text); err == nil {
				return month.Format("January 2006")
			}
		}
		if moment, err := time.Parse(time.RFC3339Nano, text); err == nil {
			return moment.UTC().Format("02-01-2006 15:04") + " UTC"
		}
		return text
	default:
		return fmt.Sprint(typed)
	}
}

// formatRupees writes an amount with Indian digit grouping, e.g. ₹1,25,000 or ₹499.50.
func formatRupees(amount float64) string {
	sign := ""
	if amount < 0 {
		sign, amount = "-", -amount
	}
	whole := math.Floor(amount)
	paise := math.Round((amount - whole) * 100)
	if paise >= 100 {
		whole, paise = whole+1, 0
	}
	digits := strconv.FormatFloat(whole, 'f', 0, 64)
	grouped := digits
	if len(digits) > 3 {
		head, tail := digits[:len(digits)-3], digits[len(digits)-3:]
		var parts []string
		for len(head) > 2 {
			parts = append([]string{head[len(head)-2:]}, parts...)
			head = head[:len(head)-2]
		}
		if head != "" {
			parts = append([]string{head}, parts...)
		}
		grouped = strings.Join(parts, ",") + "," + tail
	}
	if paise > 0 {
		return fmt.Sprintf("%s₹%s.%02.0f", sign, grouped, paise)
	}
	return sign + "₹" + grouped
}
