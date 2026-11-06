import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getFlats } from '../../services/flatService.ts'
import { getMonthLocks, lockChecker } from '../../services/monthLockService.ts'
import { getOwners } from '../../services/ownerService.ts'
import { clearPaymentFlag, flagPayment, getPayments, paymentVerification } from '../../services/paymentService.ts'
import { getPayStatus, type PayStatusReport } from '../../services/reportService.ts'
import { getTenants } from '../../services/tenantService.ts'
import { getAccountsFor } from '../../services/userService.ts'
import type { Attachment, Flat, MonthLock, Owner, Payment, Tenant, UserAccount } from '../../types/models.ts'
import { calendar } from '../../utils/calendar.ts'
import { formatDate, formatINR, formatMonth } from '../../utils/format.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'
import { can } from '../../utils/permissions.ts'
import { sessionAccount } from '../../utils/session.ts'
import { PaymentForm } from './PaymentForm.tsx'

export function PayPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [status, setStatus] = useState<PayStatusReport | null>(null)
  const [flats, setFlats] = useState<Flat[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState<string>(calendar.currentMonth)
  const [note, setNote] = useState('')
  const [flagId, setFlagId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [shot, setShot] = useState<Attachment | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      // Payments are the page. The due / status cards come calculated from the pay-status API;
      // the rest feeds the admin's dropdowns.
      const [paymentList, statusReport, flatList, ownerList, tenantList, accountList, lockList] = await Promise.all([
        getPayments(),
        getPayStatus(month),
        getFlats().catch(() => []),
        getOwners().catch(() => []),
        getTenants().catch(() => []),
        getAccountsFor(user).catch(() => [sessionAccount(user)]),
        getMonthLocks().catch(() => []),
      ])
      setPayments(paymentList)
      setStatus(statusReport)
      setFlats(flatList)
      setOwners(ownerList)
      setTenants(tenantList)
      setAccounts(accountList)
      setMonthLocks(lockList)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [user, month])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) return null

  const review = async (payment: Payment, flagged: boolean) => {
    setReviewing(payment.id)
    try {
      if (flagged) await flagPayment(payment.id, note)
      else await clearPaymentFlag(payment.id)
      notifySuccess(
        flagged ? 'Payment flagged' : 'Payment verified',
        flagged ? 'It does not count as paid until you verify it. The payer will see your note.' : 'It now counts as paid.',
      )
      setFlagId(null)
      setNote('')
      await load()
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setReviewing(null)
    }
  }

  // Due, arrears, covered and status are calculated by the backend; only verified payments count.
  const row = status?.row ?? null
  const covered = status?.covered ?? 0
  const reviewer = can(user, 'payments', 'manage')

  // The API already scopes a resident's list to their own payments.
  const visible = [...payments].sort((left, right) => right.date.localeCompare(left.date) || right.month.localeCompare(left.month))
  const isLocked = lockChecker(monthLocks)
  const flatNumber = (flatId: string) => flats.find((flat) => flat.id === flatId)?.number ?? '—'

  return (
    <Stack gap="lg">
      <PageHeading
        title="Pay / Upload"
        description="Record money paid to the building. A screenshot is required. Your upload waits for the admin to verify it; once verified it counts and the status becomes Partial or Paid."
      />

      {user.role === 'admin' ? (
        <Alert variant="light" color="terracotta" title="Admin review">
          Residents’ uploads arrive as “Pending verification” and only count as paid after you verify them. Check the
          screenshot, then Verify it, or mark it “Needs check” with a note for the payer. Payments you record here are
          verified straight away.
        </Alert>
      ) : null}

      <LoadState loading={loading} error={error} onRetry={load}>
      <Stack gap="lg">
      {row ? (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <StatCard label="Due" value={formatINR(row.due)} hint={formatMonth(month)} />
          <StatCard label="Arrears" value={formatINR(row.arrears)} hint="Carried in" />
          <StatCard label="Covered" value={formatINR(covered)} hint="Out of pocket plus verified payments" />
          <Card bg="white">
            <Text size="xs" tt="uppercase" fw={700} c="sand.7" style={{ letterSpacing: '0.04em' }}>
              Status
            </Text>
            <Group mt={8} gap="xs">
              {status?.status ? <StatusBadge status={status.status} size="lg" /> : null}
            </Group>
            <Text size="xs" c="dimmed" mt={6}>
              {row.owedToYou > 0 ? `Owed to you ${formatINR(row.owedToYou)}` : `Outstanding ${formatINR(row.balance)}`}
            </Text>
            {row.pendingVerification > 0 ? (
              <Text size="xs" c="orange.8" fw={600} mt={4}>
                {formatINR(row.pendingVerification)} waiting for admin verification
              </Text>
            ) : null}
          </Card>
        </SimpleGrid>
      ) : null}

      {can(user, 'payments', 'add') ? (
        <PaymentForm
          user={user}
          month={month}
          onMonthChange={setMonth}
          flats={flats}
          owners={owners}
          tenants={tenants}
          accounts={accounts}
          months={status?.months ?? []}
          payments={payments}
          isLocked={isLocked}
          onSaved={() => void load()}
        />
      ) : null}

      <Stack gap="sm">
        <Text fw={700}>{user.role === 'admin' ? 'All payments' : user.role === 'owner' ? 'Payments for your flat' : 'Your payments'}</Text>
        {visible.length === 0 ? (
          <Card>
            <EmptyState title="No payments yet" message="Saved payments appear here with their screenshot." />
          </Card>
        ) : null}
        {visible.map((payment: Payment) => (
          <Card key={payment.id}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Text fw={700}>{formatINR(payment.amount)}</Text>
                <Text size="sm" c="dimmed">
                  {payment.payerName} · Flat {flatNumber(payment.flatId)} {payment.role} · {formatMonth(payment.month)}
                </Text>
                <Text size="sm" c="dimmed">
                  {formatDate(payment.date)} · {payment.mode}
                  {payment.reference ? ` · Ref ${payment.reference}` : ''}
                </Text>
                <Button variant="subtle" size="compact-sm" px={0} mt={4} onClick={() => setShot(payment.screenshot)}>
                  Screenshot: {payment.screenshot.name}
                </Button>
              </div>
              <Badge
                variant="light"
                color={{ 'Needs check': 'red', 'Pending verification': 'orange', Verified: 'teal' }[paymentVerification(payment)]}
                style={{ flexShrink: 0 }}
              >
                {paymentVerification(payment)}
              </Badge>
            </Group>
            {payment.needsCheck && payment.checkNote ? (
              <Alert color="red" variant="light" mt="sm" p="xs">
                <Text size="sm">Admin note: {payment.checkNote}</Text>
              </Alert>
            ) : null}
            {reviewer ? (
              <Stack gap="xs" mt="sm">
                {flagId === payment.id ? (
                  <>
                    <TextInput
                      label="Note for the payer"
                      value={note}
                      onChange={(event) => setNote(event.currentTarget.value)}
                    />
                    <Group>
                      <Button size="sm" loading={reviewing === payment.id} onClick={() => void review(payment, true)}>
                        Save flag
                      </Button>
                      <Button size="sm" variant="default" disabled={reviewing === payment.id} onClick={() => setFlagId(null)}>
                        Cancel
                      </Button>
                    </Group>
                  </>
                ) : paymentVerification(payment) === 'Verified' ? (
                  <Button size="sm" variant="light" w="fit-content" onClick={() => setFlagId(payment.id)}>
                    Needs check
                  </Button>
                ) : (
                  // Pending or flagged: the admin verifies it (it then counts as paid) or sends it back with a note.
                  <Group gap="xs">
                    <Button size="sm" w="fit-content" loading={reviewing === payment.id} onClick={() => void review(payment, false)}>
                      {payment.needsCheck ? 'Mark as checked' : 'Verify'}
                    </Button>
                    {payment.needsCheck ? null : (
                      <Button
                        size="sm"
                        variant="light"
                        color="red"
                        w="fit-content"
                        disabled={reviewing === payment.id}
                        onClick={() => setFlagId(payment.id)}
                      >
                        Needs check
                      </Button>
                    )}
                  </Group>
                )}
              </Stack>
            ) : null}
          </Card>
        ))}
      </Stack>
      </Stack>
      </LoadState>

      <FilePreview file={shot} title="Payment screenshot" onClose={() => setShot(null)} />
    </Stack>
  )
}
