import { Badge, Button, Stack } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import type { AppRole } from '../../types/models.ts'
import { formatRole } from '../../utils/format.ts'
import { notifyResult } from '../../utils/notify.ts'
import { RoleForm } from './RoleForm.tsx'

export function RolesPage() {
  const { user } = useAuth()
  const { roles, accounts, deleteRole } = useBuilding()
  const { can } = usePermissions()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppRole | null>(null)
  const [deleting, setDeleting] = useState<AppRole | null>(null)
  if (!user) return null

  const open = (role: AppRole | null) => {
    setEditing(role)
    setFormOpen(true)
  }
  const remove = () => {
    if (!deleting) return
    notifyResult(deleteRole(deleting.id, user.name), { title: 'Role deleted', message: deleting.name }, 'Not deleted')
    setDeleting(null)
  }

  const rows = roles.map((role) => {
    const users = accounts.filter((account) => account.roleId === role.id).length
    const modules = Object.values(role.permissions).filter((actions) => actions && actions.length > 0).length
    return {
      key: role.id,
      cells: [
        <StackedCell key="name" primary={role.name} secondary={role.system ? 'Default role' : 'Custom role'} />,
        role.description || '—',
        formatRole(role.kind),
        `${modules} module${modules === 1 ? '' : 's'}`,
        String(users),
        <StatusBadge key="status" status={role.status} />,
      ],
      card: {
        title: role.name,
        subtitle: role.description,
        badge: <StatusBadge status={role.status} />,
        fields: [
          { label: 'Access level', value: formatRole(role.kind) },
          { label: 'Modules', value: String(modules) },
          { label: 'Users', value: String(users) },
          { label: 'Type', value: role.system ? <Badge size="xs" variant="outline" color="terracotta">Default</Badge> : 'Custom' },
        ],
      },
      actions: (
        <>
          {can('roles', 'edit') ? (
            <Button size="xs" variant="light" onClick={() => open(role)}>
              {role.system && role.kind === 'admin' ? 'View' : 'Edit'}
            </Button>
          ) : null}
          {can('roles', 'delete') && !role.system ? (
            <Button size="xs" variant="subtle" color="red" onClick={() => setDeleting(role)}>
              Delete
            </Button>
          ) : null}
        </>
      ),
    }
  })

  return (
    <Stack gap="lg">
      <PageHeading
        title="Roles"
        description="Each role sets an access level and which modules and actions its users get. Admin, Owner, and Tenant are the defaults."
        action={
          can('roles', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
              Create role
            </Button>
          ) : null
        }
      />
      <ResponsiveList headers={['Role', 'Description', 'Access level', 'Permissions', 'Users', 'Status']} rows={rows} />
      <RoleForm opened={formOpen} role={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete role"
        message={deleting ? `Delete the ${deleting.name} role? Roles that still have users cannot be deleted.` : ''}
        confirmLabel="Delete role"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
