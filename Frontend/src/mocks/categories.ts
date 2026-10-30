import type { ExpenseCategory } from '../types/models.ts'

export const categories: ExpenseCategory[] = [
  { id: 'cat-electricity', name: 'Common electricity', defaultTag: 'Tenant' },
  { id: 'cat-water', name: 'Water', defaultTag: 'Tenant' },
  { id: 'cat-watchman', name: 'Watchman', defaultTag: 'Tenant' },
  { id: 'cat-cleaning', name: 'Cleaning', defaultTag: 'Tenant' },
  { id: 'cat-garbage', name: 'Garbage', defaultTag: 'Tenant' },
  { id: 'cat-repairs', name: 'Minor repairs', defaultTag: 'Tenant' },
  { id: 'cat-motor', name: 'Motor running/maintenance', defaultTag: 'Tenant' },
  { id: 'cat-structural', name: 'Structural repair', defaultTag: 'Owner' },
  { id: 'cat-painting', name: 'Painting', defaultTag: 'Owner' },
  { id: 'cat-waterproof', name: 'Waterproofing', defaultTag: 'Owner' },
  { id: 'cat-lift', name: 'Lift/Motor replacement', defaultTag: 'Owner' },
  { id: 'cat-equipment', name: 'New equipment', defaultTag: 'Owner' },
  { id: 'cat-legal', name: 'Legal/Property', defaultTag: 'Owner' },
  { id: 'cat-other', name: 'Other', defaultTag: 'Other' },
]
