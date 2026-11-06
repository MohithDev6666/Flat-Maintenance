import { Badge, SegmentedControl, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { ResponsiveList, StackedCell } from '../../components/common/ResponsiveList.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getAuditEntries } from '../../services/auditService.ts'
import type { AuditChange, AuditEntry } from '../../types/models.ts'
import { calendar } from '../../utils/calendar.ts'
import { formatDateTime } from '../../utils/format.ts'

type Scope = 'money' | 'Expense' | 'Payment' | 'all'

type Side = 'old' | 'new'

/** One side of a change as readable "Label: value" lines, e.g. "Amount: ₹1,500". */
function ChangeList({ entry, side }: { entry: AuditEntry; side: Side }) {
  const changes = changesOf(entry)
  if (changes.length === 0 && entry.oldValue && entry.newValue) {
    // Saved again with the same details: nothing a reader would see has changed.
    return (
      <Text size="xs" c="dimmed">
        No changes to the details
      </Text>
    )
  }
  const lines = changes.filter((change) => change[side] !== '')
  if (lines.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    )
  }
  return (
    <Stack gap={2}>
      {lines.map((change) => (
        <Text key={change.field} size="xs" style={{ overflowWrap: 'anywhere' }}>
          <Text span size="xs" c="dimmed">
            {change.label}:
          </Text>{' '}
          {change[side]}
        </Text>
      ))}
    </Stack>
  )
}

const looksLikeJson = (value: string) => /^\s*[{[]/.test(value)

/**
 * The changes for an entry, as decoded by the backend. Plain-text values the backend did not decode
 * are shown as they are; raw JSON records never are.
 */
function changesOf(entry: AuditEntry): AuditChange[] {
  if (entry.changes.length > 0) return entry.changes
  if (looksLikeJson(entry.oldValue) || looksLikeJson(entry.newValue)) return []
  if (!entry.oldValue && !entry.newValue) return []
  return [{ field: 'value', label: 'Value', old: entry.oldValue, new: entry.newValue }]
}

/** The last 30 days of the audit trail, newest first. */
export function RecentChangesPage() {
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('money')

  const load = useCallback(async () => {
    try {
      setAudit(await getAuditEntries())
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
      <ChangeList key="old" entry={entry} side="old" />,
      <ChangeList key="new" entry={entry} side="new" />,
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
        { label: 'Old', value: <ChangeList entry={entry} side="old" /> },
        { label: 'New', value: <ChangeList entry={entry} side="new" /> },
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
      <LoadState loading={loading} error={error} onRetry={load}>
        {rows.length === 0 ? (
          <EmptyState title="No changes in the last 30 days" message="Adding or editing an expense or payment shows up here." />
        ) : (
          <ResponsiveList headers={['Record', 'Description', 'Action · changed by', 'Timestamp', 'Old values', 'New values']} rows={rows} />
        )}
      </LoadState>
    </Stack>
  )
}
