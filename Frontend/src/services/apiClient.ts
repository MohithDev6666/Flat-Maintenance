import { API_BASE_URL, MAX_PAGE_SIZE } from './apiUrls.ts'

const TOKEN_KEY = 'fm.token'

/** Fired when the server rejects the stored token, so the session can sign out. */
export const UNAUTHORIZED_EVENT = 'fm:unauthorized'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage can be blocked; the request simply goes out without a token.
  }
}

/** An error returned by the API, with the HTTP status and a message fit to show the user. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  body?: unknown
  query?: Query
  /** Login and token refresh must not trigger the global sign-out on 401. */
  skipAuthRedirect?: boolean
}

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE_URL}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `${url}?${text}` : url
}

function sentenceCase(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return trimmed
  const text = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(text) ? text : `${text}.`
}

/** Friendly fallback for each status when the server sends no message. */
function statusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'The request was not valid. Check the form and try again.'
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have permission to do this.'
    case 404:
      return 'That record was not found. It may have been deleted.'
    case 409:
      return 'This conflicts with an existing record.'
    default:
      return status >= 500 ? 'The server ran into a problem. Please try again.' : `Request failed (${status}).`
  }
}

/** Reads both API error shapes: `{ "error": "..." }` and the RBAC envelope `{ status, code, error }`. */
function errorFromBody(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const value = (body as { error: unknown }).error
    if (typeof value === 'string' && value.trim()) return sentenceCase(value)
  }
  if (typeof body === 'string' && body.trim() && body.length < 300) return sentenceCase(body)
  return statusMessage(status)
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and that the API is running.')
  }

  const text = response.status === 204 ? '' : await response.text()
  let body: unknown = undefined
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !options.skipAuthRedirect && token) {
      setToken(null)
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw new ApiError(response.status, errorFromBody(response.status, body))
  }
  return body as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}

/** RBAC endpoints wrap their payload as `{ status, code, data }`. */
export function unwrap<T>(envelope: { data?: T } | null | undefined): T {
  return (envelope?.data ?? null) as T
}

/** Reads every page of a list endpoint (the backend returns at most 500 records per call). */
export async function getAll<T>(path: string, query: Query = {}): Promise<T[]> {
  const items: T[] = []
  for (let offset = 0; ; offset += MAX_PAGE_SIZE) {
    const page = (await api.get<T[] | null>(path, { ...query, limit: MAX_PAGE_SIZE, offset })) ?? []
    items.push(...page)
    if (page.length < MAX_PAGE_SIZE) return items
  }
}

/** The message to show for any thrown value. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
