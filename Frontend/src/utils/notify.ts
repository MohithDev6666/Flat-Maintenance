import { notifications } from '@mantine/notifications'

export function notifySuccess(title: string, message: string) {
  notifications.show({ color: 'terracotta', title, message })
}

export function notifyError(title: string, message: string) {
  notifications.show({ color: 'red', title, message })
}

/** Runs a store action that returns an error string or null, and shows the matching notification. */
export function notifyResult(error: string | null, success: { title: string; message: string }, failTitle = 'Not saved'): boolean {
  if (error) {
    notifyError(failTitle, error)
    return false
  }
  notifySuccess(success.title, success.message)
  return true
}
