import { Anchor, SimpleGrid, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { paths } from '../../routes/nav.ts'
import type { Attachment } from '../../types/models.ts'
import { sortByFlatNumber } from '../../utils/calculations.ts'
import { FlatDetails } from './FlatDetails.tsx'

/** Common Flats view. Read-only for every role: the admin manages flats under Admin → Flats. */
export function FlatsPage() {
  const { user } = useAuth()
  const { flats } = useBuilding()
  const [proof, setProof] = useState<Attachment | null>(null)
  if (!user) return null

  const visible = user.role === 'admin' ? sortByFlatNumber(flats) : flats.filter((flat) => flat.id === user.flatId)

  return (
    <Stack gap="lg">
      <PageHeading
        title="Flats"
        description={
          user.role === 'admin'
            ? 'Every flat with its owner and tenant. Status comes from whether a tenant is active today.'
            : user.role === 'owner'
              ? 'Your flat, your details, and your tenant, including their ID proof.'
              : 'Your flat, your own details, and the owner’s contact.'
        }
      />
      {user.role === 'admin' ? (
        <Text size="sm" c="dimmed">
          This page is read-only. To add, edit, or delete a flat, open{' '}
          <Anchor component={Link} to={paths.adminFlats} c="terracotta.8">
            Admin → Flats
          </Anchor>
          .
        </Text>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState title="No flat to show" message="Your account is not linked to a flat yet. Ask the admin." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {visible.map((flat) => (
            <FlatDetails key={flat.id} flat={flat} viewer={user} onViewProof={setProof} />
          ))}
        </SimpleGrid>
      )}
      <FilePreview
        file={proof}
        title="ID proof"
        note="Private. Only an admin, or the owner of this flat, can open it."
        onClose={() => setProof(null)}
      />
    </Stack>
  )
}
