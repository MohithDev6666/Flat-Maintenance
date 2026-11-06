import type { Flat, OccupancyStatus } from '../types/models.ts'
import { api, getAll } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

/** What the Flats master saves. Owners and tenants are linked to a flat on their own masters. */
export interface FlatInput {
  number: string
  floor: number
  status: OccupancyStatus
}

export function toFlat(raw: Partial<Flat>): Flat {
  return {
    id: raw.id ?? '',
    number: raw.number ?? '',
    floor: Number(raw.floor ?? 0),
    status: raw.status === 'Occupied' ? 'Occupied' : 'Available',
  }
}

function payload(input: FlatInput): FlatInput {
  return { number: input.number.trim(), floor: Number(input.floor), status: input.status }
}

/** Read-only flat list for the common Flats page and dropdowns (needs `flats:view`). */
export async function getFlats(): Promise<Flat[]> {
  return (await getAll<Partial<Flat>>(API_URLS.flats.list)).map(toFlat)
}

export async function getFlat(id: string): Promise<Flat> {
  return toFlat(await api.get<Partial<Flat>>(API_URLS.flats.byId(id)))
}

// Admin → Flats uses the Flat Management endpoints (`flatManagement:*` permissions).

export async function getManagedFlats(): Promise<Flat[]> {
  return (await getAll<Partial<Flat>>(API_URLS.flatManagement.list)).map(toFlat)
}

export async function createFlat(input: FlatInput): Promise<Flat> {
  return toFlat(await api.post<Partial<Flat>>(API_URLS.flatManagement.list, payload(input)))
}

export async function updateFlat(id: string, input: FlatInput): Promise<Flat> {
  return toFlat(await api.put<Partial<Flat>>(API_URLS.flatManagement.byId(id), payload(input)))
}

export async function deleteFlat(id: string): Promise<void> {
  await api.delete(API_URLS.flatManagement.byId(id))
}
