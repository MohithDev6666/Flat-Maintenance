import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockAudit } from '../mocks/audit.ts'
import { mockBuilding } from '../mocks/building.ts'
import { mockCategories } from '../mocks/categories.ts'
import { mockExpenses } from '../mocks/expenses.ts'
import { mockFlats } from '../mocks/flats.ts'
import { mockOwners } from '../mocks/owners.ts'
import { mockPayments } from '../mocks/payments.ts'
import { fullPermissions, mockRoles } from '../mocks/roles.ts'
import { mockTenants } from '../mocks/tenants.ts'
import { mockUsers } from '../mocks/users.ts'
import type {
  AppRole,
  AuditEntry,
  AuditRecord,
  Building,
  Expense,
  ExpenseCategory,
  Flat,
  MonthLock,
  OccupancyStatus,
  NewExpenseInput,
  Owner,
  Payment,
  RecordStatus,
  Tenant,
  UserAccount,
} from '../types/models.ts'
import { activeTenantOf, monthOf, sortByFlatNumber, type ResidentData } from '../utils/calculations.ts'
import { formatDate, formatINR, formatMonth } from '../utils/format.ts'

/** What the Flats master saves. Owners and tenants are linked to a flat on their own masters. */
export interface FlatInput {
  id: string | null
  number: string
  floor: number
  status: OccupancyStatus
}

interface BuildingContextValue extends ResidentData {
  building: Building
  roles: AppRole[]
  categories: ExpenseCategory[]
  expenses: Expense[]
  payments: Payment[]
  audit: AuditEntry[]
  monthLocks: MonthLock[]
  saveBuilding: (next: Building, actor: string) => string | null
  saveFlat: (input: FlatInput, actor: string) => string | null
  deleteFlat: (id: string, actor: string) => string | null
  saveOwner: (owner: Owner, actor: string) => string | null
  deleteOwner: (id: string, actor: string) => string | null
  saveTenant: (tenant: Tenant, actor: string) => string | null
  deleteTenant: (id: string, actor: string) => string | null
  saveRole: (role: AppRole, actor: string) => string | null
  deleteRole: (id: string, actor: string) => string | null
  saveUser: (account: UserAccount, isNew: boolean, actor: string) => string | null
  setUserStatus: (id: string, status: RecordStatus, actor: string) => string | null
  saveCategory: (category: ExpenseCategory, actor: string) => string | null
  removeCategory: (id: string, actor: string) => string | null
  addExpense: (input: NewExpenseInput) => string | null
  updateExpense: (next: Expense, actor: string) => string | null
  deleteExpense: (id: string, actor: string) => string | null
  addPayment: (payment: Payment) => string | null
  flagPayment: (id: string, note: string, actor: string) => void
  clearPaymentFlag: (id: string, actor: string) => void
  isLocked: (month: string) => boolean
  setMonthLock: (month: string, locked: boolean, actor: string) => void
}

const BuildingContext = createContext<BuildingContextValue | null>(null)

function expenseLine(expense: Expense): string {
  return `${formatDate(expense.date)} · ${expense.responsibility} · ${formatINR(expense.amount)} · ${expense.description}`
}

function buildingLine(building: Building): string {
  return `${building.name} · ${building.address} · ${building.totalFlats} flats · ${building.floors} floors · ${building.contactPhone}`
}

function tenantLine(tenant: Tenant): string {
  return `${tenant.name} · ${formatDate(tenant.moveIn)} → ${tenant.moveOut ? formatDate(tenant.moveOut) : 'present'}`
}

export function BuildingProvider({ children }: { children: ReactNode }) {
  const [building, setBuilding] = useState<Building>(mockBuilding)
  const [flats, setFlats] = useState<Flat[]>(mockFlats)
  const [owners, setOwners] = useState<Owner[]>(mockOwners)
  const [tenants, setTenants] = useState<Tenant[]>(mockTenants)
  const [roles, setRoles] = useState<AppRole[]>(mockRoles)
  const [accounts, setAccounts] = useState<UserAccount[]>(mockUsers)
  const [categories, setCategories] = useState<ExpenseCategory[]>(mockCategories)
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses)
  const [payments, setPayments] = useState<Payment[]>(mockPayments)
  const [audit, setAudit] = useState<AuditEntry[]>(mockAudit)
  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([])

  const pushAudit = (
    actor: string,
    recordType: AuditRecord,
    action: string,
    description: string,
    oldValue = '',
    newValue = '',
  ) => {
    const entry: AuditEntry = {
      id: `audit-${crypto.randomUUID()}`,
      at: new Date().toISOString(),
      actor,
      recordType,
      action,
      description,
      oldValue,
      newValue,
    }
    setAudit((current) => [entry, ...current])
  }

  const flatNumberOf = (flatId: string | null) => flats.find((flat) => flat.id === flatId)?.number ?? '—'

  // Building

  const saveBuilding = (next: Building, actor: string) => {
    if (!next.name.trim() || !next.address.trim()) return 'Building name and address are required.'
    if (!(next.totalFlats > 0) || !(next.floors > 0)) return 'Total flats and floors must be at least 1.'
    if (!next.contactPhone.trim()) return 'Enter a contact phone number.'
    const saved: Building = { ...next, name: next.name.trim(), address: next.address.trim(), contactPhone: next.contactPhone.trim() }
    setBuilding(saved)
    pushAudit(actor, 'Building', 'Edited', saved.name, buildingLine(building), buildingLine(saved))
    return null
  }

  // Flats

  const saveFlat = (input: FlatInput, actor: string) => {
    const number = input.number.trim()
    if (!number) return 'Enter a flat number.'
    if (!(input.floor > 0)) return 'Choose the floor.'
    if (flats.some((flat) => flat.number === number && flat.id !== input.id)) return `Flat ${number} already exists.`
    const id = input.id ?? `flat-${crypto.randomUUID()}`
    const previous = flats.find((flat) => flat.id === id)
    const tenant = previous ? activeTenantOf(tenants, id) : null
    if (input.status === 'Available' && tenant) {
      return `${tenant.name} lives in this flat. Set their move-out date on Admin → Tenants to make it Available.`
    }
    const saved: Flat = { id, number, floor: input.floor, status: input.status }
    setFlats((current) => sortByFlatNumber(previous ? current.map((flat) => (flat.id === id ? saved : flat)) : [...current, saved]))
    pushAudit(
      actor,
      'Flat',
      previous ? 'Edited' : 'Created',
      `Flat ${saved.number}`,
      previous ? `Flat ${previous.number} · floor ${previous.floor} · ${previous.status}` : '',
      `Flat ${saved.number} · floor ${saved.floor} · ${saved.status}`,
    )
    return null
  }

  const deleteFlat = (id: string, actor: string) => {
    const flat = flats.find((item) => item.id === id)
    if (!flat) return 'That flat is no longer here.'
    if (owners.some((owner) => owner.flatId === id)) return `Flat ${flat.number} still has an owner on Admin → Owners.`
    if (tenants.some((tenant) => tenant.flatId === id)) return `Flat ${flat.number} has tenant records. Delete or move them first.`
    if (payments.some((payment) => payment.flatId === id)) return `Flat ${flat.number} has payments on record, so it stays.`
    setFlats((current) => current.filter((item) => item.id !== id))
    pushAudit(actor, 'Flat', 'Deleted', `Flat ${flat.number}`, `Flat ${flat.number} · floor ${flat.floor}`)
    return null
  }

  // Owners

  const saveOwner = (owner: Owner, actor: string) => {
    if (!owner.name.trim() || !owner.phone.trim() || !owner.email.trim()) return 'Name, phone, and email are required.'
    const previous = owners.find((item) => item.id === owner.id)
    if (previous?.flatId && previous.flatId !== owner.flatId) {
      return `Flat ${flatNumberOf(previous.flatId)} would be left without an owner. Give it to its new owner instead.`
    }
    // Choosing a flat that already has an owner transfers it: the previous owner keeps their record without a flat.
    const sellers = owners.filter((item) => owner.flatId !== null && item.flatId === owner.flatId && item.id !== owner.id)
    const saved: Owner = {
      ...owner,
      name: owner.name.trim(),
      phone: owner.phone.trim(),
      email: owner.email.trim().toLowerCase(),
      address: owner.address.trim(),
      emergency: owner.emergency.trim(),
    }
    setOwners((current) => {
      const released = current.map((item) => (sellers.some((seller) => seller.id === item.id) ? { ...item, flatId: null } : item))
      return previous ? released.map((item) => (item.id === saved.id ? saved : item)) : [...released, saved]
    })
    for (const seller of sellers) {
      pushAudit(actor, 'Owner', 'Transferred', `Flat ${flatNumberOf(saved.flatId)}`, seller.name, saved.name)
    }
    pushAudit(
      actor,
      'Owner',
      previous ? 'Edited' : 'Created',
      saved.name,
      previous ? `${previous.name} · Flat ${flatNumberOf(previous.flatId)} · ${previous.phone}` : '',
      `${saved.name} · Flat ${flatNumberOf(saved.flatId)} · ${saved.phone}`,
    )
    return null
  }

  const deleteOwner = (id: string, actor: string) => {
    const owner = owners.find((item) => item.id === id)
    if (!owner) return 'That owner is no longer here.'
    if (owner.flatId) return `${owner.name} owns flat ${flatNumberOf(owner.flatId)}. Transfer it to the new owner first.`
    const login = accounts.find((account) => account.ownerId === id)
    if (login) return `${login.email} is linked to this owner. Change or remove that user first.`
    setOwners((current) => current.filter((item) => item.id !== id))
    pushAudit(actor, 'Owner', 'Deleted', owner.name, `${owner.name} · Flat ${flatNumberOf(owner.flatId)}`)
    return null
  }

  // Tenants

  // A tenant moving in makes the flat Occupied; the tenant leaving makes it Available until the admin says otherwise.
  const syncOccupancy = (nextTenants: Tenant[]) => {
    setFlats((current) =>
      current.map((flat) => {
        const before = activeTenantOf(tenants, flat.id)
        const after = activeTenantOf(nextTenants, flat.id)
        if (after) return flat.status === 'Occupied' ? flat : { ...flat, status: 'Occupied' }
        if (before) return { ...flat, status: 'Available' }
        return flat
      }),
    )
  }

  const saveTenant = (tenant: Tenant, actor: string) => {
    if (!tenant.name.trim() || !tenant.phone.trim() || !tenant.email.trim()) return 'Name, phone, and email are required.'
    if (!tenant.flatId) return 'Choose the flat this tenant rents.'
    if (!tenant.moveIn || !tenant.agreementEnd) return 'Move-in and agreement end dates are required.'
    if (tenant.moveOut && tenant.moveOut < tenant.moveIn) return 'Move-out cannot be before move-in.'
    if (!(tenant.occupants > 0)) return 'Occupants must be at least 1.'
    if (!tenant.emergency.trim()) return 'Enter an emergency contact.'
    const end = (item: Tenant) => item.moveOut ?? '9999-12-31'
    const overlap = tenants.find(
      (item) => item.id !== tenant.id && item.flatId === tenant.flatId && item.moveIn < end(tenant) && tenant.moveIn < end(item),
    )
    if (overlap) {
      return `${overlap.name} lives in flat ${flatNumberOf(tenant.flatId)} for part of those dates. Set their move-out date first.`
    }
    const previous = tenants.find((item) => item.id === tenant.id)
    const saved: Tenant = {
      ...tenant,
      name: tenant.name.trim(),
      phone: tenant.phone.trim(),
      email: tenant.email.trim().toLowerCase(),
      emergency: tenant.emergency.trim(),
      vehicle: tenant.vehicle.trim(),
    }
    const nextTenants = previous ? tenants.map((item) => (item.id === saved.id ? saved : item)) : [...tenants, saved]
    setTenants(nextTenants)
    syncOccupancy(nextTenants)
    pushAudit(
      actor,
      'Tenant',
      previous ? 'Edited' : 'Created',
      `${saved.name} · Flat ${flatNumberOf(saved.flatId)}`,
      previous ? tenantLine(previous) : '',
      tenantLine(saved),
    )
    return null
  }

  const deleteTenant = (id: string, actor: string) => {
    const tenant = tenants.find((item) => item.id === id)
    if (!tenant) return 'That tenant is no longer here.'
    const login = accounts.find((account) => account.tenantId === id)
    if (login) return `${login.email} is linked to this tenant. Change or remove that user first.`
    if (payments.some((payment) => payment.role === 'tenant' && payment.residentId === id)) {
      return 'This tenant has payments on record. Set a move-out date to keep the history instead.'
    }
    const nextTenants = tenants.filter((item) => item.id !== id)
    setTenants(nextTenants)
    syncOccupancy(nextTenants)
    pushAudit(actor, 'Tenant', 'Deleted', `${tenant.name} · Flat ${flatNumberOf(tenant.flatId)}`, tenantLine(tenant))
    return null
  }

  // Roles

  const saveRole = (role: AppRole, actor: string) => {
    const name = role.name.trim()
    if (!name) return 'Enter a role name.'
    if (roles.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== role.id)) return 'That role name is already used.'
    const previous = roles.find((item) => item.id === role.id)
    if (previous?.system && previous.kind !== role.kind) return 'A default role keeps its access level.'
    if (role.status === 'Inactive' && accounts.some((account) => account.roleId === role.id && account.status === 'Active')) {
      return 'Active users still have this role. Move them to another role first.'
    }
    const saved: AppRole =
      role.kind === 'admin' && role.system
        ? { ...role, name, status: 'Active', permissions: fullPermissions() }
        : { ...role, name, description: role.description.trim() }
    setRoles((current) => (previous ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]))
    pushAudit(
      actor,
      'Role',
      previous ? 'Edited' : 'Created',
      saved.name,
      previous ? `${previous.name} · ${previous.status}` : '',
      `${saved.name} · ${saved.status}`,
    )
    return null
  }

  const deleteRole = (id: string, actor: string) => {
    const role = roles.find((item) => item.id === id)
    if (!role) return 'That role is no longer here.'
    if (role.system) return 'Default roles cannot be deleted.'
    if (accounts.some((account) => account.roleId === id)) return 'Users still have this role. Move them to another role first.'
    setRoles((current) => current.filter((item) => item.id !== id))
    pushAudit(actor, 'Role', 'Deleted', role.name, role.name)
    return null
  }

  // Users

  const saveUser = (account: UserAccount, isNew: boolean, actor: string) => {
    const email = account.email.trim().toLowerCase()
    if (!account.name.trim() || !email) return 'Full name and email are required.'
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email.'
    if (accounts.some((item) => item.email === email && item.id !== account.id)) return 'That email is already used.'
    if (isNew && !account.password.trim()) return 'Set an initial password.'
    const role = roles.find((item) => item.id === account.roleId)
    if (!role) return 'Choose a role.'
    if (role.status !== 'Active') return `The ${role.name} role is inactive.`
    const linked: Pick<UserAccount, 'ownerId' | 'tenantId'> =
      role.kind === 'owner'
        ? { ownerId: account.ownerId, tenantId: null }
        : role.kind === 'tenant'
          ? { ownerId: null, tenantId: account.tenantId }
          : { ownerId: null, tenantId: null }
    if (role.kind === 'owner') {
      const owner = owners.find((item) => item.id === linked.ownerId)
      if (!owner) return 'Link this user to an owner record.'
      if (!owner.flatId) return `${owner.name} is not linked to a flat yet.`
      if (accounts.some((item) => item.ownerId === owner.id && item.id !== account.id)) return `${owner.name} already has a login.`
    }
    if (role.kind === 'tenant') {
      const tenant = tenants.find((item) => item.id === linked.tenantId)
      if (!tenant) return 'Link this user to a tenant record.'
      if (!tenant.flatId) return `${tenant.name} is not linked to a flat yet.`
      if (accounts.some((item) => item.tenantId === tenant.id && item.id !== account.id)) return `${tenant.name} already has a login.`
    }
    const previous = accounts.find((item) => item.id === account.id)
    const saved: UserAccount = {
      ...account,
      ...linked,
      name: account.name.trim(),
      email,
      password: account.password.trim() || previous?.password || '',
    }
    setAccounts((current) => (isNew ? [...current, saved] : current.map((item) => (item.id === saved.id ? saved : item))))
    const roleName = (roleId: string) => roles.find((item) => item.id === roleId)?.name ?? '—'
    pushAudit(
      actor,
      'User',
      isNew ? 'Created' : 'Edited',
      saved.email,
      previous ? `${previous.name} · ${roleName(previous.roleId)} · ${previous.status}` : '',
      `${saved.name} · ${roleName(saved.roleId)} · ${saved.status}`,
    )
    return null
  }

  const setUserStatus = (id: string, status: RecordStatus, actor: string) => {
    const account = accounts.find((item) => item.id === id)
    if (!account) return 'That user is no longer here.'
    setAccounts((current) => current.map((item) => (item.id === id ? { ...item, status } : item)))
    pushAudit(actor, 'User', status === 'Active' ? 'Activated' : 'Deactivated', account.email, account.status, status)
    return null
  }

  // Categories

  const saveCategory = (category: ExpenseCategory, actor: string) => {
    const name = category.name.trim()
    if (!name) return 'Enter a category name.'
    if (categories.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== category.id)) {
      return 'That category already exists.'
    }
    const previous = categories.find((item) => item.id === category.id)
    const saved: ExpenseCategory = { ...category, name, description: category.description.trim() }
    setCategories((current) => (previous ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]))
    if (previous && previous.name !== saved.name) {
      setExpenses((current) =>
        current.map((expense) => (expense.category === previous.name ? { ...expense, category: saved.name } : expense)),
      )
    }
    pushAudit(
      actor,
      'Category',
      previous ? 'Edited' : 'Created',
      saved.name,
      previous ? `${previous.name} · ${previous.defaultTag} · ${previous.status}` : '',
      `${saved.name} · ${saved.defaultTag} · ${saved.status}`,
    )
    return null
  }

  const removeCategory = (id: string, actor: string) => {
    const category = categories.find((item) => item.id === id)
    if (!category) return 'That category is no longer here.'
    if (expenses.some((expense) => expense.category === category.name)) {
      return 'This category is used on an expense. Set it to Inactive instead.'
    }
    setCategories((current) => current.filter((item) => item.id !== id))
    pushAudit(actor, 'Category', 'Deleted', category.name, `${category.name} · ${category.defaultTag}`)
    return null
  }

  // Month lock

  const isLocked = (month: string) => monthLocks.some((lock) => lock.month === month && lock.locked)

  const setMonthLock = (month: string, locked: boolean, actor: string) => {
    const at = new Date().toISOString()
    setMonthLocks((current) => {
      const existing = current.find((lock) => lock.month === month)
      const base: MonthLock = existing ?? { month, locked: false, lockedBy: '', lockedAt: null, unlockedBy: '', unlockedAt: null }
      const next: MonthLock = locked
        ? { ...base, locked: true, lockedBy: actor, lockedAt: at }
        : { ...base, locked: false, unlockedBy: actor, unlockedAt: at }
      return existing ? current.map((lock) => (lock.month === month ? next : lock)) : [...current, next]
    })
    pushAudit(actor, 'Month lock', locked ? 'Locked' : 'Unlocked', formatMonth(month), locked ? 'Open' : 'Locked', locked ? 'Locked' : 'Open')
  }

  // Expenses

  const addExpense = (input: NewExpenseInput) => {
    if (isLocked(monthOf(input.date))) return `${formatMonth(monthOf(input.date))} is locked.`
    const expense: Expense = {
      id: `exp-${crypto.randomUUID()}`,
      date: input.date,
      category: input.category,
      responsibility: input.responsibility,
      description: input.description.trim(),
      amount: input.amount,
      vendorName: input.vendorName.trim(),
      vendorPhone: input.vendorPhone.trim(),
      paymentMode: input.paymentMode,
      paidBy: input.paidByName,
      paidByUserId: input.paidByUserId,
      bill: input.bill,
    }
    setExpenses((current) => [expense, ...current])
    pushAudit(input.paidByName, 'Expense', 'Created', expense.category, '', expenseLine(expense))
    return null
  }

  const updateExpense = (next: Expense, actor: string) => {
    const previous = expenses.find((expense) => expense.id === next.id)
    if (!previous) return 'That expense is no longer here.'
    if (isLocked(monthOf(previous.date)) || isLocked(monthOf(next.date))) return 'That month is locked.'
    const saved: Expense = { ...next, description: next.description.trim(), vendorName: next.vendorName.trim(), vendorPhone: next.vendorPhone.trim() }
    setExpenses((current) => current.map((expense) => (expense.id === saved.id ? saved : expense)))
    pushAudit(
      actor,
      'Expense',
      previous.responsibility === saved.responsibility ? 'Edited' : 'Re-tagged',
      saved.category,
      `${previous.category} · ${expenseLine(previous)}`,
      `${saved.category} · ${expenseLine(saved)}`,
    )
    return null
  }

  const deleteExpense = (id: string, actor: string) => {
    const previous = expenses.find((expense) => expense.id === id)
    if (!previous) return 'That expense is no longer here.'
    if (isLocked(monthOf(previous.date))) return 'That month is locked.'
    setExpenses((current) => current.filter((expense) => expense.id !== id))
    pushAudit(actor, 'Expense', 'Deleted', previous.category, expenseLine(previous))
    return null
  }

  // Payments

  const paymentLabel = (payment: Payment) =>
    `Flat ${flatNumberOf(payment.flatId)} · ${payment.role === 'owner' ? 'Owner' : 'Tenant'} · ${formatMonth(payment.month)}`

  const addPayment = (payment: Payment) => {
    if (isLocked(payment.month)) return `${formatMonth(payment.month)} is locked.`
    setPayments((current) => [payment, ...current])
    pushAudit(
      payment.payerName,
      'Payment',
      'Created',
      paymentLabel(payment),
      '',
      `${formatINR(payment.amount)} · ${payment.mode} · ${payment.screenshot.name}`,
    )
    return null
  }

  const flagPayment = (id: string, note: string, actor: string) => {
    const previous = payments.find((payment) => payment.id === id)
    if (!previous) return
    const next = { ...previous, needsCheck: true, checkNote: note.trim() }
    setPayments((current) => current.map((payment) => (payment.id === id ? next : payment)))
    pushAudit(actor, 'Payment', 'Flagged', paymentLabel(previous), 'Recorded', `Needs check · ${next.checkNote || 'No note'}`)
  }

  const clearPaymentFlag = (id: string, actor: string) => {
    const previous = payments.find((payment) => payment.id === id)
    if (!previous) return
    setPayments((current) => current.map((payment) => (payment.id === id ? { ...payment, needsCheck: false, checkNote: '' } : payment)))
    pushAudit(actor, 'Payment', 'Checked', paymentLabel(previous), `Needs check · ${previous.checkNote}`, 'Recorded')
  }

  return (
    <BuildingContext.Provider
      value={{
        building,
        flats,
        owners,
        tenants,
        roles,
        accounts,
        categories,
        expenses,
        payments,
        audit,
        monthLocks,
        saveBuilding,
        saveFlat,
        deleteFlat,
        saveOwner,
        deleteOwner,
        saveTenant,
        deleteTenant,
        saveRole,
        deleteRole,
        saveUser,
        setUserStatus,
        saveCategory,
        removeCategory,
        addExpense,
        updateExpense,
        deleteExpense,
        addPayment,
        flagPayment,
        clearPaymentFlag,
        isLocked,
        setMonthLock,
      }}
    >
      {children}
    </BuildingContext.Provider>
  )
}

export function useBuilding(): BuildingContextValue {
  const value = useContext(BuildingContext)
  if (!value) throw new Error('useBuilding must be used within BuildingProvider')
  return value
}
