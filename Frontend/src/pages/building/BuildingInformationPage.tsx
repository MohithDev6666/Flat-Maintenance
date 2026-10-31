import { Anchor, Button, Card, Group, List, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { paths } from '../../routes/nav.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyResult } from '../../utils/notify.ts'
import { BuildingForm } from './BuildingForm.tsx'

const setupSteps = [
  { label: 'Building Information', to: paths.adminBuilding },
  { label: 'Flats', to: paths.adminFlats },
  { label: 'Owners', to: paths.adminOwners },
  { label: 'Tenants', to: paths.adminTenants },
  { label: 'Roles', to: paths.adminRoles },
  { label: 'Users', to: paths.adminUsers },
  { label: 'Categories', to: paths.adminCategories },
]

export function BuildingInformationPage() {
  const { user } = useAuth()
  const { building, flats, saveBuilding } = useBuilding()
  const { can } = usePermissions()
  const isEmpty = !building.name.trim()
  const [editing, setEditing] = useState(isEmpty)
  if (!user) return null

  return (
    <Stack gap="lg">
      <PageHeading
        title="Building Information"
        description="The building’s name, address, size, and contact number. These appear on the login page, sidebar, and exports."
        action={
          !editing && can('building', 'edit') ? (
            <Button variant="light" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null
        }
      />
      <Card maw={720}>
        {editing ? (
          <BuildingForm
            initialValues={building}
            onCancel={() => setEditing(false)}
            onSave={(values) => {
              const saved = notifyResult(saveBuilding(values, user.name), {
                title: isEmpty ? 'Building added' : 'Building updated',
                message: values.name,
              })
              if (saved) setEditing(false)
            }}
          />
        ) : (
          <Stack gap="sm">
            <Field label="Building name" value={building.name} />
            <Field label="Building address" value={building.address} />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Field label="Total flats" value={`${building.totalFlats} (${flats.length} set up)`} />
              <Field label="Number of floors" value={String(building.floors)} />
              <Field label="Contact phone number" value={formatPhone(building.contactPhone)} />
            </SimpleGrid>
          </Stack>
        )}
      </Card>
      <Card maw={720}>
        <Text fw={700}>Recommended setup order</Text>
        <Text size="sm" c="dimmed" mb="xs">
          Not a wizard. Each step can be done or revisited at any time.
        </Text>
        <List type="ordered" spacing={4} size="sm">
          {setupSteps.map((step) => (
            <List.Item key={step.to}>
              <Anchor component={Link} to={step.to} c="terracotta.8">
                {step.label}
              </Anchor>
            </List.Item>
          ))}
        </List>
      </Card>
    </Stack>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={2} align="flex-start" style={{ flexDirection: 'column' }}>
      <Text size="xs" tt="uppercase" fw={700} c="sand.7">
        {label}
      </Text>
      <Text style={{ overflowWrap: 'anywhere' }}>{value || '—'}</Text>
    </Group>
  )
}
