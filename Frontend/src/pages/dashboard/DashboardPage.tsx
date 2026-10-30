import { Badge, Box, Card, Divider, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { BarChart } from '@mantine/charts'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import expenseBanner from '../../assets/banner_expensives.png'
import paymentBanner from '../../assets/banner _payments.png'
import { ExpensePreview } from '../../components/expenses/ExpensePreview.tsx'
import { ExpenseRow } from '../../components/expenses/ExpenseRow.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { apartment } from '../../mocks/apartment.ts'
import { paths } from '../../routes/nav.ts'
import type { Expense } from '../../types/models.ts'
import { firstName, formatINR, formatMonth, greeting } from '../../utils/format.ts'
import { buildMonthLedger, personalHistory, shareLinesFor, sortExpenses } from '../../utils/ledger.ts'

export function DashboardPage() {
  const { user } = useAuth()
  const { expenses, flats, payments, isLocked } = useBuilding()
  const [openedExpense, setOpenedExpense] = useState<Expense | null>(null)
  if (!user) return null

  const ledger = buildMonthLedger(expenses, flats, apartment.currentMonth)
  const history = personalHistory(user, expenses, flats, payments)
  const current = history.find((row) => row.month === apartment.currentMonth)
  const snapshot = current ?? { due: 0, credit: 0, arrears: 0, paidToBuilding: 0, owedToYou: 0, balance: 0 }
  const recent = sortExpenses(expenses).slice(0, 5)
  const lines = shareLinesFor(user, expenses, flats, apartment.currentMonth)
  const locked = isLocked(apartment.currentMonth)
  const positive = snapshot.owedToYou > 0
  const flagged = payments.filter((payment) => payment.userId === user.id && payment.needsCheck)

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Group gap="xs">
          <Badge variant="light" color="terracotta">
            {formatMonth(apartment.currentMonth)}
          </Badge>
          <Badge variant="outline" color="terracotta">
            {user.flatNumber ? `Flat ${user.flatNumber}` : 'Building account'}
          </Badge>
          {locked ? (
            <Badge color="red" variant="light">
              Month locked
            </Badge>
          ) : null}
        </Group>
        <Title order={2}>
          {greeting()}, {firstName(user.name)}
        </Title>
        <Text c="dimmed">Shared maintenance for {apartment.name}.</Text>
      </Stack>

      {user.role === 'admin' ? (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <StatCard label="Building total" value={formatINR(ledger.total)} hint="All October expenses" />
          <StatCard label="Owner pool" value={formatINR(ledger.ownerPool)} hint="Owner-tagged expenses" />
          <StatCard label="Tenant pool" value={formatINR(ledger.tenantPool)} hint="Tenant-tagged expenses" />
          <StatCard label="Month" value={locked ? 'Locked' : 'Open'} hint={locked ? 'Edits are frozen' : 'Expenses can be added'} />
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <StatCard label="My due" value={formatINR(snapshot.due)} hint="Your share this month" />
          <StatCard label="My credit" value={formatINR(snapshot.credit)} hint="Paid out of pocket" />
          <StatCard label="Arrears" value={formatINR(snapshot.arrears)} hint="Carried from last month" />
          <StatCard
            label={positive ? 'Owed to you' : 'Still to settle'}
            value={formatINR(positive ? snapshot.owedToYou : snapshot.balance)}
            hint={positive ? 'Credit is above your due' : 'Due plus arrears, after credit'}
            tone={positive ? 'positive' : 'default'}
          />
        </SimpleGrid>
      )}

      <Stack gap="sm">
        <BannerLink
          to={paths.addExpense}
          image={expenseBanner}
          title="Add expense"
          detail="Record a bill and split it across the flats."
        />
        <BannerLink
          to={paths.pay}
          image={paymentBanner}
          title="Pay"
          detail="Upload a screenshot and record the payment."
        />
      </Stack>
      {flagged.length > 0 ? (
        <Text c="red.8" fw={600}>
          {flagged.length === 1 ? 'A payment needs a check' : `${flagged.length} payments need a check`}:{' '}
          {flagged.map((payment) => payment.checkNote || 'Needs check').join(' · ')}
        </Text>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card>
          <Text fw={700} mb="sm">
            Latest expenses
          </Text>
          <Stack gap={0}>
            {recent.map((expense, index) => (
              <div key={expense.id}>
                {index > 0 ? <Divider my="xs" color="sand.2" /> : null}
                <ExpenseRow expense={expense} onOpen={() => setOpenedExpense(expense)} />
              </div>
            ))}
          </Stack>
        </Card>

        {user.role === 'admin' ? (
          <Card>
            <Text fw={700}>Owner and tenant pools</Text>
            <Text size="sm" c="dimmed" mb="sm">
              October split across {flats.length} flats
            </Text>
            <BarChart
              h={240}
              data={[
                { pool: 'Owner', amount: ledger.ownerPool },
                { pool: 'Tenant', amount: ledger.tenantPool },
              ]}
              dataKey="pool"
              series={[{ name: 'amount', color: 'terracotta.6', label: 'Amount' }]}
              valueFormatter={(value) => formatINR(Number(value))}
              withLegend={false}
              gridAxis="none"
              yAxisProps={{ width: 56 }}
            />
          </Card>
        ) : (
          <Card>
            <Text fw={700}>How your share is built</Text>
            <Text size="sm" c="dimmed" mb="sm">
              Each line is the expense divided by {flats.length}, rounded to the nearest rupee.
            </Text>
            <Stack gap="sm">
              {lines.map((line) => (
                <Group key={line.id} justify="space-between">
                  <div>
                    <Text size="sm" fw={600}>
                      {line.category}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {line.responsibility} tag
                    </Text>
                  </div>
                  <Text fw={700} c="terracotta.8">
                    {formatINR(line.share)}
                  </Text>
                </Group>
              ))}
              <Divider color="sand.2" />
              <Group justify="space-between">
                <Text fw={700}>This month</Text>
                <Text fw={700}>{formatINR(snapshot.due)}</Text>
              </Group>
            </Stack>
          </Card>
        )}
      </SimpleGrid>

      <ExpensePreview expense={openedExpense} opened={openedExpense !== null} onClose={() => setOpenedExpense(null)} />
    </Stack>
  )
}

function BannerLink({
  to,
  image,
  title,
  detail,
}: {
  to: string
  image: string
  title: string
  detail: string
}) {
  return (
    <Card
      component={Link}
      to={to}
      padding={0}
      radius="lg"
      withBorder
      style={{
        minHeight: 148,
        overflow: 'hidden',
        textDecoration: 'none',
        backgroundImage: `url(${image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'left center',
      }}
    >
      <Box
        h="100%"
        mih={148}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <Box
          px="lg"
          py="md"
          style={{
            width: 'min(46%, 280px)',
            minHeight: 148,
            display: 'flex',
            alignItems: 'center',
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(251,248,244,0.72) 22%, rgba(251,248,244,0.94) 100%)',
          }}
        >
          <Stack gap={4}>
            <Text fw={700} fz={{ base: 'lg', sm: 'xl' }} c="terracotta.9" lh={1.15}>
              {title}
            </Text>
            <Text size="sm" c="sand.8">
              {detail}
            </Text>
          </Stack>
        </Box>
      </Box>
    </Card>
  )
}
