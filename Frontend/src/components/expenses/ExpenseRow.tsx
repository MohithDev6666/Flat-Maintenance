import { Badge, Group, Text, UnstyledButton } from '@mantine/core'
import type { Expense } from '../../types/models.ts'
import { formatDate, formatINR } from '../../utils/format.ts'

export function ExpenseRow({ expense, onOpen }: { expense: Expense; onOpen: () => void }) {
  return (
    <UnstyledButton onClick={onOpen} w="100%" py={6} style={{ textAlign: 'left' }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Group gap={8} wrap="wrap">
            <Text fw={600} size="sm">
              {expense.category}
            </Text>
            <Badge variant="light" color="terracotta" size="sm">
              {expense.responsibility}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            {formatDate(expense.date)} · {expense.paidBy}
            {expense.hasBill ? ' · Bill attached' : ''}
          </Text>
          <Text size="sm" mt={2} lineClamp={2}>
            {expense.description}
          </Text>
        </div>
        <Text fw={700} c="terracotta.8" style={{ flexShrink: 0 }}>
          {formatINR(expense.amount)}
        </Text>
      </Group>
    </UnstyledButton>
  )
}
