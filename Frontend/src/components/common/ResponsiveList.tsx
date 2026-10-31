import { Box, Card, Group, Stack, Table, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export interface ListRow {
  key: string
  /** Table cells on desktop, one per header. */
  cells: ReactNode[]
  /** The same row as a card on phones. */
  card: {
    title: string
    subtitle?: string
    badge?: ReactNode
    fields: { label: string; value: ReactNode }[]
  }
  actions?: ReactNode
}

/** A fixed-layout table from the `sm` breakpoint up, and one card per row below it. */
export function ResponsiveList({ headers, rows }: { headers: string[]; rows: ListRow[] }) {
  const withActions = rows.some((row) => row.actions)
  return (
    <>
      <Stack gap="sm" hiddenFrom="sm">
        {rows.map((row) => (
          <Card key={row.key} withBorder padding="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <div style={{ minWidth: 0 }}>
                <Text fw={700} style={{ overflowWrap: 'anywhere' }}>
                  {row.card.title}
                </Text>
                {row.card.subtitle ? (
                  <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                    {row.card.subtitle}
                  </Text>
                ) : null}
              </div>
              {row.card.badge}
            </Group>
            <Stack gap={2} mt="xs">
              {row.card.fields.map((field) => (
                <Text key={field.label} size="sm" component="div" style={{ overflowWrap: 'anywhere' }}>
                  <Text span c="dimmed">
                    {field.label}
                  </Text>
                  {' · '}
                  {field.value}
                </Text>
              ))}
            </Stack>
            {row.actions ? (
              <Group gap={6} wrap="wrap" mt="sm">
                {row.actions}
              </Group>
            ) : null}
          </Card>
        ))}
      </Stack>
      <Box visibleFrom="sm">
        <Card p={0}>
          <Table className="admin-fit-table" striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                {headers.map((header) => (
                  <Table.Th key={header}>{header}</Table.Th>
                ))}
                {withActions ? <Table.Th style={{ width: 200 }} /> : null}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.key}>
                  {row.cells.map((cell, index) => (
                    <Table.Td key={headers[index] ?? index}>{cell}</Table.Td>
                  ))}
                  {withActions ? (
                    <Table.Td>
                      <Group gap={6} wrap="wrap">
                        {row.actions}
                      </Group>
                    </Table.Td>
                  ) : null}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      </Box>
    </>
  )
}

/** Two-line cell: a bold primary value and a dimmed detail. */
export function StackedCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div>
      <Text size="sm" fw={600}>
        {primary}
      </Text>
      {secondary ? (
        <Text size="xs" c="dimmed">
          {secondary}
        </Text>
      ) : null}
    </div>
  )
}
