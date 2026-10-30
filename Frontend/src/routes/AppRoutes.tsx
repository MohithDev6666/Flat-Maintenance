import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '../components/auth/RequireAuth.tsx'
import { AppLayout } from '../components/layout/AppLayout.tsx'
import { AdminPage } from '../pages/admin/AdminPage.tsx'
import { ContributionPage } from '../pages/contribution/ContributionPage.tsx'
import { DashboardPage } from '../pages/dashboard/DashboardPage.tsx'
import { AddExpensePage } from '../pages/expenses/AddExpensePage.tsx'
import { ExpensesPage } from '../pages/expenses/ExpensesPage.tsx'
import { LoginPage } from '../pages/login/LoginPage.tsx'
import { PayPage } from '../pages/pay/PayPage.tsx'
import { ResidentsPage } from '../pages/residents/ResidentsPage.tsx'
import { SummaryPage } from '../pages/summary/SummaryPage.tsx'
import { paths } from './nav.ts'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path={paths.dashboard} element={<DashboardPage />} />
          <Route path={paths.expenses} element={<ExpensesPage />} />
          <Route path={paths.addExpense} element={<AddExpensePage />} />
          <Route path={paths.pay} element={<PayPage />} />
          <Route path={paths.contribution} element={<ContributionPage />} />
          <Route path={paths.summary} element={<SummaryPage />} />
          <Route path={paths.residents} element={<ResidentsPage />} />
          <Route path={paths.admin} element={<Navigate to={paths.adminUsers} replace />} />
          <Route path="/admin/:section" element={<AdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={paths.dashboard} replace />} />
    </Routes>
  )
}
