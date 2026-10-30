import type { PayStatus, Payment } from '../types/models.ts'

export function partyPaid(payments: Payment[], flatNumber: string, role: 'owner' | 'tenant', month: string): number {
  return payments
    .filter((payment) => payment.flatNumber === flatNumber && payment.role === role && payment.month === month)
    .reduce((sum, payment) => sum + payment.amount, 0)
}

export function settlementStatus(amountDue: number, paid: number): PayStatus {
  if (amountDue <= 0) return 'Paid'
  if (paid <= 0) return 'Unpaid'
  if (paid + 0.001 >= amountDue) return 'Paid'
  return 'Partial'
}

export function screenshotsFor(
  payments: Payment[],
  flatNumber: string,
  role: 'owner' | 'tenant',
  month: string,
): Payment[] {
  return payments.filter(
    (payment) =>
      payment.flatNumber === flatNumber && payment.role === role && payment.month === month && payment.screenshotLabel,
  )
}
