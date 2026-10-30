import {
  Button,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { ExpenseCategory, Flat, MockUser, RecurringRule, Responsibility, Role } from '../../types/models.ts'

function showError(message: string) {
  notifications.show({ color: 'red', title: 'Not saved', message })
}

function toDisplayDate(value: string | null | undefined): string {
  if (!value) return ''
  return dayjs(value).format('DD-MM-YYYY')
}

function toIsoDate(value: string): string | null {
  if (!value.trim()) return null
  const parsed = dayjs(value, 'DD-MM-YYYY', true)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

export function UserEditor({
  opened,
  account,
  onClose,
}: {
  opened: boolean
  account: MockUser | null
  onClose: () => void
}) {
  const { saveAccount } = useAuth()
  const { flats } = useBuilding()
  const isNew = account === null
  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'owner' as Role,
      flatNumber: flats[0]?.number ?? '',
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues({
      name: account?.name ?? '',
      email: account?.email ?? '',
      phone: account?.phone ?? '',
      password: '',
      role: account?.role ?? 'owner',
      flatNumber: account?.flatNumber ?? flats[0]?.number ?? '',
    })
    // form.setValues is stable enough for this dialog open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, account, flats])

  const save = () => {
    const values = form.values
    if (!values.role || (values.role !== 'admin' && values.role !== 'owner' && values.role !== 'tenant')) {
      showError('Choose a role.')
      return
    }
    if (values.role !== 'admin' && !values.flatNumber) {
      showError('Link this user to a flat.')
      return
    }
    const error = saveAccount(
      {
        id: account?.id ?? `user-${crypto.randomUUID()}`,
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role,
        flatNumber: values.role === 'admin' ? null : values.flatNumber,
      },
      isNew,
    )
    if (error) {
      showError(error)
      return
    }
    notifications.show({ color: 'terracotta', title: isNew ? 'User added' : 'User updated', message: values.name })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={isNew ? 'Add user' : 'Edit user'}>
      <Stack gap="sm">
        <TextInput label="Name" {...form.getInputProps('name')} />
        <TextInput label="Email" {...form.getInputProps('email')} />
        <TextInput label="Phone" {...form.getInputProps('phone')} />
        <TextInput
          label="Password"
          description={isNew ? 'They will use this to sign in.' : 'Leave blank to keep the current password.'}
          {...form.getInputProps('password')}
        />
        <Select
          label="Role"
          data={[
            { value: 'admin', label: 'Admin' },
            { value: 'owner', label: 'Owner' },
            { value: 'tenant', label: 'Tenant' },
          ]}
          allowDeselect={false}
          {...form.getInputProps('role')}
        />
        {form.values.role === 'admin' ? (
          <Text size="sm" c="dimmed">
            Admin accounts are not linked to a flat.
          </Text>
        ) : (
          <Select
            label="Flat"
            description={
              form.values.role === 'tenant'
                ? 'Choose the flat they live in. Their stay, dates, and ID proof are saved on the Tenants tab.'
                : 'Choose the flat they own. Owner contact details are saved on the Flats tab.'
            }
            data={flatChoices(flats)}
            allowDeselect={false}
            {...form.getInputProps('flatNumber')}
          />
        )}
        <Button onClick={save}>{isNew ? 'Add user' : 'Save user'}</Button>
      </Stack>
    </Modal>
  )
}

export function FlatEditor({
  opened,
  flat,
  onClose,
}: {
  opened: boolean
  flat: Flat | null
  onClose: () => void
}) {
  const { user, relinkFlat } = useAuth()
  const { saveFlat } = useBuilding()
  const form = useForm({
    initialValues: emptyFlatForm(),
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(flat ? flatToForm(flat) : emptyFlatForm())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, flat])

  const save = () => {
    if (!user) return
    const values = form.values
    if (!values.number.trim()) {
      showError('Enter a flat number.')
      return
    }
    if (!values.ownerName.trim() || !values.ownerPhone.trim() || !values.ownerEmail.trim()) {
      showError('Owner name, phone, and email are required.')
      return
    }
    if (!values.address.trim() || !values.ownerEmergency.trim()) {
      showError('Owner address and emergency contact are required.')
      return
    }
    const next: Flat = {
      number: values.number.trim(),
      floor: Number(values.floor) || 1,
      owner: {
        name: values.ownerName.trim(),
        phone: values.ownerPhone.trim(),
        email: values.ownerEmail.trim(),
        address: values.address.trim(),
        emergency: values.ownerEmergency.trim(),
      },
      tenant: flat?.tenant ?? null,
    }
    const error = saveFlat(next, flat?.number ?? null, user.name)
    if (error) {
      showError(error)
      return
    }
    if (flat && flat.number !== next.number) relinkFlat(flat.number, next.number)
    notifications.show({ color: 'terracotta', title: flat ? 'Flat updated' : 'Flat added', message: `Flat ${next.number}` })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={flat ? `Edit flat ${flat.number}` : 'Add flat'} size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          This form is the flat and its owner. Add the person who lives there on the Tenants tab, and create their login on the Users tab.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Flat number" required {...form.getInputProps('number')} />
          <TextInput label="Floor" required {...form.getInputProps('floor')} />
        </SimpleGrid>
        <Text fw={700}>Owner</Text>
        <TextInput label="Name" required {...form.getInputProps('ownerName')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Phone" required {...form.getInputProps('ownerPhone')} />
          <TextInput label="Email" required {...form.getInputProps('ownerEmail')} />
        </SimpleGrid>
        <TextInput label="Address" required {...form.getInputProps('address')} />
        <TextInput label="Emergency contact" required placeholder="Name · phone" {...form.getInputProps('ownerEmergency')} />
        <Button onClick={save}>{flat ? 'Save flat' : 'Add flat'}</Button>
      </Stack>
    </Modal>
  )
}

export function TenantEditor({
  opened,
  flat,
  onClose,
}: {
  opened: boolean
  flat: Flat | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const { flats, saveFlat } = useBuilding()
  const vacant = flats.filter((item) => item.tenant === null)
  const form = useForm({
    initialValues: emptyTenantForm(vacant[0]?.number ?? ''),
  })

  useEffect(() => {
    if (!opened) return
    if (flat?.tenant) {
      form.setValues(tenantToForm(flat))
      return
    }
    const firstVacant = flats.find((item) => item.tenant === null)
    form.setValues(emptyTenantForm(firstVacant?.number ?? ''))
    // Reset only when the dialog opens or the edited flat changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, flat])

  const save = () => {
    if (!user) return
    const values = form.values
    const target = flats.find((item) => item.number === values.flatNumber)
    if (!target) {
      showError('Choose a flat.')
      return
    }
    if (!flat && target.tenant) {
      showError('That flat already has a tenant. End that tenancy before adding another.')
      return
    }
    if (!values.name.trim() || !values.phone.trim() || !values.email.trim()) {
      showError('Name, phone, and email are required.')
      return
    }
    const moveIn = toIsoDate(values.moveIn)
    if (!moveIn) {
      showError('Move-in date must be DD-MM-YYYY.')
      return
    }
    const agreementEnd = toIsoDate(values.agreementEnd)
    if (!agreementEnd) {
      showError('Agreement end must be DD-MM-YYYY.')
      return
    }
    const moveOut = values.moveOut.trim() ? toIsoDate(values.moveOut) : null
    if (values.moveOut.trim() && !moveOut) {
      showError('Move-out date must be DD-MM-YYYY.')
      return
    }
    if (!values.emergency.trim() || !values.idProofLabel.trim()) {
      showError('Emergency contact and ID proof file name are required.')
      return
    }
    const occupants = Number(values.occupants)
    if (!(occupants > 0)) {
      showError('Occupants must be at least 1.')
      return
    }
    const error = saveFlat(
      {
        ...target,
        tenant: {
          name: values.name.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          occupants,
          moveIn,
          moveOut,
          agreementEnd,
          vehicle: values.vehicle.trim(),
          emergency: values.emergency.trim(),
          idProofLabel: values.idProofLabel.trim(),
        },
      },
      target.number,
      user.name,
    )
    if (error) {
      showError(error)
      return
    }
    notifications.show({
      color: 'terracotta',
      title: flat ? 'Tenant updated' : 'Tenant added',
      message: `${values.name.trim()} · Flat ${target.number}`,
    })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={flat ? `Edit tenant · Flat ${flat.number}` : 'Add tenant'} size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          One tenant per flat. Their login is a separate step on the Users tab, with the role set to Tenant and the same flat.
        </Text>
        <Select
          label="Flat"
          description={
            flat
              ? 'To move this tenant, end the tenancy and add them on the other flat.'
              : 'Every flat is listed. End the current tenancy before adding someone to a flat that already has a tenant.'
          }
          data={flatChoices(flats)}
          allowDeselect={false}
          disabled={flat !== null}
          required
          {...form.getInputProps('flatNumber')}
        />
        <TextInput label="Name" required {...form.getInputProps('name')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Phone" required {...form.getInputProps('phone')} />
          <TextInput label="Email" required {...form.getInputProps('email')} />
        </SimpleGrid>
        <NumberInput label="Occupants" required min={1} {...form.getInputProps('occupants')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Move-in" required placeholder="DD-MM-YYYY" {...form.getInputProps('moveIn')} />
          <TextInput label="Move-out" placeholder="DD-MM-YYYY" description="Leave blank while they still live here." {...form.getInputProps('moveOut')} />
        </SimpleGrid>
        <TextInput label="Agreement end" required placeholder="DD-MM-YYYY" {...form.getInputProps('agreementEnd')} />
        <TextInput label="Vehicle number" placeholder="Optional" {...form.getInputProps('vehicle')} />
        <TextInput label="Emergency contact" required placeholder="Name · phone" {...form.getInputProps('emergency')} />
        <TextInput
          label="ID proof file name"
          required
          description="Private. Only an admin and this flat’s owner can open it."
          {...form.getInputProps('idProofLabel')}
        />
        <Button onClick={save} disabled={!flat && vacant.length === 0}>
          {flat ? 'Save tenant' : 'Add tenant'}
        </Button>
      </Stack>
    </Modal>
  )
}

export function CategoryEditor({
  opened,
  category,
  onClose,
}: {
  opened: boolean
  category: ExpenseCategory | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const { saveCategory } = useBuilding()
  const form = useForm({ initialValues: { name: '', defaultTag: 'Tenant' as ExpenseCategory['defaultTag'] } })

  useEffect(() => {
    if (!opened) return
    form.setValues({
      name: category?.name ?? '',
      defaultTag: category?.defaultTag ?? 'Tenant',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, category])

  const save = () => {
    if (!user) return
    if (!form.values.defaultTag) {
      showError('Choose a default responsibility.')
      return
    }
    const error = saveCategory(
      {
        id: category?.id ?? `cat-${crypto.randomUUID()}`,
        name: form.values.name.trim(),
        defaultTag: form.values.defaultTag,
      },
      category?.name ?? null,
      user.name,
    )
    if (error) {
      showError(error)
      return
    }
    notifications.show({ color: 'terracotta', title: category ? 'Category updated' : 'Category added', message: form.values.name })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={category ? 'Edit category' : 'Add category'}>
      <Stack gap="sm">
        <TextInput label="Name" {...form.getInputProps('name')} />
        <Select
          label="Default responsibility"
          data={['Tenant', 'Owner', 'Other']}
          allowDeselect={false}
          {...form.getInputProps('defaultTag')}
        />
        <Button onClick={save}>Save category</Button>
      </Stack>
    </Modal>
  )
}

export function RecurringEditor({
  opened,
  rule,
  onClose,
}: {
  opened: boolean
  rule: RecurringRule | null
  onClose: () => void
}) {
  const { user } = useAuth()
  const { categories, saveRecurring } = useBuilding()
  const form = useForm({
    initialValues: {
      name: '',
      category: categories[0]?.name ?? 'Watchman',
      amount: 0,
      responsibility: 'Tenant' as Responsibility,
      dayOfMonth: 1,
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues({
      name: rule?.name ?? '',
      category: rule?.category ?? categories[0]?.name ?? 'Watchman',
      amount: rule?.amount ?? 0,
      responsibility: rule?.responsibility ?? 'Tenant',
      dayOfMonth: rule?.dayOfMonth ?? 1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, rule, categories])

  const save = () => {
    if (!user) return
    if (!form.values.name.trim() || !(Number(form.values.amount) > 0)) {
      showError('Name and amount are required.')
      return
    }
    if (!form.values.category || !form.values.responsibility) {
      showError('Choose a category and a responsibility.')
      return
    }
    saveRecurring(
      {
        id: rule?.id ?? `rec-${crypto.randomUUID()}`,
        name: form.values.name.trim(),
        category: form.values.category,
        amount: Number(form.values.amount),
        responsibility: form.values.responsibility,
        dayOfMonth: Math.min(28, Math.max(1, Number(form.values.dayOfMonth) || 1)),
      },
      rule === null,
      user.name,
    )
    notifications.show({ color: 'terracotta', title: rule ? 'Recurring expense updated' : 'Recurring expense added', message: form.values.name })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={rule ? 'Edit recurring expense' : 'Add recurring expense'}>
      <Stack gap="sm">
        <TextInput label="Name" {...form.getInputProps('name')} />
        <Select label="Category" data={categories.map((item) => item.name)} allowDeselect={false} {...form.getInputProps('category')} />
        <NumberInput label="Amount" prefix="₹ " min={0} thousandSeparator="," {...form.getInputProps('amount')} />
        <Select label="Responsibility" data={['Owner', 'Tenant']} allowDeselect={false} {...form.getInputProps('responsibility')} />
        <NumberInput label="Day of month" min={1} max={28} {...form.getInputProps('dayOfMonth')} />
        <Button onClick={save}>Save recurring expense</Button>
      </Stack>
    </Modal>
  )
}

function flatChoices(flats: Flat[]) {
  return [...flats]
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    .map((flat) => ({ value: flat.number, label: `Flat ${flat.number}` }))
}

function emptyFlatForm() {
  return {
    number: '',
    floor: '1',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    address: '',
    ownerEmergency: '',
  }
}

function flatToForm(flat: Flat) {
  return {
    number: flat.number,
    floor: String(flat.floor),
    ownerName: flat.owner?.name ?? '',
    ownerPhone: flat.owner?.phone ?? '',
    ownerEmail: flat.owner?.email ?? '',
    address: flat.owner?.address ?? '',
    ownerEmergency: flat.owner?.emergency ?? '',
  }
}

function emptyTenantForm(flatNumber: string) {
  return {
    flatNumber,
    name: '',
    phone: '',
    email: '',
    occupants: 1,
    moveIn: '',
    moveOut: '',
    agreementEnd: '',
    vehicle: '',
    emergency: '',
    idProofLabel: '',
  }
}

function tenantToForm(flat: Flat) {
  return {
    flatNumber: flat.number,
    name: flat.tenant?.name ?? '',
    phone: flat.tenant?.phone ?? '',
    email: flat.tenant?.email ?? '',
    occupants: flat.tenant?.occupants ?? 1,
    moveIn: toDisplayDate(flat.tenant?.moveIn),
    moveOut: toDisplayDate(flat.tenant?.moveOut),
    agreementEnd: toDisplayDate(flat.tenant?.agreementEnd),
    vehicle: flat.tenant?.vehicle ?? '',
    emergency: flat.tenant?.emergency ?? '',
    idProofLabel: flat.tenant?.idProofLabel ?? '',
  }
}
