import { Anchor, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../../routes/nav.ts'
import { createFlat, updateFlat } from '../../services/flatService.ts'
import type { Flat, OccupancyStatus, Owner, Tenant } from '../../types/models.ts'
import { activeTenantOf, ownerOf } from '../../utils/calculations.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyError, notifyApiError, notifySuccess } from '../../utils/notify.ts'

interface FlatFormValues {
  number: string
  floor: string
  status: OccupancyStatus
}

/**
 * Flats master: only the flat's own fields. Owners are assigned on the Owners master and tenants on
 * the Tenants master, so each link has exactly one place where it is changed.
 */
export function FlatForm({
  opened,
  flat,
  flats,
  owners,
  tenants,
  floors,
  onClose,
  onSaved,
}: {
  opened: boolean
  flat: Flat | null
  flats: Flat[]
  owners: Owner[]
  tenants: Tenant[]
  /** Number of floors from Building Information (0 when it is not set up yet). */
  floors: number
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const form = useForm<FlatFormValues>({
    initialValues: { number: '', floor: '1', status: 'Available' },
    validate: {
      number: (value) =>
        !value.trim()
          ? 'Enter the flat number'
          : flats.some((item) => item.number === value.trim() && item.id !== flat?.id)
            ? 'That flat number already exists'
            : null,
      floor: (value) => (value ? null : 'Choose the floor'),
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues({ number: flat?.number ?? '', floor: String(flat?.floor ?? 1), status: flat?.status ?? 'Available' })
    form.resetDirty()
    // Reset only when the dialog opens or the edited flat changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, flat])

  const owner = flat ? ownerOf(owners, flat.id) : null
  const tenant = flat ? activeTenantOf(tenants, flat.id) : null
  // Floors come from Building Information; keep the flat's current floor selectable even beyond that.
  const floorCount = Math.max(floors, flat?.floor ?? 0, 1)
  const floorChoices = Array.from({ length: floorCount }, (_, index) => String(index + 1))

  const save = async (values: FlatFormValues) => {
    if (values.status === 'Available' && tenant) {
      notifyError('Not saved', `${tenant.name} lives in this flat. Set their move-out date on Admin → Tenants to make it Available.`)
      return
    }
    const input = { number: values.number, floor: Number(values.floor), status: values.status }
    setSaving(true)
    try {
      if (flat) await updateFlat(flat.id, input)
      else await createFlat(input)
      notifySuccess(flat ? 'Flat updated' : 'Flat added', `Flat ${values.number.trim()}`)
      onSaved()
      onClose()
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={flat ? `Edit flat ${flat.number}` : 'Add flat'} size="lg">
      <form onSubmit={form.onSubmit((values) => void save(values))}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Flat no" required placeholder="e.g. 501" {...form.getInputProps('number')} />
            <Select
              label="Floor"
              required
              allowDeselect={false}
              data={floorChoices.map((value) => ({ value, label: `Floor ${value}` }))}
              {...form.getInputProps('floor')}
            />
            <Select
              label="Status"
              required
              allowDeselect={false}
              data={[
                { value: 'Occupied', label: 'Occupied' },
                { value: 'Available', label: 'Available', disabled: tenant !== null },
              ]}
              {...form.getInputProps('status')}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Occupied: the owner or a tenant lives here. Available: nobody lives here. Adding a tenant sets Occupied, and their
            move-out sets Available.
          </Text>

          <Card withBorder padding="sm" bg="sand.0">
            <Text size="xs" tt="uppercase" fw={700} c="sand.7" mb={6}>
              Linked residents
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <div>
                <Text size="sm" c="dimmed">
                  Owner
                </Text>
                <Text size="sm" fw={600}>
                  {owner ? `${owner.name} · ${formatPhone(owner.phone)}` : 'Not assigned yet'}
                </Text>
                <Anchor component={Link} to={paths.adminOwners} size="xs" c="terracotta.8" onClick={onClose}>
                  Assign on Owners
                </Anchor>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Tenant living here
                </Text>
                <Text size="sm" fw={600}>
                  {tenant ? `${tenant.name} · ${formatPhone(tenant.phone)}` : 'None'}
                </Text>
                <Anchor component={Link} to={paths.adminTenants} size="xs" c="terracotta.8" onClick={onClose}>
                  Assign on Tenants
                </Anchor>
              </div>
            </SimpleGrid>
          </Card>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {flat ? 'Save flat' : 'Add flat'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
