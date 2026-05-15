import { Navigate } from 'react-router-dom'
import { getAdminAuth } from '../adminAuth'

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = getAdminAuth()
  if (!auth?.token) {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}
