import { Anchor, Badge, Box, Card, Divider, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ExpenseRow } from '../../components/expenses/ExpenseRow.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import { paths } from '../../routes/nav.ts'
import type { Expense, SessionUser } from '../../types/models.ts'
import { firstName, formatMonth, greeting } from '../../utils/format.ts'

export function DashboardHeader({ user }: { user: SessionUser }) {
  const { building, isLocked } = useBuilding()
  return (
    <Stack gap={6}>
      <Group gap="xs">
        <Badge variant="light" color="terracotta">
          {formatMonth(calendar.currentMonth)}
        </Badge>
        <Badge variant="outline" color="terracotta">
          {user.flatNumber ? `Flat ${user.flatNumber}` : 'Building account'}
        </Badge>
        {isLocked(calendar.currentMonth) ? (
          <Badge color="red" variant="light">
            Month locked
          </Badge>
        ) : null}
      </Group>
      <Title order={2}>
        {greeting()}, {firstName(user.name)}
      </Title>
      <Text c="dimmed">Shared maintenance for {building.name}.</Text>
    </Stack>
  )
}

export function LatestExpensesCard({
  expenses,
  onOpen,
  showAll = false,
}: {
  expenses: Expense[]
  onOpen: (expense: Expense) => void
  showAll?: boolean
}) {
  return (
    <Card>
      <Group justify="space-between" mb="sm">
        <Text fw={700}>Latest expenses</Text>
        {showAll ? (
          <Anchor component={Link} to={paths.expenses} size="sm" c="terracotta.8">
            View all
          </Anchor>
        ) : null}
      </Group>
      <Stack gap={0}>
        {expenses.map((expense, index) => (
          <div key={expense.id}>
            {index > 0 ? <Divider my="xs" color="sand.2" /> : null}
            <ExpenseRow expense={expense} onOpen={() => onOpen(expense)} />
          </div>
        ))}
      </Stack>
    </Card>
  )
}

export function BannerLink({
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
