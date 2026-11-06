import dayjs from 'dayjs'
import { calendar } from './calendar.ts'
import type { Expense, Flat, FlatStatus, Owner, ResidentKind, Tenant } from '../types/models.ts'

/*
 * Record lookups and sorting for forms and lists (who owns a flat, who rents it, list order).
 *
 * Money is NOT calculated here. Shares, dues, credit, payments, arrears, balances and
 * Paid / Partial / Unpaid all come calculated from the backend report APIs (services/reportService.ts).
 */

/** Whoever a payment is for: an owner record or a tenant record. */
export interface Party {
  kind: ResidentKind
  residentId: string
  flatId: string | null
  name: string
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

/** Months that have expenses, plus the current month, oldest first (for month filters). */
export function listMonths(expenses: Expense[], current: string = calendar.currentMonth): string[] {
  const months = new Set(expenses.map((expense) => monthOf(expense.date)))
  months.add(current)
  return [...months].sort()
}

export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id))
}
