import type { SessionUser, UserAccount } from '../types/models.ts'

/**
 * The signed-in user as a login account. Residents cannot list other logins, so their
 * calculations credit only their own out-of-pocket expenses.
 */
export function sessionAccount(user: SessionUser): UserAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: '',
    roleId: user.roleId,
    roleName: user.roleName,
    isAdmin: user.role === 'admin',
    ownerId: user.ownerId,
    tenantId: user.tenantId,
    status: 'Active',
  }
}
