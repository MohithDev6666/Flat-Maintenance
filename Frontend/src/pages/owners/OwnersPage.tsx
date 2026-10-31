import { Anchor, Button, Divider, Modal, Stack, Text, TextInput } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DetailLine } from '../../components/common/DetailLine.tsx'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { paths } from '../../routes/nav.ts'
import type { Owner } from '../../types/models.ts'
import { activeTenantOf, flatStatus } from '../../utils/calculations.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyResult } from '../../utils/notify.ts'
import { OwnerForm } from './OwnerForm.tsx'

export function OwnersPage() {
  const { user } = useAuth()
  const { owners, tenants, flats, accounts, deleteOwner } = useBuilding()
  const { can } = usePermissions()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Owner | null>(null)
  const [viewing, setViewing] = useState<Owner | null>(null)
  const [deleting, setDeleting] = useState<Owner | null>(null)
  if (!user) return null

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
  const remove = () => {
    if (!deleting) return
    notifyResult(deleteOwner(deleting.id, user.name), { title: 'Owner deleted', message: deleting.name }, 'Not deleted')
    setDeleting(null)
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
      {rows.length === 0 ? (
        <EmptyState title={owners.length === 0 ? 'No owners yet' : 'No owners match'} message="Add an owner and link them to a flat." />
      ) : (
        <ResponsiveList headers={['Owner', 'Phone', 'Flat', 'Occupancy', 'Tenant', 'Login']} rows={rows} />
      )}

      <OwnerForm opened={formOpen} owner={editing} onClose={() => setFormOpen(false)} />
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
        message={deleting ? `Delete ${deleting.name}? Their flat will have no owner until you add or link one.` : ''}
        confirmLabel="Delete owner"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
