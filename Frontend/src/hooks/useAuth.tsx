import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SessionUser } from '../types/models.ts'
import { resolveSession } from '../utils/session.ts'
import { useBuilding } from './useBuilding.tsx'

const SESSION_KEY = 'spr.session'

interface AuthContextValue {
  user: SessionUser | null
  login: (email: string, password: string) => string | null
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { accounts, roles, owners, tenants, flats } = useBuilding()
  const [userId, setUserId] = useState<string | null>(() => readSessionId())

  const account = accounts.find((item) => item.id === userId)
  const user = account ? resolveSession(account, roles, owners, tenants, flats) : null

  const login = (email: string, password: string) => {
    const found = accounts.find(
      (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password,
    )
    if (!found) return 'Those details do not match a demo account.'
    if (found.status !== 'Active') return 'This account is deactivated. Ask the admin to activate it.'
    if (!resolveSession(found, roles, owners, tenants, flats)) {
      return 'This account’s role is inactive or it is not linked to a flat. Ask the admin to fix it.'
    }
    try {
      sessionStorage.setItem(SESSION_KEY, found.id)
    } catch {
      // Session storage can be unavailable; the in-memory session still works.
    }
    setUserId(found.id)
    return null
  }

  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // Nothing stored to clear.
    }
    setUserId(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
