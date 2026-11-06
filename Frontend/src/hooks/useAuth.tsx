import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { UNAUTHORIZED_EVENT } from '../services/apiClient.ts'
import * as authService from '../services/authService.ts'
import type { SessionUser } from '../types/models.ts'

/**
 * Only the signed-in session lives here. Screens load their own data through the services,
 * so there is no shared data store.
 */
interface AuthContextValue {
  user: SessionUser | null
  /** True while a stored token is being checked after a page load. */
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    let active = true
    authService
      .restoreSession()
      .then((session) => {
        if (active) setUser(session)
      })
      .catch(() => {
        // An expired or unlinked session goes back to the login page.
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setRestoring(false)
      })
    const signOut = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, signOut)
    return () => {
      active = false
      window.removeEventListener(UNAUTHORIZED_EVENT, signOut)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setUser(await authService.login(email, password))
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, restoring, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
