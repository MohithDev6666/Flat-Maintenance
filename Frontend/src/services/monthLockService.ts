import type { MonthLock } from '../types/models.ts'
import { api } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

export function toMonthLock(raw: Partial<MonthLock>): MonthLock {
  return {
    month: raw.month ?? '',
    locked: Boolean(raw.locked),
    lockedBy: raw.lockedBy ?? '',
    lockedAt: raw.lockedAt ?? null,
    unlockedBy: raw.unlockedBy ?? '',
    unlockedAt: raw.unlockedAt ?? null,
  }
}

export async function getMonthLocks(): Promise<MonthLock[]> {
  return ((await api.get<Partial<MonthLock>[] | null>(API_URLS.monthLocks.list)) ?? []).map(toMonthLock)
}

/** Locks or unlocks a `YYYY-MM` month. The backend keeps who locked / unlocked it and when. */
export async function setMonthLock(month: string, locked: boolean): Promise<MonthLock> {
  return toMonthLock(await api.put<Partial<MonthLock>>(API_URLS.monthLocks.byMonth(month), { locked }))
}

/** Builds the `isLocked(month)` check the screens use from a loaded lock list. */
export function lockChecker(locks: MonthLock[]): (month: string) => boolean {
  const locked = new Set(locks.filter((lock) => lock.locked).map((lock) => lock.month))
  return (month: string) => locked.has(month)
}
