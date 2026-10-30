import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.tsx'
import { paths } from '../../routes/nav.ts'

export function RequireAuth() {
  const { user } = useAuth()
  if (!user) return <Navigate to={paths.login} replace />
  return <Outlet />
}
