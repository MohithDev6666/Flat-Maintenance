import type { Owner } from '../types/models.ts'
import { api, getAll } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

export type OwnerInput = Omit<Owner, 'id'>

export function toOwner(raw: Partial<Owner>): Owner {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    flatId: raw.flatId ? raw.flatId : null,
    address: raw.address ?? '',
    emergency: raw.emergency ?? '',
  }
}

function payload(input: OwnerInput): OwnerInput {
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    flatId: input.flatId || null,
    address: input.address.trim(),
    emergency: input.emergency.trim(),
  }
}

export async function getOwners(): Promise<Owner[]> {
  return (await getAll<Partial<Owner>>(API_URLS.owners.list)).map(toOwner)
}

export async function getOwner(id: string): Promise<Owner> {
  return toOwner(await api.get<Partial<Owner>>(API_URLS.owners.byId(id)))
}

/** Choosing a flat that already has an owner transfers it; the backend releases the previous owner. */
export async function createOwner(input: OwnerInput): Promise<Owner> {
  return toOwner(await api.post<Partial<Owner>>(API_URLS.owners.list, payload(input)))
}

export async function updateOwner(id: string, input: OwnerInput): Promise<Owner> {
  return toOwner(await api.put<Partial<Owner>>(API_URLS.owners.byId(id), payload(input)))
}

export async function deleteOwner(id: string): Promise<void> {
  await api.delete(API_URLS.owners.byId(id))
}
