import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard, Users, Truck, ClipboardList, FileText,
  Receipt, UserCheck, Calendar, Wallet, BarChart3, Settings,
  LogOut, Menu, X, ChevronDown, Building2, Globe,
  Route, CreditCard, BadgeCheck, UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/clients',    label: 'Clients',     icon: Users },
  { to: '/vehicles',   label: 'Vehicles',    icon: Truck },
  { to: '/orders',     label: 'Orders',      icon: ClipboardList },
  { to: '/lrs',        label: 'LR Register', icon: FileText },
  { to: '/invoices',   label: 'Invoices',    icon: Receipt },
  { to: '/staff',      label: 'Staff',       icon: UserCheck },
  { to: '/attendance', label: 'Attendance',  icon: Calendar },
  { to: '/payroll',    label: 'Payroll',     icon: Wallet },
  { to: '/reports',    label: 'Reports',     icon: BarChart3 },
  { to: '/masters',    label: 'Masters',     icon: Settings },
]

const SUPER_ADMIN_NAV = [
  { to: '/sa/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/sa/tenants',        label: 'Tenants',        icon: Building2 },
  { to: '/sa/subscriptions',  label: 'Subscriptions',  icon: BadgeCheck },
  { to: '/sa/users',          label: 'Users',          icon: UserCog },
  { to: '/sa/global-masters', label: 'Global Masters', icon: Globe },
  { to: '/sa/settings',       label: 'Settings',       icon: Settings },
]

const STAFF_NAV = [
  { to: '/my/trips',      label: 'My Trips',      icon: Route },
  { to: '/my/attendance', label: 'My Attendance', icon: Calendar },
  { to: '/my/payslip',    label: 'My Payslip',    icon: CreditCard },
]

function getRoleLabel(role: string | null) {
  if (role === 'SUPER_ADMIN') return 'Super Admin'
  if (role === 'ADMIN') return 'Admin'
  return 'Staff'
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const phone              = useAuthStore(s => s.phone)
  const name               = useAuthStore(s => s.name)
  const role               = useAuthStore(s => s.role)
  const companyName        = useAuthStore(s => s.companyName)
  const saSession          = useAuthStore(s => s.saSession)
  const logout             = useAuthStore(s => s.logout)
  const exitImpersonation  = useAuthStore(s => s.exitImpersonation)
  const navigate = useNavigate()

  const isImpersonating = !!saSession

  const navItems =
    role === 'SUPER_ADMIN' ? SUPER_ADMIN_NAV :
    role === 'STAFF'       ? STAFF_NAV :
    ADMIN_NAV

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleExitImpersonation() {
    exitImpersonation()
    navigate('/sa/tenants', { replace: true })
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={cn('flex flex-col h-full bg-feros-sidebar', mobile ? 'w-72' : 'w-64')}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-white/10 shrink-0">
        <div>
          <span className="text-feros-orange font-bold text-2xl tracking-tight">FEROS</span>
          <span className="ml-2 text-xs text-blue-300 uppercase tracking-widest">{getRoleLabel(role)}</span>
        </div>
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => mobile && setSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-feros-orange text-white'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-feros-navy flex items-center justify-center text-white text-sm font-semibold">
                {name?.[0] ?? phone?.[0] ?? 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-800">{name ?? phone}</p>
                <p className="text-xs text-gray-500">{companyName ?? getRoleLabel(role)}</p>
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-5 py-2 flex items-center justify-between text-sm shrink-0">
            <div className="flex items-center gap-2">
              <Building2 size={15} />
              <span>Acting as <strong>{companyName}</strong> — you have full admin access on behalf of this tenant</span>
            </div>
            <button
              onClick={handleExitImpersonation}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-xs font-semibold transition-colors"
            >
              <LogOut size={12} />
              Exit
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
