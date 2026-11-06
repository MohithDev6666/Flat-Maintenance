import { notifications } from '@mantine/notifications'
import { getErrorMessage } from '../services/apiClient.ts'

export function notifySuccess(title: string, message: string) {
  notifications.show({ color: 'terracotta', title, message })
}

export function notifyError(title: string, message: string) {
  notifications.show({ color: 'red', title, message, autoClose: 7000 })
}

/** Shows the API's error message (validation, permission, conflict, or network) in a red notification. */
export function notifyApiError(error: unknown, title = 'Not saved') {
  notifyError(title, getErrorMessage(error))
}
