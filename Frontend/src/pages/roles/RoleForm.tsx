import { Alert, Button, Checkbox, Group, Modal, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { adminModules, allActions, commonModules, residentPermissions } from '../../mocks/roles.ts'
import type { AppRole, PermissionAction, PermissionModule, PermissionSet, RecordStatus, Role } from '../../types/models.ts'
import { hasPermission } from '../../utils/permissions.ts'
import { notifyResult } from '../../utils/notify.ts'
import { actionLabels, kindLabels, moduleLabels } from './permissionLabels.ts'

interface RoleFormValues {
  name: string
  description: string
  status: RecordStatus
  kind: Role
  permissions: PermissionSet
}

const empty: RoleFormValues = {
  name: '',
  description: '',
  status: 'Active',
  kind: 'owner',
  permissions: residentPermissions(),
}

export function RoleForm({ opened, role, onClose }: { opened: boolean; role: AppRole | null; onClose: () => void }) {
  const { user } = useAuth()
  const { saveRole } = useBuilding()
  const form = useForm<RoleFormValues>({
    initialValues: empty,
    validate: { name: (value) => (value.trim() ? null : 'Enter a role name') },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(role ? { ...role } : empty)
    form.resetDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, role])

  if (!user) return null

  const lockedAdmin = role?.system === true && role.kind === 'admin'
  const modules = form.values.kind === 'admin' ? [...commonModules, ...adminModules] : commonModules

  const toggle = (module: PermissionModule, action: PermissionAction, checked: boolean) => {
    const current = form.values.permissions[module] ?? []
    let next = checked ? [...new Set([...current, action])] : current.filter((item) => item !== action)
    // Any action implies the module can be opened.
    if (checked && action !== 'view') next = [...new Set([...next, 'view' as const])]
    if (!checked && action === 'view') next = []
    form.setFieldValue('permissions', { ...form.values.permissions, [module]: next })
  }

  const save = (values: RoleFormValues) => {
    // Admin modules never apply to owner or tenant roles.
    const permissions: PermissionSet =
      values.kind === 'admin'
        ? values.permissions
        : Object.fromEntries(commonModules.map((module) => [module, values.permissions[module] ?? []]))
    const done = notifyResult(
      saveRole(
        {
          id: role?.id ?? `role-${crypto.randomUUID()}`,
          system: role?.system ?? false,
          name: values.name,
          description: values.description,
          status: values.status,
          kind: values.kind,
          permissions,
        },
        user.name,
      ),
      { title: role ? 'Role updated' : 'Role created', message: values.name.trim() },
    )
    if (done) onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={role ? `Edit role · ${role.name}` : 'Create role'} size="xl">
      <form onSubmit={form.onSubmit(save)}>
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
          <Select
            label="Access level"
            description="Decides what the user is linked to and which personal records they can see."
            required
            allowDeselect={false}
            disabled={role?.system === true}
            data={(['admin', 'owner', 'tenant'] as Role[]).map((kind) => ({ value: kind, label: kindLabels[kind] }))}
            {...form.getInputProps('kind')}
          />
          <Text fw={700} mt="xs">
            Module permissions
          </Text>
          {lockedAdmin ? (
            <Alert color="terracotta" variant="light">
              The Admin role always has every module and action, so the building can never be locked out.
            </Alert>
          ) : form.values.kind !== 'admin' ? (
            <Text size="xs" c="dimmed">
              Owner and tenant roles only use the common modules. Edit lets them change their own expenses; Manage and Delete
              are for the admin.
            </Text>
          ) : null}
          <Table.ScrollContainer minWidth={560}>
            <Table striped verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Module</Table.Th>
                  {allActions.map((action) => (
                    <Table.Th key={action} ta="center">
                      {actionLabels[action]}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {modules.map((module) => (
                  <Table.Tr key={module}>
                    <Table.Td>{moduleLabels[module]}</Table.Td>
                    {allActions.map((action) => (
                      <Table.Td key={action}>
                        <Group justify="center">
                          <Checkbox
                            aria-label={`${moduleLabels[module]}: ${actionLabels[action]}`}
                            disabled={lockedAdmin}
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
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{role ? 'Save role' : 'Create role'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
