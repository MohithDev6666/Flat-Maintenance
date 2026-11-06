import { Anchor, Button, Card, Group, List, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadState } from '../../components/common/LoadState.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { paths } from '../../routes/nav.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { emptyBuilding, getBuilding, saveBuilding } from '../../services/buildingService.ts'
import { getManagedFlats } from '../../services/flatService.ts'
import type { Building } from '../../types/models.ts'
import { formatPhone } from '../../utils/format.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'
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
  const { can } = usePermissions()
  const [building, setBuilding] = useState<Building>(emptyBuilding)
  const [flatCount, setFlatCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const canSeeFlats = can('flatManagement', 'view')

  const load = useCallback(async () => {
    try {
      const [record, flats] = await Promise.all([getBuilding(), canSeeFlats ? getManagedFlats() : Promise.resolve(null)])
      setBuilding(record)
      setFlatCount(flats ? flats.length : null)
      // A building that has never been saved opens straight in the form.
      setEditing(!record.name.trim())
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [canSeeFlats])

  useEffect(() => {
    void load()
  }, [load])

  const isEmpty = !building.name.trim()

  const save = async (values: Building) => {
    setSaving(true)
    try {
      const saved = await saveBuilding(values)
      setBuilding(saved)
      setEditing(false)
      notifySuccess(isEmpty ? 'Building added' : 'Building updated', saved.name)
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg">
      <PageHeading
        title="Building Information"
        description="The building’s name, address, size, and contact number. These appear on the sidebar and exports."
        action={
          !loading && !error && !editing && can('building', 'edit') ? (
            <Button variant="light" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null
        }
      />
      <LoadState loading={loading} error={error} onRetry={load}>
        <Card maw={720}>
          {editing && can('building', 'edit') ? (
            <BuildingForm
              initialValues={isEmpty ? { ...building, totalFlats: 8, floors: 1 } : building}
              saving={saving}
              onCancel={() => setEditing(false)}
              onSave={(values) => void save(values)}
            />
          ) : (
            <Stack gap="sm">
              <Field label="Building name" value={building.name} />
              <Field label="Building address" value={building.address} />
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Field
                  label="Total flats"
                  value={building.totalFlats ? `${building.totalFlats}${flatCount !== null ? ` (${flatCount} set up)` : ''}` : ''}
                />
                <Field label="Number of floors" value={building.floors ? String(building.floors) : ''} />
                <Field label="Contact phone number" value={building.contactPhone ? formatPhone(building.contactPhone) : ''} />
              </SimpleGrid>
            </Stack>
          )}
        </Card>
      </LoadState>
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
