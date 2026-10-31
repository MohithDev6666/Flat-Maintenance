import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import type { Attachment, Payment } from '../../types/models.ts'
import { partyForUser, partyHistory, settlementStatus } from '../../utils/calculations.ts'
import { formatDate, formatINR, formatMonth } from '../../utils/format.ts'
import { can } from '../../utils/permissions.ts'
import { PaymentForm } from './PaymentForm.tsx'

export function PayPage() {
  const { user } = useAuth()
  const { payments, flats, owners, tenants, accounts, expenses, flagPayment, clearPaymentFlag } = useBuilding()
  const [month, setMonth] = useState<string>(calendar.currentMonth)
  const [note, setNote] = useState('')
  const [flagId, setFlagId] = useState<string | null>(null)
  const [shot, setShot] = useState<Attachment | null>(null)
  if (!user) return null

  const data = { flats, owners, tenants, accounts }
  const party = partyForUser(user, data)
  const row = party ? partyHistory(party, expenses, data, payments).find((item) => item.month === month) : undefined
  const owing = row ? row.due + row.arrears : 0
  const covered = row ? row.credit + row.paidToBuilding : 0
  const reviewer = can(user, 'payments', 'manage')

  // Owners also see their flat's tenant payments; tenants see only their own.
  const visible = payments.filter((payment) => {
    if (user.role === 'admin') return true
    if (user.role === 'owner') return payment.flatId === user.flatId
    return payment.userId === user.id || (payment.role === 'tenant' && payment.residentId === user.tenantId)
  })
  const flatNumber = (flatId: string) => flats.find((flat) => flat.id === flatId)?.number ?? '—'

  return (
    <Stack gap="lg">
      <PageHeading
        title="Pay / Upload"
        description="Record money paid to the building. A screenshot is required. Status becomes Unpaid, Partial, or Paid straight away."
      />

      {user.role === 'admin' ? (
        <Alert variant="light" color="terracotta" title="Admin review">
          Record a payment for any flat, or flag one in the list as “Needs check” with a note for the payer.
        </Alert>
      ) : null}

      {row ? (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <StatCard label="Due" value={formatINR(row.due)} hint={formatMonth(month)} />
          <StatCard label="Arrears" value={formatINR(row.arrears)} hint="Carried in" />
          <StatCard label="Covered" value={formatINR(covered)} hint="Out of pocket plus paid" />
          <Card bg="white">
            <Text size="xs" tt="uppercase" fw={700} c="sand.7" style={{ letterSpacing: '0.04em' }}>
              Status
            </Text>
            <Group mt={8} gap="xs">
              <StatusBadge status={settlementStatus(owing, covered)} size="lg" />
            </Group>
            <Text size="xs" c="dimmed" mt={6}>
              {row.owedToYou > 0 ? `Owed to you ${formatINR(row.owedToYou)}` : `Outstanding ${formatINR(row.balance)}`}
            </Text>
          </Card>
        </SimpleGrid>
      ) : null}

      {can(user, 'payments', 'add') ? <PaymentForm user={user} month={month} onMonthChange={setMonth} /> : null}

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
              {payment.needsCheck ? (
                <Badge color="red" variant="light" style={{ flexShrink: 0 }}>
                  Needs check
                </Badge>
              ) : (
                <Badge variant="light" color="terracotta" style={{ flexShrink: 0 }}>
                  Recorded
                </Badge>
              )}
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
                      <Button
                        size="sm"
                        onClick={() => {
                          flagPayment(payment.id, note, user.name)
                          setFlagId(null)
                          setNote('')
                        }}
                      >
                        Save flag
                      </Button>
                      <Button size="sm" variant="default" onClick={() => setFlagId(null)}>
                        Cancel
                      </Button>
                    </Group>
                  </>
                ) : payment.needsCheck ? (
                  <Button size="sm" variant="default" w="fit-content" onClick={() => clearPaymentFlag(payment.id, user.name)}>
                    Mark as checked
                  </Button>
                ) : (
                  <Button size="sm" variant="light" w="fit-content" onClick={() => setFlagId(payment.id)}>
                    Needs check
                  </Button>
                )}
              </Stack>
            ) : null}
          </Card>
        ))}
      </Stack>

      <FilePreview file={shot} title="Payment screenshot" onClose={() => setShot(null)} />
    </Stack>
  )
}
