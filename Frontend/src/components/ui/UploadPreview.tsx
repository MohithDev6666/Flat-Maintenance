import { ActionIcon, Box } from '@mantine/core'
import { IconX } from '@tabler/icons-react'

export function UploadPreview({
  url,
  name,
  kind,
  onRemove,
}: {
  url: string
  name: string
  kind: 'image' | 'pdf'
  onRemove: () => void
}) {
  return (
    <Box onClick={(event) => event.stopPropagation()} style={{ pointerEvents: 'auto' }}>
      <Box pos="relative" style={{ width: kind === 'pdf' ? '100%' : 'fit-content', maxWidth: '100%', marginInline: 'auto' }}>
        <ActionIcon
          aria-label={`Remove ${name}`}
          variant="filled"
          color="dark"
          radius="xl"
          size="sm"
          pos="absolute"
          top={6}
          right={6}
          style={{ zIndex: 2 }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
          }}
        >
          <IconX size={14} />
        </ActionIcon>
        {kind === 'pdf' ? (
          <iframe
            title={name}
            src={url}
            style={{ display: 'block', width: '100%', height: 280, border: 0, borderRadius: 8, background: '#fff' }}
          />
        ) : (
          <img
            src={url}
            alt={name}
            style={{ display: 'block', maxWidth: '100%', maxHeight: 280, borderRadius: 8, background: '#fff' }}
          />
        )}
      </Box>
    </Box>
  )
}
