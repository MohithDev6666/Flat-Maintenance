import type { RecurringRule } from '../types/models.ts'

export const recurringRules: RecurringRule[] = [
  {
    id: 'rec-watchman',
    name: 'Watchman salary',
    category: 'Watchman',
    amount: 8000,
    responsibility: 'Tenant',
    dayOfMonth: 1,
  },
]
