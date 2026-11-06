import { Button, Group, Modal, Stack, Text } from '@mantine/core'

export function ConfirmDialog({
  opened,
  title,
  message,
  confirmLabel,
  color = 'red',
  loading = false,
  onConfirm,
  onClose,
}: {
  opened: boolean
  title: string
  message: string
  confirmLabel: string
  color?: string
  /** Shows a spinner on the confirm button while the request runs. */
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal opened={opened} onClose={loading ? () => undefined : onClose} title={title} centered>
      <Stack gap="md">
        <Text size="sm">{message}</Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button color={color} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
