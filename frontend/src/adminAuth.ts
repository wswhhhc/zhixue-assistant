import { API_BASE } from './config'

const ADMIN_AUTH_KEY = 'admin_auth'

interface AdminAuth {
  token: string
  username: string
}

export function getAdminAuth(): AdminAuth | null {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

export function setAdminAuth(token: string, username: string) {
  localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ token, username }))
}

export function clearAdminAuth() {
  localStorage.removeItem(ADMIN_AUTH_KEY)
}

export async function adminFetch(url: string, options: RequestInit = {}) {
  const auth = getAdminAuth()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  }
  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`
  }
  const hasBody = options.body !== undefined && options.body !== null
  if (hasBody && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  const res = await fetch(API_BASE + url, { ...options, headers })
  if (res.status === 401) {
    clearAdminAuth()
    window.location.href = '/admin/login'
  }
  return res
}
