import { Button, Group, Modal, SegmentedControl, Stack, TextInput } from '@mantine/core'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { DetailLine } from '../../components/common/DetailLine.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import type { Attachment, Tenant } from '../../types/models.ts'
import { ownerOf, tenancyState } from '../../utils/calculations.ts'
import { formatDate, formatPhone } from '../../utils/format.ts'
import { notifyResult } from '../../utils/notify.ts'
import { canSeeIdProof } from '../../utils/permissions.ts'
import { TenantForm } from './TenantForm.tsx'

type Filter = 'all' | 'Active' | 'Upcoming' | 'Past'

export function TenantsPage() {
  const { user } = useAuth()
  const { tenants, owners, flats, accounts, deleteTenant } = useBuilding()
  const { can } = usePermissions()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [viewing, setViewing] = useState<Tenant | null>(null)
  const [deleting, setDeleting] = useState<Tenant | null>(null)
  const [proof, setProof] = useState<Attachment | null>(null)
  if (!user) return null

  const flatNumber = (flatId: string | null) => flats.find((flat) => flat.id === flatId)?.number ?? null
  const loginOf = (tenant: Tenant) => accounts.find((account) => account.tenantId === tenant.id)?.email ?? 'No login yet'
  const stay = (tenant: Tenant) => `${formatDate(tenant.moveIn)} → ${tenant.moveOut ? formatDate(tenant.moveOut) : 'present'}`
  const needle = query.trim().toLowerCase()
  const visible = tenants
    .filter((tenant) => filter === 'all' || tenancyState(tenant) === filter)
    .filter(
      (tenant) =>
        !needle ||
        tenant.name.toLowerCase().includes(needle) ||
        tenant.email.toLowerCase().includes(needle) ||
        (flatNumber(tenant.flatId) ?? '').includes(needle),
    )
    .sort(
      (left, right) =>
        (flatNumber(left.flatId) ?? '').localeCompare(flatNumber(right.flatId) ?? '', undefined, { numeric: true }) ||
        right.moveIn.localeCompare(left.moveIn),
    )

  const open = (tenant: Tenant | null) => {
    setEditing(tenant)
    setFormOpen(true)
  }
  const remove = () => {
    if (!deleting) return
    notifyResult(deleteTenant(deleting.id, user.name), { title: 'Tenant deleted', message: deleting.name }, 'Not deleted')
    setDeleting(null)
  }

  const rows = visible.map((tenant) => {
    const owner = ownerOf(owners, tenant.flatId)
    const state = tenancyState(tenant)
    const flat = flatNumber(tenant.flatId)
    return {
      key: tenant.id,
      cells: [
        <StackedCell key="name" primary={tenant.name} secondary={formatPhone(tenant.phone)} />,
        flat ? `Flat ${flat}` : 'Not linked',
        owner?.name ?? 'No owner',
        stay(tenant),
        <StatusBadge key="state" status={state} />,
        loginOf(tenant),
      ],
      card: {
        title: tenant.name,
        subtitle: flat ? `Flat ${flat}` : 'Not linked',
        badge: <StatusBadge status={state} />,
        fields: [
          { label: 'Phone', value: formatPhone(tenant.phone) },
          { label: 'Owner', value: owner?.name ?? 'No owner' },
          { label: 'Stay', value: stay(tenant) },
          { label: 'Login', value: loginOf(tenant) },
        ],
      },
      actions: (
        <>
          <Button size="xs" variant="default" onClick={() => setViewing(tenant)}>
            View
          </Button>
          {can('tenants', 'edit') ? (
            <Button size="xs" variant="light" onClick={() => open(tenant)}>
              Edit
            </Button>
          ) : null}
          {can('tenants', 'delete') ? (
            <Button size="xs" variant="subtle" color="red" onClick={() => setDeleting(tenant)}>
              Delete
            </Button>
          ) : null}
        </>
      ),
    }
  })

  const viewingOwner = viewing ? ownerOf(owners, viewing.flatId) : null

  return (
    <Stack gap="lg">
      <PageHeading
        title="Tenants"
        description="Current, upcoming, and past tenancies. A tenant is active between their move-in and move-out dates, and that sets the flat to Rented."
        action={
          can('tenants', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
              Add tenant
            </Button>
          ) : null
        }
      />
      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          data={[
            { label: 'All', value: 'all' },
            { label: 'Active', value: 'Active' },
            { label: 'Upcoming', value: 'Upcoming' },
            { label: 'Past', value: 'Past' },
          ]}
        />
        <TextInput
          w={{ base: '100%', sm: 300 }}
          leftSection={<IconSearch size={16} />}
          placeholder="Search by name, email, or flat"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </Group>
      {rows.length === 0 ? (
        <EmptyState title={tenants.length === 0 ? 'No tenants yet' : 'No tenants match'} message="Add a tenant and link them to a flat." />
      ) : (
        <ResponsiveList headers={['Tenant', 'Flat', 'Owner', 'Stay', 'Status', 'Login']} rows={rows} />
      )}

      <TenantForm opened={formOpen} tenant={editing} onClose={() => setFormOpen(false)} />
      <Modal opened={viewing !== null} onClose={() => setViewing(null)} title={viewing?.name ?? 'Tenant'}>
        {viewing ? (
          <Stack gap={6}>
            <Group>
              <StatusBadge status={tenancyState(viewing)} />
            </Group>
            <DetailLine label="Flat" value={flatNumber(viewing.flatId) ? `Flat ${flatNumber(viewing.flatId)}` : 'Not linked'} />
            <DetailLine label="Owner" value={viewingOwner ? `${viewingOwner.name} · ${formatPhone(viewingOwner.phone)}` : 'No owner'} />
            <DetailLine label="Phone" value={formatPhone(viewing.phone)} />
            <DetailLine label="Email" value={viewing.email} />
            <DetailLine label="Occupants" value={String(viewing.occupants)} />
            <DetailLine label="Move-in" value={formatDate(viewing.moveIn)} />
            <DetailLine label="Move-out" value={viewing.moveOut ? formatDate(viewing.moveOut) : 'Still living here'} />
            <DetailLine label="Agreement end" value={formatDate(viewing.agreementEnd)} />
            <DetailLine label="Emergency contact" value={viewing.emergency} />
            <DetailLine label="Vehicle" value={viewing.vehicle || '—'} />
            <DetailLine label="Login" value={loginOf(viewing)} />
            {canSeeIdProof(user, viewing.flatId) ? <DetailLine label="ID proof type" value={viewing.idProofType} /> : null}
            {canSeeIdProof(user, viewing.flatId) ? (
              viewing.idProof ? (
                <Button variant="light" w="fit-content" mt="xs" onClick={() => setProof(viewing.idProof)}>
                  View ID proof
                </Button>
              ) : (
                <DetailLine label="ID proof" value="Not uploaded" />
              )
            ) : null}
          </Stack>
        ) : null}
      </Modal>
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete tenant"
        message={
          deleting
            ? `Delete ${deleting.name}? To keep their history, set a move-out date instead. Tenants with payments cannot be deleted.`
            : ''
        }
        confirmLabel="Delete tenant"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
      <FilePreview file={proof} title="ID proof" note="Private to the admin and the owner of this flat." onClose={() => setProof(null)} />
    </Stack>
  )
}
