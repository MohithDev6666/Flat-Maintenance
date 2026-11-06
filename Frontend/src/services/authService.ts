import type { ProfileLink, SessionUser } from '../types/models.ts'
import { fullPermissions, permissionSetFromStrings } from '../utils/modules.ts'
import { ApiError, api, getToken, setToken, unwrap } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'
import { getFlat } from './flatService.ts'
import { getOwner } from './ownerService.ts'
import { getTenant } from './tenantService.ts'
import type { RawUser } from './userService.ts'

interface LoginResponse {
  token: string
  user: RawUser
  permissions?: string[] | null
}

async function getMyProfileLink(): Promise<ProfileLink> {
  try {
    return await api.get<ProfileLink>(API_URLS.profileLinks.mine)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      throw new ApiError(
        error.status,
        'This account is not linked to an owner or tenant record yet, or the link is out of date. Ask the admin to link it on Admin → Users.',
      )
    }
    throw error
  }
}

/** Resolves the signed-in user: the RBAC user, its permissions, and (for residents) the linked flat. */
async function buildSession(user: RawUser, permissions: string[]): Promise<SessionUser> {
  const base = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id || user.roleId || '',
    roleName: user.roleName || 'User',
  }
  if (user.is_admin) {
    return { ...base, role: 'admin', permissions: fullPermissions(), ownerId: null, tenantId: null, flatId: null, flatNumber: null, floor: null }
  }

  const link = await getMyProfileLink()
  const role = link.kind === 'tenant' ? 'tenant' : 'owner'
  // The flat is display information; a role without `flats:view` still signs in without it.
  let flatId: string | null = null
  if (role === 'owner' && link.ownerId) flatId = (await getOwner(link.ownerId).catch(() => null))?.flatId ?? null
  if (role === 'tenant' && link.tenantId) flatId = (await getTenant(link.tenantId).catch(() => null))?.flatId ?? null
  const flat = flatId ? await getFlat(flatId).catch(() => null) : null

  return {
    ...base,
    role,
    permissions: permissionSetFromStrings(permissions),
    ownerId: role === 'owner' ? (link.ownerId ?? null) : null,
    tenantId: role === 'tenant' ? (link.tenantId ?? null) : null,
    flatId,
    flatNumber: flat?.number ?? null,
    floor: flat?.floor ?? null,
  }
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const response = unwrap(
    await api.post<{ data?: LoginResponse }>(
      API_URLS.auth.login,
      { email: email.trim().toLowerCase(), password },
      { skipAuthRedirect: true },
    ),
  )
  if (!response?.token) throw new ApiError(500, 'The server did not return a session. Please try again.')
  setToken(response.token)
  try {
    return await buildSession(response.user, response.permissions ?? [])
  } catch (error) {
    setToken(null)
    throw error
  }
}

/** Rebuilds the session from the stored token after a page reload. Null when nobody is signed in. */
export async function restoreSession(): Promise<SessionUser | null> {
  if (!getToken()) return null
  const [user, permissions] = await Promise.all([
    api.get<{ data?: RawUser }>(API_URLS.auth.me),
    api.get<{ data?: string[] | null }>(API_URLS.auth.permissions),
  ])
  return buildSession(unwrap(user), unwrap(permissions) ?? [])
}

export async function logout(): Promise<void> {
  try {
    if (getToken()) await api.post(API_URLS.auth.logout, undefined, { skipAuthRedirect: true })
  } catch {
    // The token is dropped locally either way.
  } finally {
    setToken(null)
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.put(API_URLS.auth.password, { old_password: oldPassword, new_password: newPassword })
}
