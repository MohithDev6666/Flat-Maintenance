import { Alert, Badge, Button, Card, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { BarChart } from '@mantine/charts'
import { useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { DownloadBar } from '../../components/ui/DownloadBar.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import type { Attachment, ResidentKind } from '../../types/models.ts'
import { downloadCsv, downloadPdf, openWhatsApp } from '../../utils/download.ts'
import { formatDate, formatINR, formatMonth } from '../../utils/format.ts'
import {
  buildMonthLedger,
  flatSettlements,
  listMonths,
  monthOf,
  sortExpenses,
  totalsByCategory,
  type SideSettlement,
} from '../../utils/calculations.ts'
import { screenshotsFor } from '../../utils/payments.ts'

function balanceText(side: SideSettlement): string {
  return side.balance < 0 ? `Owed ${formatINR(-side.balance)}` : formatINR(side.balance)
}

export function SummaryPage() {
  const { user } = useAuth()
  const { building, expenses, flats, owners, tenants, accounts, payments, isLocked } = useBuilding()
  const [month, setMonth] = useState<string>(calendar.currentMonth)
  const [file, setFile] = useState<{ title: string; file: Attachment } | null>(null)
  if (!user) return null

  const data = { flats, owners, tenants, accounts }
  const ledger = buildMonthLedger(expenses, data, month)
  const categoryTotals = totalsByCategory(expenses, month)
  const settlements = flatSettlements(ledger, expenses, payments, data)
  const monthLabel = formatMonth(month)
  const monthExpenses = sortExpenses(expenses).filter((expense) => monthOf(expense.date) === month)
  const collected = payments.filter((payment) => payment.month === month).reduce((sum, payment) => sum + payment.amount, 0)
  const outstanding = settlements.reduce(
    (sum, row) => sum + Math.max(0, row.owner.balance) + Math.max(0, row.tenant.balance),
    0,
  )

  // Admin sees every flat. Owners see their flat with its tenant; tenants see only their own side.
  const rows = user.role === 'admin' ? settlements : settlements.filter((row) => row.line.flatId === user.flatId)
  const showOwner = user.role !== 'tenant'

  const lines = [
    building.name,
    monthLabel,
    `Total expenses ${formatINR(ledger.total)}`,
    `Owner responsibility ${formatINR(ledger.ownerPool)}`,
    `Tenant responsibility ${formatINR(ledger.tenantPool)}`,
    `Collected ${formatINR(collected)}`,
    `Outstanding ${formatINR(outstanding)}`,
    `Rounding ${formatINR(ledger.rounding)}`,
    ...rows.map(({ line, owner, tenant }) =>
      [
        `Flat ${line.number}:`,
        showOwner ? `owner ${formatINR(owner.due)} (${owner.status})` : '',
        `tenant ${formatINR(tenant.due)} (${tenant.status})`,
      ]
        .filter(Boolean)
        .join(' '),
    ),
  ]

  const csvHeaders = [
    'Flat',
    ...(showOwner ? ['Owner', 'Owner due', 'Owner paid', 'Owner balance', 'Owner status'] : []),
    'Tenant',
    'Tenant due',
    'Tenant paid',
    'Tenant balance',
    'Tenant status',
  ]
  const csvRows = rows.map(({ line, owner, tenant }) => [
    line.number,
    ...(showOwner ? [line.ownerName ?? '', formatINR(owner.due), formatINR(owner.paid + owner.credit), balanceText(owner), owner.status] : []),
    line.tenantName ?? '',
    formatINR(tenant.due),
    formatINR(tenant.paid + tenant.credit),
    balanceText(tenant),
    tenant.status,
  ])

  const shotButtons = (flatId: string, role: ResidentKind) =>
    screenshotsFor(payments, flatId, role, month).map((payment) => (
      <Button
        key={payment.id}
        variant="subtle"
        size="compact-xs"
        px={0}
        onClick={() => setFile({ title: 'Payment screenshot', file: payment.screenshot })}
      >
        {payment.screenshot.name}
      </Button>
    ))

  return (
    <Stack gap="lg">
      <PageHeading
        title="Month Summary"
        description={`${monthLabel} for ${building.name}. Amounts update when an expense or payment changes.`}
        action={
          <DownloadBar
            onPdf={() => downloadPdf(`summary-${month}.pdf`, lines)}
            onCsv={() => downloadCsv(`summary-${month}.csv`, csvHeaders, csvRows)}
            onWhatsApp={() => openWhatsApp(lines.join('\n'))}
          />
        }
      />

      <Card maw={420}>
        <Select
          label="Month"
          searchable
          allowDeselect={false}
          value={month}
          onChange={(value) => setMonth(value ?? month)}
          data={listMonths(expenses)
            .slice()
            .reverse()
            .map((value) => ({ value, label: `${formatMonth(value)}${isLocked(value) ? ' · Locked' : ''}` }))}
        />
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="md">
        <StatCard label="Total expenses" value={formatINR(ledger.total)} />
        <StatCard label="Owner responsibility" value={formatINR(ledger.ownerPool)} />
        <StatCard label="Tenant responsibility" value={formatINR(ledger.tenantPool)} />
        <StatCard label="Total collected" value={formatINR(collected)} hint="Paid to the building" />
        <StatCard label="Total outstanding" value={formatINR(outstanding)} hint="After credit and payments" />
        <StatCard label="Rounding difference" value={formatINR(ledger.rounding)} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card>
          <Text fw={700} mb="xs">
            By category
          </Text>
          {categoryTotals.length === 0 ? (
            <EmptyState title="No expenses this month" />
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
        <Card p={0}>
          <Text fw={700} p="md" pb={0}>
            Category summary
          </Text>
          {categoryTotals.length === 0 ? (
            <EmptyState title="Nothing to sum yet" />
          ) : (
            <Table.ScrollContainer minWidth={420}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Category</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th>Responsibility</Table.Th>
                    <Table.Th ta="right">Expenses</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {categoryTotals.map((row) => (
                    <Table.Tr key={row.category}>
                      <Table.Td>{row.category}</Table.Td>
                      <Table.Td ta="right">{formatINR(row.amount)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="terracotta" size="sm">
                          {row.responsibility}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">{row.count}</Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td fw={700}>Owner total</Table.Td>
                    <Table.Td ta="right" fw={700}>
                      {formatINR(ledger.ownerPool)}
                    </Table.Td>
                    <Table.Td fw={700}>Tenant total</Table.Td>
                    <Table.Td ta="right" fw={700}>
                      {formatINR(ledger.tenantPool)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>
      </SimpleGrid>

      <Alert variant="light" color="terracotta" title="Rounding">
        Each expense is divided by {flats.length} and rounded to the nearest rupee. The difference this month is{' '}
        {formatINR(ledger.rounding)}. A tenant-tagged share goes to the tenant who was active on the 1st. If that flat
        had no tenant, the owner carries it. Paid includes expenses the person paid out of pocket.
      </Alert>

      <Card p={0}>
        <Text fw={700} p="md" pb={0}>
          {user.role === 'admin' ? 'Flat-wise summary' : 'Your flat'}
        </Text>
        <Table.ScrollContainer minWidth={showOwner ? 1080 : 560}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Flat</Table.Th>
                {showOwner ? (
                  <>
                    <Table.Th>Owner</Table.Th>
                    <Table.Th ta="right">Owner Due</Table.Th>
                    <Table.Th ta="right">Owner Paid</Table.Th>
                    <Table.Th>Owner Balance</Table.Th>
                  </>
                ) : null}
                <Table.Th>Tenant</Table.Th>
                <Table.Th ta="right">Tenant Due</Table.Th>
                <Table.Th ta="right">Tenant Paid</Table.Th>
                <Table.Th>Tenant Balance</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map(({ line, owner, tenant }) => (
                <Table.Tr key={line.flatId}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {line.number}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {line.status}
                    </Text>
                  </Table.Td>
                  {showOwner ? (
                    <>
                      <Table.Td>{line.ownerName ?? '—'}</Table.Td>
                      <Table.Td ta="right">{formatINR(owner.due)}</Table.Td>
                      <Table.Td ta="right">
                        {formatINR(owner.paid + owner.credit)}
                        {owner.credit > 0 ? (
                          <Text size="xs" c="dimmed">
                            incl. {formatINR(owner.credit)} out of pocket
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4} align="flex-start">
                          <Text size="sm" c={owner.balance < 0 ? 'teal.8' : undefined}>
                            {balanceText(owner)}
                          </Text>
                          <StatusBadge status={owner.status} />
                          {shotButtons(line.flatId, 'owner')}
                        </Stack>
                      </Table.Td>
                    </>
                  ) : null}
                  <Table.Td>{user.role === 'tenant' ? 'You' : (line.tenantName ?? '—')}</Table.Td>
                  <Table.Td ta="right">{formatINR(tenant.due)}</Table.Td>
                  <Table.Td ta="right">
                    {formatINR(tenant.paid + tenant.credit)}
                    {tenant.credit > 0 ? (
                      <Text size="xs" c="dimmed">
                        incl. {formatINR(tenant.credit)} out of pocket
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4} align="flex-start">
                      <Text size="sm" c={tenant.balance < 0 ? 'teal.8' : undefined}>
                        {balanceText(tenant)}
                      </Text>
                      {line.tenantId ? <StatusBadge status={tenant.status} /> : <Text size="xs" c="dimmed">No tenant</Text>}
                      {shotButtons(line.flatId, 'tenant')}
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Card p={0}>
        <Text fw={700} p="md" pb={0}>
          Bills · {monthLabel}
        </Text>
        {monthExpenses.length === 0 ? (
          <EmptyState title="No expenses this month" />
        ) : (
          <Table.ScrollContainer minWidth={520}>
            <Table striped>
              <Table.Tbody>
                {monthExpenses.map((expense) => (
                  <Table.Tr key={expense.id}>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(expense.date)}</Table.Td>
                    <Table.Td>{expense.category}</Table.Td>
                    <Table.Td ta="right">{formatINR(expense.amount)}</Table.Td>
                    <Table.Td>
                      {expense.bill ? (
                        <Button
                          size="compact-xs"
                          variant="light"
                          onClick={() => expense.bill && setFile({ title: 'Bill', file: expense.bill })}
                        >
                          View bill
                        </Button>
                      ) : (
                        <Text size="xs" c="dimmed">
                          No bill
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {user.role === 'owner' ? (
        <Text size="sm" c="dimmed">
          You see your own flat, including its tenant. Other flats are only part of the building totals.
        </Text>
      ) : null}
      {user.role === 'tenant' ? (
        <Text size="sm" c="dimmed">
          You see your own share and payments and the building totals. Other residents stay hidden.
        </Text>
      ) : null}

      <FilePreview file={file?.file ?? null} title={file?.title ?? ''} onClose={() => setFile(null)} />
    </Stack>
  )
}
