import { Center, Loader } from '@mantine/core'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.tsx'
import { paths } from '../../routes/nav.ts'

export function RequireAuth() {
  const { user, restoring } = useAuth()
  if (restoring) {
    return (
      <Center mih="100dvh">
        <Loader color="terracotta" />
      </Center>
    )
  }
  if (!user) return <Navigate to={paths.login} replace />
  return <Outlet />
}
