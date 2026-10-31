import { Button, Stack } from '@mantine/core'
import dayjs from 'dayjs'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { ResponsiveList } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { listMonths } from '../../utils/calculations.ts'
import { formatDateTime, formatMonth } from '../../utils/format.ts'
import { notifySuccess } from '../../utils/notify.ts'

export function LockMonthPage() {
  const { user } = useAuth()
  const { expenses, payments, monthLocks, isLocked, setMonthLock } = useBuilding()
  const { can } = usePermissions()
  const [pending, setPending] = useState<string | null>(null)
  if (!user) return null

  // Every month that has activity or a lock history.
  const months = [
    ...new Set([...listMonths(expenses), ...payments.map((payment) => payment.month), ...monthLocks.map((lock) => lock.month)]),
  ].sort((left, right) => right.localeCompare(left))

  const pendingLocked = pending ? isLocked(pending) : false
  const confirm = () => {
    if (!pending) return
    setMonthLock(pending, !pendingLocked, user.name)
    notifySuccess(pendingLocked ? 'Month unlocked' : 'Month locked', formatMonth(pending))
    setPending(null)
  }

  const rows = months.map((month) => {
    const lock = monthLocks.find((item) => item.month === month)
    const locked = isLocked(month)
    const status = <StatusBadge status={locked ? 'Locked' : 'Open'} />
    const lockedOn = lock?.lockedAt ? formatDateTime(lock.lockedAt) : '—'
    const unlockedOn = lock?.unlockedAt ? formatDateTime(lock.unlockedAt) : '—'
    return {
      key: month,
      cells: [
        dayjs(`${month}-01`).format('MMMM'),
        month.slice(0, 4),
        status,
        lock?.lockedBy || '—',
        lockedOn,
        lock?.unlockedBy || '—',
        unlockedOn,
      ],
      card: {
        title: formatMonth(month),
        badge: status,
        fields: [
          { label: 'Locked', value: lock?.lockedBy ? `${lock.lockedBy} · ${lockedOn}` : '—' },
          { label: 'Unlocked', value: lock?.unlockedBy ? `${lock.unlockedBy} · ${unlockedOn}` : '—' },
        ],
      },
      actions: can('lockMonth', 'manage') ? (
        <Button size="xs" variant={locked ? 'default' : 'light'} color={locked ? undefined : 'red'} onClick={() => setPending(month)}>
          {locked ? 'Unlock' : 'Lock'}
        </Button>
      ) : undefined,
    }
  })

  return (
    <Stack gap="lg">
      <PageHeading
        title="Lock Month"
        description="Locking a month blocks new expenses, edits, deletes, and payments for it until you unlock it."
      />
      <ResponsiveList headers={['Month', 'Year', 'Status', 'Locked by', 'Lock date', 'Unlocked by', 'Unlock date']} rows={rows} />
      <ConfirmDialog
        opened={pending !== null}
        title={pendingLocked ? 'Unlock month' : 'Lock month'}
        message={
          pending
            ? pendingLocked
              ? `Unlock ${formatMonth(pending)}? Authorised users can edit its expenses and add payments again.`
              : `Lock ${formatMonth(pending)}? Nobody can add, edit, or delete its expenses or add payments until it is unlocked.`
            : ''
        }
        confirmLabel={pendingLocked ? 'Unlock' : 'Lock'}
        color={pendingLocked ? 'terracotta' : 'red'}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </Stack>
  )
}
