import { Button, Stack, TextInput } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getFlats } from '../../services/flatService.ts'
import { getOwners } from '../../services/ownerService.ts'
import { getRoles } from '../../services/roleService.ts'
import { getTenants } from '../../services/tenantService.ts'
import { deleteUser, getAccounts, setUserStatus } from '../../services/userService.ts'
import type { AppRole, Flat, Owner, Tenant, UserAccount } from '../../types/models.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'
import { UserForm } from './UserForm.tsx'

export function UsersPage() {
  const { user } = useAuth()
  const { can } = usePermissions()
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [flats, setFlats] = useState<Flat[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [toggling, setToggling] = useState<UserAccount | null>(null)
  const [deleting, setDeleting] = useState<UserAccount | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      // Roles, flats, owners, and tenants feed the form's dropdowns.
      const [accountList, roleList, flatList, ownerList, tenantList] = await Promise.all([
        getAccounts(),
        getRoles(),
        getFlats(),
        getOwners(),
        getTenants(),
      ])
      setAccounts(accountList)
      setRoles(roleList)
      setFlats(flatList)
      setOwners(ownerList)
      setTenants(tenantList)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) return null

  const roleOf = (account: UserAccount) => roles.find((role) => role.id === account.roleId)
  const linkOf = (account: UserAccount) => {
    const resident = owners.find((owner) => owner.id === account.ownerId) ?? tenants.find((tenant) => tenant.id === account.tenantId)
    if (!resident) return { flat: '—', record: account.isAdmin || roleOf(account)?.isAdmin ? 'Not linked' : 'Missing link' }
    const flat = flats.find((item) => item.id === resident.flatId)
    return {
      flat: flat ? `Flat ${flat.number} · floor ${flat.floor}` : '—',
      record: `${account.ownerId ? 'Owner' : 'Tenant'} · ${resident.name}`,
    }
  }
  const needle = query.trim().toLowerCase()
  const visible = accounts.filter(
    (account) => !needle || account.name.toLowerCase().includes(needle) || account.email.toLowerCase().includes(needle),
  )

  const open = (account: UserAccount | null) => {
    setEditing(account)
    setFormOpen(true)
  }

  const confirmToggle = async () => {
    if (!toggling) return
    const next = toggling.status === 'Active' ? 'Inactive' : 'Active'
    setBusy(true)
    try {
      await setUserStatus(toggling.id, next)
      notifySuccess(next === 'Active' ? 'User activated' : 'User deactivated', toggling.email)
      setToggling(null)
      await load()
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteUser(deleting.id)
      notifySuccess('User deleted', deleting.email)
      setDeleting(null)
      await load()
    } catch (failure) {
      notifyApiError(failure, 'Not deleted')
    } finally {
      setBusy(false)
    }
  }

  const rows = visible.map((account) => {
    const link = linkOf(account)
    const roleName = roleOf(account)?.name ?? (account.roleName || 'No role')
    const self = account.id === user.id
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
          {can('users', 'edit') && !self ? (
            <Button size="xs" variant="default" onClick={() => setToggling(account)}>
              {account.status === 'Active' ? 'Deactivate' : 'Activate'}
            </Button>
          ) : null}
          {can('users', 'delete') && !self ? (
            <Button size="xs" variant="subtle" color="red" onClick={() => setDeleting(account)}>
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
        title="Users"
        description="Logins. Owner users link to an owner record, tenant users to a tenant record, and administrators to neither."
        action={
          can('users', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)} disabled={loading}>
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
      <LoadState loading={loading} error={error} onRetry={load}>
        {rows.length === 0 ? (
          <EmptyState title={accounts.length === 0 ? 'No users yet' : 'No users match'} />
        ) : (
          <ResponsiveList headers={['User', 'Role', 'Linked flat', 'Linked record', 'Status']} rows={rows} />
        )}
      </LoadState>
      <UserForm
        opened={formOpen}
        account={editing}
        currentUser={user}
        roles={roles}
        flats={flats}
        owners={owners}
        tenants={tenants}
        accounts={accounts}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
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
        loading={busy}
        onConfirm={() => void confirmToggle()}
        onClose={() => setToggling(null)}
      />
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete user"
        message={deleting ? `Delete the login ${deleting.email}? To keep the history, deactivate it instead.` : ''}
        confirmLabel="Delete user"
        loading={busy}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
