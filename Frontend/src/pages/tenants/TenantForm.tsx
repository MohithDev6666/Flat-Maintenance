import { Button, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { FileUploadField } from '../../components/common/FileUploadField.tsx'
import { createTenant, updateTenant } from '../../services/tenantService.ts'
import { idProofTypes, type Attachment, type Flat, type IdProofType, type Owner, type Tenant } from '../../types/models.ts'
import { flatStatus, occupiedBy, ownerOf, sortByFlatNumber } from '../../utils/calculations.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'

const occupantChoices = Array.from({ length: 10 }, (_, index) => String(index + 1))

/** Date pickers may hand back a Date or a string; the API wants YYYY-MM-DD. */
function isoDate(value: string | null): string | null {
  return value ? dayjs(value).format('YYYY-MM-DD') : null
}

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

export function TenantForm({
  opened,
  tenant,
  tenants,
  owners,
  flats,
  onClose,
  onSaved,
}: {
  opened: boolean
  tenant: Tenant | null
  tenants: Tenant[]
  owners: Owner[]
  flats: Flat[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const form = useForm<TenantFormValues>({
    initialValues: empty,
    validate: {
      name: (value) => (value.trim() ? null : 'Enter the tenant’s name'),
      phone: (value) => (/^[\d\s+-]{7,15}$/.test(value.trim()) ? null : 'Enter a valid phone number'),
      email: (value) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Enter a valid email'),
      flatId: (value) => (value ? null : 'Choose a flat'),
      occupants: (value) => (Number(value) >= 1 ? null : 'At least 1 occupant'),
      moveIn: (value) => (value ? null : 'Choose the move-in date'),
      moveOut: (value, values) =>
        value && values.moveIn && dayjs(value).isBefore(dayjs(values.moveIn), 'day') ? 'Move-out cannot be before move-in' : null,
      agreementEnd: (value) => (value ? null : 'Choose the agreement end date'),
      emergency: (value) => (value.trim() ? null : 'Enter an emergency contact'),
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(tenant ? { ...tenant, flatId: tenant.flatId ?? '', occupants: String(tenant.occupants) } : empty)
    form.resetDirty()
    form.clearErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, tenant])

  const owner = ownerOf(owners, form.values.flatId || null)

  const save = async (values: TenantFormValues) => {
    const moveIn = isoDate(values.moveIn)
    const agreementEnd = isoDate(values.agreementEnd)
    if (!moveIn || !agreementEnd) return
    const input = {
      name: values.name,
      phone: values.phone,
      email: values.email,
      flatId: values.flatId || null,
      occupants: Number(values.occupants),
      moveIn,
      moveOut: isoDate(values.moveOut),
      agreementEnd,
      idProofType: values.idProofType,
      idProof: values.idProof,
      emergency: values.emergency,
      vehicle: values.vehicle,
    }
    setSaving(true)
    try {
      if (tenant) await updateTenant(tenant.id, input)
      else await createTenant(input)
      notifySuccess(tenant ? 'Tenant updated' : 'Tenant added', `${values.name.trim()} · flat occupancy updated`)
      onSaved()
      onClose()
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={tenant ? 'Edit tenant' : 'Add tenant'} size="lg">
      <form onSubmit={form.onSubmit((values) => void save(values))}>
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
              description="Flats the owner lives in cannot be rented out and are greyed out."
              data={sortByFlatNumber(flats).map((flat) => {
                // A flat the owner lives in takes no tenant; the tenant's own flat stays selectable when editing.
                const ownerLivesHere = occupiedBy(flat, tenants) === 'Owner' && flat.id !== tenant?.flatId
                return {
                  value: flat.id,
                  label: `Flat ${flat.number} · ${ownerOf(owners, flat.id)?.name ?? 'no owner'} · ${
                    ownerLivesHere ? 'Owner-occupied' : flatStatus(flat, owners, tenants)
                  }`,
                  disabled: ownerLivesHere,
                }
              })}
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
            <Button variant="default" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {tenant ? 'Save tenant' : 'Add tenant'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
