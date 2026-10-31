import { Alert, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import type { NavItem } from '../../routes/nav.ts'
import { can, canOpenAdminModule } from '../../utils/permissions.ts'
import { PageHeading } from '../ui/PageHeading.tsx'

/** Shows the page only when the signed-in role may open it. Admin modules also need an admin-level role. */
export function RequirePermission({ item, admin = false, children }: { item: NavItem; admin?: boolean; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return null
  const allowed = admin ? canOpenAdminModule(user, item.module) : can(user, item.module, item.action)
  if (allowed) return children
  return (
    <Stack gap="lg">
      <PageHeading title={item.label} />
      <Alert color="terracotta" variant="light" title={admin ? 'Admin only' : 'Not available'}>
        {admin
          ? `${item.label} is managed from the admin account.`
          : `Your role (${user.roleName}) does not include ${item.label}.`}
      </Alert>
    </Stack>
  )
}
