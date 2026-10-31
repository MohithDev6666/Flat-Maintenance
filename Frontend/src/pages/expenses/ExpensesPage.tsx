import { Badge, Box, Button, Card, Divider, Group, SegmentedControl, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { FilePreview } from '../../components/common/FilePreview.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { ExpenseDetails } from '../../components/expenses/ExpenseDetails.tsx'
import { ExpenseRow } from '../../components/expenses/ExpenseRow.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { calendar } from '../../mocks/calendar.ts'
import { paths } from '../../routes/nav.ts'
import type { Attachment, Expense, Responsibility } from '../../types/models.ts'
import { listMonths, monthOf, sortExpenses } from '../../utils/calculations.ts'
import { formatDate, formatINR, formatMonth } from '../../utils/format.ts'

export function ExpensesPage() {
  const { expenses, categories, isLocked } = useBuilding()
  const { can } = usePermissions()
  const [month, setMonth] = useState<string | null>(calendar.currentMonth)
  const [category, setCategory] = useState<string | null>('all')
  const [tag, setTag] = useState<'all' | Responsibility>('all')
  const [openedExpense, setOpenedExpense] = useState<Expense | null>(null)
  const [bill, setBill] = useState<Attachment | null>(null)

  const monthOptions = useMemo(
    () => [
      { value: 'all', label: 'All months' },
      ...listMonths(expenses)
        .slice()
        .reverse()
        .map((value) => ({ value, label: `${formatMonth(value)}${isLocked(value) ? ' · Locked' : ''}` })),
    ],
    [expenses, isLocked],
  )

  const visible = sortExpenses(expenses).filter((expense) => {
    if (month && month !== 'all' && monthOf(expense.date) !== month) return false
    if (category && category !== 'all' && expense.category !== category) return false
    if (tag !== 'all' && expense.responsibility !== tag) return false
    return true
  })
  const total = visible.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <Stack gap="lg">
      <PageHeading
        title="Expenses"
        description="Every signed-in resident can see building expenses and open a bill preview."
        action={
          can('expenses', 'add') ? (
            <Button component={Link} to={paths.addExpense} leftSection={<IconPlus size={16} />}>
              Add Expense
            </Button>
          ) : null
        }
      />
      <Card>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select label="Month" data={monthOptions} value={month} onChange={setMonth} allowDeselect={false} searchable />
          <Select
            label="Category"
            data={[{ value: 'all', label: 'All categories' }, ...categories.map((item) => ({ value: item.name, label: item.name }))]}
            value={category}
            onChange={setCategory}
            allowDeselect={false}
            searchable
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
        {month && month !== 'all' && isLocked(month) ? (
          <Group gap="xs" mt="md">
            <StatusBadge status="Locked" />
            <Text size="sm" c="dimmed">
              {formatMonth(month)} is locked. Expenses in it cannot be edited.
            </Text>
          </Group>
        ) : null}
      </Card>

      <Card p={visible.length === 0 ? undefined : 0}>
        {visible.length === 0 ? (
          <EmptyState
            title="No expenses match these filters"
            message="Try another month or category."
            action={
              can('expenses', 'add') ? (
                <Button component={Link} to={paths.addExpense} variant="light" mt="xs">
                  Add Expense
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Stack gap={0} p="md" hiddenFrom="md">
              {visible.map((expense, index) => (
                <div key={expense.id}>
                  {index > 0 ? <Divider my="xs" color="sand.2" /> : null}
                  <ExpenseRow expense={expense} onOpen={() => setOpenedExpense(expense)} />
                </div>
              ))}
            </Stack>
            <Box visibleFrom="md">
              <Table.ScrollContainer minWidth={980}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                      <Table.Th>Responsibility</Table.Th>
                      <Table.Th>Paid by</Table.Th>
                      <Table.Th>Vendor</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th>Bill</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {visible.map((expense) => (
                      <Table.Tr key={expense.id} style={{ cursor: 'pointer' }} onClick={() => setOpenedExpense(expense)}>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(expense.date)}</Table.Td>
                        <Table.Td>{expense.category}</Table.Td>
                        <Table.Td maw={260}>
                          <Text size="sm" lineClamp={2}>
                            {expense.description}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" fw={700} c="terracotta.8">
                          {formatINR(expense.amount)}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="terracotta" size="sm">
                            {expense.responsibility}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{expense.paidBy}</Table.Td>
                        <Table.Td>{expense.vendorName || '—'}</Table.Td>
                        <Table.Td>{expense.paymentMode}</Table.Td>
                        <Table.Td>
                          {expense.bill ? (
                            <Button
                              size="compact-xs"
                              variant="light"
                              onClick={(event) => {
                                event.stopPropagation()
                                setBill(expense.bill)
                              }}
                            >
                              View bill
                            </Button>
                          ) : (
                            '—'
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Box>
          </>
        )}
        {visible.length > 0 ? (
          <Group justify="space-between" px="md" py="sm">
            <Text size="xs" c="dimmed">
              {visible.length} shown
            </Text>
            <Text size="sm" fw={700}>
              Total {formatINR(total)}
            </Text>
          </Group>
        ) : null}
      </Card>

      <ExpenseDetails expense={openedExpense} opened={openedExpense !== null} onClose={() => setOpenedExpense(null)} />
      <FilePreview file={bill} title="Bill" note="Every signed-in resident can open a bill." onClose={() => setBill(null)} />
    </Stack>
  )
}
