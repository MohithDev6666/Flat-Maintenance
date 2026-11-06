import type { CategoryTag, ExpenseCategory } from '../types/models.ts'
import { api, getAll } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

export type CategoryInput = Omit<ExpenseCategory, 'id'>

export function toCategory(raw: Partial<ExpenseCategory>): ExpenseCategory {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    defaultTag: (raw.defaultTag ?? 'Other') as CategoryTag,
    status: raw.status === 'Inactive' ? 'Inactive' : 'Active',
  }
}

function payload(input: CategoryInput): CategoryInput {
  return { name: input.name.trim(), description: input.description.trim(), defaultTag: input.defaultTag, status: input.status }
}

/** Every category, sorted by name. Also used for the Add / Edit Expense dropdown. */
export async function getCategories(): Promise<ExpenseCategory[]> {
  const categories = (await getAll<Partial<ExpenseCategory>>(API_URLS.categories.list)).map(toCategory)
  return categories.sort((left, right) => left.name.localeCompare(right.name))
}

export async function createCategory(input: CategoryInput): Promise<ExpenseCategory> {
  return toCategory(await api.post<Partial<ExpenseCategory>>(API_URLS.categories.list, payload(input)))
}

/** Renaming a category also renames it on every expense (done by the backend). */
export async function updateCategory(id: string, input: CategoryInput): Promise<ExpenseCategory> {
  return toCategory(await api.put<Partial<ExpenseCategory>>(API_URLS.categories.byId(id), payload(input)))
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(API_URLS.categories.byId(id))
}
