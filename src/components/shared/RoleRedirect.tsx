import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function RoleRedirect() {
  const role               = useAuthStore(s => s.role)
  const canAccessVehicles  = useAuthStore(s => s.canAccessVehicles)
  const canAccessEquipment = useAuthStore(s => s.canAccessEquipment)
  if (role === 'SUPER_ADMIN') return <Navigate to="/sa/dashboard" replace />
  if (role === 'SUPERVISOR') {
    if (canAccessVehicles === false && canAccessEquipment === true)
      return <Navigate to="/equipment/dashboard" replace />
    return <Navigate to="/dashboard" replace />
  }
  if (role === 'DRIVER' || role === 'CLEANER') return <Navigate to="/my/trips" replace />
  if (role === 'STORE_KEEPER') return <Navigate to="/inventory" replace />
  if (role === 'SERVICE_MANAGER') return <Navigate to="/service-manager" replace />
  return <Navigate to="/dashboard" replace />
}
