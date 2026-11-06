import type { AuditChange, AuditEntry, AuditRecord } from '../types/models.ts'
import { api, getAll } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

function toAuditEntry(raw: Partial<AuditEntry>): AuditEntry {
  return {
    id: raw.id ?? '',
    at: raw.at ?? '',
    actor: raw.actor ?? '',
    recordType: (raw.recordType ?? 'Expense') as AuditRecord,
    action: raw.action ?? '',
    description: raw.description ?? '',
    oldValue: raw.oldValue ?? '',
    newValue: raw.newValue ?? '',
    changes: (raw.changes ?? []).map((change: Partial<AuditChange>) => ({
      field: change.field ?? '',
      label: change.label ?? change.field ?? '',
      old: change.old ?? '',
      new: change.new ?? '',
    })),
  }
}

/** The audit trail, newest first. The backend writes an entry on every change. */
export async function getAuditEntries(): Promise<AuditEntry[]> {
  return (await getAll<Partial<AuditEntry>>(API_URLS.audit.list)).map(toAuditEntry)
}

export async function getAuditEntry(id: string): Promise<AuditEntry> {
  return toAuditEntry(await api.get<Partial<AuditEntry>>(API_URLS.audit.byId(id)))
}
