import { Button, Group, Input, Modal, PasswordInput, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect, useState } from 'react'
import { createUser, updateUser } from '../../services/userService.ts'
import type { AppRole, Flat, Owner, RecordStatus, ResidentKind, SessionUser, Tenant, UserAccount } from '../../types/models.ts'
import { flatStatus, sortByFlatNumber, tenancyState } from '../../utils/calculations.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'

interface UserFormValues {
  name: string
  email: string
  password: string
  roleId: string
  linkKind: ResidentKind
  flatId: string
  residentId: string
  status: RecordStatus
}

const empty: UserFormValues = {
  name: '',
  email: '',
  password: '',
  roleId: '',
  linkKind: 'owner',
  flatId: '',
  residentId: '',
  status: 'Active',
}

/**
 * Creates or edits a login. Resident logins link to an owner or tenant record; the flat only
 * narrows that list, because the flat itself is stored on the owner or tenant record.
 */
export function UserForm({
  opened,
  account,
  currentUser,
  roles,
  flats,
  owners,
  tenants,
  accounts,
  onClose,
  onSaved,
}: {
  opened: boolean
  account: UserAccount | null
  currentUser: SessionUser
  roles: AppRole[]
  flats: Flat[]
  owners: Owner[]
  tenants: Tenant[]
  accounts: UserAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = account === null
  const [saving, setSaving] = useState(false)
  const roleOf = (roleId: string) => roles.find((item) => item.id === roleId)
  const form = useForm<UserFormValues>({
    initialValues: empty,
    validate: {
      name: (value) => (value.trim() ? null : 'Enter the full name'),
      email: (value) => {
        const email = value.trim().toLowerCase()
        if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email'
        return accounts.some((item) => item.email.toLowerCase() === email && item.id !== account?.id) ? 'That email is already used' : null
      },
      password: (value) => (isNew && value.trim().length < 6 ? 'At least 6 characters' : !isNew && value && value.length < 6 ? 'At least 6 characters' : null),
      roleId: (value) => (value ? null : 'Choose a role'),
      flatId: (value, values) => (!roleOf(values.roleId)?.isAdmin && !value ? 'Choose the flat' : null),
      residentId: (value, values) => (!roleOf(values.roleId)?.isAdmin && !value ? 'Choose the linked record' : null),
    },
  })

  useEffect(() => {
    if (!opened) return
    const residentId = account?.ownerId ?? account?.tenantId ?? ''
    const resident = owners.find((item) => item.id === residentId) ?? tenants.find((item) => item.id === residentId)
    const firstResidentRole = roles.find((role) => !role.isAdmin && role.status === 'Active')
    form.setValues(
      account
        ? {
            name: account.name,
            email: account.email,
            password: '',
            roleId: account.roleId,
            linkKind: account.tenantId ? 'tenant' : 'owner',
            flatId: resident?.flatId ?? '',
            residentId,
            status: account.status,
          }
        : { ...empty, roleId: firstResidentRole?.id ?? '' },
    )
    form.resetDirty()
    form.clearErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, account])

  const role = roleOf(form.values.roleId)
  const isAdminRole = role?.isAdmin ?? false
  const kind = form.values.linkKind
  const takenBy = (residentId: string) =>
    accounts.find((item) => (item.ownerId === residentId || item.tenantId === residentId) && item.id !== account?.id)
  const residentChoices =
    kind === 'owner'
      ? owners
          .filter((owner) => owner.flatId === form.values.flatId)
          .map((owner) => ({ value: owner.id, label: owner.name, disabled: Boolean(takenBy(owner.id)) }))
      : tenants
          .filter((tenant) => tenant.flatId === form.values.flatId)
          .map((tenant) => ({ value: tenant.id, label: `${tenant.name} · ${tenancyState(tenant)}`, disabled: Boolean(takenBy(tenant.id)) }))

  // Name and email come from the linked owner or tenant record, so the two never drift apart.
  const pickResident = (residentId: string) => {
    form.setFieldValue('residentId', residentId)
    const resident = owners.find((item) => item.id === residentId) ?? tenants.find((item) => item.id === residentId)
    if (!resident) return
    form.setFieldValue('name', resident.name)
    form.setFieldValue('email', resident.email)
  }

  const pickFlat = (flatId: string, linkKind: ResidentKind = kind) => {
    form.setFieldValue('flatId', flatId)
    // A flat has exactly one owner, so an owner login can link straight away.
    const owner = linkKind === 'owner' ? owners.find((item) => item.flatId === flatId) : undefined
    if (owner && !takenBy(owner.id)) pickResident(owner.id)
    else form.setFieldValue('residentId', '')
  }

  const save = async (values: UserFormValues) => {
    const input = {
      name: values.name,
      email: values.email,
      password: values.password,
      roleId: values.roleId,
      status: values.status,
      isAdminRole,
      link: isAdminRole ? null : { kind: values.linkKind, residentId: values.residentId },
    }
    setSaving(true)
    try {
      if (account) await updateUser(account, input)
      else await createUser(input)
      notifySuccess(isNew ? 'User created' : 'User updated', values.email.trim().toLowerCase())
      onSaved()
      onClose()
    } catch (failure) {
      notifyApiError(failure)
      // A create that failed at the linking step still made the login, so refresh the list.
      if (isNew) onSaved()
    } finally {
      setSaving(false)
    }
  }

  const editingSelf = account?.id === currentUser.id

  return (
    <Modal opened={opened} onClose={onClose} title={isNew ? 'Create user' : 'Edit user'} size="lg">
      <form onSubmit={form.onSubmit((values) => void save(values))}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="Role"
              required
              searchable
              allowDeselect={false}
              disabled={editingSelf}
              description={editingSelf ? 'You cannot change your own role.' : 'Roles are managed on Admin → Roles.'}
              nothingFoundMessage="No roles. Create one on Admin → Roles."
              data={roles.map((item) => ({
                value: item.id,
                label: `${item.name}${item.isAdmin ? ' · Administrator' : ''}${item.status === 'Active' ? '' : ' (inactive)'}`,
                disabled: item.status !== 'Active' && item.id !== account?.roleId,
              }))}
              value={form.values.roleId || null}
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
              disabled={editingSelf}
              description={editingSelf ? 'You cannot deactivate your own account.' : undefined}
              {...form.getInputProps('status')}
            />
          </SimpleGrid>
          {isAdminRole ? (
            <Text size="sm" c="dimmed">
              Administrator users are not linked to a flat, owner, or tenant.
            </Text>
          ) : (
            <>
              <Input.Wrapper label="Linked as" required>
                <SegmentedControl
                  mt={6}
                  fullWidth
                  data={[
                    { label: 'Owner', value: 'owner' },
                    { label: 'Tenant', value: 'tenant' },
                  ]}
                  value={kind}
                  onChange={(value) => {
                    form.setFieldValue('linkKind', value as ResidentKind)
                    if (form.values.flatId) pickFlat(form.values.flatId, value as ResidentKind)
                    else form.setFieldValue('residentId', '')
                  }}
                />
              </Input.Wrapper>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Linked flat"
                  required
                  searchable
                  allowDeselect={false}
                  nothingFoundMessage="No flats. Add them on Admin → Flats."
                  data={sortByFlatNumber(flats).map((flat) => ({
                    value: flat.id,
                    label: `Flat ${flat.number} · ${flatStatus(flat, owners, tenants)}`,
                  }))}
                  value={form.values.flatId || null}
                  error={form.errors.flatId}
                  onChange={(value) => pickFlat(value ?? '')}
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
                  value={form.values.residentId || null}
                  error={form.errors.residentId}
                  onChange={(value) => pickResident(value ?? '')}
                />
              </SimpleGrid>
            </>
          )}
          <TextInput label="Full name" required {...form.getInputProps('name')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Email" required description="Used to log in." {...form.getInputProps('email')} />
            <PasswordInput
              label={isNew ? 'Initial password' : 'New password'}
              required={isNew}
              description={isNew ? 'They use this to log in.' : 'Leave blank to keep the current password.'}
              autoComplete="new-password"
              {...form.getInputProps('password')}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isNew ? 'Create user' : 'Save user'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
