import type { Payment, ResidentKind } from '../types/models.ts'

export function screenshotsFor(payments: Payment[], flatId: string, role: ResidentKind, month: string): Payment[] {
  return payments.filter((payment) => payment.flatId === flatId && payment.role === role && payment.month === month)
}
