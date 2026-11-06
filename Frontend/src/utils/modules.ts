import type { PermissionAction, PermissionModule, PermissionSet } from '../types/models.ts'

/** Actions a role can be granted. "Manage" is not stored: it is implied by an administrator role. */
export const roleActions: Exclude<PermissionAction, 'manage'>[] = ['view', 'add', 'edit', 'delete']

export const allActions: PermissionAction[] = ['view', 'add', 'edit', 'delete', 'manage']

export const commonModules: PermissionModule[] = ['dashboard', 'expenses', 'payments', 'contribution', 'summary', 'flats']

export const adminModules: PermissionModule[] = [
  'building',
  'flatManagement',
  'owners',
  'tenants',
  'roles',
  'users',
  'categories',
  'recentChanges',
  'lockMonth',
]

export const allModules: PermissionModule[] = [...commonModules, ...adminModules]

export function fullPermissions(): PermissionSet {
  return Object.fromEntries(allModules.map((module) => [module, [...allActions]]))
}

/** Starting point for a new resident role. Edit means "your own expense"; delete stays with the admin. */
export function residentPermissions(): PermissionSet {
  return {
    dashboard: ['view'],
    expenses: ['view', 'add', 'edit'],
    payments: ['view', 'add'],
    contribution: ['view'],
    summary: ['view'],
    flats: ['view'],
  }
}

const moduleByLowerKey = new Map(allModules.map((module) => [module.toLowerCase(), module]))

/** Backend module key (any casing) → frontend module, or null when the app does not use it. */
export function toModule(key: string): PermissionModule | null {
  return moduleByLowerKey.get(key.trim().toLowerCase()) ?? null
}

const actionFromBackend: Record<string, Exclude<PermissionAction, 'manage'>> = {
  read: 'view',
  view: 'view',
  create: 'add',
  add: 'add',
  update: 'edit',
  edit: 'edit',
  delete: 'delete',
}

const actionToBackend: Record<Exclude<PermissionAction, 'manage'>, string> = {
  view: 'read',
  add: 'create',
  edit: 'update',
  delete: 'delete',
}

/** ["expenses:read", "flatmanagement:update"] → { expenses: ['view'], flatManagement: ['edit'] }. */
export function permissionSetFromStrings(permissions: string[]): PermissionSet {
  const set: PermissionSet = {}
  for (const permission of permissions) {
    const [key = '', rawAction = ''] = permission.split(':')
    const module = toModule(key)
    const action = actionFromBackend[rawAction.toLowerCase()]
    if (!module || !action) continue
    const current = set[module] ?? []
    if (!current.includes(action)) set[module] = [...current, action]
  }
  return set
}

/** { expenses: ['view', 'add'] } → ["expenses:read", "expenses:create"]. */
export function permissionStringsFromSet(set: PermissionSet): string[] {
  const result: string[] = []
  for (const [module, actions] of Object.entries(set)) {
    for (const action of actions ?? []) {
      if (action === 'manage') continue
      result.push(`${module}:${actionToBackend[action]}`)
    }
  }
  return result
}
