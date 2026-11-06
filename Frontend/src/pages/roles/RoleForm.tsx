import { Alert, Button, Checkbox, Group, Modal, Select, SimpleGrid, Stack, Switch, Table, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect, useState } from 'react'
import { createRole, updateRole } from '../../services/roleService.ts'
import type { AppRole, PermissionAction, PermissionModule, PermissionSet, RecordStatus } from '../../types/models.ts'
import { commonModules, residentPermissions, roleActions } from '../../utils/modules.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'
import { hasPermission } from '../../utils/permissions.ts'
import { actionLabels, moduleLabels } from './permissionLabels.ts'

interface RoleFormValues {
  name: string
  description: string
  status: RecordStatus
  isAdmin: boolean
  permissions: PermissionSet
}

const empty: RoleFormValues = {
  name: '',
  description: '',
  status: 'Active',
  isAdmin: false,
  permissions: residentPermissions(),
}

export function RoleForm({
  opened,
  role,
  roles,
  onClose,
  onSaved,
}: {
  opened: boolean
  role: AppRole | null
  /** Existing roles, to catch a duplicate name before calling the API. */
  roles: AppRole[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const form = useForm<RoleFormValues>({
    initialValues: empty,
    validate: {
      name: (value) => {
        const name = value.trim()
        if (!name) return 'Enter a role name'
        const taken = roles.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== role?.id)
        return taken ? 'That role name is already used' : null
      },
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(
      role
        ? { name: role.name, description: role.description, status: role.status, isAdmin: role.isAdmin, permissions: role.permissions }
        : empty,
    )
    form.resetDirty()
    form.clearErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, role])

  // An administrator role keeps full access so the building can never be locked out.
  const lockedAdmin = role?.system === true

  const toggle = (module: PermissionModule, action: PermissionAction, checked: boolean) => {
    const current = form.values.permissions[module] ?? []
    let next = checked ? [...new Set([...current, action])] : current.filter((item) => item !== action)
    // Any action implies the module can be opened; removing View removes everything.
    if (checked && action !== 'view') next = [...new Set([...next, 'view' as const])]
    if (!checked && action === 'view') next = []
    form.setFieldValue('permissions', { ...form.values.permissions, [module]: next })
  }

  const save = async (values: RoleFormValues) => {
    // Resident roles only use the common modules.
    const permissions: PermissionSet = Object.fromEntries(commonModules.map((module) => [module, values.permissions[module] ?? []]))
    if (!values.isAdmin && Object.values(permissions).every((actions) => !actions || actions.length === 0)) {
      form.setFieldError('permissions', 'Give the role at least one module, or its users cannot sign in.')
      return
    }
    const input = { ...values, permissions }
    setSaving(true)
    try {
      if (role) await updateRole(role.id, input)
      else await createRole(input)
      notifySuccess(role ? 'Role updated' : 'Role created', values.name.trim())
      onSaved()
      onClose()
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={role ? `Edit role · ${role.name}` : 'Create role'} size="xl">
      <form onSubmit={form.onSubmit((values) => void save(values))}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Role name" required {...form.getInputProps('name')} />
            <Select
              label="Status"
              required
              data={['Active', 'Inactive']}
              allowDeselect={false}
              disabled={lockedAdmin}
              {...form.getInputProps('status')}
            />
          </SimpleGrid>
          <Textarea label="Role description" autosize minRows={2} {...form.getInputProps('description')} />
          <Switch
            label="Administrator role"
            description="Administrators get every module and action and are not linked to a flat. Leave off for owner and tenant roles."
            disabled={lockedAdmin}
            checked={form.values.isAdmin}
            onChange={(event) => form.setFieldValue('isAdmin', event.currentTarget.checked)}
          />
          <Text fw={700} mt="xs">
            Module permissions
          </Text>
          {form.values.isAdmin ? (
            <Alert color="terracotta" variant="light">
              An administrator role always has every module and action.
            </Alert>
          ) : (
            <>
              <Text size="xs" c="dimmed">
                Resident roles use the common modules. Edit lets them change their own expenses; delete stays with the admin.
              </Text>
              {typeof form.errors.permissions === 'string' ? (
                <Text size="sm" c="red">
                  {form.errors.permissions}
                </Text>
              ) : null}
              <Table.ScrollContainer minWidth={480}>
                <Table striped verticalSpacing={6}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Module</Table.Th>
                      {roleActions.map((action) => (
                        <Table.Th key={action} ta="center">
                          {actionLabels[action]}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {commonModules.map((module) => (
                      <Table.Tr key={module}>
                        <Table.Td>{moduleLabels[module]}</Table.Td>
                        {roleActions.map((action) => (
                          <Table.Td key={action}>
                            <Group justify="center">
                              <Checkbox
                                aria-label={`${moduleLabels[module]}: ${actionLabels[action]}`}
                                checked={hasPermission(form.values.permissions, module, action)}
                                onChange={(event) => toggle(module, action, event.currentTarget.checked)}
                              />
                            </Group>
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {role ? 'Save role' : 'Create role'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
