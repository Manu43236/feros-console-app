import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const WEB_BLOCKED_ROLES = ['DRIVER', 'CLEANER']

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const role = useAuthStore(s => s.role)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role && WEB_BLOCKED_ROLES.includes(role)) return <Navigate to="/login" replace />
  return <>{children}</>
}
