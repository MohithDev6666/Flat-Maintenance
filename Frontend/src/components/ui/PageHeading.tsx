import { Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
      <div>
        <Title order={2}>{title}</Title>
        {description ? (
          <Text c="dimmed" mt={4} maw={560}>
            {description}
          </Text>
        ) : null}
      </div>
      {action}
    </Group>
  )
}
