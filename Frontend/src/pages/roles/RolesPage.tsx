import { Badge, Button, Stack } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { deleteRole, getRoles } from '../../services/roleService.ts'
import { getAccounts } from '../../services/userService.ts'
import type { AppRole, UserAccount } from '../../types/models.ts'
import { notifyError, notifyApiError, notifySuccess } from '../../utils/notify.ts'
import { RoleForm } from './RoleForm.tsx'

export function RolesPage() {
  const { can } = usePermissions()
  const [roles, setRoles] = useState<AppRole[]>([])
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppRole | null>(null)
  const [deleting, setDeleting] = useState<AppRole | null>(null)
  const [busy, setBusy] = useState(false)
  const canSeeUsers = can('users', 'view')

  const load = useCallback(async () => {
    try {
      const [roleList, accountList] = await Promise.all([getRoles(), canSeeUsers ? getAccounts().catch(() => []) : Promise.resolve([])])
      setRoles(roleList)
      setAccounts(accountList)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [canSeeUsers])

  useEffect(() => {
    void load()
  }, [load])

  const usersOf = (role: AppRole) => accounts.filter((account) => account.roleId === role.id).length

  const open = (role: AppRole | null) => {
    setEditing(role)
    setFormOpen(true)
  }
  const remove = async () => {
    if (!deleting) return
    if (usersOf(deleting) > 0) {
      notifyError('Not deleted', 'Users still have this role. Move them to another role first.')
      setDeleting(null)
      return
    }
    setBusy(true)
    try {
      await deleteRole(deleting.id)
      notifySuccess('Role deleted', deleting.name)
      setDeleting(null)
      await load()
    } catch (failure) {
      notifyApiError(failure, 'Not deleted')
    } finally {
      setBusy(false)
    }
  }

  const rows = roles.map((role) => {
    const users = usersOf(role)
    const modules = Object.values(role.permissions).filter((actions) => actions && actions.length > 0).length
    const access = role.isAdmin ? 'Administrator' : 'Resident (owner or tenant)'
    return {
      key: role.id,
      cells: [
        <StackedCell key="name" primary={role.name} secondary={role.system ? 'Administrator role' : 'Custom role'} />,
        role.description || '—',
        access,
        role.isAdmin ? 'All modules' : `${modules} module${modules === 1 ? '' : 's'}`,
        String(users),
        <StatusBadge key="status" status={role.status} />,
      ],
      card: {
        title: role.name,
        subtitle: role.description,
        badge: <StatusBadge status={role.status} />,
        fields: [
          { label: 'Access level', value: access },
          { label: 'Modules', value: role.isAdmin ? 'All' : String(modules) },
          { label: 'Users', value: String(users) },
          {
            label: 'Type',
            value: role.system ? (
              <Badge size="xs" variant="outline" color="terracotta">
                Administrator
              </Badge>
            ) : (
              'Custom'
            ),
          },
        ],
      },
      actions: (
        <>
          {can('roles', 'edit') ? (
            <Button size="xs" variant="light" onClick={() => open(role)}>
              Edit
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
        description="Each role is either an administrator (every module, not linked to a flat) or a resident role with chosen modules and actions."
        action={
          can('roles', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
              Create role
            </Button>
          ) : null
        }
      />
      <LoadState loading={loading} error={error} onRetry={load}>
        {rows.length === 0 ? (
          <EmptyState title="No roles yet" message="Create a role for owners and tenants." />
        ) : (
          <ResponsiveList headers={['Role', 'Description', 'Access level', 'Permissions', 'Users', 'Status']} rows={rows} />
        )}
      </LoadState>
      <RoleForm opened={formOpen} role={editing} roles={roles} onClose={() => setFormOpen(false)} onSaved={() => void load()} />
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete role"
        message={deleting ? `Delete the ${deleting.name} role? Roles that still have users cannot be deleted.` : ''}
        confirmLabel="Delete role"
        loading={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
