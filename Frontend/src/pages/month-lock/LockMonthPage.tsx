import { Button, Stack } from '@mantine/core'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { ResponsiveList } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getExpenses } from '../../services/expenseService.ts'
import { getMonthLocks, lockChecker, setMonthLock } from '../../services/monthLockService.ts'
import { getPayments } from '../../services/paymentService.ts'
import type { Expense, MonthLock, Payment } from '../../types/models.ts'
import { listMonths } from '../../utils/calculations.ts'
import { formatDateTime, formatMonth } from '../../utils/format.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'

export function LockMonthPage() {
  const { can } = usePermissions()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canSeeExpenses = can('expenses', 'view')
  const canSeePayments = can('payments', 'view')

  const load = useCallback(async () => {
    try {
      const [lockList, expenseList, paymentList] = await Promise.all([
        getMonthLocks(),
        canSeeExpenses ? getExpenses() : Promise.resolve([]),
        canSeePayments ? getPayments() : Promise.resolve([]),
      ])
      setMonthLocks(lockList)
      setExpenses(expenseList)
      setPayments(paymentList)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [canSeeExpenses, canSeePayments])

  useEffect(() => {
    void load()
  }, [load])

  const isLocked = lockChecker(monthLocks)

  // Every month that has activity or a lock history, plus the current month.
  const months = [
    ...new Set([...listMonths(expenses), ...payments.map((payment) => payment.month), ...monthLocks.map((lock) => lock.month)]),
  ]
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))

  const pendingLocked = pending ? isLocked(pending) : false
  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await setMonthLock(pending, !pendingLocked)
      notifySuccess(pendingLocked ? 'Month unlocked' : 'Month locked', formatMonth(pending))
      setPending(null)
      await load()
    } catch (failure) {
      notifyApiError(failure, pendingLocked ? 'Not unlocked' : 'Not locked')
    } finally {
      setBusy(false)
    }
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
      actions: can('lockMonth', 'edit') ? (
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
      <LoadState loading={loading} error={error} onRetry={load}>
        <ResponsiveList headers={['Month', 'Year', 'Status', 'Locked by', 'Lock date', 'Unlocked by', 'Unlock date']} rows={rows} />
      </LoadState>
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
        loading={busy}
        onConfirm={() => void confirm()}
        onClose={() => setPending(null)}
      />
    </Stack>
  )
}
