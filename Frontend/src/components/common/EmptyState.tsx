import { Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <Stack align="center" gap={6} py="xl" px="md">
      <Text fw={700} ta="center">
        {title}
      </Text>
      {message ? (
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          {message}
        </Text>
      ) : null}
      {action}
    </Stack>
  )
}
