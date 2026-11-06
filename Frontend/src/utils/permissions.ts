import type { Expense, PermissionAction, PermissionModule, PermissionSet, SessionUser, Tenant } from '../types/models.ts'

export function hasPermission(permissions: PermissionSet, module: PermissionModule, action: PermissionAction): boolean {
  return permissions[module]?.includes(action) ?? false
}

export function can(user: SessionUser, module: PermissionModule, action: PermissionAction): boolean {
  return hasPermission(user.permissions, module, action)
}

/** Admin modules are only ever shown to an admin-level role, whatever its permission list says. */
export function canOpenAdminModule(user: SessionUser, module: PermissionModule): boolean {
  return user.role === 'admin' && can(user, module, 'view')
}

/** Owner contact details: the admin, the owner themself, and the tenant of that flat. */
export function canSeeOwner(viewer: SessionUser, flatId: string): boolean {
  if (viewer.role === 'admin') return true
  return viewer.flatId === flatId
}

/** Full owner record (address and emergency contact): the admin and the owner. */
export function canSeeOwnerPrivate(viewer: SessionUser, flatId: string): boolean {
  if (viewer.role === 'admin') return true
  return viewer.role === 'owner' && viewer.flatId === flatId
}

/** A tenant record: the admin, the owner of that flat, and the tenant themself. */
export function canSeeTenant(viewer: SessionUser, tenant: Tenant): boolean {
  if (viewer.role === 'admin') return true
  if (viewer.role === 'owner') return viewer.flatId === tenant.flatId
  return viewer.tenantId === tenant.id
}

/** ID proof is private to the admin and the owner of that flat. */
export function canSeeIdProof(viewer: SessionUser, flatId: string | null): boolean {
  if (viewer.role === 'admin') return true
  return viewer.role === 'owner' && flatId !== null && viewer.flatId === flatId
}

/** Manage lets an admin change any expense; edit alone covers only expenses you created. */
export function canEditExpense(user: SessionUser, expense: Expense, locked: boolean): boolean {
  if (locked) return false
  if (can(user, 'expenses', 'manage')) return true
  return can(user, 'expenses', 'edit') && expense.paidByUserId === user.id
}

/** The API lets only administrators delete expenses. */
export function canDeleteExpense(user: SessionUser, _expense: Expense, locked: boolean): boolean {
  if (locked || !can(user, 'expenses', 'delete')) return false
  return can(user, 'expenses', 'manage')
}
