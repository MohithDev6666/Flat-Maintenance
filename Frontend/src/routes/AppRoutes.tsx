import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '../components/auth/RequireAuth.tsx'
import { RequirePermission } from '../components/auth/RequirePermission.tsx'
import { AppLayout } from '../components/layout/AppLayout.tsx'
import { BuildingInformationPage } from '../pages/building/BuildingInformationPage.tsx'
import { CategoriesPage } from '../pages/categories/CategoriesPage.tsx'
import { ContributionPage } from '../pages/contribution/ContributionPage.tsx'
import { DashboardPage } from '../pages/dashboard/DashboardPage.tsx'
import { AddExpensePage } from '../pages/expenses/AddExpensePage.tsx'
import { ExpensesPage } from '../pages/expenses/ExpensesPage.tsx'
import { FlatManagementPage } from '../pages/flats/FlatManagementPage.tsx'
import { FlatsPage } from '../pages/flats/FlatsPage.tsx'
import { LoginPage } from '../pages/login/LoginPage.tsx'
import { LockMonthPage } from '../pages/month-lock/LockMonthPage.tsx'
import { OwnersPage } from '../pages/owners/OwnersPage.tsx'
import { PayPage } from '../pages/pay/PayPage.tsx'
import { RecentChangesPage } from '../pages/recent-changes/RecentChangesPage.tsx'
import { RolesPage } from '../pages/roles/RolesPage.tsx'
import { SummaryPage } from '../pages/summary/SummaryPage.tsx'
import { TenantsPage } from '../pages/tenants/TenantsPage.tsx'
import { UsersPage } from '../pages/users/UsersPage.tsx'
import { adminNav, navItems, paths } from './nav.ts'

const commonPages: Record<string, ReactNode> = {
  [paths.dashboard]: <DashboardPage />,
  [paths.expenses]: <ExpensesPage />,
  [paths.addExpense]: <AddExpensePage />,
  [paths.pay]: <PayPage />,
  [paths.contribution]: <ContributionPage />,
  [paths.summary]: <SummaryPage />,
  [paths.residents]: <FlatsPage />,
}

const adminPages: Record<string, ReactNode> = {
  [paths.adminBuilding]: <BuildingInformationPage />,
  [paths.adminFlats]: <FlatManagementPage />,
  [paths.adminOwners]: <OwnersPage />,
  [paths.adminTenants]: <TenantsPage />,
  [paths.adminRoles]: <RolesPage />,
  [paths.adminUsers]: <UsersPage />,
  [paths.adminCategories]: <CategoriesPage />,
  [paths.adminRecent]: <RecentChangesPage />,
  [paths.adminLock]: <LockMonthPage />,
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          {navItems.map((item) => (
            <Route key={item.path} path={item.path} element={<RequirePermission item={item}>{commonPages[item.path]}</RequirePermission>} />
          ))}
          <Route path={paths.admin} element={<Navigate to={paths.adminBuilding} replace />} />
          {adminNav.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <RequirePermission item={item} admin>
                  {adminPages[item.path]}
                </RequirePermission>
              }
            />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={paths.dashboard} replace />} />
    </Routes>
  )
}
