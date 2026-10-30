import { Alert, Badge, Button, Card, Modal, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { BarChart } from '@mantine/charts'
import { useState } from 'react'
import { DownloadBar } from '../../components/ui/DownloadBar.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { apartment } from '../../mocks/apartment.ts'
import type { Payment } from '../../types/models.ts'
import { downloadCsv, downloadPdf, openWhatsApp } from '../../utils/download.ts'
import { formatINR, formatMonth } from '../../utils/format.ts'
import { buildMonthLedger, totalsByCategory } from '../../utils/ledger.ts'
import { partyPaid, screenshotsFor, settlementStatus } from '../../utils/payments.ts'

export function SummaryPage() {
  const { user } = useAuth()
  const { expenses, flats, payments } = useBuilding()
  const [shot, setShot] = useState<Payment | null>(null)
  if (!user) return null

  const ledger = buildMonthLedger(expenses, flats, apartment.currentMonth)
  const categoryTotals = totalsByCategory(expenses, apartment.currentMonth)
  const rows = user.role === 'tenant' ? ledger.flats.filter((flat) => flat.number === user.flatNumber) : ledger.flats
  const monthLabel = formatMonth(apartment.currentMonth)

  const lines = [
    apartment.name,
    monthLabel,
    `Total ${formatINR(ledger.total)}`,
    `Owner pool ${formatINR(ledger.ownerPool)}`,
    `Tenant pool ${formatINR(ledger.tenantPool)}`,
    `Rounding ${formatINR(ledger.rounding)}`,
    ...rows.map((flat) => {
      const ownerPaid = partyPaid(payments, flat.number, 'owner', apartment.currentMonth)
      const tenantPaid = partyPaid(payments, flat.number, 'tenant', apartment.currentMonth)
      return `Flat ${flat.number}: owner ${formatINR(flat.ownerDue)} (${settlementStatus(flat.ownerDue, ownerPaid)}), tenant ${formatINR(flat.tenantDue)} (${settlementStatus(flat.tenantDue, tenantPaid)})`
    }),
  ]

  const exportRows = rows.map((flat) => {
    const ownerShots = screenshotsFor(payments, flat.number, 'owner', apartment.currentMonth)
    const tenantShots = screenshotsFor(payments, flat.number, 'tenant', apartment.currentMonth)
    return [
      flat.number,
      flat.status,
      formatINR(flat.ownerDue),
      settlementStatus(flat.ownerDue, partyPaid(payments, flat.number, 'owner', apartment.currentMonth)),
      ownerShots.map((payment) => payment.screenshotLabel).join(' | '),
      formatINR(flat.tenantDue),
      settlementStatus(flat.tenantDue, partyPaid(payments, flat.number, 'tenant', apartment.currentMonth)),
      tenantShots.map((payment) => payment.screenshotLabel).join(' | '),
    ]
  })

  return (
    <Stack gap="lg">
      <PageHeading
        title="Month summary"
        description={`${monthLabel} for ${apartment.name}. Amounts update when an expense or payment changes.`}
        action={
          <DownloadBar
            onPdf={() => downloadPdf(`summary-${apartment.currentMonth}.pdf`, lines)}
            onCsv={() =>
              downloadCsv(
                `summary-${apartment.currentMonth}.csv`,
                ['Flat', 'Occupancy', 'Owner due', 'Owner status', 'Owner screenshots', 'Tenant due', 'Tenant status', 'Tenant screenshots'],
                exportRows,
              )
            }
            onWhatsApp={() => openWhatsApp(lines.join('\n'))}
          />
        }
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard label="Total" value={formatINR(ledger.total)} />
        <StatCard label="Owner pool" value={formatINR(ledger.ownerPool)} />
        <StatCard label="Tenant pool" value={formatINR(ledger.tenantPool)} />
      </SimpleGrid>

      <Card>
        <Text fw={700} mb="xs">
          By category
        </Text>
        {categoryTotals.length === 0 ? (
          <Text c="dimmed">No expenses this month.</Text>
        ) : (
          <BarChart
            h={260}
            data={categoryTotals}
            dataKey="category"
            series={[{ name: 'amount', color: 'terracotta.6', label: 'Amount' }]}
            valueFormatter={(value) => formatINR(Number(value))}
            withLegend={false}
            gridAxis="y"
          />
        )}
      </Card>

      <Alert variant="light" color="terracotta" title="Rounding">
        Each expense is divided by {flats.length} and rounded to the nearest rupee. The difference this month is{' '}
        {formatINR(ledger.rounding)}. A tenant-tagged share goes to the tenant who was active on the 1st. If that flat
        had no tenant, the owner carries it.
      </Alert>

      <Card p={0}>
        <Table.ScrollContainer minWidth={860}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Flat</Table.Th>
                <Table.Th>People</Table.Th>
                <Table.Th>Occupancy</Table.Th>
                <Table.Th>Owner due</Table.Th>
                <Table.Th>Owner paid</Table.Th>
                <Table.Th>Tenant due</Table.Th>
                <Table.Th>Tenant paid</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((flat) => {
                const showNames = user.role === 'admin' || (user.role === 'owner' && user.flatNumber === flat.number)
                const people = showNames
                  ? [flat.ownerName, flat.tenantName].filter(Boolean).join(' · ')
                  : user.role === 'tenant' && user.flatNumber === flat.number
                    ? 'You'
                    : '—'
                const ownerPaid = partyPaid(payments, flat.number, 'owner', apartment.currentMonth)
                const tenantPaid = partyPaid(payments, flat.number, 'tenant', apartment.currentMonth)
                const ownerShots = screenshotsFor(payments, flat.number, 'owner', apartment.currentMonth)
                const tenantShots = screenshotsFor(payments, flat.number, 'tenant', apartment.currentMonth)
                return (
                  <Table.Tr key={flat.number}>
                    <Table.Td>{flat.number}</Table.Td>
                    <Table.Td>{people || '—'}</Table.Td>
                    <Table.Td>{flat.status}</Table.Td>
                    <Table.Td>{formatINR(flat.ownerDue)}</Table.Td>
                    <Table.Td>
                      <PayCell status={settlementStatus(flat.ownerDue, ownerPaid)} shots={ownerShots} onOpen={setShot} />
                    </Table.Td>
                    <Table.Td>{formatINR(flat.tenantDue)}</Table.Td>
                    <Table.Td>
                      <PayCell status={settlementStatus(flat.tenantDue, tenantPaid)} shots={tenantShots} onOpen={setShot} />
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {user.role === 'owner' ? (
        <Text size="sm" c="dimmed">
          You can see every flat’s amounts. Names are shown only for your own flat.
        </Text>
      ) : null}
      {user.role === 'tenant' ? (
        <Text size="sm" c="dimmed">
          You see your own line and the building totals. Other residents’ names stay hidden.
        </Text>
      ) : null}
      <Modal opened={shot !== null} onClose={() => setShot(null)} title="Payment screenshot">
        {shot ? (
          <Stack gap="xs">
            <Text fw={600}>{shot.screenshotLabel}</Text>
            <Text size="sm" c="dimmed">
              {shot.payerName} · {formatINR(shot.amount)} · {shot.mode}
            </Text>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  )
}

function PayCell({
  status,
  shots,
  onOpen,
}: {
  status: string
  shots: Payment[]
  onOpen: (payment: Payment) => void
}) {
  return (
    <Stack gap={4}>
      <Badge variant="light" color={status === 'Paid' ? 'teal' : status === 'Partial' ? 'yellow' : 'terracotta'}>
        {status}
      </Badge>
      {shots.map((payment) => (
        <Button key={payment.id} variant="subtle" size="xs" onClick={() => onOpen(payment)}>
          {payment.screenshotLabel}
        </Button>
      ))}
    </Stack>
  )
}
