import type { AppRole, PermissionAction, PermissionModule, PermissionSet } from '../types/models.ts'

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

export function fullPermissions(): PermissionSet {
  return Object.fromEntries([...commonModules, ...adminModules].map((module) => [module, [...allActions]]))
}

/** Owners and tenants: common modules only. Edit means "your own expense"; delete and manage stay with the admin. */
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

export const mockRoles: AppRole[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Building administrator. Every module and action. Not linked to a flat.',
    status: 'Active',
    kind: 'admin',
    system: true,
    permissions: fullPermissions(),
  },
  {
    id: 'role-owner',
    name: 'Owner',
    description: 'Flat owner. Common modules, with their own flat and its tenant.',
    status: 'Active',
    kind: 'owner',
    system: true,
    permissions: residentPermissions(),
  },
  {
    id: 'role-tenant',
    name: 'Tenant',
    description: 'Tenant. Common modules, with their own flat and contribution.',
    status: 'Active',
    kind: 'tenant',
    system: true,
    permissions: residentPermissions(),
  },
]
