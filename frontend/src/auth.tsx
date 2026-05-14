import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AuthState {
  token: string | null
  user_id: number | null
  username: string | null
  membership: string              // "free" | "premium"
  member_expires: string | null
}

interface AuthContextType extends AuthState {
  login: (token: string, userId: number, username: string, membership?: string, memberExpires?: string | null) => void
  updateProfile: (profile: { username: string }) => void
  updateMembership: (membership: string, memberExpires: string | null) => void
  logout: () => void
  isAuthenticated: boolean
  isPremium: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem('auth')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { token: null, user_id: null, username: null, membership: 'free', member_expires: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadAuth)

  useEffect(() => {
    localStorage.setItem('auth', JSON.stringify(auth))
  }, [auth])

  const login = (token: string, userId: number, username: string, membership = 'free', memberExpires: string | null = null) => {
    const data = { token, user_id: userId, username, membership, member_expires: memberExpires }
    localStorage.setItem('auth', JSON.stringify(data))
    setAuth(data)
  }

  const updateProfile = (profile: { username: string }) => {
    setAuth((prev) => {
      const next = { ...prev, username: profile.username }
      localStorage.setItem('auth', JSON.stringify(next))
      return next
    })
  }

  const updateMembership = (membership: string, memberExpires: string | null) => {
    setAuth((prev) => {
      const next = { ...prev, membership, member_expires: memberExpires }
      localStorage.setItem('auth', JSON.stringify(next))
      return next
    })
  }

  const logout = () => {
    setAuth({ token: null, user_id: null, username: null, membership: 'free', member_expires: null })
    localStorage.removeItem('auth')
  }

  const isPremium = auth.membership === 'premium' && (
    auth.member_expires === null || new Date(auth.member_expires) > new Date()
  )

  return (
    <AuthContext.Provider value={{
      ...auth, login, updateProfile, updateMembership, logout,
      isAuthenticated: !!auth.token, isPremium,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** 带 Authorization header 的 fetch */
export function authFetch(url: string, options: RequestInit = {}) {
  const raw = localStorage.getItem('auth')
  let token: string | null = null
  if (raw) {
    try { token = JSON.parse(raw).token } catch { /* ignore */ }
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const hasBody = options.body !== undefined && options.body !== null
  if (hasBody && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  return fetch(url, { ...options, headers })
}
