import { Modal, Stack, Text } from '@mantine/core'
import type { Attachment } from '../../types/models.ts'

/** Shows a bill, payment screenshot, or ID proof inside the app. Seeded sample files only have a name. */
export function FilePreview({
  file,
  title,
  note,
  onClose,
}: {
  file: Attachment | null
  title: string
  note?: string
  onClose: () => void
}) {
  return (
    <Modal opened={file !== null} onClose={onClose} title={title} size="lg">
      {file ? (
        <Stack gap="sm">
          <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
            {file.name}
          </Text>
          {file.url ? (
            file.kind === 'pdf' ? (
              <iframe
                title={file.name}
                src={file.url}
                style={{ display: 'block', width: '100%', height: '70dvh', border: 0, borderRadius: 8, background: '#fff' }}
              />
            ) : (
              <img
                src={file.url}
                alt={file.name}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '70dvh', margin: '0 auto', borderRadius: 8 }}
              />
            )
          ) : (
            <Text size="sm" c="dimmed">
              This is sample data, so only the file name is stored. Files you upload in this session open here in full.
            </Text>
          )}
          {note ? (
            <Text size="xs" c="dimmed">
              {note}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Modal>
  )
}
