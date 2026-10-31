import { Card, Divider, Group, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { DownloadBar } from '../../components/ui/DownloadBar.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import { downloadPdf } from '../../utils/download.ts'
import { formatDate, formatINR, formatMonth } from '../../utils/format.ts'
import {
  allParties,
  buildMonthLedger,
  listMonths,
  monthOf,
  partyForUser,
  partyHistory,
  userIdsFor,
  type Party,
} from '../../utils/calculations.ts'

const BUILDING = 'building'

function partyKey(party: Party): string {
  return `${party.kind}:${party.residentId}`
}

export function ContributionPage() {
  const { user } = useAuth()
  const { building, expenses, flats, owners, tenants, accounts, payments } = useBuilding()
  const [month, setMonth] = useState<string>(calendar.currentMonth)
  const [inspect, setInspect] = useState<string>(BUILDING)
  if (!user) return null

  const data = { flats, owners, tenants, accounts }
  const flatNumber = (flatId: string | null) => flats.find((flat) => flat.id === flatId)?.number ?? '—'
  const parties = user.role === 'admin' ? allParties(data) : []
  const party = user.role === 'admin' ? (parties.find((item) => partyKey(item) === inspect) ?? null) : partyForUser(user, data)
  const months = listMonths(expenses)
  const monthOptions = months
    .slice()
    .reverse()
    .map((value) => ({ value, label: formatMonth(value) }))

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
            value: partyKey(item),
            label: `Flat ${flatNumber(item.flatId)} · ${item.kind === 'owner' ? 'Owner' : 'Tenant'} · ${item.name}`,
          })),
        ]}
      />
    ) : null

  if (!party) {
    const buildingRows = months.map((value) => buildMonthLedger(expenses, data, value))
    const yearTotal = buildingRows.reduce((sum, row) => sum + row.total, 0)
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
                downloadPdf(`contribution-building.pdf`, [
                  building.name,
                  'Building totals',
                  ...buildingRows.map(
                    (row) =>
                      `${formatMonth(row.month)} total ${formatINR(row.total)} owner ${formatINR(row.ownerPool)} tenant ${formatINR(row.tenantPool)}`,
                  ),
                ])
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

  const history = partyHistory(party, expenses, data, payments)
  const selected = history.find((row) => row.month === month) ?? history[history.length - 1]
  const yearRows = history.filter((row) => row.month.slice(0, 4) === month.slice(0, 4) && row.month <= month)
  const yearShare = yearRows.reduce((sum, row) => sum + row.due, 0)
  const yearCredit = yearRows.reduce((sum, row) => sum + row.credit, 0)
  const yearPaid = yearRows.reduce((sum, row) => sum + row.paidToBuilding, 0)
  const userIds = userIdsFor(accounts, party.kind, party.residentId)
  const pocket = expenses.filter(
    (expense) => monthOf(expense.date) === month && expense.paidByUserId && userIds.includes(expense.paidByUserId),
  )
  const paidIn = payments.filter(
    (payment) => payment.month === month && payment.role === party.kind && payment.residentId === party.residentId,
  )
  const owed = selected ? selected.owedToYou > 0 : false
  const who = `${party.name} · Flat ${flatNumber(party.flatId)} ${party.kind === 'owner' ? 'owner' : 'tenant'}`

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
              downloadPdf(`contribution-${party.residentId}.pdf`, [
                building.name,
                who,
                ...history.map(
                  (row) =>
                    `${formatMonth(row.month)} share ${formatINR(row.due)} pocket ${formatINR(row.credit)} paid ${formatINR(row.paidToBuilding)} balance ${row.owedToYou > 0 ? `owed to you ${formatINR(row.owedToYou)}` : formatINR(row.balance)}`,
                ),
                `Year to date share ${formatINR(yearShare)}`,
                `Year to date out of pocket ${formatINR(yearCredit)}`,
                `Year to date paid to building ${formatINR(yearPaid)}`,
              ])
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
          <StatCard label="Paid to building" value={formatINR(selected.paidToBuilding)} hint="Payments this month" />
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
                      <Text size="xs" c={payment.needsCheck ? 'red.8' : 'dimmed'}>
                        {payment.needsCheck ? `Needs check · ${payment.checkNote}` : payment.reference || payment.screenshot.name}
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
