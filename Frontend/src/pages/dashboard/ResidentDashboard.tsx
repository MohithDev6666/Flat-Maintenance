import { Anchor, Card, Divider, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import expenseBanner from '../../assets/banner_expensives.png'
import paymentBanner from '../../assets/banner _payments.png'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { ExpenseDetails } from '../../components/expenses/ExpenseDetails.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import { paths } from '../../routes/nav.ts'
import type { Expense, SessionUser } from '../../types/models.ts'
import { formatINR, formatPhone } from '../../utils/format.ts'
import {
  activeTenantOf,
  flatStatus,
  ownerOf,
  partyForUser,
  partyHistory,
  shareLinesFor,
  sortExpenses,
} from '../../utils/calculations.ts'
import { can } from '../../utils/permissions.ts'
import { BannerLink, DashboardHeader, LatestExpensesCard } from './DashboardParts.tsx'

/** Owner and tenant dashboard. Both see their own share; only the linked resident record differs. */
export function ResidentDashboard({ user }: { user: SessionUser }) {
  const { expenses, flats, owners, tenants, accounts, payments } = useBuilding()
  const [openedExpense, setOpenedExpense] = useState<Expense | null>(null)
  const data = { flats, owners, tenants, accounts }

  const party = partyForUser(user, data)
  const history = party ? partyHistory(party, expenses, data, payments) : []
  const current = history.find((row) => row.month === calendar.currentMonth)
  const snapshot = current ?? { due: 0, credit: 0, arrears: 0, paidToBuilding: 0, owedToYou: 0, balance: 0 }
  const recent = sortExpenses(expenses).slice(0, 5)
  const lines = party ? shareLinesFor(party, expenses, data, calendar.currentMonth) : []
  const positive = snapshot.owedToYou > 0
  const flagged = payments.filter((payment) => payment.userId === user.id && payment.needsCheck)

  return (
    <Stack gap="lg">
      <DashboardHeader user={user} />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <UnstyledButton component={Link} to={paths.contribution} aria-label="My due, open My Contribution">
          <StatCard label="My due" value={formatINR(snapshot.due)} hint="Your share this month" />
        </UnstyledButton>
        <StatCard label="My credit" value={formatINR(snapshot.credit)} hint="Paid out of pocket" />
        <StatCard label="Arrears" value={formatINR(snapshot.arrears)} hint="Carried from last month" />
        <StatCard
          label={positive ? 'Owed to you' : 'Still to settle'}
          value={formatINR(positive ? snapshot.owedToYou : snapshot.balance)}
          hint={positive ? 'Credit is above your due' : 'Due plus arrears, after credit'}
          tone={positive ? 'positive' : 'default'}
        />
      </SimpleGrid>

      <Stack gap="sm">
        {can(user, 'expenses', 'add') ? (
          <BannerLink
            to={paths.addExpense}
            image={expenseBanner}
            title="Add expense"
            detail="Record a bill and split it across the flats."
          />
        ) : null}
        {can(user, 'payments', 'view') ? (
          <BannerLink
            to={paths.pay}
            image={paymentBanner}
            title="Pay / Upload"
            detail="Upload a screenshot and record the payment."
          />
        ) : null}
      </Stack>
      {flagged.length > 0 ? (
        <Text c="red.8" fw={600}>
          {flagged.length === 1 ? 'A payment needs a check' : `${flagged.length} payments need a check`}:{' '}
          {flagged.map((payment) => payment.checkNote || 'Needs check').join(' · ')}
        </Text>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <LatestExpensesCard expenses={recent} onOpen={setOpenedExpense} showAll />

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
            <Group justify="space-between">
              <Anchor component={Link} to={paths.contribution} size="sm" c="terracotta.8">
                My contribution
              </Anchor>
              <Anchor component={Link} to={paths.summary} size="sm" c="terracotta.8">
                Month summary
              </Anchor>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>

      {user.flatId ? <MyFlatCard user={user} /> : null}

      <ExpenseDetails expense={openedExpense} opened={openedExpense !== null} onClose={() => setOpenedExpense(null)} />
    </Stack>
  )
}

function MyFlatCard({ user }: { user: SessionUser }) {
  const { flats, owners, tenants } = useBuilding()
  const flat = flats.find((item) => item.id === user.flatId)
  if (!user.flatId || !flat) return null
  const owner = ownerOf(owners, user.flatId)
  const tenant = activeTenantOf(tenants, user.flatId)
  return (
    <Card>
      <Group justify="space-between" mb="sm">
        <div>
          <Text fw={700}>My flat</Text>
          <Text size="sm" c="dimmed">
            Flat {user.flatNumber} · Floor {user.floor}
          </Text>
        </div>
        <StatusBadge status={flatStatus(flat, owners, tenants)} />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Stack gap={2}>
          <Text size="xs" tt="uppercase" fw={700} c="sand.7">
            Owner
          </Text>
          <Text size="sm" fw={600}>
            {owner?.name ?? 'No owner linked'}
          </Text>
          {owner ? (
            <Text size="sm" c="dimmed">
              {formatPhone(owner.phone)}
            </Text>
          ) : null}
        </Stack>
        <Stack gap={2}>
          <Text size="xs" tt="uppercase" fw={700} c="sand.7">
            Tenant
          </Text>
          <Text size="sm" fw={600}>
            {tenant ? tenant.name : 'No active tenant'}
          </Text>
          {tenant ? (
            <Text size="sm" c="dimmed">
              {formatPhone(tenant.phone)}
            </Text>
          ) : null}
        </Stack>
      </SimpleGrid>
      <Anchor component={Link} to={paths.residents} size="sm" c="terracotta.8" mt="sm" display="inline-block">
        Flat details
      </Anchor>
    </Card>
  )
}
