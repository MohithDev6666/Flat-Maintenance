import { Text } from '@mantine/core'
import type { ReactNode } from 'react'

/** "Label · value" on one line, used in the admin view dialogs. */
export function DetailLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Text size="sm" component="div" style={{ overflowWrap: 'anywhere' }}>
      <Text span c="dimmed">
        {label}
      </Text>
      {' · '}
      {value}
    </Text>
  )
}
