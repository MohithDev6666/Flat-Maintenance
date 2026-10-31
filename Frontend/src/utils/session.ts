import type { AppRole, Flat, Owner, SessionUser, Tenant, UserAccount } from '../types/models.ts'

/**
 * Builds the signed-in user from the account, its role, and its owner or tenant record.
 * Returns null when the account or its role is inactive, or the resident link is broken.
 */
export function resolveSession(
  account: UserAccount,
  roles: AppRole[],
  owners: Owner[],
  tenants: Tenant[],
  flats: Flat[],
): SessionUser | null {
  const role = roles.find((item) => item.id === account.roleId)
  if (!role || role.status !== 'Active' || account.status !== 'Active') return null
  const base = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: role.kind,
    roleId: role.id,
    roleName: role.name,
    permissions: role.permissions,
  }
  if (role.kind === 'admin') {
    return { ...base, ownerId: null, tenantId: null, flatId: null, flatNumber: null, floor: null }
  }
  const resident =
    role.kind === 'owner'
      ? owners.find((owner) => owner.id === account.ownerId)
      : tenants.find((tenant) => tenant.id === account.tenantId)
  const flat = flats.find((item) => item.id === resident?.flatId)
  if (!resident || !flat) return null
  return {
    ...base,
    ownerId: role.kind === 'owner' ? resident.id : null,
    tenantId: role.kind === 'tenant' ? resident.id : null,
    flatId: flat.id,
    flatNumber: flat.number,
    floor: flat.floor,
  }
}
