import { Stack } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { LoadState } from '../../components/common/LoadState.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getBuilding } from '../../services/buildingService.ts'
import { getDashboardReport, type DashboardReport } from '../../services/reportService.ts'
import { can } from '../../utils/permissions.ts'
import { AdminDashboard } from './AdminDashboard.tsx'
import { DashboardHeader } from './DashboardParts.tsx'
import { ResidentDashboard } from './ResidentDashboard.tsx'

/** The dashboard report, with every figure already calculated by the backend. */
export interface DashboardData extends DashboardReport {
  buildingName: string
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [report, building] = await Promise.all([
        getDashboardReport(),
        can(user, 'building', 'view') ? getBuilding().catch(() => null) : Promise.resolve(null),
      ])
      setData({ ...report, buildingName: building?.name ?? '' })
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) return null

  if (!data) {
    return (
      <Stack gap="lg">
        <DashboardHeader user={user} buildingName="" locked={false} />
        <LoadState loading={loading} error={error} onRetry={load}>
          {null}
        </LoadState>
      </Stack>
    )
  }

  return user.role === 'admin' ? (
    <AdminDashboard user={user} data={data} onChanged={() => void load()} />
  ) : (
    <ResidentDashboard user={user} data={data} onChanged={() => void load()} />
  )
}
