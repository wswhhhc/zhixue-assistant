import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AuthState {
  token: string | null
  user_id: number | null
  username: string | null
}

interface AuthContextType extends AuthState {
  login: (token: string, userId: number, username: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem('auth')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { token: null, user_id: null, username: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadAuth)

  useEffect(() => {
    localStorage.setItem('auth', JSON.stringify(auth))
  }, [auth])

  const login = (token: string, userId: number, username: string) => {
    const data = { token, user_id: userId, username }
    localStorage.setItem('auth', JSON.stringify(data))
    setAuth(data)
  }

  const logout = () => {
    setAuth({ token: null, user_id: null, username: null })
    localStorage.removeItem('auth')
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.token }}>
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

  // 仅在非 GET 且有 JSON body 时加 Content-Type
  const hasBody = options.body !== undefined && options.body !== null
  if (hasBody && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  return fetch(url, { ...options, headers })
}
