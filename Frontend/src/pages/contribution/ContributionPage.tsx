import { Card, Stack, Table, Text } from '@mantine/core'
import { DownloadBar } from '../../components/ui/DownloadBar.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { apartment } from '../../mocks/apartment.ts'
import { downloadPdf } from '../../utils/download.ts'
import { formatINR, formatMonth } from '../../utils/format.ts'
import { buildMonthLedger, personalHistory } from '../../utils/ledger.ts'
import { SimpleGrid } from '@mantine/core'

export function ContributionPage() {
  const { user } = useAuth()
  const { expenses, flats, payments } = useBuilding()
  if (!user) return null

  const history = personalHistory(user, expenses, flats, payments)
  const yearShare = history.reduce((sum, row) => sum + row.due, 0)
  const yearCredit = history.reduce((sum, row) => sum + row.credit, 0)
  const closing = history[history.length - 1]
  const buildingRows = history.map((row) => buildMonthLedger(expenses, flats, row.month))

  if (user.role === 'admin') {
    const yearTotal = buildingRows.reduce((sum, row) => sum + row.total, 0)
    return (
      <Stack gap="lg">
        <PageHeading
          title="My contribution"
          description="This account is not linked to a flat, so there is no personal share. These are the building totals."
          action={
            <DownloadBar
              onPdf={() =>
                downloadPdf(
                  `contribution-${user.id}.pdf`,
                  [
                    apartment.name,
                    'Building totals',
                    ...buildingRows.map(
                      (row) =>
                        `${formatMonth(row.month)} total ${formatINR(row.total)} owner ${formatINR(row.ownerPool)} tenant ${formatINR(row.tenantPool)}`,
                    ),
                  ],
                )
              }
            />
          }
        />
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

  return (
    <Stack gap="lg">
      <PageHeading
        title="My contribution"
        description="Your share, what you paid out of pocket, what you paid to the building, and the balance."
        action={
          <DownloadBar
            onPdf={() =>
              downloadPdf(`contribution-${user.id}.pdf`, [
                apartment.name,
                user.name,
                ...history.map(
                  (row) =>
                    `${formatMonth(row.month)} share ${formatINR(row.due)} pocket ${formatINR(row.credit)} paid ${formatINR(row.paidToBuilding)} balance ${row.owedToYou > 0 ? `owed ${formatINR(row.owedToYou)}` : formatINR(row.balance)}`,
                ),
                `Year share ${formatINR(yearShare)}`,
                `Year out of pocket ${formatINR(yearCredit)}`,
              ])
            }
          />
        }
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard label="Year share" value={formatINR(yearShare)} />
        <StatCard label="Paid out of pocket" value={formatINR(yearCredit)} />
        <StatCard
          label={closing && closing.owedToYou > 0 ? 'Owed to you' : 'Closing balance'}
          value={formatINR(closing ? (closing.owedToYou > 0 ? closing.owedToYou : closing.balance) : 0)}
          tone={closing && closing.owedToYou > 0 ? 'positive' : 'default'}
        />
      </SimpleGrid>
      <Card p={0}>
        <Table.ScrollContainer minWidth={640}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th>Share</Table.Th>
                <Table.Th>Out of pocket</Table.Th>
                <Table.Th>Paid to building</Table.Th>
                <Table.Th>Arrears in</Table.Th>
                <Table.Th>Balance</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((row) => (
                <Table.Tr key={row.month}>
                  <Table.Td>{formatMonth(row.month)}</Table.Td>
                  <Table.Td>{formatINR(row.due)}</Table.Td>
                  <Table.Td>{formatINR(row.credit)}</Table.Td>
                  <Table.Td>{formatINR(row.paidToBuilding)}</Table.Td>
                  <Table.Td>{formatINR(row.arrears)}</Table.Td>
                  <Table.Td>
                    {row.owedToYou > 0 ? `Owed to you ${formatINR(row.owedToYou)}` : formatINR(row.balance)}
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
