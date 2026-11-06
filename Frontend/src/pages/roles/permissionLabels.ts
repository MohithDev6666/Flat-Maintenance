import type { PermissionAction, PermissionModule } from '../../types/models.ts'

export const moduleLabels: Record<PermissionModule, string> = {
  dashboard: 'Dashboard',
  expenses: 'Expenses and Add Expense',
  payments: 'Pay / Upload',
  contribution: 'My Contribution',
  summary: 'Month Summary',
  flats: 'Flats (read-only view)',
  building: 'Building Information',
  flatManagement: 'Flats (management)',
  owners: 'Owners',
  tenants: 'Tenants',
  roles: 'Roles',
  users: 'Users',
  categories: 'Categories',
  recentChanges: 'Recent Changes',
  lockMonth: 'Lock Month',
}

export const actionLabels: Record<PermissionAction, string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  manage: 'Manage',
}
