import { Button, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { FileUploadField } from '../../components/common/FileUploadField.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { idProofTypes, type Attachment, type IdProofType, type Tenant } from '../../types/models.ts'
import { flatStatus, ownerOf, sortByFlatNumber } from '../../utils/calculations.ts'
import { formatPhone } from '../../utils/format.ts'

const occupantChoices = Array.from({ length: 10 }, (_, index) => String(index + 1))
import { notifyResult } from '../../utils/notify.ts'

interface TenantFormValues {
  name: string
  phone: string
  email: string
  flatId: string
  occupants: string
  moveIn: string | null
  moveOut: string | null
  agreementEnd: string | null
  idProofType: IdProofType
  idProof: Attachment | null
  emergency: string
  vehicle: string
}

const empty: TenantFormValues = {
  name: '',
  phone: '',
  email: '',
  flatId: '',
  occupants: '1',
  moveIn: null,
  moveOut: null,
  agreementEnd: null,
  idProofType: 'Aadhaar',
  idProof: null,
  emergency: '',
  vehicle: '',
}

export function TenantForm({ opened, tenant, onClose }: { opened: boolean; tenant: Tenant | null; onClose: () => void }) {
  const { user } = useAuth()
  const { flats, owners, tenants, saveTenant } = useBuilding()
  const form = useForm<TenantFormValues>({
    initialValues: empty,
    validate: {
      name: (value) => (value.trim() ? null : 'Enter the tenant’s name'),
      phone: (value) => (/^[\d\s+-]{7,15}$/.test(value.trim()) ? null : 'Enter a valid phone number'),
      email: (value) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Enter a valid email'),
      flatId: (value) => (value ? null : 'Choose a flat'),
      occupants: (value) => (Number(value) >= 1 ? null : 'At least 1 occupant'),
      moveIn: (value) => (value ? null : 'Choose the move-in date'),
      moveOut: (value, values) => (value && values.moveIn && value < values.moveIn ? 'Move-out cannot be before move-in' : null),
      agreementEnd: (value) => (value ? null : 'Choose the agreement end date'),
      emergency: (value) => (value.trim() ? null : 'Enter an emergency contact'),
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(tenant ? { ...tenant, flatId: tenant.flatId ?? '', occupants: String(tenant.occupants) } : empty)
    form.resetDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, tenant])

  if (!user) return null

  const owner = ownerOf(owners, form.values.flatId || null)

  const save = (values: TenantFormValues) => {
    if (!values.moveIn || !values.agreementEnd) return
    const done = notifyResult(
      saveTenant(
        {
          id: tenant?.id ?? `tenant-${crypto.randomUUID()}`,
          name: values.name,
          phone: values.phone,
          email: values.email,
          flatId: values.flatId || null,
          occupants: Number(values.occupants),
          moveIn: values.moveIn,
          moveOut: values.moveOut || null,
          agreementEnd: values.agreementEnd,
          idProofType: values.idProofType,
          idProof: values.idProof,
          emergency: values.emergency,
          vehicle: values.vehicle,
        },
        user.name,
      ),
      { title: tenant ? 'Tenant updated' : 'Tenant added', message: `${values.name.trim()} · flat occupancy updated` },
    )
    if (done) onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={tenant ? 'Edit tenant' : 'Add tenant'} size="lg">
      <form onSubmit={form.onSubmit(save)}>
        <Stack gap="sm">
          <TextInput label="Tenant name" required {...form.getInputProps('name')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Phone number" required inputMode="tel" {...form.getInputProps('phone')} />
            <TextInput label="Email" required {...form.getInputProps('email')} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Flat"
              required
              searchable
              description="Each flat is listed with its owner and who lives there today."
              data={sortByFlatNumber(flats).map((flat) => ({
                value: flat.id,
                label: `Flat ${flat.number} · ${ownerOf(owners, flat.id)?.name ?? 'no owner'} · ${flatStatus(flat, owners, tenants)}`,
              }))}
              allowDeselect={false}
              {...form.getInputProps('flatId')}
            />
            <TextInput
              label="Owner"
              readOnly
              description="Linked through the flat."
              placeholder="Choose a flat"
              value={owner ? `${owner.name} · ${formatPhone(owner.phone)}` : ''}
            />
          </SimpleGrid>
          <Select
            label="Occupants"
            required
            allowDeselect={false}
            w={{ base: '100%', sm: '50%' }}
            data={occupantChoices}
            {...form.getInputProps('occupants')}
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <DatePickerInput label="Move-in date" required valueFormat="DD-MM-YYYY" {...form.getInputProps('moveIn')} />
            <DatePickerInput
              label="Move-out date"
              valueFormat="DD-MM-YYYY"
              clearable
              placeholder="Still living here"
              {...form.getInputProps('moveOut')}
            />
            <DatePickerInput label="Agreement end date" required valueFormat="DD-MM-YYYY" {...form.getInputProps('agreementEnd')} />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            The active tenant is whoever has moved in and not yet moved out. Two tenancies in the same flat cannot overlap.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Emergency contact" required placeholder="Name · phone" {...form.getInputProps('emergency')} />
            <TextInput label="Vehicle number" placeholder="Optional" {...form.getInputProps('vehicle')} />
          </SimpleGrid>
          <Select
            label="ID proof type"
            required
            allowDeselect={false}
            w={{ base: '100%', sm: '50%' }}
            data={idProofTypes}
            {...form.getInputProps('idProofType')}
          />
          <FileUploadField
            label="ID proof"
            description="Private. Only the admin and this flat’s owner can open it."
            value={form.values.idProof}
            onChange={(file) => form.setFieldValue('idProof', file)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{tenant ? 'Save tenant' : 'Add tenant'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
