import type { AppRole, PermissionModule, PermissionSet, RecordStatus } from '../types/models.ts'
import { fullPermissions, permissionStringsFromSet, roleActions, toModule } from '../utils/modules.ts'
import { api, unwrap } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

interface RawPermissionObject {
  module_key: string
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

interface RawRole {
  id: string
  name: string
  description?: string
  level?: number
  is_admin?: boolean
  isSystem?: boolean
  active?: number
  permissions_objects?: RawPermissionObject[] | null
}

interface RawModule {
  id: string
  key: string
  name: string
}

export interface RoleInput {
  name: string
  description: string
  status: RecordStatus
  isAdmin: boolean
  permissions: PermissionSet
}

/** RBAC modules, used to translate module IDs stored on roles back to module keys. */
export async function getModules(): Promise<RawModule[]> {
  return unwrap(await api.get<{ data?: RawModule[] }>(API_URLS.modules.list)) ?? []
}

function toAppRole(raw: RawRole, moduleKeyById: Map<string, string>): AppRole {
  const isAdmin = Boolean(raw.is_admin) || raw.level === 1
  const permissions: PermissionSet = {}
  if (isAdmin) {
    Object.assign(permissions, fullPermissions())
  } else {
    for (const object of raw.permissions_objects ?? []) {
      const module: PermissionModule | null = toModule(moduleKeyById.get(object.module_key) ?? object.module_key)
      if (!module) continue
      const actions = roleActions.filter((action) => object[action])
      if (actions.length > 0) permissions[module] = actions
    }
  }
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    status: raw.active === 0 ? 'Inactive' : 'Active',
    isAdmin,
    system: Boolean(raw.isSystem) || isAdmin,
    permissions,
  }
}

export async function getRoles(): Promise<AppRole[]> {
  const [roles, modules] = await Promise.all([api.get<{ data?: RawRole[] }>(API_URLS.roles.list), getModules()])
  const moduleKeyById = new Map(modules.map((module) => [module.id, module.key]))
  return (unwrap(roles) ?? []).map((role) => toAppRole(role, moduleKeyById)).sort((left, right) => left.name.localeCompare(right.name))
}

function payload(input: RoleInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    is_admin: input.isAdmin,
    active: input.status === 'Active' ? 1 : 0,
    // Administrator roles bypass permission checks, so they store no module list.
    permissions: input.isAdmin ? [] : permissionStringsFromSet(input.permissions),
  }
}

export async function createRole(input: RoleInput): Promise<void> {
  const body = payload(input)
  const created = unwrap(await api.post<{ data?: RawRole }>(API_URLS.roles.list, body))
  // The backend always creates a role as active; apply an Inactive status straight after.
  if (body.active === 0 && created?.id) await api.put(API_URLS.roles.byId(created.id), { active: 0 })
}

export async function updateRole(id: string, input: RoleInput): Promise<void> {
  await api.put(API_URLS.roles.byId(id), payload(input))
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(API_URLS.roles.byId(id))
}
