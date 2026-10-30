import { Card, Text } from '@mantine/core'

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive'
}) {
  return (
    <Card bg="white">
      <Text size="xs" tt="uppercase" fw={700} c="sand.7" style={{ letterSpacing: '0.04em' }}>
        {label}
      </Text>
      <Text mt={8} fw={700} fz={{ base: 22, sm: 28 }} lh={1.15} c={tone === 'positive' ? 'teal.8' : 'terracotta.8'}>
        {value}
      </Text>
      {hint ? (
        <Text size="xs" c="dimmed" mt={6}>
          {hint}
        </Text>
      ) : null}
    </Card>
  )
}
