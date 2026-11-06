import type { Attachment, Payment, PaymentMode, PaymentVerification } from '../types/models.ts'
import { api, getAll } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

export type PaymentInput = Omit<Payment, 'id' | 'needsCheck' | 'checkNote' | 'status'>

export interface PaymentFilter {
  month?: string
  flatId?: string
  needsCheck?: boolean
}

export function toPayment(raw: Partial<Payment>): Payment {
  return {
    id: raw.id ?? '',
    userId: raw.userId ?? '',
    payerName: raw.payerName ?? '',
    flatId: raw.flatId ?? '',
    role: raw.role === 'tenant' ? 'tenant' : 'owner',
    residentId: raw.residentId ?? '',
    month: raw.month ?? '',
    amount: Number(raw.amount ?? 0),
    date: raw.date ?? '',
    mode: (raw.mode ?? 'Cash') as PaymentMode,
    reference: raw.reference ?? '',
    screenshot: (raw.screenshot as Attachment | undefined) ?? { name: '', url: null, kind: 'image' },
    needsCheck: Boolean(raw.needsCheck),
    checkNote: raw.checkNote ?? '',
    // Payments saved before verification existed have no status and count as verified.
    status: raw.status === 'Pending' ? 'Pending' : 'Verified',
  }
}

/** The review state shown on a payment, worked out the same way as the backend. */
export function paymentVerification(payment: Payment): PaymentVerification {
  if (payment.needsCheck) return 'Needs check'
  return payment.status === 'Pending' ? 'Pending verification' : 'Verified'
}

/** Admins get every payment; residents get only their own (the backend scopes the list). */
export async function getPayments(filter: PaymentFilter = {}): Promise<Payment[]> {
  return (await getAll<Partial<Payment>>(API_URLS.payments.list, { ...filter })).map(toPayment)
}

export async function getPayment(id: string): Promise<Payment> {
  return toPayment(await api.get<Partial<Payment>>(API_URLS.payments.byId(id)))
}

/** For residents the backend fills in the payer, flat, and role from their profile link. */
export async function createPayment(input: PaymentInput): Promise<Payment> {
  return toPayment(
    await api.post<Partial<Payment>>(API_URLS.payments.list, {
      ...input,
      amount: Number(input.amount),
      reference: input.reference.trim(),
    }),
  )
}

export async function updatePayment(id: string, input: PaymentInput): Promise<Payment> {
  return toPayment(await api.put<Partial<Payment>>(API_URLS.payments.byId(id), input))
}

export async function deletePayment(id: string): Promise<void> {
  await api.delete(API_URLS.payments.byId(id))
}

/** Admin review: mark a payment "Needs check" with a note for the payer. */
export async function flagPayment(id: string, note: string): Promise<Payment> {
  return toPayment(await api.post<Partial<Payment>>(API_URLS.payments.flag(id), { note: note.trim() }))
}

/** Admin review: verify the payment (also clears a "Needs check" flag), so it counts as paid. */
export async function clearPaymentFlag(id: string): Promise<Payment> {
  return toPayment(await api.delete<Partial<Payment>>(API_URLS.payments.flag(id)))
}
