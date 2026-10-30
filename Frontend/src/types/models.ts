export type Role = 'admin' | 'owner' | 'tenant'
export type Responsibility = 'Owner' | 'Tenant'
export type PaymentMode = 'Cash' | 'UPI' | 'Bank'
export type FlatStatus = 'Owner-occupied' | 'Rented' | 'Vacant'
export type CategoryTag = Responsibility | 'Other'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  flatNumber: string | null
  phone: string
}

export interface MockUser extends SessionUser {
  password: string
}

export interface OwnerProfile {
  name: string
  phone: string
  email: string
  address: string
  emergency: string
}

export interface TenantProfile {
  name: string
  phone: string
  email: string
  occupants: number
  moveIn: string
  moveOut: string | null
  agreementEnd: string
  vehicle: string
  emergency: string
  idProofLabel: string
}

export interface Flat {
  number: string
  floor: number
  owner: OwnerProfile | null
  tenant: TenantProfile | null
}

export interface ExpenseCategory {
  id: string
  name: string
  defaultTag: CategoryTag
}

export interface Expense {
  id: string
  date: string
  category: string
  responsibility: Responsibility
  description: string
  amount: number
  vendorName: string
  vendorPhone: string
  paymentMode: PaymentMode
  paidBy: string
  paidByUserId: string | null
  hasBill: boolean
  billLabel?: string
  recurringRuleId?: string
}

export type PayStatus = 'Unpaid' | 'Partial' | 'Paid'

export interface Payment {
  id: string
  userId: string
  payerName: string
  flatNumber: string | null
  role: Role
  month: string
  amount: number
  date: string
  mode: PaymentMode
  reference: string
  screenshotLabel: string
  needsCheck: boolean
  checkNote: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  detail: string
}

export interface RecurringRule {
  id: string
  name: string
  category: string
  amount: number
  responsibility: Responsibility
  dayOfMonth: number
}

export interface NewExpenseInput {
  date: string
  category: string
  responsibility: Responsibility
  description: string
  amount: number
  vendorName: string
  vendorPhone: string
  paymentMode: PaymentMode
  hasBill: boolean
  billLabel?: string
  paidByName: string
  paidByUserId: string
}
