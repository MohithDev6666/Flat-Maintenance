import type { PermissionAction, PermissionModule } from '../types/models.ts'
import { can } from '../utils/permissions.ts'
import { useAuth } from './useAuth.tsx'

/** `can('owners', 'add')` for the signed-in user. False when nobody is signed in. */
export function usePermissions() {
  const { user } = useAuth()
  return {
    can: (module: PermissionModule, action: PermissionAction) => (user ? can(user, module, action) : false),
  }
}
