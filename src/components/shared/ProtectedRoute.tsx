import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const role = useAuthStore(s => s.role)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}
