import { Button, Group, Stack, Text } from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import { IconCamera, IconUpload } from '@tabler/icons-react'
import { useRef } from 'react'
import type { Attachment } from '../../types/models.ts'
import { chosenFileKind, photoOrPdf, uploadRejectMessage } from '../../utils/upload.ts'
import { UploadPreview } from '../ui/UploadPreview.tsx'

/**
 * Photo or PDF picker with an in-page preview and a camera button for phones.
 * The file stays in memory as an object URL, which is enough for this static build.
 */
export function FileUploadField({
  label,
  description,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
}: {
  label: string
  description?: string
  value: Attachment | null
  onChange: (file: Attachment | null) => void
  required?: boolean
  disabled?: boolean
  error?: string | null
}) {
  const openPicker = useRef<() => void>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  const take = (file: File) => {
    onChange({ name: file.name, url: URL.createObjectURL(file), kind: chosenFileKind(file) })
  }

  return (
    <Stack gap={6}>
      <div>
        <Text size="sm" fw={600}>
          {label}
          {required ? (
            <Text span c="red">
              {' '}
              *
            </Text>
          ) : null}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        ) : null}
      </div>
      <Dropzone
        openRef={openPicker}
        multiple={false}
        disabled={disabled}
        maxSize={8 * 1024 ** 2}
        accept={photoOrPdf}
        onDrop={(files) => {
          const file = files[0]
          if (file) take(file)
        }}
        onReject={() => notifications.show({ color: 'red', title: 'File not added', message: uploadRejectMessage })}
        style={error ? { borderColor: 'var(--mantine-color-red-6)' } : undefined}
      >
        {value?.url ? (
          <UploadPreview url={value.url} name={value.name} kind={value.kind} onRemove={() => onChange(null)} />
        ) : (
          <Stack align="center" gap={4} mih={84} justify="center" style={{ pointerEvents: 'none' }}>
            <Text size="sm" ta="center">
              {value ? value.name : 'Tap to choose a file'}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              JPG, PNG, other photos, or PDF. Up to 8 MB.
            </Text>
          </Stack>
        )}
      </Dropzone>
      {error ? (
        <Text size="xs" c="red">
          {error}
        </Text>
      ) : null}
      <Group gap="xs" wrap="wrap">
        <Button variant="light" size="xs" leftSection={<IconUpload size={14} />} disabled={disabled} onClick={() => openPicker.current?.()}>
          {value ? 'Replace file' : 'Choose file'}
        </Button>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconCamera size={14} />}
          disabled={disabled}
          onClick={() => cameraInput.current?.click()}
        >
          Take photo
        </Button>
        {value ? (
          <Button variant="subtle" color="terracotta" size="xs" disabled={disabled} onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
      </Group>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) take(file)
          event.currentTarget.value = ''
        }}
      />
    </Stack>
  )
}
