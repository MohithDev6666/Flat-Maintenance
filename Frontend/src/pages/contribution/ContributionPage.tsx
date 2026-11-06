import { Card, Divider, Group, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { DownloadBar } from '../../components/ui/DownloadBar.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getBuilding } from '../../services/buildingService.ts'
import { getContributionReport, type ContributionReport } from '../../services/reportService.ts'
import type { Building } from '../../types/models.ts'
import { calendar } from '../../utils/calendar.ts'
import { can } from '../../utils/permissions.ts'
import { formatDate, formatINR, formatMonth, formatPhone } from '../../utils/format.ts'
import { downloadReportPdf, type PdfLetterhead } from '../../utils/pdfReport.ts'

const BUILDING = 'building'

export function ContributionPage() {
  const { user } = useAuth()
  const [report, setReport] = useState<ContributionReport | null>(null)
  const [buildingName, setBuildingName] = useState('')
  const [buildingInfo, setBuildingInfo] = useState<Building | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState<string>(calendar.currentMonth)
  const [inspect, setInspect] = useState<string>(BUILDING)

  // Shares, credit, payments, arrears and balances are all calculated by the backend.
  const load = useCallback(async () => {
    if (!user) return
    try {
      const [data, building] = await Promise.all([
        getContributionReport(month, inspect === BUILDING ? '' : inspect),
        can(user, 'building', 'view') ? getBuilding().catch(() => null) : Promise.resolve(null),
      ])
      setReport(data)
      setBuildingName(building?.name ?? '')
      setBuildingInfo(building)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [user, month, inspect])

  useEffect(() => {
    void load()
  }, [load])
  if (!user) return null

  if (!report || error) {
    return (
      <Stack gap="lg">
        <PageHeading title="My Contribution" />
        <LoadState loading={loading} error={error} onRetry={load}>
          {null}
        </LoadState>
      </Stack>
    )
  }

  const building = { name: buildingName || 'Flat Maintenance' }
  const letterhead: PdfLetterhead = {
    name: building.name,
    address: buildingInfo?.address,
    phone: buildingInfo?.contactPhone ? formatPhone(buildingInfo.contactPhone) : undefined,
  }

  const flats = { length: report.flatCount }
  const parties = report.parties
  const party = report.party
  // Oldest first, like the month-by-month tables.
  const months = report.months.map((option) => option.month).reverse()
  const monthOptions = report.months.map((option) => ({ value: option.month, label: formatMonth(option.month) }))

  const adminPicker =
    user.role === 'admin' ? (
      <Select
        label="Contribution of"
        searchable
        allowDeselect={false}
        value={inspect}
        onChange={(value) => setInspect(value ?? BUILDING)}
        data={[
          { value: BUILDING, label: 'Building totals' },
          ...parties.map((item) => ({
            value: item.key,
            label: `Flat ${item.flatNumber || '—'} · ${item.kind === 'owner' ? 'Owner' : 'Tenant'} · ${item.name}`,
          })),
        ]}
      />
    ) : null

  if (!party || !report.statement) {
    const buildingRows = report.building?.rows ?? []
    const yearTotal = report.building?.total ?? 0
    const ownerPoolTotal = report.building?.ownerPool ?? 0
    const tenantPoolTotal = report.building?.tenantPool ?? 0
    return (
      <Stack gap="lg">
        <PageHeading
          title="My Contribution"
          description={
            user.role === 'admin'
              ? 'This account is not linked to a flat, so there is no personal share. Choose a resident to inspect theirs.'
              : 'Your account is not linked to a flat yet.'
          }
          action={
            <DownloadBar
              onPdf={() =>
                downloadReportPdf({
                  filename: 'contribution-building.pdf',
                  title: 'Contribution Report',
                  subtitle: 'Building totals',
                  letterhead,
                  details: [
                    { label: 'Report', value: 'Building totals' },
                    { label: 'Flats', value: String(flats.length) },
                    {
                      label: 'Period',
                      value: months.length
                        ? `${formatMonth(months[0])} to ${formatMonth(months[months.length - 1])}`
                        : 'No expenses recorded',
                    },
                    { label: 'Months recorded', value: String(months.length) },
                  ],
                  sections: [
                    {
                      type: 'stats',
                      heading: 'Overview',
                      items: [
                        { label: 'Total expenses', value: formatINR(yearTotal), hint: 'Sum of every recorded month' },
                        { label: 'Owner pool', value: formatINR(ownerPoolTotal) },
                        { label: 'Tenant pool', value: formatINR(tenantPoolTotal) },
                      ],
                    },
                    {
                      type: 'table',
                      heading: 'Month-wise totals',
                      columns: [
                        { header: 'Month', width: 2 },
                        { header: 'Total', width: 1.5, align: 'right' },
                        { header: 'Owner pool', width: 1.5, align: 'right' },
                        { header: 'Tenant pool', width: 1.5, align: 'right' },
                      ],
                      rows: buildingRows.map((row) => [
                        formatMonth(row.month),
                        formatINR(row.total),
                        formatINR(row.ownerPool),
                        formatINR(row.tenantPool),
                      ]),
                      footer: [
                        'Total',
                        formatINR(yearTotal),
                        formatINR(ownerPoolTotal),
                        formatINR(tenantPoolTotal),
                      ],
                      emptyText: 'No expenses recorded yet',
                    },
                  ],
                })
              }
            />
          }
        />
        <Card maw={560}>{adminPicker}</Card>
        <StatCard label="Year expenses" value={formatINR(yearTotal)} hint="Sum of every recorded month" />
        <Card p={0}>
          <Table.ScrollContainer minWidth={520}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Month</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th>Owner pool</Table.Th>
                  <Table.Th>Tenant pool</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {buildingRows.map((row) => (
                  <Table.Tr key={row.month}>
                    <Table.Td>{formatMonth(row.month)}</Table.Td>
                    <Table.Td>{formatINR(row.total)}</Table.Td>
                    <Table.Td>{formatINR(row.ownerPool)}</Table.Td>
                    <Table.Td>{formatINR(row.tenantPool)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>
    )
  }

  const { history, selected, pocket, payments: paidIn } = report.statement
  const { share: yearShare, credit: yearCredit, paid: yearPaid } = report.statement.yearToDate
  const flatNumber = () => party.flatNumber || '—'
  const owed = selected ? selected.owedToYou > 0 : false
  const who = `${party.name} · Flat ${flatNumber()} ${party.kind === 'owner' ? 'owner' : 'tenant'}`

  return (
    <Stack gap="lg">
      <PageHeading
        title="My Contribution"
        description={
          user.role === 'admin'
            ? `Inspecting ${who}.`
            : 'Your share, what you paid out of pocket, what you paid to the building, and the balance.'
        }
        action={
          <DownloadBar
            onPdf={() =>
              downloadReportPdf({
                filename: `contribution-${party.residentId}.pdf`,
                title: 'Contribution Statement',
                subtitle: formatMonth(month),
                letterhead,
                details: [
                  { label: 'Resident', value: party.name },
                  { label: 'Flat', value: `Flat ${flatNumber()}` },
                  { label: 'Resident type', value: party.kind === 'owner' ? 'Owner' : 'Tenant' },
                  { label: 'Statement month', value: formatMonth(month) },
                ],
                sections: [
                  ...(selected
                    ? [
                        {
                          type: 'stats' as const,
                          heading: `This month · ${formatMonth(selected.month)}`,
                          items: [
                            { label: 'Opening arrears', value: formatINR(selected.arrears), hint: 'Carried from last month' },
                            { label: 'Current due', value: formatINR(selected.due), hint: formatMonth(selected.month) },
                            { label: 'Out-of-pocket credit', value: formatINR(selected.credit), hint: 'Expenses paid personally' },
                            { label: 'Paid to building', value: formatINR(selected.paidToBuilding), hint: 'Payments this month' },
                            {
                              label: owed ? 'Owed to resident' : 'Outstanding',
                              value: formatINR(owed ? selected.owedToYou : selected.balance),
                              hint: owed ? 'Credit is above the due' : 'Carries forward as arrears',
                            },
                          ],
                        },
                      ]
                    : []),
                  {
                    type: 'stats',
                    heading: `Year to date · through ${formatMonth(month)}`,
                    items: [
                      { label: 'Share', value: formatINR(yearShare) },
                      { label: 'Out of pocket', value: formatINR(yearCredit) },
                      { label: 'Paid to building', value: formatINR(yearPaid) },
                    ],
                  },
                  {
                    type: 'table',
                    heading: `Out-of-pocket expenses · ${formatMonth(month)}`,
                    columns: [
                      { header: 'Date', width: 1.2 },
                      { header: 'Category', width: 2 },
                      { header: 'Description', width: 3 },
                      { header: 'Mode', width: 1.2 },
                      { header: 'Amount', width: 1.5, align: 'right' },
                    ],
                    rows: pocket.map((expense) => [
                      formatDate(expense.date),
                      expense.category,
                      expense.description || '—',
                      expense.paymentMode,
                      formatINR(expense.amount),
                    ]),
                    footer: pocket.length
                      ? ['Total', '', '', '', formatINR(pocket.reduce((sum, expense) => sum + expense.amount, 0))]
                      : undefined,
                    emptyText: 'None this month',
                  },
                  {
                    type: 'table',
                    heading: `Payments · ${formatMonth(month)}`,
                    columns: [
                      { header: 'Date', width: 1.2 },
                      { header: 'Mode', width: 1.2 },
                      { header: 'Reference', width: 3.2 },
                      { header: 'Status', width: 1.8 },
                      { header: 'Amount', width: 1.5, align: 'right' },
                    ],
                    rows: paidIn.map((payment) => [
                      formatDate(payment.date),
                      payment.mode,
                      payment.reference || payment.screenshot.name || '—',
                      payment.checkNote ? `${payment.verification} · ${payment.checkNote}` : payment.verification,
                      formatINR(payment.amount),
                    ]),
                    footer: selected
                      ? ['Verified paid', '', '', '', formatINR(selected.paidToBuilding)]
                      : undefined,
                    emptyText: 'No payments this month',
                  },
                  {
                    type: 'table',
                    heading: 'Monthly history',
                    columns: [
                      { header: 'Month', width: 1.7 },
                      { header: 'Responsibility share', width: 1.5, align: 'right' },
                      { header: 'Paid out of pocket', width: 1.5, align: 'right' },
                      { header: 'Paid to building', width: 1.5, align: 'right' },
                      { header: 'Arrears in', width: 1.4, align: 'right' },
                      { header: 'Balance', width: 1.8, align: 'right' },
                    ],
                    rows: history.map((row) => [
                      formatMonth(row.month),
                      formatINR(row.due),
                      formatINR(row.credit),
                      formatINR(row.paidToBuilding),
                      formatINR(row.arrears),
                      row.owedToYou > 0 ? `Owed ${formatINR(row.owedToYou)}` : formatINR(row.balance),
                    ]),
                    emptyText: 'No history yet',
                  },
                  {
                    type: 'note',
                    heading: 'Notes',
                    text: 'A month’s unpaid balance becomes next month’s arrears. Money paid to the building reduces that balance. Credit above the due stays on that month as “Owed to resident”.',
                  },
                ],
              })
            }
          />
        }
      />

      <Card maw={720}>
        <SimpleGrid cols={{ base: 1, sm: user.role === 'admin' ? 2 : 1 }}>
          {adminPicker}
          <Select label="Month" searchable allowDeselect={false} data={monthOptions} value={month} onChange={(value) => setMonth(value ?? month)} />
        </SimpleGrid>
      </Card>

      {selected ? (
        <SimpleGrid cols={{ base: 2, md: 5 }} spacing="md">
          <StatCard label="Opening arrears" value={formatINR(selected.arrears)} hint="Carried from last month" />
          <StatCard label="Current due" value={formatINR(selected.due)} hint={formatMonth(selected.month)} />
          <StatCard label="Out-of-pocket credit" value={formatINR(selected.credit)} hint="Expenses you paid" />
          <StatCard
            label="Paid to building"
            value={formatINR(selected.paidToBuilding)}
            hint={
              selected.pendingVerification > 0
                ? `Verified · ${formatINR(selected.pendingVerification)} awaiting verification`
                : 'Verified payments this month'
            }
          />
          <StatCard
            label={owed ? 'Owed to you' : 'Outstanding'}
            value={formatINR(owed ? selected.owedToYou : selected.balance)}
            hint={owed ? 'Credit is above your due' : 'Carries forward as arrears'}
            tone={owed ? 'positive' : 'default'}
          />
        </SimpleGrid>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard label="Year-to-date share" value={formatINR(yearShare)} hint={`Through ${formatMonth(month)}`} />
        <StatCard label="Year-to-date out of pocket" value={formatINR(yearCredit)} />
        <StatCard label="Year-to-date paid" value={formatINR(yearPaid)} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Text fw={700} mb="xs">
            Out-of-pocket expenses · {formatMonth(month)}
          </Text>
          {pocket.length === 0 ? (
            <EmptyState title="None this month" message="Expenses you pay yourself are credited against your due." />
          ) : (
            <Stack gap="xs">
              {pocket.map((expense, index) => (
                <div key={expense.id}>
                  {index > 0 ? <Divider mb="xs" color="sand.2" /> : null}
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={600}>
                        {expense.category}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(expense.date)} · {expense.paymentMode}
                      </Text>
                    </div>
                    <Text fw={700}>{formatINR(expense.amount)}</Text>
                  </Group>
                </div>
              ))}
            </Stack>
          )}
        </Card>
        <Card>
          <Text fw={700} mb="xs">
            Payments · {formatMonth(month)}
          </Text>
          {paidIn.length === 0 ? (
            <EmptyState title="No payments this month" message="Payments are recorded on Pay / Upload." />
          ) : (
            <Stack gap="xs">
              {paidIn.map((payment, index) => (
                <div key={payment.id}>
                  {index > 0 ? <Divider mb="xs" color="sand.2" /> : null}
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={600}>
                        {formatDate(payment.date)} · {payment.mode}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {payment.reference || payment.screenshot.name}
                      </Text>
                      <Text
                        size="xs"
                        fw={600}
                        c={payment.verification === 'Needs check' ? 'red.8' : payment.verification === 'Verified' ? 'teal.8' : 'orange.8'}
                      >
                        {payment.verification}
                        {payment.checkNote ? ` · ${payment.checkNote}` : ''}
                      </Text>
                    </div>
                    <Text fw={700}>{formatINR(payment.amount)}</Text>
                  </Group>
                </div>
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      <Card p={0}>
        <Table.ScrollContainer minWidth={640}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th>Responsibility share</Table.Th>
                <Table.Th>Paid out of pocket</Table.Th>
                <Table.Th>Paid to building</Table.Th>
                <Table.Th>Arrears in</Table.Th>
                <Table.Th>Balance</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((row) => (
                <Table.Tr key={row.month} bg={row.month === month ? 'sand.1' : undefined}>
                  <Table.Td>{formatMonth(row.month)}</Table.Td>
                  <Table.Td>{formatINR(row.due)}</Table.Td>
                  <Table.Td>{formatINR(row.credit)}</Table.Td>
                  <Table.Td>{formatINR(row.paidToBuilding)}</Table.Td>
                  <Table.Td>{formatINR(row.arrears)}</Table.Td>
                  <Table.Td>
                    {row.owedToYou > 0 ? (
                      <Text size="sm" c="teal.8" fw={600}>
                        Owed to you {formatINR(row.owedToYou)}
                      </Text>
                    ) : (
                      formatINR(row.balance)
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Text size="sm" c="dimmed">
        A month’s unpaid balance becomes next month’s arrears. Money paid to the building reduces that balance. Credit above the due stays on that month as “Owed to you”.
      </Text>
    </Stack>
  )
}
