/** Access level of a role. Decides which records a signed-in user is linked to and can see. */
export type Role = 'admin' | 'owner' | 'tenant'
export type ResidentKind = Exclude<Role, 'admin'>
export type Responsibility = 'Owner' | 'Tenant'
export type PaymentMode = 'Cash' | 'UPI' | 'Bank'
/** Shown across the app; worked out from the flat's status and its active tenant. */
export type FlatStatus = 'Owner-occupied' | 'Rented' | 'Vacant'
/** What the admin sets on the Flats master. */
export type OccupancyStatus = 'Occupied' | 'Available'
export type CategoryTag = Responsibility | 'Other'
export type RecordStatus = 'Active' | 'Inactive'
export type FileKind = 'image' | 'pdf'
export type IdProofType = 'Aadhaar' | 'PAN' | 'Passport' | 'Driving licence' | 'Voter ID'

export const idProofTypes: IdProofType[] = ['Aadhaar', 'PAN', 'Passport', 'Driving licence', 'Voter ID']

/** A bill, screenshot, or ID proof. `url` is null for seeded sample files that have no content. */
export interface Attachment {
  name: string
  url: string | null
  kind: FileKind
}

export interface Building {
  name: string
  address: string
  totalFlats: number
  floors: number
  contactPhone: string
}

/*
 * How the records link (each arrow is an id field, so an API can return them as-is):
 *
 *   Flat ←── Owner.flatId          every flat has exactly one permanent owner (set on the Owners master)
 *   Flat ←── Tenant.flatId         a flat has many tenancies over time; at most one active on a day (set on the Tenants master)
 *   Tenant → its owner             not stored: it is the owner of Tenant.flatId
 *   UserAccount → AppRole          roleId; the role's kind says what the user links to
 *   UserAccount → Owner | Tenant   ownerId or tenantId (admin: neither); the flat comes from that record
 */

export interface Flat {
  id: string
  number: string
  floor: number
  /** Occupied when the owner or a tenant lives there. A tenant moving in sets Occupied; moving out sets Available. */
  status: OccupancyStatus
}

export interface Owner {
  id: string
  name: string
  phone: string
  email: string
  flatId: string | null
  address: string
  emergency: string
}

export interface Tenant {
  id: string
  name: string
  phone: string
  email: string
  flatId: string | null
  occupants: number
  moveIn: string
  moveOut: string | null
  agreementEnd: string
  idProofType: IdProofType
  idProof: Attachment | null
  emergency: string
  vehicle: string
}

export type PermissionModule =
  | 'dashboard'
  | 'expenses'
  | 'payments'
  | 'contribution'
  | 'summary'
  | 'flats'
  | 'building'
  | 'flatManagement'
  | 'owners'
  | 'tenants'
  | 'roles'
  | 'users'
  | 'categories'
  | 'recentChanges'
  | 'lockMonth'

export type PermissionAction = 'view' | 'add' | 'edit' | 'delete' | 'manage'

export type PermissionSet = Partial<Record<PermissionModule, PermissionAction[]>>

export interface AppRole {
  id: string
  name: string
  description: string
  status: RecordStatus
  kind: Role
  /** Admin, Owner, and Tenant ship with the app and cannot be deleted. */
  system: boolean
  permissions: PermissionSet
}

export interface UserAccount {
  id: string
  name: string
  email: string
  password: string
  roleId: string
  ownerId: string | null
  tenantId: string | null
  status: RecordStatus
}

/** The signed-in user, resolved from the account, its role, and its resident record. */
export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  roleId: string
  roleName: string
  permissions: PermissionSet
  ownerId: string | null
  tenantId: string | null
  flatId: string | null
  flatNumber: string | null
  floor: number | null
}

export interface ExpenseCategory {
  id: string
  name: string
  description: string
  defaultTag: CategoryTag
  status: RecordStatus
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
  bill: Attachment | null
}

export type PayStatus = 'Unpaid' | 'Partial' | 'Paid'

export interface Payment {
  id: string
  userId: string
  payerName: string
  flatId: string
  role: ResidentKind
  residentId: string
  month: string
  amount: number
  date: string
  mode: PaymentMode
  reference: string
  screenshot: Attachment
  needsCheck: boolean
  checkNote: string
}

export type AuditRecord =
  | 'Expense'
  | 'Payment'
  | 'Building'
  | 'Flat'
  | 'Owner'
  | 'Tenant'
  | 'Role'
  | 'User'
  | 'Category'
  | 'Month lock'

export interface AuditEntry {
  id: string
  at: string
  actor: string
  recordType: AuditRecord
  action: string
  description: string
  oldValue: string
  newValue: string
}

export interface MonthLock {
  month: string
  locked: boolean
  lockedBy: string
  lockedAt: string | null
  unlockedBy: string
  unlockedAt: string | null
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
  bill: Attachment | null
  paidByName: string
  paidByUserId: string
}
