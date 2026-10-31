import { useAuth } from '../../hooks/useAuth.tsx'
import { AdminDashboard } from './AdminDashboard.tsx'
import { ResidentDashboard } from './ResidentDashboard.tsx'

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null
  return user.role === 'admin' ? <AdminDashboard user={user} /> : <ResidentDashboard user={user} />
}
