import { Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { Flat } from '../../types/models.ts'
import { canSeeFlatPeople, canSeeIdProof, canSeeOwnProfile } from '../../utils/access.ts'
import { formatDate, formatPhone } from '../../utils/format.ts'
import { flatStatus } from '../../utils/ledger.ts'

export function ResidentsPage() {
  const { user } = useAuth()
  const { flats } = useBuilding()
  const [proof, setProof] = useState<string | null>(null)
  const [opened, { open, close }] = useDisclosure(false)
  if (!user) return null

  const visible =
    user.role === 'admin' ? flats : flats.filter((flat) => flat.number === user.flatNumber)

  const showProof = (label: string) => {
    setProof(label)
    open()
  }

  return (
    <Stack gap="lg">
      <PageHeading
        title={user.role === 'tenant' ? 'My flat' : 'Flats and residents'}
        description={
          user.role === 'admin'
            ? 'Status comes from whether a tenant is active today.'
            : user.role === 'owner'
              ? 'You see your flat, your tenant, and that tenant’s ID proof.'
              : 'You see your own profile and flat. The owner’s details and your ID file stay hidden.'
        }
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {visible.map((flat) => (
          <FlatCard
            key={flat.number}
            flat={flat}
            showPeople={canSeeFlatPeople(user, flat.number)}
            showSelf={canSeeOwnProfile(user, flat.number)}
            showProof={canSeeIdProof(user, flat.number)}
            onProof={showProof}
            viewerRole={user.role}
          />
        ))}
      </SimpleGrid>
      <Modal opened={opened} onClose={close} title="ID proof">
        <Stack gap="xs">
          <Text fw={600}>{proof}</Text>
          <Text size="sm" c="dimmed">
            Preview stays inside the app. In this sample the file is not loaded. Only an admin, or the owner of this
            flat, can open it.
          </Text>
        </Stack>
      </Modal>
    </Stack>
  )
}

function FlatCard({
  flat,
  showPeople,
  showSelf,
  showProof,
  onProof,
  viewerRole,
}: {
  flat: Flat
  showPeople: boolean
  showSelf: boolean
  showProof: boolean
  onProof: (label: string) => void
  viewerRole: 'admin' | 'owner' | 'tenant'
}) {
  const status = flatStatus(flat)
  const showOwner = showPeople && flat.owner
  const showTenantBlock = flat.tenant && (showPeople || (showSelf && viewerRole === 'tenant'))

  return (
    <Card>
      <Group justify="space-between" mb="sm">
        <div>
          <Text fw={700} fz={22} c="terracotta.8">
            Flat {flat.number}
          </Text>
          <Text size="sm" c="dimmed">
            Floor {flat.floor}
          </Text>
        </div>
        <Badge variant="light" color="terracotta">
          {status}
        </Badge>
      </Group>
      <Stack gap="sm">
        {showOwner && flat.owner ? (
          <Stack gap={2}>
            <Text size="xs" tt="uppercase" fw={700} c="sand.7">
              Owner
            </Text>
            <Text fw={600}>{flat.owner.name}</Text>
            <Text size="sm" c="dimmed">
              {formatPhone(flat.owner.phone)} · {flat.owner.email}
            </Text>
            <Text size="sm">{flat.owner.address}</Text>
            <Text size="sm">Emergency: {flat.owner.emergency}</Text>
          </Stack>
        ) : null}
        {showTenantBlock && flat.tenant ? (
          <Stack gap={2}>
            <Text size="xs" tt="uppercase" fw={700} c="sand.7">
              Tenant
            </Text>
            <Text fw={600}>{flat.tenant.name}</Text>
            <Text size="sm" c="dimmed">
              {formatPhone(flat.tenant.phone)} · {flat.tenant.email}
            </Text>
            <Text size="sm">
              {flat.tenant.occupants} occupants · moved in {formatDate(flat.tenant.moveIn)}
            </Text>
            <Text size="sm">Agreement ends {formatDate(flat.tenant.agreementEnd)}</Text>
            <Text size="sm">Vehicle {flat.tenant.vehicle}</Text>
            <Text size="sm">Emergency: {flat.tenant.emergency}</Text>
            {showProof ? (
              <Button mt="xs" variant="light" onClick={() => onProof(flat.tenant?.idProofLabel ?? 'ID proof')}>
                View ID proof
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No active tenant.
          </Text>
        )}
      </Stack>
    </Card>
  )
}
