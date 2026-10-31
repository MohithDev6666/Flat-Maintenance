import { Alert, Button, Group, Modal, Stack } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import type { Attachment, Flat } from '../../types/models.ts'
import { activeTenantOf, occupiedBy, ownerOf, sortByFlatNumber } from '../../utils/calculations.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyResult } from '../../utils/notify.ts'
import { FlatDetails } from './FlatDetails.tsx'
import { FlatForm } from './FlatForm.tsx'

/** Admin → Flats. Same flat data and detail card as the common Flats page, plus add, edit, and delete. */
export function FlatManagementPage() {
  const { user } = useAuth()
  const { flats, owners, tenants, accounts, building, deleteFlat } = useBuilding()
  const { can } = usePermissions()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Flat | null>(null)
  const [viewing, setViewing] = useState<Flat | null>(null)
  const [deleting, setDeleting] = useState<Flat | null>(null)
  const [proof, setProof] = useState<Attachment | null>(null)
  if (!user) return null

  const open = (flat: Flat | null) => {
    setEditing(flat)
    setFormOpen(true)
  }
  const remove = () => {
    if (!deleting) return
    notifyResult(deleteFlat(deleting.id, user.name), { title: 'Flat deleted', message: `Flat ${deleting.number}` }, 'Not deleted')
    setDeleting(null)
  }
  const ownerLogin = (ownerId: string | undefined) => accounts.find((account) => account.ownerId === ownerId)?.email ?? 'No login yet'

  const rows = sortByFlatNumber(flats).map((flat) => {
    const owner = ownerOf(owners, flat.id)
    const tenant = activeTenantOf(tenants, flat.id)
    const who = occupiedBy(flat, tenants)
    return {
      key: flat.id,
      cells: [
        <StackedCell key="flat" primary={`Flat ${flat.number}`} secondary={`Floor ${flat.floor}`} />,
        <StatusBadge key="status" status={flat.status} />,
        who ?? '—',
        <StackedCell key="owner" primary={owner?.name ?? 'Not assigned'} secondary={owner ? formatPhone(owner.phone) : undefined} />,
        <StackedCell key="tenant" primary={tenant?.name ?? 'None'} secondary={tenant ? formatPhone(tenant.phone) : undefined} />,
        ownerLogin(owner?.id),
      ],
      card: {
        title: `Flat ${flat.number}`,
        subtitle: `Floor ${flat.floor}`,
        badge: <StatusBadge status={flat.status} />,
        fields: [
          { label: 'Occupied by', value: who ?? '—' },
          { label: 'Owner', value: owner ? `${owner.name} · ${formatPhone(owner.phone)}` : 'Not assigned' },
          { label: 'Tenant', value: tenant ? tenant.name : 'None' },
          { label: 'Owner login', value: ownerLogin(owner?.id) },
        ],
      },
      actions: (
        <>
          <Button size="xs" variant="default" onClick={() => setViewing(flat)}>
            View
          </Button>
          {can('flatManagement', 'edit') ? (
            <Button size="xs" variant="light" onClick={() => open(flat)}>
              Edit
            </Button>
          ) : null}
          {can('flatManagement', 'delete') ? (
            <Button size="xs" variant="subtle" color="red" onClick={() => setDeleting(flat)}>
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
        title="Flats"
        description="Flat no, floor, and whether it is Occupied or Available. Owners are assigned on Admin → Owners and tenants on Admin → Tenants; they show here once linked."
        action={
          can('flatManagement', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
              Add flat
            </Button>
          ) : null
        }
      />
      {flats.length !== building.totalFlats ? (
        <Alert color="yellow" variant="light" title="Flat count">
          Building Information says {building.totalFlats} flats, and {flats.length} are set up here. Shares are split across the{' '}
          {flats.length} flats listed.
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No flats yet" message="Add the first flat to start linking owners and tenants." />
      ) : (
        <ResponsiveList headers={['Flat', 'Status', 'Occupied by', 'Owner', 'Tenant', 'Owner login']} rows={rows} />
      )}

      <FlatForm opened={formOpen} flat={editing} onClose={() => setFormOpen(false)} />
      <Modal opened={viewing !== null} onClose={() => setViewing(null)} title="Flat details" size="lg">
        {viewing ? (
          <Stack gap="sm">
            <FlatDetails flat={viewing} viewer={user} onViewProof={setProof} showHistory bordered />
            {can('flatManagement', 'edit') ? (
              <Group justify="flex-end">
                <Button
                  variant="light"
                  onClick={() => {
                    open(viewing)
                    setViewing(null)
                  }}
                >
                  Edit flat
                </Button>
              </Group>
            ) : null}
          </Stack>
        ) : null}
      </Modal>
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete flat"
        message={deleting ? `Delete flat ${deleting.number}? A flat with an owner, tenants, or payments cannot be deleted.` : ''}
        confirmLabel="Delete flat"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
      <FilePreview file={proof} title="ID proof" note="Private to the admin and the owner of this flat." onClose={() => setProof(null)} />
    </Stack>
  )
}
