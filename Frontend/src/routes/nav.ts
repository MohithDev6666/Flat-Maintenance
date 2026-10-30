import {
  IconBuilding,
  IconChartBar,
  IconHistory,
  IconHome,
  IconLayoutDashboard,
  IconLock,
  IconPlus,
  IconReceipt,
  IconRepeat,
  IconTags,
  IconUpload,
  IconUser,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react'
import type { ComponentType } from 'react'
import type { Role } from '../types/models.ts'

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
  adminUsers: '/admin/users',
  adminFlats: '/admin/flats',
  adminTenants: '/admin/tenants',
  adminCategories: '/admin/categories',
  adminRecurring: '/admin/recurring',
  adminRecent: '/admin/recent',
  adminLock: '/admin/lock',
} as const

export interface NavItem {
  label: string
  path: string
  roles: Role[]
  icon: ComponentType<{ size?: number }>
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: paths.dashboard, roles: ['admin', 'owner', 'tenant'], icon: IconLayoutDashboard },
  { label: 'Expenses', path: paths.expenses, roles: ['admin', 'owner', 'tenant'], icon: IconReceipt },
  { label: 'Add expense', path: paths.addExpense, roles: ['admin', 'owner', 'tenant'], icon: IconPlus },
  { label: 'Pay', path: paths.pay, roles: ['admin', 'owner', 'tenant'], icon: IconUpload },
  { label: 'My contribution', path: paths.contribution, roles: ['admin', 'owner', 'tenant'], icon: IconWallet },
  { label: 'Month summary', path: paths.summary, roles: ['admin', 'owner', 'tenant'], icon: IconChartBar },
  { label: 'Flats', path: paths.residents, roles: ['admin', 'owner', 'tenant'], icon: IconBuilding },
]

export const adminNav: NavItem[] = [
  { label: 'Users', path: paths.adminUsers, roles: ['admin'], icon: IconUsers },
  { label: 'Flats', path: paths.adminFlats, roles: ['admin'], icon: IconHome },
  { label: 'Tenants', path: paths.adminTenants, roles: ['admin'], icon: IconUser },
  { label: 'Categories', path: paths.adminCategories, roles: ['admin'], icon: IconTags },
  { label: 'Recurring expenses', path: paths.adminRecurring, roles: ['admin'], icon: IconRepeat },
  { label: 'Recent changes', path: paths.adminRecent, roles: ['admin'], icon: IconHistory },
  { label: 'Lock month', path: paths.adminLock, roles: ['admin'], icon: IconLock },
]

export function navFor(role: Role): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role))
}

export interface Crumb {
  label: string
  to?: string
}

export function crumbsFor(pathname: string): Crumb[] {
  if (pathname === paths.pay) {
    return [
      { label: 'Dashboard', to: paths.dashboard },
      { label: 'Pay' },
    ]
  }
  if (pathname === paths.addExpense) {
    return [
      { label: 'Dashboard', to: paths.dashboard },
      { label: 'Expenses', to: paths.expenses },
      { label: 'Add expense' },
    ]
  }
  const adminMatch = adminNav.find((item) => item.path === pathname)
  if (adminMatch) {
    return [
      { label: 'Dashboard', to: paths.dashboard },
      { label: 'Admin', to: paths.adminUsers },
      { label: adminMatch.label },
    ]
  }
  const match = navItems.find((item) => item.path === pathname)
  if (!match || pathname === paths.dashboard) return [{ label: 'Dashboard' }]
  return [{ label: 'Dashboard', to: paths.dashboard }, { label: match.label }]
}
