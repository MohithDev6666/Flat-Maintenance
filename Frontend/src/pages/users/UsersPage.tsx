import { Button, Stack, TextInput } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import type { UserAccount } from '../../types/models.ts'
import { notifyResult } from '../../utils/notify.ts'
import { UserForm } from './UserForm.tsx'

export function UsersPage() {
  const { user } = useAuth()
  const { accounts, roles, owners, tenants, flats, setUserStatus } = useBuilding()
  const { can } = usePermissions()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [toggling, setToggling] = useState<UserAccount | null>(null)
  if (!user) return null

  const roleOf = (account: UserAccount) => roles.find((role) => role.id === account.roleId)
  const linkOf = (account: UserAccount) => {
    const resident = owners.find((owner) => owner.id === account.ownerId) ?? tenants.find((tenant) => tenant.id === account.tenantId)
    if (!resident) return { flat: '—', record: roleOf(account)?.kind === 'admin' ? 'Not linked' : 'Missing link' }
    const flat = flats.find((item) => item.id === resident.flatId)
    return {
      flat: flat ? `Flat ${flat.number} · floor ${flat.floor}` : '—',
      record: `${account.ownerId ? 'Owner' : 'Tenant'} · ${resident.name}`,
    }
  }
  const needle = query.trim().toLowerCase()
  const visible = accounts.filter(
    (account) => !needle || account.name.toLowerCase().includes(needle) || account.email.includes(needle),
  )

  const open = (account: UserAccount | null) => {
    setEditing(account)
    setFormOpen(true)
  }
  const confirmToggle = () => {
    if (!toggling) return
    const next = toggling.status === 'Active' ? 'Inactive' : 'Active'
    notifyResult(setUserStatus(toggling.id, next, user.name), {
      title: next === 'Active' ? 'User activated' : 'User deactivated',
      message: toggling.email,
    })
    setToggling(null)
  }

  const rows = visible.map((account) => {
    const link = linkOf(account)
    const roleName = roleOf(account)?.name ?? 'No role'
    return {
      key: account.id,
      cells: [
        <StackedCell key="name" primary={account.name} secondary={account.email} />,
        roleName,
        link.flat,
        link.record,
        <StatusBadge key="status" status={account.status} />,
      ],
      card: {
        title: account.name,
        subtitle: account.email,
        badge: <StatusBadge status={account.status} />,
        fields: [
          { label: 'Role', value: roleName },
          { label: 'Flat', value: link.flat },
          { label: 'Linked record', value: link.record },
        ],
      },
      actions: (
        <>
          {can('users', 'edit') ? (
            <Button size="xs" variant="light" onClick={() => open(account)}>
              Edit
            </Button>
          ) : null}
          {can('users', 'manage') && account.id !== user.id ? (
            <Button size="xs" variant="default" onClick={() => setToggling(account)}>
              {account.status === 'Active' ? 'Deactivate' : 'Activate'}
            </Button>
          ) : null}
        </>
      ),
    }
  })

  return (
    <Stack gap="lg">
      <PageHeading
        title="Users"
        description="Logins. Owner users link to an owner record, tenant users to a tenant record, and admins to neither."
        action={
          can('users', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
              Create user
            </Button>
          ) : null
        }
      />
      <TextInput
        maw={360}
        leftSection={<IconSearch size={16} />}
        placeholder="Search by name or email"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      {rows.length === 0 ? (
        <EmptyState title="No users match" />
      ) : (
        <ResponsiveList headers={['User', 'Role', 'Linked flat', 'Linked record', 'Status']} rows={rows} />
      )}
      <UserForm opened={formOpen} account={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        opened={toggling !== null}
        title={toggling?.status === 'Active' ? 'Deactivate user' : 'Activate user'}
        message={
          toggling
            ? toggling.status === 'Active'
              ? `${toggling.email} will not be able to log in until you activate it again.`
              : `${toggling.email} will be able to log in again.`
            : ''
        }
        confirmLabel={toggling?.status === 'Active' ? 'Deactivate' : 'Activate'}
        color={toggling?.status === 'Active' ? 'red' : 'terracotta'}
        onConfirm={confirmToggle}
        onClose={() => setToggling(null)}
      />
    </Stack>
  )
}
