import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { ModuleKey } from '@/types'

// Maps routes to module keys. Routes without a moduleKey are always accessible.
const ROUTE_MODULE_MAP: Record<string, ModuleKey> = {
  '/clients':                'CLIENTS',
  '/orders':                 'ORDERS',
  '/assignments':            'ASSIGNMENTS',
  '/lrs':                    'LR_REGISTER',
  '/invoices':               'INVOICES',
  '/credit-notes':           'CREDIT_NOTES',
  '/service-invoices':       'SERVICE_INVOICES',
  '/attendance':             'ATTENDANCE',
  '/reports':                'REPORTS',
  '/inventory':              'SPARE_PARTS',
  '/inventory/tires':        'TIRES',
  '/inventory/part-requests':'PART_REQUESTS',
  '/inventory/tire-requests':'TIRE_REQUESTS',
  '/vehicle-services':       'VEHICLE_SERVICES',
}

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const role            = useAuthStore(s => s.role)
  const allowedModules  = useAuthStore(s => s.allowedModules)
  const { pathname }    = useLocation()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/" replace />

  // Module access check — only applies when allowedModules is a non-null array (non-admin roles)
  // Skip if allowedRoles explicitly grants this role access (developer gate takes precedence)
  if (allowedModules !== null && !(allowedRoles && role && allowedRoles.includes(role))) {
    // Find the base route that matches (handle sub-routes like /lrs/:id → /lrs)
    const baseRoute = Object.keys(ROUTE_MODULE_MAP).find(r =>
      pathname === r || pathname.startsWith(r + '/')
    )
    if (baseRoute) {
      const moduleKey = ROUTE_MODULE_MAP[baseRoute]
      if (!allowedModules.includes(moduleKey)) {
        return <Navigate to="/dashboard" replace />
      }
    }
  }

  return <>{children}</>
}
