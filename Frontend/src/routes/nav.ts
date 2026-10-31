import {
  IconBuildingCommunity,
  IconBuilding,
  IconChartBar,
  IconHistory,
  IconHome,
  IconKey,
  IconLayoutDashboard,
  IconLock,
  IconPlus,
  IconReceipt,
  IconTags,
  IconUpload,
  IconUser,
  IconUserShield,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import type { PermissionAction, PermissionModule, SessionUser } from '../types/models.ts'
import { can, canOpenAdminModule } from '../utils/permissions.ts'

export const paths = {
  login: '/login',
  dashboard: '/',
  expenses: '/expenses',
  addExpense: '/expenses/new',
  pay: '/pay',
  contribution: '/contribution',
  summary: '/summary',
  residents: '/residents',
  admin: '/admin',
  adminBuilding: '/admin/building',
  adminFlats: '/admin/flats',
  adminOwners: '/admin/owners',
  adminTenants: '/admin/tenants',
  adminRoles: '/admin/roles',
  adminUsers: '/admin/users',
  adminCategories: '/admin/categories',
  adminRecent: '/admin/recent',
  adminLock: '/admin/lock',
} as const

export interface NavItem {
  label: string
  path: string
  module: PermissionModule
  action: PermissionAction
  icon: ComponentType<{ size?: number }>
}

/** Common modules, in the order the sidebar shows them. */
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: paths.dashboard, module: 'dashboard', action: 'view', icon: IconLayoutDashboard },
  { label: 'Expenses', path: paths.expenses, module: 'expenses', action: 'view', icon: IconReceipt },
  { label: 'Add Expense', path: paths.addExpense, module: 'expenses', action: 'add', icon: IconPlus },
  { label: 'Pay / Upload', path: paths.pay, module: 'payments', action: 'view', icon: IconUpload },
  { label: 'My Contribution', path: paths.contribution, module: 'contribution', action: 'view', icon: IconWallet },
  { label: 'Month Summary', path: paths.summary, module: 'summary', action: 'view', icon: IconChartBar },
  { label: 'Flats', path: paths.residents, module: 'flats', action: 'view', icon: IconBuilding },
]

/** Admin modules, in the order the sidebar shows them. */
export const adminNav: NavItem[] = [
  { label: 'Building Information', path: paths.adminBuilding, module: 'building', action: 'view', icon: IconBuildingCommunity },
  { label: 'Flats', path: paths.adminFlats, module: 'flatManagement', action: 'view', icon: IconHome },
  { label: 'Owners', path: paths.adminOwners, module: 'owners', action: 'view', icon: IconKey },
  { label: 'Tenants', path: paths.adminTenants, module: 'tenants', action: 'view', icon: IconUser },
  { label: 'Roles', path: paths.adminRoles, module: 'roles', action: 'view', icon: IconUserShield },
  { label: 'Users', path: paths.adminUsers, module: 'users', action: 'view', icon: IconUsers },
  { label: 'Categories', path: paths.adminCategories, module: 'categories', action: 'view', icon: IconTags },
  { label: 'Recent Changes', path: paths.adminRecent, module: 'recentChanges', action: 'view', icon: IconHistory },
  { label: 'Lock Month', path: paths.adminLock, module: 'lockMonth', action: 'view', icon: IconLock },
]

export function navFor(user: SessionUser): NavItem[] {
  return navItems.filter((item) => can(user, item.module, item.action))
}

export function adminNavFor(user: SessionUser): NavItem[] {
  return adminNav.filter((item) => canOpenAdminModule(user, item.module))
}

export interface Crumb {
  label: string
  to?: string
}

export function crumbsFor(pathname: string): Crumb[] {
  if (pathname === paths.pay) {
    return [
      { label: 'Dashboard', to: paths.dashboard },
      { label: 'Pay / Upload' },
    ]
  }
  if (pathname === paths.addExpense) {
    return [
      { label: 'Dashboard', to: paths.dashboard },
      { label: 'Expenses', to: paths.expenses },
      { label: 'Add Expense' },
    ]
  }
  const adminMatch = adminNav.find((item) => item.path === pathname)
  if (adminMatch) {
    return [
      { label: 'Dashboard', to: paths.dashboard },
      { label: 'Admin', to: paths.adminBuilding },
      { label: adminMatch.label },
    ]
  }
  const match = navItems.find((item) => item.path === pathname)
  if (!match || pathname === paths.dashboard) return [{ label: 'Dashboard' }]
  return [{ label: 'Dashboard', to: paths.dashboard }, { label: match.label }]
}
