import { Button, Group, Modal, PasswordInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { RecordStatus, UserAccount } from '../../types/models.ts'
import { flatStatus, sortByFlatNumber, tenancyState } from '../../utils/calculations.ts'
import { notifyResult } from '../../utils/notify.ts'

interface UserFormValues {
  name: string
  email: string
  password: string
  roleId: string
  flatId: string
  residentId: string
  status: RecordStatus
}

const empty: UserFormValues = {
  name: '',
  email: '',
  password: '',
  roleId: 'role-owner',
  flatId: '',
  residentId: '',
  status: 'Active',
}

/**
 * The linked flat narrows the resident list; the flat itself is stored on the owner or tenant record,
 * so a user never carries a second copy of it.
 */
export function UserForm({ opened, account, onClose }: { opened: boolean; account: UserAccount | null; onClose: () => void }) {
  const { user } = useAuth()
  const { roles, flats, owners, tenants, accounts, saveUser } = useBuilding()
  const isNew = account === null
  const form = useForm<UserFormValues>({
    initialValues: empty,
    validate: {
      name: (value) => (value.trim() ? null : 'Enter the full name'),
      email: (value) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Enter a valid email'),
      password: (value) => (isNew && value.trim().length < 6 ? 'At least 6 characters' : null),
      roleId: (value) => (value ? null : 'Choose a role'),
      residentId: (value, values) =>
        roles.find((item) => item.id === values.roleId)?.kind !== 'admin' && !value ? 'Choose the linked record' : null,
    },
  })

  useEffect(() => {
    if (!opened) return
    const residentId = account?.ownerId ?? account?.tenantId ?? ''
    const resident = owners.find((item) => item.id === residentId) ?? tenants.find((item) => item.id === residentId)
    form.setValues(
      account
        ? {
            name: account.name,
            email: account.email,
            password: '',
            roleId: account.roleId,
            flatId: resident?.flatId ?? '',
            residentId,
            status: account.status,
          }
        : empty,
    )
    form.resetDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, account])

  if (!user) return null

  const role = roles.find((item) => item.id === form.values.roleId)
  const kind = role?.kind ?? 'admin'
  const takenBy = (residentId: string) =>
    accounts.find((item) => (item.ownerId === residentId || item.tenantId === residentId) && item.id !== account?.id)
  const residentChoices =
    kind === 'owner'
      ? owners
          .filter((owner) => owner.flatId === form.values.flatId)
          .map((owner) => ({ value: owner.id, label: owner.name, disabled: Boolean(takenBy(owner.id)) }))
      : kind === 'tenant'
        ? tenants
            .filter((tenant) => tenant.flatId === form.values.flatId)
            .map((tenant) => ({
              value: tenant.id,
              label: `${tenant.name} · ${tenancyState(tenant)}`,
              disabled: Boolean(takenBy(tenant.id)),
            }))
        : []

  // Name and email come from the linked owner or tenant record, so the two never drift apart.
  const pickResident = (residentId: string) => {
    form.setFieldValue('residentId', residentId)
    const resident = owners.find((item) => item.id === residentId) ?? tenants.find((item) => item.id === residentId)
    if (!resident) return
    form.setFieldValue('name', resident.name)
    form.setFieldValue('email', resident.email)
  }

  const save = (values: UserFormValues) => {
    const done = notifyResult(
      saveUser(
        {
          id: account?.id ?? `user-${crypto.randomUUID()}`,
          name: values.name,
          email: values.email,
          password: values.password,
          roleId: values.roleId,
          ownerId: kind === 'owner' ? values.residentId || null : null,
          tenantId: kind === 'tenant' ? values.residentId || null : null,
          status: values.status,
        },
        isNew,
        user.name,
      ),
      { title: isNew ? 'User created' : 'User updated', message: values.email.trim().toLowerCase() },
    )
    if (done) onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={isNew ? 'Create user' : 'Edit user'} size="lg">
      <form onSubmit={form.onSubmit(save)}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Role"
              required
              searchable
              allowDeselect={false}
              data={roles.map((item) => ({
                value: item.id,
                label: item.status === 'Active' ? item.name : `${item.name} (inactive)`,
                disabled: item.status !== 'Active',
              }))}
              value={form.values.roleId}
              error={form.errors.roleId}
              onChange={(value) => {
                form.setFieldValue('roleId', value ?? '')
                form.setFieldValue('residentId', '')
              }}
            />
            <Select
              label="Account status"
              required
              allowDeselect={false}
              data={['Active', 'Inactive']}
              disabled={account?.id === user.id}
              description={account?.id === user.id ? 'You cannot deactivate your own account.' : undefined}
              {...form.getInputProps('status')}
            />
          </SimpleGrid>
          {kind === 'admin' ? (
            <Text size="sm" c="dimmed">
              Admin users are not linked to a flat, floor, owner, or tenant.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Linked flat"
                required
                searchable
                allowDeselect={false}
                data={sortByFlatNumber(flats).map((flat) => ({
                  value: flat.id,
                  label: `Flat ${flat.number} · ${flatStatus(flat, owners, tenants)}`,
                }))}
                value={form.values.flatId}
                onChange={(value) => {
                  const flatId = value ?? ''
                  form.setFieldValue('flatId', flatId)
                  // A flat has exactly one owner, so an owner login can link straight away.
                  const owner = kind === 'owner' ? owners.find((item) => item.flatId === flatId) : undefined
                  if (owner && !takenBy(owner.id)) pickResident(owner.id)
                  else form.setFieldValue('residentId', '')
                }}
              />
              <Select
                label={kind === 'owner' ? 'Linked owner record' : 'Linked tenant record'}
                required
                searchable
                allowDeselect={false}
                disabled={!form.values.flatId}
                nothingFoundMessage={`No ${kind} record on this flat`}
                description={
                  form.values.flatId && residentChoices.length === 0
                    ? `Add the ${kind} on Admin → ${kind === 'owner' ? 'Owners' : 'Tenants'} first.`
                    : 'Fills in the name and email. Records that already have a login are greyed out.'
                }
                data={residentChoices}
                value={form.values.residentId}
                error={form.errors.residentId}
                onChange={(value) => pickResident(value ?? '')}
              />
            </SimpleGrid>
          )}
          <TextInput label="Full name" required {...form.getInputProps('name')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Email" required description="Used to log in." {...form.getInputProps('email')} />
            <PasswordInput
              label={isNew ? 'Initial password' : 'Password'}
              required={isNew}
              description={isNew ? 'They use this to log in.' : 'Leave blank to keep the current password.'}
              {...form.getInputProps('password')}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{isNew ? 'Create user' : 'Save user'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
