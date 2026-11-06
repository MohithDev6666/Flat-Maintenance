import type { Attachment, Expense, PaymentMode, Responsibility } from '../types/models.ts'
import { api, getAll } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

/** What the Add / Edit Expense form sends. For residents the backend fills "paid by" from their profile. */
export interface ExpenseInput {
  date: string
  category: string
  responsibility: Responsibility
  description: string
  amount: number
  vendorName: string
  vendorPhone: string
  paymentMode: PaymentMode
  bill: Attachment | null
  paidBy: string
  paidByUserId: string | null
}

export function toExpense(raw: Partial<Expense>): Expense {
  return {
    id: raw.id ?? '',
    date: raw.date ?? '',
    category: raw.category ?? '',
    responsibility: raw.responsibility === 'Owner' ? 'Owner' : 'Tenant',
    description: raw.description ?? '',
    amount: Number(raw.amount ?? 0),
    vendorName: raw.vendorName ?? '',
    vendorPhone: raw.vendorPhone ?? '',
    paymentMode: (raw.paymentMode ?? 'Cash') as PaymentMode,
    paidBy: raw.paidBy ?? '',
    paidByUserId: raw.paidByUserId ?? null,
    bill: (raw.bill as Attachment | null | undefined) ?? null,
  }
}

function payload(input: ExpenseInput): ExpenseInput {
  return {
    ...input,
    description: input.description.trim(),
    vendorName: input.vendorName.trim(),
    vendorPhone: input.vendorPhone.trim(),
    amount: Number(input.amount),
  }
}

/** All expenses, or only one month's when `month` (YYYY-MM) is given. */
export async function getExpenses(month?: string): Promise<Expense[]> {
  return (await getAll<Partial<Expense>>(API_URLS.expenses.list, { month })).map(toExpense)
}

export async function getExpense(id: string): Promise<Expense> {
  return toExpense(await api.get<Partial<Expense>>(API_URLS.expenses.byId(id)))
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  return toExpense(await api.post<Partial<Expense>>(API_URLS.expenses.list, payload(input)))
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
  return toExpense(await api.put<Partial<Expense>>(API_URLS.expenses.byId(id), payload(input)))
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(API_URLS.expenses.byId(id))
}
