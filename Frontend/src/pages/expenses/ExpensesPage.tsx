import { Card, Divider, Group, SegmentedControl, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { ExpensePreview } from '../../components/expenses/ExpensePreview.tsx'
import { ExpenseRow } from '../../components/expenses/ExpenseRow.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { apartment } from '../../mocks/apartment.ts'
import type { Expense, Responsibility } from '../../types/models.ts'
import { formatMonth } from '../../utils/format.ts'
import { listMonths, sortExpenses } from '../../utils/ledger.ts'

export function ExpensesPage() {
  const { expenses, categories } = useBuilding()
  const [month, setMonth] = useState<string | null>(apartment.currentMonth)
  const [category, setCategory] = useState<string | null>('all')
  const [tag, setTag] = useState<'all' | Responsibility>('all')
  const [openedExpense, setOpenedExpense] = useState<Expense | null>(null)

  const monthOptions = useMemo(
    () => [
      { value: 'all', label: 'All months' },
      ...listMonths(expenses)
        .slice()
        .reverse()
        .map((value) => ({ value, label: formatMonth(value) })),
    ],
    [expenses],
  )

  const visible = sortExpenses(expenses).filter((expense) => {
    if (month && month !== 'all' && !expense.date.startsWith(month)) return false
    if (category && category !== 'all' && expense.category !== category) return false
    if (tag !== 'all' && expense.responsibility !== tag) return false
    return true
  })

  return (
    <Stack gap="lg">
      <PageHeading
        title="Expenses"
        description="Every signed-in resident can see building expenses and open a bill preview."
      />
      <Card>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select label="Month" data={monthOptions} value={month} onChange={setMonth} allowDeselect={false} />
          <Select
            label="Category"
            data={[{ value: 'all', label: 'All categories' }, ...categories.map((item) => ({ value: item.name, label: item.name }))]}
            value={category}
            onChange={setCategory}
            allowDeselect={false}
          />
        </SimpleGrid>
        <Stack gap={6} mt="md">
          <Text size="sm" fw={600}>
            Responsibility
          </Text>
          <SegmentedControl
            fullWidth
            value={tag}
            onChange={(value) => setTag(value as 'all' | Responsibility)}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Owner', value: 'Owner' },
              { label: 'Tenant', value: 'Tenant' },
            ]}
          />
        </Stack>
      </Card>

      <Card>
        {visible.length === 0 ? (
          <Text c="dimmed">No expenses match these filters.</Text>
        ) : (
          <Stack gap={0}>
            {visible.map((expense, index) => (
              <div key={expense.id}>
                {index > 0 ? <Divider my="xs" color="sand.2" /> : null}
                <ExpenseRow expense={expense} onOpen={() => setOpenedExpense(expense)} />
              </div>
            ))}
          </Stack>
        )}
        <Group mt="md">
          <Text size="xs" c="dimmed">
            {visible.length} shown
          </Text>
        </Group>
      </Card>

      <ExpensePreview expense={openedExpense} opened={openedExpense !== null} onClose={() => setOpenedExpense(null)} />
    </Stack>
  )
}
