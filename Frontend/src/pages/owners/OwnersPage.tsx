import { Anchor, Button, Divider, Modal, Stack, Text, TextInput } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DetailLine } from '../../components/common/DetailLine.tsx'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { paths } from '../../routes/nav.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { emptyBuilding, getBuilding } from '../../services/buildingService.ts'
import { getFlats } from '../../services/flatService.ts'
import { deleteOwner, getOwners } from '../../services/ownerService.ts'
import { getTenants } from '../../services/tenantService.ts'
import { getAccounts } from '../../services/userService.ts'
import type { Building, Flat, Owner, Tenant, UserAccount } from '../../types/models.ts'
import { activeTenantOf, flatStatus } from '../../utils/calculations.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'
import { OwnerForm } from './OwnerForm.tsx'

export function OwnersPage() {
  const { can } = usePermissions()
  const [owners, setOwners] = useState<Owner[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [flats, setFlats] = useState<Flat[]>([])
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [building, setBuilding] = useState<Building>(emptyBuilding)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Owner | null>(null)
  const [viewing, setViewing] = useState<Owner | null>(null)
  const [deleting, setDeleting] = useState<Owner | null>(null)
  const [busy, setBusy] = useState(false)
  const canSeeUsers = can('users', 'view')
  const canSeeBuilding = can('building', 'view')

  const load = useCallback(async () => {
    try {
      const [ownerList, tenantList, flatList, accountList, buildingRecord] = await Promise.all([
        getOwners(),
        getTenants(),
        getFlats(),
        canSeeUsers ? getAccounts().catch(() => []) : Promise.resolve([]),
        canSeeBuilding ? getBuilding().catch(() => emptyBuilding) : Promise.resolve(emptyBuilding),
      ])
      setOwners(ownerList)
      setTenants(tenantList)
      setFlats(flatList)
      setAccounts(accountList)
      setBuilding(buildingRecord)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [canSeeUsers, canSeeBuilding])

  useEffect(() => {
    void load()
  }, [load])

  const flatNumber = (flatId: string | null) => flats.find((flat) => flat.id === flatId)?.number ?? null
  const loginOf = (owner: Owner) => accounts.find((account) => account.ownerId === owner.id)?.email ?? 'No login yet'
  const tenantOf = (owner: Owner) => (owner.flatId ? activeTenantOf(tenants, owner.flatId) : null)
  const occupancyOf = (owner: Owner) => {
    const flat = flats.find((item) => item.id === owner.flatId)
    return flat ? flatStatus(flat, owners, tenants) : null
  }
  const needle = query.trim().toLowerCase()
  const visible = owners
    .filter(
      (owner) =>
        !needle ||
        owner.name.toLowerCase().includes(needle) ||
        owner.email.toLowerCase().includes(needle) ||
        (flatNumber(owner.flatId) ?? '').includes(needle),
    )
    .sort((left, right) => (flatNumber(left.flatId) ?? '').localeCompare(flatNumber(right.flatId) ?? '', undefined, { numeric: true }))

  const open = (owner: Owner | null) => {
    setEditing(owner)
    setFormOpen(true)
  }
  const remove = async () => {
    if (!deleting) return
    const login = accounts.find((account) => account.ownerId === deleting.id)
    if (login) {
      notifyApiError(new Error(`${login.email} is linked to this owner. Change or remove that user first.`), 'Not deleted')
      setDeleting(null)
      return
    }
    setBusy(true)
    try {
      await deleteOwner(deleting.id)
      notifySuccess('Owner deleted', deleting.name)
      setDeleting(null)
      await load()
    } catch (failure) {
      notifyApiError(failure, 'Not deleted')
    } finally {
      setBusy(false)
    }
  }

  const rows = visible.map((owner) => {
    const tenant = tenantOf(owner)
    const flat = flatNumber(owner.flatId)
    const occupancy = occupancyOf(owner)
    const occupancyBadge = occupancy ? <StatusBadge status={occupancy} /> : <Text size="sm" c="dimmed">—</Text>
    return {
      key: owner.id,
      cells: [
        <StackedCell key="name" primary={owner.name} secondary={owner.email} />,
        formatPhone(owner.phone),
        flat ? `Flat ${flat}` : 'No flat yet',
        occupancyBadge,
        tenant?.name ?? 'None',
        loginOf(owner),
      ],
      card: {
        title: owner.name,
        subtitle: owner.email,
        badge: occupancy ? <StatusBadge status={occupancy} /> : undefined,
        fields: [
          { label: 'Phone', value: formatPhone(owner.phone) },
          { label: 'Flat', value: flat ? `Flat ${flat}` : 'No flat yet' },
          { label: 'Tenant', value: tenant?.name ?? 'None' },
          { label: 'Login', value: loginOf(owner) },
        ],
      },
      actions: (
        <>
          <Button size="xs" variant="default" onClick={() => setViewing(owner)}>
            View
          </Button>
          {can('owners', 'edit') ? (
            <Button size="xs" variant="light" onClick={() => open(owner)}>
              Edit
            </Button>
          ) : null}
          {can('owners', 'delete') && !owner.flatId ? (
            <Button size="xs" variant="subtle" color="red" onClick={() => setDeleting(owner)}>
              Delete
            </Button>
          ) : null}
        </>
      ),
    }
  })

  const viewingTenant = viewing ? tenantOf(viewing) : null

  return (
    <Stack gap="lg">
      <PageHeading
        title="Owners"
        description="Assign each owner to their flat here. Every flat has one permanent owner who may live there or rent it out. When a flat is sold, add the new owner and choose that flat to transfer it. Logins are created on Admin → Users."
        action={
          can('owners', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
              Add owner
            </Button>
          ) : null
        }
      />
      <TextInput
        maw={360}
        leftSection={<IconSearch size={16} />}
        placeholder="Search by name, email, or flat"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <LoadState loading={loading} error={error} onRetry={load}>
        {rows.length === 0 ? (
          <EmptyState title={owners.length === 0 ? 'No owners yet' : 'No owners match'} message="Add an owner and link them to a flat." />
        ) : (
          <ResponsiveList headers={['Owner', 'Phone', 'Flat', 'Occupancy', 'Tenant', 'Login']} rows={rows} />
        )}
      </LoadState>

      <OwnerForm
        opened={formOpen}
        owner={editing}
        owners={owners}
        flats={flats}
        building={building}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
      <Modal opened={viewing !== null} onClose={() => setViewing(null)} title={viewing?.name ?? 'Owner'}>
        {viewing ? (
          <Stack gap={6}>
            <DetailLine label="Phone" value={formatPhone(viewing.phone)} />
            <DetailLine label="Email" value={viewing.email} />
            <DetailLine label="Flat" value={flatNumber(viewing.flatId) ? `Flat ${flatNumber(viewing.flatId)}` : 'Not linked'} />
            <DetailLine label="Address" value={viewing.address} />
            <DetailLine label="Emergency contact" value={viewing.emergency} />
            <DetailLine label="Login" value={loginOf(viewing)} />
            <Divider my="xs" color="sand.2" />
            <Text size="xs" tt="uppercase" fw={700} c="sand.7">
              Tenant
            </Text>
            {viewingTenant ? (
              <>
                <DetailLine label="Name" value={viewingTenant.name} />
                <DetailLine label="Phone" value={formatPhone(viewingTenant.phone)} />
                <DetailLine label="Email" value={viewingTenant.email} />
              </>
            ) : (
              <Text size="sm" c="dimmed">
                No active tenant.
              </Text>
            )}
            <Anchor component={Link} to={paths.adminTenants} size="sm" c="terracotta.8" mt="xs">
              Open Tenants
            </Anchor>
          </Stack>
        ) : null}
      </Modal>
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete owner"
        message={deleting ? `Delete ${deleting.name}? Owners with payments or a linked login cannot be deleted.` : ''}
        confirmLabel="Delete owner"
        loading={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
