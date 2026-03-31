import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function RoleRedirect() {
  const role = useAuthStore(s => s.role)
  if (role === 'SUPER_ADMIN')  return <Navigate to="/sa/dashboard" replace />
  if (role === 'STAFF')        return <Navigate to="/my/trips" replace />
  if (role === 'STORE_KEEPER') return <Navigate to="/inventory" replace />
  if (role === 'SERVICE_MEN')  return <Navigate to="/vehicle-services" replace />
  return <Navigate to="/dashboard" replace />
}
