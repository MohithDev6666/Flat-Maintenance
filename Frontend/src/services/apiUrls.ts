/**
 * Every backend endpoint the app calls, in one place.
 *
 * In development the Vite dev server proxies `/api` to the Go backend (see vite.config.ts),
 * so the default base URL works without CORS. Set VITE_API_BASE_URL to call another host,
 * for example `VITE_API_BASE_URL=http://localhost:8080/api`.
 */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')

const enc = encodeURIComponent

export const API_URLS = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    me: '/auth/me',
    permissions: '/auth/permissions',
    logout: '/auth/logout',
    password: '/auth/password',
  },
  profileLinks: {
    mine: '/me/profile-link',
    list: '/user-profile-links',
    byUser: (userId: string) => `/users/${enc(userId)}/profile-link`,
  },
  modules: {
    list: '/modules',
  },
  roles: {
    list: '/roles',
    byId: (id: string) => `/roles/${enc(id)}`,
    permissions: (id: string) => `/roles/${enc(id)}/permissions`,
  },
  users: {
    list: '/users',
    byId: (id: string) => `/users/${enc(id)}`,
    role: (id: string) => `/users/${enc(id)}/role`,
  },
  building: '/building',
  flats: {
    list: '/flats',
    byId: (id: string) => `/flats/${enc(id)}`,
  },
  flatManagement: {
    list: '/flat-management',
    byId: (id: string) => `/flat-management/${enc(id)}`,
  },
  owners: {
    list: '/owners',
    byId: (id: string) => `/owners/${enc(id)}`,
  },
  tenants: {
    list: '/tenants',
    byId: (id: string) => `/tenants/${enc(id)}`,
  },
  categories: {
    list: '/categories',
    byId: (id: string) => `/categories/${enc(id)}`,
  },
  expenses: {
    list: '/expenses',
    byId: (id: string) => `/expenses/${enc(id)}`,
  },
  payments: {
    list: '/payments',
    byId: (id: string) => `/payments/${enc(id)}`,
    flag: (id: string) => `/payments/${enc(id)}/flag`,
  },
  monthLocks: {
    list: '/month-locks',
    byMonth: (month: string) => `/month-locks/${enc(month)}`,
  },
  audit: {
    list: '/audit',
    byId: (id: string) => `/audit/${enc(id)}`,
  },
  reports: {
    dashboard: '/dashboard',
    summary: '/summary',
    contribution: '/contribution',
    payStatus: '/pay-status',
  },
} as const

/** The backend caps list endpoints at 500 records per request. */
export const MAX_PAGE_SIZE = 500
