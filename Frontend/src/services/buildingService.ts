import type { Building } from '../types/models.ts'
import { api } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

export const emptyBuilding: Building = { name: '', address: '', totalFlats: 0, floors: 0, contactPhone: '' }

function toBuilding(raw: Partial<Building> | null | undefined): Building {
  return {
    name: raw?.name ?? '',
    address: raw?.address ?? '',
    totalFlats: Number(raw?.totalFlats ?? 0),
    floors: Number(raw?.floors ?? 0),
    contactPhone: raw?.contactPhone ?? '',
  }
}

/** The single building record. An unset building comes back with empty fields. */
export async function getBuilding(): Promise<Building> {
  return toBuilding(await api.get<Partial<Building>>(API_URLS.building))
}

/** Creates the building the first time and updates it afterwards. */
export async function saveBuilding(building: Building): Promise<Building> {
  const payload: Building = {
    name: building.name.trim(),
    address: building.address.trim(),
    totalFlats: Number(building.totalFlats),
    floors: Number(building.floors),
    contactPhone: building.contactPhone.trim(),
  }
  return toBuilding(await api.put<Partial<Building>>(API_URLS.building, payload))
}
