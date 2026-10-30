import dayjs from 'dayjs'
import { apartment } from '../mocks/apartment.ts'
import type { Expense, Flat, FlatStatus, Payment, SessionUser } from '../types/models.ts'

export interface FlatLine {
  number: string
  floor: number
  status: FlatStatus
  ownerName: string | null
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
  responsibility: Expense['responsibility']
  share: number
}

export function tenantActiveOn(flat: Flat, day: string): boolean {
  if (!flat.tenant) return false
  if (dayjs(flat.tenant.moveIn).isAfter(day, 'day')) return false
  if (flat.tenant.moveOut && !dayjs(flat.tenant.moveOut).isAfter(day, 'day')) return false
  return true
}

export function flatStatus(flat: Flat, day = apartment.today): FlatStatus {
  if (tenantActiveOn(flat, day)) return 'Rented'
  if (flat.owner) return 'Owner-occupied'
  return 'Vacant'
}

export function roundShare(amount: number, flatCount: number = apartment.flatCount): number {
  return Math.round(amount / flatCount)
}

export function listMonths(expenses: Expense[], current = apartment.currentMonth): string[] {
  const months = new Set(expenses.map((expense) => expense.date.slice(0, 7)))
  months.add(current)
  return [...months].sort()
}

export function buildMonthLedger(expenses: Expense[], homes: Flat[], month: string): MonthLedger {
  const first = `${month}-01`
  const inMonth = expenses.filter((expense) => expense.date.startsWith(month))
  const ownerDue = new Map<string, number>()
  const tenantDue = new Map<string, number>()

  for (const flat of homes) {
    ownerDue.set(flat.number, 0)
    tenantDue.set(flat.number, 0)
  }

  let total = 0
  let ownerPool = 0
  let tenantPool = 0
  let rounding = 0

  for (const expense of inMonth) {
    const share = roundShare(expense.amount, homes.length)
    total += expense.amount
    rounding += expense.amount - share * homes.length

    if (expense.responsibility === 'Owner') {
      ownerPool += expense.amount
      for (const flat of homes) {
        ownerDue.set(flat.number, (ownerDue.get(flat.number) ?? 0) + share)
      }
      continue
    }

    tenantPool += expense.amount
    for (const flat of homes) {
      if (tenantActiveOn(flat, first)) {
        tenantDue.set(flat.number, (tenantDue.get(flat.number) ?? 0) + share)
      } else {
        ownerDue.set(flat.number, (ownerDue.get(flat.number) ?? 0) + share)
      }
    }
  }

  return {
    month,
    total,
    ownerPool,
    tenantPool,
    rounding,
    flats: homes.map((flat) => ({
      number: flat.number,
      floor: flat.floor,
      status: flatStatus(flat),
      ownerName: flat.owner?.name ?? null,
      tenantName: tenantActiveOn(flat, first) ? (flat.tenant?.name ?? null) : null,
      ownerDue: ownerDue.get(flat.number) ?? 0,
      tenantDue: tenantDue.get(flat.number) ?? 0,
    })),
  }
}

export function creditFor(expenses: Expense[], userId: string, month: string): number {
  return expenses
    .filter((expense) => expense.date.startsWith(month) && expense.paidByUserId === userId)
    .reduce((sum, expense) => sum + expense.amount, 0)
}

export function personalDue(ledger: MonthLedger, user: SessionUser): number {
  if (!user.flatNumber || user.role === 'admin') return 0
  const line = ledger.flats.find((flat) => flat.number === user.flatNumber)
  if (!line) return 0
  return user.role === 'tenant' ? line.tenantDue : line.ownerDue
}

export function paidToBuilding(payments: Payment[], userId: string, month: string): number {
  return payments
    .filter((payment) => payment.userId === userId && payment.month === month)
    .reduce((sum, payment) => sum + payment.amount, 0)
}

export function personalHistory(
  user: SessionUser,
  expenses: Expense[],
  homes: Flat[],
  payments: Payment[] = [],
): MonthPersonal[] {
  let carry = 0
  return listMonths(expenses).map((month) => {
    const ledger = buildMonthLedger(expenses, homes, month)
    const due = personalDue(ledger, user)
    const credit = creditFor(expenses, user.id, month)
    const paid = paidToBuilding(payments, user.id, month)
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

export function shareLinesFor(
  user: SessionUser,
  expenses: Expense[],
  homes: Flat[],
  month: string,
): ShareLine[] {
  const flat = homes.find((item) => item.number === user.flatNumber)
  if (!flat || user.role === 'admin') return []
  const first = `${month}-01`
  const tenantActive = tenantActiveOn(flat, first)

  return expenses
    .filter((expense) => expense.date.startsWith(month))
    .map((expense) => {
      const appliesToOwner = expense.responsibility === 'Owner' || !tenantActive
      const mine =
        (user.role === 'owner' && appliesToOwner && expense.responsibility === 'Owner') ||
        (user.role === 'owner' && expense.responsibility === 'Tenant' && !tenantActive) ||
        (user.role === 'tenant' && expense.responsibility === 'Tenant' && tenantActive)
      return {
        id: expense.id,
        category: expense.category,
        responsibility: expense.responsibility,
        share: roundShare(expense.amount, homes.length),
        mine,
      }
    })
    .filter((line) => line.mine)
}

export function totalsByCategory(expenses: Expense[], month: string): { category: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    if (!expense.date.startsWith(month)) continue
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount)
  }
  return [...totals.entries()].map(([category, amount]) => ({ category, amount }))
}

export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
}
