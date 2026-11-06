import type { Attachment, IdProofType, Tenant } from '../types/models.ts'
import { api, getAll } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

export type TenantInput = Omit<Tenant, 'id'>

export function toTenant(raw: Partial<Tenant>): Tenant {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    flatId: raw.flatId ? raw.flatId : null,
    occupants: Number(raw.occupants ?? 1),
    moveIn: raw.moveIn ?? '',
    moveOut: raw.moveOut ? raw.moveOut : null,
    agreementEnd: raw.agreementEnd ?? '',
    idProofType: (raw.idProofType ?? 'Aadhaar') as IdProofType,
    idProof: (raw.idProof as Attachment | null | undefined) ?? null,
    emergency: raw.emergency ?? '',
    vehicle: raw.vehicle ?? '',
  }
}

function payload(input: TenantInput) {
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    flatId: input.flatId ?? '',
    occupants: Number(input.occupants),
    moveIn: input.moveIn,
    moveOut: input.moveOut || null,
    agreementEnd: input.agreementEnd,
    idProofType: input.idProofType,
    idProof: input.idProof,
    emergency: input.emergency.trim(),
    vehicle: input.vehicle.trim(),
  }
}

export async function getTenants(): Promise<Tenant[]> {
  return (await getAll<Partial<Tenant>>(API_URLS.tenants.list)).map(toTenant)
}

export async function getTenant(id: string): Promise<Tenant> {
  return toTenant(await api.get<Partial<Tenant>>(API_URLS.tenants.byId(id)))
}

/** The backend sets the flat to Occupied / Available from the tenancy dates. */
export async function createTenant(input: TenantInput): Promise<Tenant> {
  return toTenant(await api.post<Partial<Tenant>>(API_URLS.tenants.list, payload(input)))
}

export async function updateTenant(id: string, input: TenantInput): Promise<Tenant> {
  return toTenant(await api.put<Partial<Tenant>>(API_URLS.tenants.byId(id), payload(input)))
}

export async function deleteTenant(id: string): Promise<void> {
  await api.delete(API_URLS.tenants.byId(id))
}
