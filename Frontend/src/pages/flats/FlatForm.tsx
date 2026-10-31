import { Anchor, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { paths } from '../../routes/nav.ts'
import type { Flat, OccupancyStatus } from '../../types/models.ts'
import { activeTenantOf, ownerOf } from '../../utils/calculations.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyResult } from '../../utils/notify.ts'

interface FlatFormValues {
  number: string
  floor: string
  status: OccupancyStatus
}

/**
 * Flats master: only the flat's own fields. Owners are assigned on the Owners master and tenants on
 * the Tenants master, so each link has exactly one place where it is changed.
 */
export function FlatForm({ opened, flat, onClose }: { opened: boolean; flat: Flat | null; onClose: () => void }) {
  const { user } = useAuth()
  const { owners, tenants, flats, building, saveFlat } = useBuilding()
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

  if (!user) return null

  const owner = flat ? ownerOf(owners, flat.id) : null
  const tenant = flat ? activeTenantOf(tenants, flat.id) : null
  const floorChoices = Array.from({ length: building.floors }, (_, index) => String(index + 1))

  const save = (values: FlatFormValues) => {
    const done = notifyResult(
      saveFlat({ id: flat?.id ?? null, number: values.number, floor: Number(values.floor), status: values.status }, user.name),
      { title: flat ? 'Flat updated' : 'Flat added', message: `Flat ${values.number.trim()}` },
    )
    if (done) onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={flat ? `Edit flat ${flat.number}` : 'Add flat'} size="lg">
      <form onSubmit={form.onSubmit(save)}>
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
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{flat ? 'Save flat' : 'Add flat'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
