import { Alert, Badge, Button, Card, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { BarChart } from '@mantine/charts'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { DownloadBar } from '../../components/ui/DownloadBar.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getBuilding } from '../../services/buildingService.ts'
import { getSummaryReport, type SideSettlement, type SummaryReport } from '../../services/reportService.ts'
import type { Building } from '../../types/models.ts'
import { calendar } from '../../utils/calendar.ts'
import { can } from '../../utils/permissions.ts'
import type { Attachment } from '../../types/models.ts'
import { downloadCsv, openWhatsApp } from '../../utils/download.ts'
import { formatDate, formatINR, formatMonth, formatPhone } from '../../utils/format.ts'
import { notifySuccess } from '../../utils/notify.ts'
import { downloadReportPdf, reportPdfFile, type PdfReport, type PdfSection } from '../../utils/pdfReport.ts'

function balanceText(side: SideSettlement): string {
  return side.balance < 0 ? `Owed ${formatINR(-side.balance)}` : formatINR(side.balance)
}

const noSide: SideSettlement = { due: 0, credit: 0, paid: 0, pending: 0, balance: 0, status: 'Paid', payments: [] }

export function SummaryPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<SummaryReport | null>(null)
  const [buildingName, setBuildingName] = useState('')
  const [buildingInfo, setBuildingInfo] = useState<Building | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState<string>(calendar.currentMonth)

  // Every figure on this screen is calculated by the backend for the chosen month.
  const load = useCallback(async () => {
    if (!user) return
    try {
      const [data, building] = await Promise.all([
        getSummaryReport(month),
        can(user, 'building', 'view') ? getBuilding().catch(() => null) : Promise.resolve(null),
      ])
      setSummary(data)
      setBuildingName(building?.name ?? '')
      setBuildingInfo(building)
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
  const [file, setFile] = useState<{ title: string; file: Attachment } | null>(null)
  if (!user) return null

  if (!summary || error) {
    return (
      <Stack gap="lg">
        <PageHeading title="Month Summary" />
        <LoadState loading={loading} error={error} onRetry={load}>
          {null}
        </LoadState>
      </Stack>
    )
  }

  const lockedMonths = new Set(summary.months.filter((option) => option.locked).map((option) => option.month))
  const isLocked = (value: string) => lockedMonths.has(value)
  const building = { name: buildingName || 'Flat Maintenance' }

  const ledger = summary.totals
  const categoryTotals = summary.categories
  const monthLabel = formatMonth(month)
  const monthExpenses = summary.bills
  const collected = summary.totals.collected
  const outstanding = summary.totals.outstanding
  const flats = { length: summary.flatCount }
  const splitNote = `Each expense is divided equally across the ${flats.length} flats, exact to the paisa, with no rounding. When an amount does not divide evenly (for example ₹100 across 3 flats), the leftover paise go one each to the first flats in flat-number order (₹33.34, ₹33.33, ₹33.33), so the shares always add up to the full amount. A tenant-tagged share goes to the tenant who was active on the 1st; if the flat had no tenant, the owner carries it. Paid counts out-of-pocket expenses and payments the admin has verified; uploads waiting for verification are shown separately.`

  // The API sends only what this viewer may see: every flat for the admin, the resident's own flat
  // otherwise, and no owner side for a tenant.
  const rows = summary.flats.map((row) => ({ line: row, owner: row.owner ?? noSide, tenant: row.tenant }))
  const showOwner = summary.scope !== 'tenant'

  // WhatsApp message: *bold* headings, one block per flat, and a status mark for each side.
  const statusMark = (status: string) => (status === 'Paid' ? '✅' : status === 'Partial' ? '🟡' : '🔴')
  const sideLine = (label: string, name: string | null, side: SideSettlement) =>
    `   ${label}${name ? ` (${name})` : ''}: Due ${formatINR(side.due)} · Paid ${formatINR(side.paid + side.credit)} · ${balanceText(side)} ${statusMark(side.status)} ${side.status}`
  const whatsAppMessage = [
    `🏢 *${building.name}*`,
    `*Month Summary · ${monthLabel}*${isLocked(month) ? ' 🔒' : ''}`,
    '',
    '📊 *Overview*',
    `• Total expenses: *${formatINR(ledger.total)}*`,
    `• Owner responsibility: ${formatINR(ledger.ownerPool)}`,
    `• Tenant responsibility: ${formatINR(ledger.tenantPool)}`,
    `• Collected: ${formatINR(collected)}`,
    `• Outstanding: *${formatINR(outstanding)}*`,
    ...(categoryTotals.length > 0
      ? ['', '🧾 *By category*', ...categoryTotals.map((row) => `• ${row.category}: ${formatINR(row.amount)} (${row.responsibility})`)]
      : []),
    '',
    `🏠 *${user.role === 'admin' ? 'Flat-wise summary' : 'Your flat'}*`,
    ...rows.flatMap(({ line, owner, tenant }) => [
      `*Flat ${line.number}*`,
      ...(showOwner ? [sideLine('Owner', line.ownerName, owner)] : []),
      line.tenantId || !showOwner
        ? sideLine('Tenant', user.role === 'tenant' ? 'You' : line.tenantName, tenant)
        : '   Tenant: none',
    ]),
    '',
    `📎 The full report is in the attached PDF (summary-${month}.pdf).`,
    `_Generated on ${dayjs().format('DD-MM-YYYY HH:mm')}_`,
  ].join('\n')

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

  // A4 report: residency letterhead, centred title and details, then the same figures as the screen.
  const summaryReport = (): PdfReport => {
    const flatTable: PdfSection = showOwner
      ? {
          type: 'table',
          heading: user.role === 'admin' ? 'Flat-wise summary' : 'Your flat',
          groups: [
            { label: '', span: 1 },
            { label: 'Owner', span: 5 },
            { label: 'Tenant', span: 5 },
          ],
          columns: [
            { header: 'Flat', width: 0.9 },
            { header: 'Name', width: 1.9 },
            { header: 'Due', width: 1.35, align: 'right' },
            { header: 'Paid', width: 1.35, align: 'right' },
            { header: 'Balance', width: 1.6, align: 'right' },
            { header: 'Status', width: 1.25, align: 'center' },
            { header: 'Name', width: 1.9 },
            { header: 'Due', width: 1.35, align: 'right' },
            { header: 'Paid', width: 1.35, align: 'right' },
            { header: 'Balance', width: 1.6, align: 'right' },
            { header: 'Status', width: 1.25, align: 'center' },
          ],
          rows: rows.map(({ line, owner, tenant }) => [
            line.number,
            line.ownerName ?? '—',
            formatINR(owner.due),
            formatINR(owner.paid + owner.credit),
            balanceText(owner),
            owner.status,
            line.tenantName ?? '—',
            formatINR(tenant.due),
            formatINR(tenant.paid + tenant.credit),
            balanceText(tenant),
            line.tenantId ? tenant.status : 'No tenant',
          ]),
          emptyText: 'No flats to show',
        }
      : {
          type: 'table',
          heading: 'Your share',
          columns: [
            { header: 'Flat', width: 1 },
            { header: 'Tenant', width: 2 },
            { header: 'Due', width: 1.5, align: 'right' },
            { header: 'Paid', width: 1.5, align: 'right' },
            { header: 'Balance', width: 1.7, align: 'right' },
            { header: 'Status', width: 1.3, align: 'center' },
          ],
          rows: rows.map(({ line, tenant }) => [
            line.number,
            'You',
            formatINR(tenant.due),
            formatINR(tenant.paid + tenant.credit),
            balanceText(tenant),
            tenant.status,
          ]),
          emptyText: 'No flats to show',
        }

    return {
      filename: `summary-${month}.pdf`,
      title: 'Month Summary',
      subtitle: monthLabel,
      letterhead: {
        name: building.name,
        address: buildingInfo?.address,
        phone: buildingInfo?.contactPhone ? formatPhone(buildingInfo.contactPhone) : undefined,
      },
      details: [
        { label: 'Month', value: monthLabel },
        { label: 'Month status', value: isLocked(month) ? 'Locked' : 'Open' },
        { label: 'Flats', value: String(flats.length) },
        {
          label: 'Covers',
          value: user.role === 'admin' ? 'All flats' : `Flat ${rows[0]?.line.number ?? user.flatNumber ?? '—'}`,
        },
      ],
      sections: [
        {
          type: 'stats',
          heading: 'Overview',
          items: [
            { label: 'Total expenses', value: formatINR(ledger.total) },
            { label: 'Owner responsibility', value: formatINR(ledger.ownerPool) },
            { label: 'Tenant responsibility', value: formatINR(ledger.tenantPool) },
            { label: 'Total collected', value: formatINR(collected), hint: 'Paid to the building' },
            { label: 'Total outstanding', value: formatINR(outstanding), hint: 'After credit and payments' },
          ],
        },
        {
          type: 'table',
          heading: 'Category summary',
          columns: [
            { header: 'Category', width: 2.6 },
            { header: 'Responsibility', width: 3 },
            { header: 'Expenses', width: 1.2, align: 'right' },
            { header: 'Total', width: 1.8, align: 'right' },
          ],
          rows: categoryTotals.map((row) => [row.category, row.responsibility, String(row.count), formatINR(row.amount)]),
          footer: [
            'Total',
            `Owner ${formatINR(ledger.ownerPool)} · Tenant ${formatINR(ledger.tenantPool)}`,
            String(categoryTotals.reduce((sum, row) => sum + row.count, 0)),
            formatINR(ledger.total),
          ],
          emptyText: 'No expenses this month',
        },
        flatTable,
        {
          type: 'table',
          heading: `Bills · ${monthLabel}`,
          columns: [
            { header: 'Date', width: 1.3 },
            { header: 'Category', width: 1.8 },
            { header: 'Description', width: 3 },
            { header: 'Responsibility', width: 1.6 },
            { header: 'Amount', width: 1.6, align: 'right' },
            { header: 'Bill', width: 1.1, align: 'center' },
          ],
          rows: monthExpenses.map((expense) => [
            formatDate(expense.date),
            expense.category,
            expense.description || '—',
            expense.responsibility,
            formatINR(expense.amount),
            expense.bill ? 'Attached' : '—',
          ]),
          footer: ['Total', '', '', '', formatINR(monthExpenses.reduce((sum, expense) => sum + expense.amount, 0)), ''],
          emptyText: 'No expenses this month',
        },
        {
          type: 'note',
          heading: 'Notes',
          text: splitNote,
        },
      ],
    }
  }

  const downloadSummaryPdf = () => downloadReportPdf(summaryReport())

  /**
   * Shares the summary PDF with a formatted message. Phones (and browsers that can share files) open the
   * share sheet with the PDF attached; elsewhere the PDF is downloaded and WhatsApp opens with the message.
   */
  const shareOnWhatsApp = async () => {
    const report = summaryReport()
    const file = reportPdfFile(report)
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${building.name} · Month Summary`, text: whatsAppMessage })
        return
      } catch (failure) {
        // Closing the share sheet is not an error; anything else falls back to WhatsApp Web below.
        if (failure instanceof DOMException && failure.name === 'AbortError') return
      }
    }
    downloadReportPdf(report)
    openWhatsApp(whatsAppMessage)
    notifySuccess('PDF downloaded', `WhatsApp is opening with the summary. Attach ${report.filename} from your downloads to send the PDF too.`)
  }

  const shotButtons = (side: SideSettlement) => (
    <>
      {side.pending > 0 ? (
        <Text size="xs" c="orange.8">
          {formatINR(side.pending)} awaiting verification
        </Text>
      ) : null}
      {side.payments.map((payment) => (
        <Button
          key={payment.id}
          variant="subtle"
          size="compact-xs"
          px={0}
          onClick={() => setFile({ title: `Payment screenshot · ${payment.verification}`, file: payment.screenshot })}
        >
          {payment.screenshot.name}
          {payment.verification === 'Verified' ? '' : ` · ${payment.verification}`}
        </Button>
      ))}
    </>
  )

  return (
    <Stack gap="lg">
      <PageHeading
        title="Month Summary"
        description={`${monthLabel} for ${building.name}. Amounts update when an expense or payment changes.`}
        action={
          <DownloadBar
            onPdf={downloadSummaryPdf}
            onCsv={() => downloadCsv(`summary-${month}.csv`, csvHeaders, csvRows)}
            onWhatsApp={() => void shareOnWhatsApp()}
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
          data={summary.months.map((option) => ({
            value: option.month,
            label: `${formatMonth(option.month)}${option.locked ? ' · Locked' : ''}`,
          }))}
        />
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="md">
        <StatCard label="Total expenses" value={formatINR(ledger.total)} />
        <StatCard label="Owner responsibility" value={formatINR(ledger.ownerPool)} />
        <StatCard label="Tenant responsibility" value={formatINR(ledger.tenantPool)} />
        <StatCard
          label="Total collected"
          value={formatINR(collected)}
          hint={
            summary.totals.pending > 0
              ? `Verified · ${formatINR(summary.totals.pending)} awaiting verification`
              : 'Verified payments to the building'
          }
        />
        <StatCard label="Total outstanding" value={formatINR(outstanding)} hint="After credit and payments" />
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

      <Alert variant="light" color="terracotta" title="How shares are split">
        {splitNote}
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
                          {shotButtons(owner)}
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
                      {shotButtons(tenant)}
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
