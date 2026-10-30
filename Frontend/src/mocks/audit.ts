import type { AuditEntry } from '../types/models.ts'

export const mockAudit: AuditEntry[] = [
  {
    id: 'audit-painting',
    at: '2026-10-12T09:15:00',
    actor: 'Harish Naidu',
    action: 'Added expense',
    detail: 'Painting · ₹16,000 · Owner',
  },
  {
    id: 'audit-water',
    at: '2026-10-05T11:40:00',
    actor: 'Pooja Shah',
    action: 'Added expense',
    detail: 'Water · ₹1,600 · Tenant',
  },
  {
    id: 'audit-watchman',
    at: '2026-10-01T00:05:00',
    actor: 'System',
    action: 'Created recurring expense',
    detail: 'Watchman · ₹8,000 · Tenant',
  },
]
