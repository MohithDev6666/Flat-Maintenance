import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

/**
 * Shows a spinner while a screen loads and an error with a retry button when it fails;
 * renders the screen's content once the data is in.
 */
export function LoadState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean
  error: string | null
  onRetry?: () => Promise<void> | void
  children: ReactNode
}) {
  const [retrying, setRetrying] = useState(false)

  const retry = async () => {
    if (!onRetry) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  if (error) {
    return (
      <Alert color="red" variant="light" title="Could not load this page" icon={<IconAlertTriangle size={18} />}>
        <Stack gap="xs" align="flex-start">
          <Text size="sm">{error}</Text>
          {onRetry ? (
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconRefresh size={14} />}
              loading={retrying}
              onClick={() => void retry()}
            >
              Try again
            </Button>
          ) : null}
        </Stack>
      </Alert>
    )
  }
  if (loading) {
    return (
      <Center py="xl">
        <Loader color="terracotta" />
      </Center>
    )
  }
  return <>{children}</>
}
