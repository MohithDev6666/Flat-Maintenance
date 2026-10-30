import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockUsers } from '../mocks/users.ts'
import type { MockUser, SessionUser } from '../types/models.ts'

const SESSION_KEY = 'spr.session'

interface AuthContextValue {
  user: SessionUser | null
  accounts: MockUser[]
  login: (email: string, password: string) => boolean
  logout: () => void
  saveAccount: (account: MockUser, isNew: boolean) => string | null
  relinkFlat: (previousNumber: string, nextNumber: string) => void
}

function toSession(account: MockUser): SessionUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    flatNumber: account.flatNumber,
    phone: account.phone,
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUser
    const account = mockUsers.find((item) => item.id === parsed.id && item.role === parsed.role)
    if (!account) return null
    const previousNames = ['Anil Sharma', 'Ravi Kumar', 'Meera Iyer']
    const name = previousNames.includes(parsed.name) ? account.name : parsed.name
    return { ...parsed, name }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readSession())
  const [accounts, setAccounts] = useState<MockUser[]>(mockUsers)

  const login = (email: string, password: string) => {
    const found = accounts.find(
      (account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password,
    )
    if (!found) return false
    const session = toSession(found)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return true
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  const saveAccount = (account: MockUser, isNew: boolean) => {
    const emailTaken = accounts.some(
      (item) => item.email.toLowerCase() === account.email.trim().toLowerCase() && item.id !== account.id,
    )
    if (!account.name.trim() || !account.email.trim()) return 'Name and email are required.'
    if (emailTaken) return 'That email is already used.'
    if (isNew && !account.password.trim()) return 'Set a password for the new user.'
    const previous = accounts.find((item) => item.id === account.id)
    const saved: MockUser = {
      ...account,
      name: account.name.trim(),
      email: account.email.trim().toLowerCase(),
      phone: account.phone.trim(),
      password: account.password.trim() || previous?.password || '',
      flatNumber: account.role === 'admin' ? null : account.flatNumber,
    }
    setAccounts((current) => (isNew ? [...current, saved] : current.map((item) => (item.id === saved.id ? saved : item))))
    if (user?.id === saved.id) {
      const session = toSession(saved)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      setUser(session)
    }
    return null
  }

  const relinkFlat = (previousNumber: string, nextNumber: string) => {
    if (!previousNumber || previousNumber === nextNumber) return
    setAccounts((current) =>
      current.map((item) => (item.flatNumber === previousNumber ? { ...item, flatNumber: nextNumber } : item)),
    )
    if (user?.flatNumber === previousNumber) {
      const session = { ...user, flatNumber: nextNumber }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      setUser(session)
    }
  }

  return (
    <AuthContext.Provider value={{ user, accounts, login, logout, saveAccount, relinkFlat }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
