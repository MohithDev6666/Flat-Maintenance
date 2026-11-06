import type { ProfileLink, RecordStatus, ResidentKind, SessionUser, UserAccount } from '../types/models.ts'
import { sessionAccount } from '../utils/session.ts'
import { ApiError, api, unwrap } from './apiClient.ts'
import { API_URLS } from './apiUrls.ts'

export interface RawUser {
  id: string
  name: string
  email: string
  phone?: string
  role_id?: string
  roleId?: string
  roleName?: string
  active?: number
  isActive?: boolean
  is_admin?: boolean
}

/** What the Users form saves. `link` is the owner or tenant record a resident login acts for. */
export interface UserInput {
  name: string
  email: string
  password: string
  roleId: string
  status: RecordStatus
  isAdminRole: boolean
  link: { kind: ResidentKind; residentId: string } | null
}

function isActive(raw: RawUser): boolean {
  if (typeof raw.isActive === 'boolean') return raw.isActive
  return raw.active !== 0
}

export function toAccount(raw: RawUser, link?: ProfileLink): UserAccount {
  return {
    id: raw.id,
    name: raw.name ?? '',
    email: raw.email ?? '',
    phone: raw.phone ?? '',
    roleId: raw.role_id || raw.roleId || '',
    roleName: raw.roleName ?? '',
    isAdmin: Boolean(raw.is_admin),
    ownerId: link?.kind === 'owner' ? (link.ownerId ?? null) : null,
    tenantId: link?.kind === 'tenant' ? (link.tenantId ?? null) : null,
    status: isActive(raw) ? 'Active' : 'Inactive',
  }
}

export async function getUsers(): Promise<RawUser[]> {
  return unwrap(await api.get<{ data?: RawUser[] }>(API_URLS.users.list)) ?? []
}

/** Every login's owner / tenant link. Administrator only. */
export async function getProfileLinks(): Promise<ProfileLink[]> {
  return (await api.get<ProfileLink[] | null>(API_URLS.profileLinks.list)) ?? []
}

/** Users with their owner / tenant links resolved, sorted by name. */
export async function getAccounts(): Promise<UserAccount[]> {
  const [users, links] = await Promise.all([getUsers(), getProfileLinks()])
  const linkByUser = new Map(links.map((link) => [link.userId, link]))
  return users.map((user) => toAccount(user, linkByUser.get(user.id))).sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Logins used to credit out-of-pocket expenses in the calculations. Admins load every login;
 * residents cannot list users, so they get their own account only.
 */
export async function getAccountsFor(user: SessionUser): Promise<UserAccount[]> {
  if (user.role !== 'admin') return [sessionAccount(user)]
  return getAccounts()
}

/** Sets or clears the owner / tenant link. Must run after the role is saved, because the link records the role. */
async function syncProfileLink(userId: string, input: UserInput, hadLink: boolean) {
  if (input.isAdminRole || !input.link) {
    if (!hadLink) return
    try {
      await api.delete(API_URLS.profileLinks.byUser(userId))
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
    }
    return
  }
  const { kind, residentId } = input.link
  await api.put(API_URLS.profileLinks.byUser(userId), kind === 'owner' ? { kind, ownerId: residentId } : { kind, tenantId: residentId })
}

export async function createUser(input: UserInput): Promise<void> {
  const created = unwrap(
    await api.post<{ data?: RawUser }>(API_URLS.users.list, {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role_id: input.roleId,
    }),
  )
  if (!created?.id) throw new ApiError(500, 'The user was not created. Please try again.')
  if (input.status === 'Inactive') await api.put(API_URLS.users.byId(created.id), { active: 0 })
  try {
    await syncProfileLink(created.id, input, false)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    throw new ApiError(error instanceof ApiError ? error.status : 500, `The login was created, but linking it failed: ${reason} Edit the user to link it.`)
  }
}

export async function updateUser(account: UserAccount, input: UserInput): Promise<void> {
  await api.put(API_URLS.users.byId(account.id), {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    ...(input.password.trim() ? { password: input.password } : {}),
    active: input.status === 'Active' ? 1 : 0,
  })
  if (input.roleId !== account.roleId) await api.put(API_URLS.users.role(account.id), { role_id: input.roleId })
  await syncProfileLink(account.id, input, Boolean(account.ownerId || account.tenantId))
}

export async function setUserStatus(id: string, status: RecordStatus): Promise<void> {
  await api.put(API_URLS.users.byId(id), { active: status === 'Active' ? 1 : 0 })
}

/** Removes the login and its owner / tenant link, so that record can get a new login or be deleted. */
export async function deleteUser(id: string): Promise<void> {
  try {
    await api.delete(API_URLS.profileLinks.byUser(id))
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error
  }
  await api.delete(API_URLS.users.byId(id))
}
