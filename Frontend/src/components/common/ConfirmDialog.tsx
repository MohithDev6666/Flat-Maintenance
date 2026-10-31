import { Button, Group, Modal, Stack, Text } from '@mantine/core'

export function ConfirmDialog({
  opened,
  title,
  message,
  confirmLabel,
  color = 'red',
  onConfirm,
  onClose,
}: {
  opened: boolean
  title: string
  message: string
  confirmLabel: string
  color?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        <Text size="sm">{message}</Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color={color} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
