import { Button, Card, Divider, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { Attachment, Flat, SessionUser, Tenant } from '../../types/models.ts'
import { activeTenantOf, flatStatus, ownerOf, tenancyState } from '../../utils/calculations.ts'
import { formatDate, formatPhone } from '../../utils/format.ts'
import { canSeeIdProof, canSeeOwner, canSeeOwnerPrivate, canSeeTenant } from '../../utils/permissions.ts'

/**
 * One flat with the people the viewer is allowed to see.
 * Shared by the read-only Flats page and the admin Flats management view.
 */
export function FlatDetails({
  flat,
  viewer,
  onViewProof,
  showHistory = false,
  bordered = false,
}: {
  flat: Flat
  viewer: SessionUser
  onViewProof: (file: Attachment) => void
  showHistory?: boolean
  bordered?: boolean
}) {
  const { owners, tenants } = useBuilding()
  const owner = ownerOf(owners, flat.id)
  const tenant = activeTenantOf(tenants, flat.id)
  const status = flatStatus(flat, owners, tenants)
  const others = tenants
    .filter((item) => item.flatId === flat.id && item.id !== tenant?.id)
    .sort((left, right) => right.moveIn.localeCompare(left.moveIn))

  return (
    <Card withBorder={bordered}>
      <Group justify="space-between" mb="sm">
        <div>
          <Text fw={700} fz={22} c="terracotta.8">
            Flat {flat.number}
          </Text>
          <Text size="sm" c="dimmed">
            Floor {flat.floor}
          </Text>
        </div>
        <StatusBadge status={status} size="md" />
      </Group>
      <Stack gap="sm">
        <Section title="Owner">
          {!owner ? (
            <Text size="sm" c="dimmed">
              No owner linked.
            </Text>
          ) : canSeeOwner(viewer, flat.id) ? (
            <>
              <Text fw={600}>{owner.name}</Text>
              <Text size="sm" c="dimmed">
                {formatPhone(owner.phone)} · {owner.email}
              </Text>
              {canSeeOwnerPrivate(viewer, flat.id) ? (
                <>
                  <Text size="sm">{owner.address}</Text>
                  <Text size="sm">Emergency: {owner.emergency}</Text>
                </>
              ) : null}
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Private.
            </Text>
          )}
        </Section>

        <Divider color="sand.2" />

        <Section title="Tenant">
          {tenant && canSeeTenant(viewer, tenant) ? (
            <TenantBlock tenant={tenant} showProof={canSeeIdProof(viewer, flat.id)} onViewProof={onViewProof} />
          ) : tenant ? (
            <Text size="sm" c="dimmed">
              Rented. Tenant details are private.
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              No active tenant.
            </Text>
          )}
        </Section>

        {showHistory && others.length > 0 ? (
          <>
            <Divider color="sand.2" />
            <Section title="Other tenancies">
              {others.map((item) => (
                <Group key={item.id} justify="space-between" wrap="nowrap">
                  <Text size="sm">{item.name}</Text>
                  <Group gap={6} wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      {formatDate(item.moveIn)} → {item.moveOut ? formatDate(item.moveOut) : 'present'}
                    </Text>
                    <StatusBadge status={tenancyState(item)} size="xs" />
                  </Group>
                </Group>
              ))}
            </Section>
          </>
        ) : null}
      </Stack>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" tt="uppercase" fw={700} c="sand.7">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

function TenantBlock({
  tenant,
  showProof,
  onViewProof,
}: {
  tenant: Tenant
  showProof: boolean
  onViewProof: (file: Attachment) => void
}) {
  return (
    <>
      <Text fw={600}>{tenant.name}</Text>
      <Text size="sm" c="dimmed">
        {formatPhone(tenant.phone)} · {tenant.email}
      </Text>
      <Text size="sm">
        {tenant.occupants} occupants · moved in {formatDate(tenant.moveIn)}
      </Text>
      <Text size="sm">Agreement ends {formatDate(tenant.agreementEnd)}</Text>
      {tenant.vehicle ? <Text size="sm">Vehicle {tenant.vehicle}</Text> : null}
      <Text size="sm">Emergency: {tenant.emergency}</Text>
      {showProof && tenant.idProof ? (
        <Button mt="xs" variant="light" w="fit-content" onClick={() => tenant.idProof && onViewProof(tenant.idProof)}>
          View ID proof
        </Button>
      ) : null}
    </>
  )
}
