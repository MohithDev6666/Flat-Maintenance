import dayjs from 'dayjs'
import { calendar } from '../mocks/calendar.ts'
import type {
  Expense,
  Flat,
  FlatStatus,
  Owner,
  PayStatus,
  Payment,
  ResidentKind,
  Responsibility,
  SessionUser,
  Tenant,
  UserAccount,
} from '../types/models.ts'

/** The resident records the calculations need. */
export interface ResidentData {
  flats: Flat[]
  owners: Owner[]
  tenants: Tenant[]
  accounts: UserAccount[]
}

/**
 * Whoever a share is charged to: an owner record or a tenant record.
 * Kept apart from the person who paid an expense and the person who paid the building.
 */
export interface Party {
  kind: ResidentKind
  residentId: string
  flatId: string | null
  name: string
}

export interface FlatLine {
  flatId: string
  number: string
  floor: number
  status: FlatStatus
  ownerId: string | null
  ownerName: string | null
  tenantId: string | null
  tenantName: string | null
  ownerDue: number
  tenantDue: number
}

export interface MonthLedger {
  month: string
  total: number
  ownerPool: number
  tenantPool: number
  rounding: number
  flats: FlatLine[]
}

export interface MonthPersonal {
  month: string
  due: number
  credit: number
  arrears: number
  paidToBuilding: number
  owedToYou: number
  balance: number
}

export interface ShareLine {
  id: string
  category: string
  responsibility: Responsibility
  share: number
}

export interface CategoryTotal {
  category: string
  amount: number
  count: number
  responsibility: Responsibility | 'Mixed'
}

export interface SideSettlement {
  due: number
  credit: number
  paid: number
  balance: number
  status: PayStatus
}

export interface FlatSettlement {
  line: FlatLine
  owner: SideSettlement
  tenant: SideSettlement
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function sortByFlatNumber<T extends { number: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.number.localeCompare(right.number, undefined, { numeric: true }))
}

export function tenantActiveOn(tenant: Tenant, day: string): boolean {
  if (dayjs(tenant.moveIn).isAfter(day, 'day')) return false
  if (tenant.moveOut && !dayjs(tenant.moveOut).isAfter(day, 'day')) return false
  return true
}

/** The tenant living in the flat on that day, from move-in and move-out dates. */
export function activeTenantOf(tenants: Tenant[], flatId: string, day: string = calendar.today): Tenant | null {
  return tenants.find((tenant) => tenant.flatId === flatId && tenantActiveOn(tenant, day)) ?? null
}

export function ownerOf(owners: Owner[], flatId: string | null): Owner | null {
  if (!flatId) return null
  return owners.find((owner) => owner.flatId === flatId) ?? null
}

/** Rented when a tenant lives there; otherwise Owner-occupied or Vacant from the flat's Occupied / Available status. */
export function flatStatus(flat: Flat, owners: Owner[], tenants: Tenant[], day: string = calendar.today): FlatStatus {
  if (activeTenantOf(tenants, flat.id, day)) return 'Rented'
  if (flat.status === 'Available' || !ownerOf(owners, flat.id)) return 'Vacant'
  return 'Owner-occupied'
}

/** Who lives in an occupied flat today. */
export function occupiedBy(flat: Flat, tenants: Tenant[], day: string = calendar.today): 'Owner' | 'Tenant' | null {
  if (activeTenantOf(tenants, flat.id, day)) return 'Tenant'
  return flat.status === 'Occupied' ? 'Owner' : null
}

export function tenancyState(tenant: Tenant, day: string = calendar.today): 'Active' | 'Upcoming' | 'Past' {
  if (tenantActiveOn(tenant, day)) return 'Active'
  if (dayjs(tenant.moveIn).isAfter(day, 'day')) return 'Upcoming'
  return 'Past'
}

export function roundShare(amount: number, flatCount: number): number {
  if (flatCount <= 0) return 0
  return Math.round(amount / flatCount)
}

export function listMonths(expenses: Expense[], current: string = calendar.currentMonth): string[] {
  const months = new Set(expenses.map((expense) => monthOf(expense.date)))
  months.add(current)
  return [...months].sort()
}

/**
 * Splits every expense of the month equally across the flats, rounded to the rupee.
 * Owner-tagged shares go to the owner. Tenant-tagged shares go to the tenant active on the 1st,
 * or to the owner when nobody was renting that day.
 */
export function buildMonthLedger(expenses: Expense[], data: ResidentData, month: string): MonthLedger {
  const first = `${month}-01`
  const homes = sortByFlatNumber(data.flats)
  const inMonth = expenses.filter((expense) => monthOf(expense.date) === month)
  const tenantOnFirst = new Map(homes.map((flat) => [flat.id, activeTenantOf(data.tenants, flat.id, first)]))
  const ownerDue = new Map<string, number>(homes.map((flat) => [flat.id, 0]))
  const tenantDue = new Map<string, number>(homes.map((flat) => [flat.id, 0]))

  let total = 0
  let ownerPool = 0
  let tenantPool = 0
  let rounding = 0

  for (const expense of inMonth) {
    const share = roundShare(expense.amount, homes.length)
    total += expense.amount
    rounding += expense.amount - share * homes.length
    if (expense.responsibility === 'Owner') ownerPool += expense.amount
    else tenantPool += expense.amount

    for (const flat of homes) {
      const toTenant = expense.responsibility === 'Tenant' && tenantOnFirst.get(flat.id)
      const target = toTenant ? tenantDue : ownerDue
      target.set(flat.id, (target.get(flat.id) ?? 0) + share)
    }
  }

  return {
    month,
    total,
    ownerPool,
    tenantPool,
    rounding,
    flats: homes.map((flat) => {
      const owner = ownerOf(data.owners, flat.id)
      const tenant = tenantOnFirst.get(flat.id) ?? null
      return {
        flatId: flat.id,
        number: flat.number,
        floor: flat.floor,
        status: flatStatus(flat, data.owners, data.tenants),
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? null,
        tenantId: tenant?.id ?? null,
        tenantName: tenant?.name ?? null,
        ownerDue: ownerDue.get(flat.id) ?? 0,
        tenantDue: tenantDue.get(flat.id) ?? 0,
      }
    }),
  }
}

export function partyForUser(user: SessionUser, data: ResidentData): Party | null {
  if (user.role === 'owner' && user.ownerId) {
    const owner = data.owners.find((item) => item.id === user.ownerId)
    return owner ? { kind: 'owner', residentId: owner.id, flatId: owner.flatId, name: owner.name } : null
  }
  if (user.role === 'tenant' && user.tenantId) {
    const tenant = data.tenants.find((item) => item.id === user.tenantId)
    return tenant ? { kind: 'tenant', residentId: tenant.id, flatId: tenant.flatId, name: tenant.name } : null
  }
  return null
}

/** Every owner and tenant record, for the admin to inspect. */
export function allParties(data: ResidentData): Party[] {
  const flatNumber = (flatId: string | null) => data.flats.find((flat) => flat.id === flatId)?.number ?? ''
  const owners: Party[] = data.owners.map((owner) => ({ kind: 'owner', residentId: owner.id, flatId: owner.flatId, name: owner.name }))
  const tenants: Party[] = data.tenants.map((tenant) => ({ kind: 'tenant', residentId: tenant.id, flatId: tenant.flatId, name: tenant.name }))
  return [...owners, ...tenants].sort(
    (left, right) =>
      flatNumber(left.flatId).localeCompare(flatNumber(right.flatId), undefined, { numeric: true }) ||
      left.kind.localeCompare(right.kind),
  )
}

/** Login users linked to a resident record. Their out-of-pocket expenses count as that record's credit. */
export function userIdsFor(accounts: UserAccount[], kind: ResidentKind, residentId: string | null): string[] {
  if (!residentId) return []
  return accounts
    .filter((account) => (kind === 'owner' ? account.ownerId === residentId : account.tenantId === residentId))
    .map((account) => account.id)
}

export function creditFor(expenses: Expense[], userIds: string[], month: string): number {
  return expenses
    .filter((expense) => monthOf(expense.date) === month && expense.paidByUserId && userIds.includes(expense.paidByUserId))
    .reduce((sum, expense) => sum + expense.amount, 0)
}

export function paidByParty(payments: Payment[], party: Party, month: string): number {
  return payments
    .filter((payment) => payment.role === party.kind && payment.residentId === party.residentId && payment.month === month)
    .reduce((sum, payment) => sum + payment.amount, 0)
}

export function partyDue(ledger: MonthLedger, party: Party): number {
  const line = ledger.flats.find((flat) => flat.flatId === party.flatId)
  if (!line) return 0
  if (party.kind === 'owner') return line.ownerDue
  return line.tenantId === party.residentId ? line.tenantDue : 0
}

/** Month by month: share, out-of-pocket credit, money paid in, and the balance carried as arrears. */
export function partyHistory(
  party: Party,
  expenses: Expense[],
  data: ResidentData,
  payments: Payment[],
): MonthPersonal[] {
  const userIds = userIdsFor(data.accounts, party.kind, party.residentId)
  let carry = 0
  return listMonths(expenses).map((month) => {
    const due = partyDue(buildMonthLedger(expenses, data, month), party)
    const credit = creditFor(expenses, userIds, month)
    const paid = paidByParty(payments, party, month)
    const net = due + carry - credit - paid
    const row: MonthPersonal = {
      month,
      due,
      credit,
      arrears: carry,
      paidToBuilding: paid,
      owedToYou: net < 0 ? -net : 0,
      balance: net > 0 ? net : 0,
    }
    carry = row.balance
    return row
  })
}

export function shareLinesFor(party: Party, expenses: Expense[], data: ResidentData, month: string): ShareLine[] {
  if (!party.flatId) return []
  const tenant = activeTenantOf(data.tenants, party.flatId, `${month}-01`)
  const tenantPays = party.kind === 'tenant' && tenant?.id === party.residentId
  return expenses
    .filter((expense) => monthOf(expense.date) === month)
    .filter((expense) => {
      if (party.kind === 'owner') return expense.responsibility === 'Owner' || !tenant
      return tenantPays && expense.responsibility === 'Tenant'
    })
    .map((expense) => ({
      id: expense.id,
      category: expense.category,
      responsibility: expense.responsibility,
      share: roundShare(expense.amount, data.flats.length),
    }))
}

export function settlementStatus(amountDue: number, paid: number): PayStatus {
  if (amountDue <= 0) return 'Paid'
  if (paid <= 0) return 'Unpaid'
  if (paid + 0.001 >= amountDue) return 'Paid'
  return 'Partial'
}

function side(due: number, credit: number, paid: number): SideSettlement {
  return { due, credit, paid, balance: due - credit - paid, status: settlementStatus(due, credit + paid) }
}

/** One flat in one month: what the owner and the tenant owe, what they covered, and the status. */
export function flatSettlements(ledger: MonthLedger, expenses: Expense[], payments: Payment[], data: ResidentData): FlatSettlement[] {
  const paid = (flatId: string, role: ResidentKind) =>
    payments
      .filter((payment) => payment.flatId === flatId && payment.role === role && payment.month === ledger.month)
      .reduce((sum, payment) => sum + payment.amount, 0)
  return ledger.flats.map((line) => ({
    line,
    owner: side(line.ownerDue, creditFor(expenses, userIdsFor(data.accounts, 'owner', line.ownerId), ledger.month), paid(line.flatId, 'owner')),
    tenant: side(line.tenantDue, creditFor(expenses, userIdsFor(data.accounts, 'tenant', line.tenantId), ledger.month), paid(line.flatId, 'tenant')),
  }))
}

export function totalsByCategory(expenses: Expense[], month: string): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>()
  for (const expense of expenses) {
    if (monthOf(expense.date) !== month) continue
    const current = totals.get(expense.category)
    if (!current) {
      totals.set(expense.category, { category: expense.category, amount: expense.amount, count: 1, responsibility: expense.responsibility })
      continue
    }
    current.amount += expense.amount
    current.count += 1
    if (current.responsibility !== expense.responsibility) current.responsibility = 'Mixed'
  }
  return [...totals.values()].sort((left, right) => right.amount - left.amount)
}

export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
}
