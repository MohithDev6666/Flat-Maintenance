import { Card, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarChart } from '@mantine/charts'
import { useState } from 'react'
import expenseBanner from '../../assets/banner_expensives.png'
import paymentBanner from '../../assets/banner _payments.png'
import { ExpenseDetails } from '../../components/expenses/ExpenseDetails.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { paths } from '../../routes/nav.ts'
import { lockChecker } from '../../services/monthLockService.ts'
import type { Expense, SessionUser } from '../../types/models.ts'
import { formatINR, formatMonth } from '../../utils/format.ts'
import type { DashboardData } from './DashboardPage.tsx'
import { BannerLink, DashboardHeader, LatestExpensesCard } from './DashboardParts.tsx'

export function AdminDashboard({ user, data, onChanged }: { user: SessionUser; data: DashboardData; onChanged: () => void }) {
  // Totals, the review queue and the latest expenses all come calculated from the dashboard API.
  const { totals: ledger, recentExpenses: recent, flagged, pendingCount, flatCount, categories, monthLocks, buildingName } = data
  const isLocked = lockChecker(monthLocks)
  const [openedExpense, setOpenedExpense] = useState<Expense | null>(null)

  const locked = data.locked
  const monthName = formatMonth(data.month).split(' ')[0]

  return (
    <Stack gap="lg">
      <DashboardHeader user={user} buildingName={buildingName} locked={locked} />

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <StatCard label="Building total" value={formatINR(ledger.total)} hint={`All ${monthName} expenses`} />
        <StatCard label="Owner pool" value={formatINR(ledger.ownerPool)} hint="Owner-tagged expenses" />
        <StatCard label="Tenant pool" value={formatINR(ledger.tenantPool)} hint="Tenant-tagged expenses" />
        <StatCard label="Month" value={locked ? 'Locked' : 'Open'} hint={locked ? 'Edits are frozen' : 'Expenses can be added'} />
      </SimpleGrid>

      <Stack gap="sm">
        <BannerLink
          to={paths.addExpense}
          image={expenseBanner}
          title="Add expense"
          detail="Record a bill and split it across the flats."
        />
        <BannerLink to={paths.pay} image={paymentBanner} title="Pay" detail="Upload a screenshot and record the payment." />
      </Stack>
      {pendingCount > 0 ? (
        <Text c="orange.8" fw={600}>
          {pendingCount === 1 ? 'A payment is waiting for verification' : `${pendingCount} payments are waiting for verification`}{' '}
          on Pay / Upload.
        </Text>
      ) : null}
      {flagged.length > 0 ? (
        <Text c="red.8" fw={600}>
          {flagged.length === 1 ? 'A payment needs a check' : `${flagged.length} payments need a check`}:{' '}
          {flagged.map((payment) => payment.checkNote || 'Needs check').join(' · ')}
        </Text>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <LatestExpensesCard expenses={recent} onOpen={setOpenedExpense} />
        <Card>
          <Text fw={700}>Owner and tenant pools</Text>
          <Text size="sm" c="dimmed" mb="sm">
            {monthName} split across {flatCount} flats
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
      </SimpleGrid>

      <ExpenseDetails
        expense={openedExpense}
        opened={openedExpense !== null}
        onClose={() => setOpenedExpense(null)}
        categories={categories}
        isLocked={isLocked}
        flatCount={flatCount}
        onChanged={onChanged}
      />
    </Stack>
  )
}
