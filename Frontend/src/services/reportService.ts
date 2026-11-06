import type {
  Attachment,
  Expense,
  ExpenseCategory,
  FlatStatus,
  MonthLock,
  PaymentMode,
  PaymentVerification,
  PayStatus,
  ResidentKind,
} from '../types/models.ts'
import { api } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'
import { toCategory } from './categoryService.ts'
import { toExpense } from './expenseService.ts'
import { toMonthLock } from './monthLockService.ts'

/*
 * Every money figure (shares, dues, credit, payments, arrears, balances, Paid / Partial / Unpaid)
 * is calculated by the backend. These types mirror its responses; the screens only display them.
 */

export interface MonthOption {
  month: string
  locked: boolean
}

export interface ReportParty {
  key: string
  kind: ResidentKind
  residentId: string
  flatId: string
  flatNumber: string
  name: string
}

/** One resident's month: share, out-of-pocket credit, verified payments, arrears, and what is left. */
export interface PersonalMonth {
  month: string
  due: number
  credit: number
  arrears: number
  paidToBuilding: number
  pendingVerification: number
  owedToYou: number
  balance: number
}

export interface PaymentRef {
  id: string
  payerName: string
  flatId: string
  flatNumber: string
  role: ResidentKind
  month: string
  amount: number
  date: string
  mode: PaymentMode
  reference: string
  verification: PaymentVerification
  checkNote: string
  screenshot: Attachment
}

/** The owner's or tenant's position for one flat in one month. */
export interface SideSettlement {
  due: number
  credit: number
  paid: number
  pending: number
  balance: number
  status: PayStatus
  payments: PaymentRef[]
}

export interface ShareLine {
  id: string
  category: string
  responsibility: string
  share: number
}

export interface CategoryTotal {
  category: string
  amount: number
  count: number
  responsibility: string
}

export interface PoolTotals {
  total: number
  ownerPool: number
  tenantPool: number
}

export interface DashboardReport {
  month: string
  locked: boolean
  flatCount: number
  totals: PoolTotals
  party: ReportParty | null
  snapshot: PersonalMonth | null
  shareLines: ShareLine[]
  flagged: PaymentRef[]
  pendingCount: number
  myFlat: {
    flatId: string
    number: string
    floor: number
    status: FlatStatus
    owner: { name: string; phone: string } | null
    tenant: { name: string; phone: string } | null
  } | null
  recentExpenses: Expense[]
  categories: ExpenseCategory[]
  monthLocks: MonthLock[]
}

export interface SummaryRow {
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
  /** Not sent to tenants. */
  owner: SideSettlement | null
  tenant: SideSettlement
}

export interface SummaryReport {
  month: string
  months: MonthOption[]
  locked: boolean
  flatCount: number
  /** all = admin; owner / tenant = that resident's flat only; none = not linked to a flat. */
  scope: 'all' | 'owner' | 'tenant' | 'none'
  totals: PoolTotals & { collected: number; pending: number; outstanding: number }
  categories: CategoryTotal[]
  flats: SummaryRow[]
  bills: Expense[]
}

export interface ContributionReport {
  month: string
  months: MonthOption[]
  flatCount: number
  parties: ReportParty[]
  party: ReportParty | null
  building: {
    rows: (PoolTotals & { month: string })[]
    total: number
    ownerPool: number
    tenantPool: number
  } | null
  statement: {
    history: PersonalMonth[]
    selected: PersonalMonth | null
    yearToDate: { share: number; credit: number; paid: number }
    pocket: Expense[]
    payments: PaymentRef[]
  } | null
}

export interface PayStatusReport {
  month: string
  months: MonthOption[]
  party: ReportParty | null
  row: PersonalMonth | null
  /** The month's share plus arrears. */
  owing: number
  /** Out-of-pocket credit plus verified payments. */
  covered: number
  status: PayStatus | ''
}

// ---------------------------------------------------------------------------------------------
// The backend sends money as numbers in rupees; lists can come back as null when empty.

type Raw<T> = { [K in keyof T]?: unknown }

const list = <T>(value: unknown, map: (item: never) => T): T[] => (Array.isArray(value) ? value.map((item) => map(item as never)) : [])

const toExpenses = (value: unknown) => list(value, (item: Partial<Expense>) => toExpense(item))

function toPaymentRef(raw: Partial<PaymentRef>): PaymentRef {
  return {
    id: raw.id ?? '',
    payerName: raw.payerName ?? '',
    flatId: raw.flatId ?? '',
    flatNumber: raw.flatNumber ?? '',
    role: raw.role === 'tenant' ? 'tenant' : 'owner',
    month: raw.month ?? '',
    amount: Number(raw.amount ?? 0),
    date: raw.date ?? '',
    mode: (raw.mode ?? 'Cash') as PaymentMode,
    reference: raw.reference ?? '',
    verification: (raw.verification ?? 'Verified') as PaymentVerification,
    checkNote: raw.checkNote ?? '',
    screenshot: raw.screenshot ?? { name: '', url: null, kind: 'image' },
  }
}

function toSide(raw: Partial<SideSettlement>): SideSettlement {
  return {
    due: Number(raw.due ?? 0),
    credit: Number(raw.credit ?? 0),
    paid: Number(raw.paid ?? 0),
    pending: Number(raw.pending ?? 0),
    balance: Number(raw.balance ?? 0),
    status: (raw.status ?? 'Paid') as PayStatus,
    payments: list(raw.payments, toPaymentRef),
  }
}

function toPersonal(raw: Partial<PersonalMonth> | null | undefined): PersonalMonth | null {
  if (!raw) return null
  return {
    month: raw.month ?? '',
    due: Number(raw.due ?? 0),
    credit: Number(raw.credit ?? 0),
    arrears: Number(raw.arrears ?? 0),
    paidToBuilding: Number(raw.paidToBuilding ?? 0),
    pendingVerification: Number(raw.pendingVerification ?? 0),
    owedToYou: Number(raw.owedToYou ?? 0),
    balance: Number(raw.balance ?? 0),
  }
}

const toMonths = (value: unknown) => list(value, (item: Partial<MonthOption>) => ({ month: item.month ?? '', locked: Boolean(item.locked) }))

const toParty = (raw: ReportParty | null | undefined): ReportParty | null => (raw ? { ...raw } : null)

/** Needs `dashboard:view`. Admins get building totals and the review queue; residents their own month. */
export async function getDashboardReport(): Promise<DashboardReport> {
  const raw = await api.get<Raw<DashboardReport>>(API_URLS.reports.dashboard)
  const totals = (raw.totals ?? {}) as Partial<PoolTotals>
  return {
    month: String(raw.month ?? ''),
    locked: Boolean(raw.locked),
    flatCount: Number(raw.flatCount ?? 0),
    totals: { total: Number(totals.total ?? 0), ownerPool: Number(totals.ownerPool ?? 0), tenantPool: Number(totals.tenantPool ?? 0) },
    party: toParty(raw.party as ReportParty | null),
    snapshot: toPersonal(raw.snapshot as Partial<PersonalMonth> | null),
    shareLines: list(raw.shareLines, (item: ShareLine) => ({ ...item, share: Number(item.share ?? 0) })),
    flagged: list(raw.flagged, toPaymentRef),
    pendingCount: Number(raw.pendingCount ?? 0),
    myFlat: (raw.myFlat as DashboardReport['myFlat']) ?? null,
    recentExpenses: toExpenses(raw.recentExpenses),
    categories: list(raw.categories, (item: Partial<ExpenseCategory>) => toCategory(item)),
    monthLocks: list(raw.monthLocks, (item: Partial<MonthLock>) => toMonthLock(item)),
  }
}

/** Needs `summary:view`. Residents receive only their own flat's row; totals cover the building. */
export async function getSummaryReport(month: string): Promise<SummaryReport> {
  const raw = await api.get<Raw<SummaryReport>>(API_URLS.reports.summary, { month })
  const totals = (raw.totals ?? {}) as Partial<SummaryReport['totals']>
  return {
    month: String(raw.month ?? month),
    months: toMonths(raw.months),
    locked: Boolean(raw.locked),
    flatCount: Number(raw.flatCount ?? 0),
    scope: (raw.scope ?? 'none') as SummaryReport['scope'],
    totals: {
      total: Number(totals.total ?? 0),
      ownerPool: Number(totals.ownerPool ?? 0),
      tenantPool: Number(totals.tenantPool ?? 0),
      collected: Number(totals.collected ?? 0),
      pending: Number(totals.pending ?? 0),
      outstanding: Number(totals.outstanding ?? 0),
    },
    categories: list(raw.categories, (item: CategoryTotal) => ({ ...item, amount: Number(item.amount ?? 0) })),
    flats: list(raw.flats, (item: Partial<SummaryRow> & { owner?: Partial<SideSettlement> | null; tenant?: Partial<SideSettlement> }) => ({
      flatId: item.flatId ?? '',
      number: item.number ?? '',
      floor: Number(item.floor ?? 0),
      status: (item.status ?? 'Vacant') as FlatStatus,
      ownerId: item.ownerId ?? null,
      ownerName: item.ownerName ?? null,
      tenantId: item.tenantId ?? null,
      tenantName: item.tenantName ?? null,
      ownerDue: Number(item.ownerDue ?? 0),
      tenantDue: Number(item.tenantDue ?? 0),
      owner: item.owner ? toSide(item.owner) : null,
      tenant: toSide(item.tenant ?? {}),
    })),
    bills: toExpenses(raw.bills),
  }
}

/** Needs `contribution:view`. The admin may pass a party key ("owner:<id>" / "tenant:<id>"). */
export async function getContributionReport(month: string, party = ''): Promise<ContributionReport> {
  const raw = await api.get<Raw<ContributionReport>>(API_URLS.reports.contribution, { month, party })
  const building = raw.building as ContributionReport['building']
  const statement = raw.statement as (Omit<NonNullable<ContributionReport['statement']>, 'history'> & { history: unknown }) | null
  return {
    month: String(raw.month ?? month),
    months: toMonths(raw.months),
    flatCount: Number(raw.flatCount ?? 0),
    parties: list(raw.parties, (item: ReportParty) => ({ ...item })),
    party: toParty(raw.party as ReportParty | null),
    building: building
      ? {
          rows: list(building.rows, (row: PoolTotals & { month: string }) => ({
            month: row.month,
            total: Number(row.total ?? 0),
            ownerPool: Number(row.ownerPool ?? 0),
            tenantPool: Number(row.tenantPool ?? 0),
          })),
          total: Number(building.total ?? 0),
          ownerPool: Number(building.ownerPool ?? 0),
          tenantPool: Number(building.tenantPool ?? 0),
        }
      : null,
    statement: statement
      ? {
          history: list(statement.history, (row: Partial<PersonalMonth>) => toPersonal(row) as PersonalMonth),
          selected: toPersonal(statement.selected),
          yearToDate: {
            share: Number(statement.yearToDate?.share ?? 0),
            credit: Number(statement.yearToDate?.credit ?? 0),
            paid: Number(statement.yearToDate?.paid ?? 0),
          },
          pocket: toExpenses(statement.pocket),
          payments: list(statement.payments, toPaymentRef),
        }
      : null,
  }
}

/** Needs `payments:view`. The resident's month on the Pay screen; the admin gets only the month list. */
export async function getPayStatus(month: string): Promise<PayStatusReport> {
  const raw = await api.get<Raw<PayStatusReport>>(API_URLS.reports.payStatus, { month })
  return {
    month: String(raw.month ?? month),
    months: toMonths(raw.months),
    party: toParty(raw.party as ReportParty | null),
    row: toPersonal(raw.row as Partial<PersonalMonth> | null),
    owing: Number(raw.owing ?? 0),
    covered: Number(raw.covered ?? 0),
    status: (raw.status ?? '') as PayStatusReport['status'],
  }
}
