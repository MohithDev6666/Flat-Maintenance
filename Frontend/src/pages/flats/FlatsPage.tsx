import { Anchor, SimpleGrid, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { paths } from '../../routes/nav.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getFlats } from '../../services/flatService.ts'
import { getOwners } from '../../services/ownerService.ts'
import { getTenants } from '../../services/tenantService.ts'
import type { Attachment, Flat, Owner, Tenant } from '../../types/models.ts'
import { sortByFlatNumber } from '../../utils/calculations.ts'
import { FlatDetails } from './FlatDetails.tsx'

/** Common Flats view. Read-only for every role: the admin manages flats under Admin → Flats. */
export function FlatsPage() {
  const { user } = useAuth()
  const [flats, setFlats] = useState<Flat[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proof, setProof] = useState<Attachment | null>(null)

  const load = useCallback(async () => {
    try {
      const [flatList, ownerList, tenantList] = await Promise.all([getFlats(), getOwners(), getTenants()])
      setFlats(flatList)
      setOwners(ownerList)
      setTenants(tenantList)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
      <LoadState loading={loading} error={error} onRetry={load}>
        {visible.length === 0 ? (
          <EmptyState
            title="No flat to show"
            message={user.role === 'admin' ? 'No flats have been added yet.' : 'Your account is not linked to a flat yet. Ask the admin.'}
          />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {visible.map((flat) => (
              <FlatDetails key={flat.id} flat={flat} owners={owners} tenants={tenants} viewer={user} onViewProof={setProof} />
            ))}
          </SimpleGrid>
        )}
      </LoadState>
      <FilePreview
        file={proof}
        title="ID proof"
        note="Private. Only an admin, or the owner of this flat, can open it."
        onClose={() => setProof(null)}
      />
    </Stack>
  )
}
