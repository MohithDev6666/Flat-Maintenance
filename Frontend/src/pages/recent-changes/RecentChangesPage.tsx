import { Badge, SegmentedControl, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import { useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import { formatDateTime } from '../../utils/format.ts'

type Scope = 'money' | 'Expense' | 'Payment' | 'all'

function ValueText({ value }: { value: string }) {
  return (
    <Text size="xs" c={value ? undefined : 'dimmed'} style={{ overflowWrap: 'anywhere' }}>
      {value || '—'}
    </Text>
  )
}

/** The last 30 days of the audit trail, newest first. */
export function RecentChangesPage() {
  const { audit } = useBuilding()
  const [scope, setScope] = useState<Scope>('money')

  const cutoff = dayjs(calendar.today).subtract(30, 'day')
  const recent = audit
    .filter((entry) => !dayjs(entry.at).isBefore(cutoff, 'day'))
    .filter((entry) => {
      if (scope === 'all') return true
      if (scope === 'money') return entry.recordType === 'Expense' || entry.recordType === 'Payment'
      return entry.recordType === scope
    })
    .sort((left, right) => right.at.localeCompare(left.at))

  const rows = recent.map((entry) => ({
    key: entry.id,
    cells: [
      <Badge key="type" variant="light" color={entry.recordType === 'Payment' ? 'teal' : 'terracotta'}>
        {entry.recordType}
      </Badge>,
      entry.description,
      <StackedCell key="action" primary={entry.action} secondary={entry.actor} />,
      formatDateTime(entry.at),
      <ValueText key="old" value={entry.oldValue} />,
      <ValueText key="new" value={entry.newValue} />,
    ],
    card: {
      title: `${entry.action} · ${entry.description}`,
      subtitle: `${entry.actor} · ${formatDateTime(entry.at)}`,
      badge: (
        <Badge variant="light" color={entry.recordType === 'Payment' ? 'teal' : 'terracotta'}>
          {entry.recordType}
        </Badge>
      ),
      fields: [
        { label: 'Old', value: entry.oldValue || '—' },
        { label: 'New', value: entry.newValue || '—' },
      ],
    },
  }))

  return (
    <Stack gap="lg">
      <PageHeading
        title="Recent Changes"
        description="Who created, edited, re-tagged, or deleted what in the last 30 days, with the old and new values. Newest first."
      />
      <SegmentedControl
        w="fit-content"
        value={scope}
        onChange={(value) => setScope(value as Scope)}
        data={[
          { label: 'Expenses and payments', value: 'money' },
          { label: 'Expenses', value: 'Expense' },
          { label: 'Payments', value: 'Payment' },
          { label: 'Everything', value: 'all' },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No changes in the last 30 days" message="Adding or editing an expense or payment shows up here." />
      ) : (
        <ResponsiveList headers={['Record', 'Description', 'Action · changed by', 'Timestamp', 'Old values', 'New values']} rows={rows} />
      )}
    </Stack>
  )
}
