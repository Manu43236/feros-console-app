import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import leftMenuLogo from '@/assets/left_menu_logo.png'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi, subscriptionsApi } from '@/api/superadmin'
import {
  LayoutDashboard, Users, Truck, ClipboardList, FileText,
  Receipt, UserCheck, Calendar, Wallet, BarChart3, Settings,
  LogOut, Menu, X, Building2, Globe,
  BadgeCheck, UserCog, Bell, AlertTriangle, FileMinus, ClipboardCheck,
  Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { to: '/dashboard',                  label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/clients',                    label: 'Clients',      icon: Users },
  { to: '/vehicles',                   label: 'Vehicles',     icon: Truck },
  { to: '/orders',                     label: 'Orders',       icon: ClipboardList },
  { to: '/assignments',                label: 'Assignments',  icon: ClipboardCheck },
  { to: '/lrs',                        label: 'LR Register',  icon: FileText },
  { to: '/invoices',                   label: 'Invoices',     icon: Receipt },
  { to: '/credit-notes',               label: 'Credit Notes', icon: FileMinus },
  { to: '/staff',                      label: 'Staff',        icon: UserCheck },
  { to: '/attendance',                 label: 'Attendance',   icon: Calendar },
  { to: '/payroll',                    label: 'Payroll',      icon: Wallet },
  { to: '/reports',                    label: 'Reports',      icon: BarChart3 },
  { to: '/masters',   label: 'Masters',   icon: Settings },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
]

const SUPER_ADMIN_NAV = [
  { to: '/sa/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/sa/tenants',        label: 'Tenants',        icon: Building2 },
  { to: '/sa/subscriptions',  label: 'Subscriptions',  icon: BadgeCheck },
  { to: '/sa/users',          label: 'Users',          icon: UserCog },
  { to: '/sa/global-masters', label: 'Global Masters', icon: Globe },
  { to: '/sa/settings',       label: 'Settings',       icon: Settings },
]

const OFFICE_STAFF_NAV = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/clients',      label: 'Clients',      icon: Users },
  { to: '/vehicles',     label: 'Vehicles',     icon: Truck },
  { to: '/orders',       label: 'Orders',       icon: ClipboardList },
  { to: '/lrs',          label: 'LR Register',  icon: FileText },
  { to: '/invoices',     label: 'Invoices',     icon: Receipt },
  { to: '/credit-notes', label: 'Credit Notes', icon: FileMinus },
  { to: '/attendance',   label: 'Attendance',   icon: Calendar },
  { to: '/reports',      label: 'Reports',      icon: BarChart3 },
]

const SUPERVISOR_NAV = [
  { to: '/my/attendance', label: 'My Attendance', icon: Calendar },
  { to: '/orders',        label: 'Orders',        icon: ClipboardList },
  { to: '/assignments',   label: 'Assignments',   icon: ClipboardCheck },
  { to: '/lrs',           label: 'LR Register',   icon: FileText },
  { to: '/my/payslip',    label: 'My Payslip',    icon: Wallet },
]

const DRIVER_CLEANER_NAV = [
  { to: '/my/trips',      label: 'My Trips',      icon: Truck },
  { to: '/my/attendance', label: 'My Attendance', icon: Calendar },
  { to: '/my/payslip',    label: 'My Payslip',    icon: Wallet },
]

const STORE_KEEPER_NAV = [
  { to: '/inventory',     label: 'Inventory',     icon: Boxes },
  { to: '/my/attendance', label: 'My Attendance', icon: Calendar },
  { to: '/my/payslip',    label: 'My Payslip',    icon: Wallet },
]

const SERVICE_MEN_NAV = [
  { to: '/vehicle-services', label: 'Vehicle Services', icon: Truck },
  { to: '/my/attendance',    label: 'My Attendance',    icon: Calendar },
  { to: '/my/payslip',       label: 'My Payslip',       icon: Wallet },
]

// ─── Notification Nav Link ─────────────────────────────────────────────────────
function NotifNavLink() {
  const { data: countRes } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30_000,
  })
  const count = countRes?.data?.count ?? 0

  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) => cn(
        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-feros-orange text-white'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      )}
    >
      <Bell size={18} className="shrink-0" />
      <span>Notifications</span>
      {count > 0 && (
        <span className="ml-auto min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </NavLink>
  )
}

function getRoleLabel(role: string | null) {
  if (role === 'SUPER_ADMIN') return 'Super Admin'
  if (role === 'ADMIN') return 'Admin'
  return 'Staff'
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const phone              = useAuthStore(s => s.phone)
  const name               = useAuthStore(s => s.name)
  const role               = useAuthStore(s => s.role)
  const companyName        = useAuthStore(s => s.companyName)
  const logoUrl            = useAuthStore(s => s.logoUrl)
  const saSession          = useAuthStore(s => s.saSession)
  const logout             = useAuthStore(s => s.logout)
  const exitImpersonation  = useAuthStore(s => s.exitImpersonation)
  const navigate = useNavigate()

  const isImpersonating = !!saSession
  const tenantId = useAuthStore(s => s.tenantId)

  // Fetch subscription status for tenant users (not SUPER_ADMIN)
  const { data: mySubRes } = useQuery({
    queryKey: ['my-subscription', tenantId],
    queryFn: () => subscriptionsApi.getMy(),
    enabled: role !== 'SUPER_ADMIN' && tenantId != null,
    retry: false,
  })
  const subStatus = mySubRes?.data?.status

  const navItems =
    role === 'SUPER_ADMIN'  ? SUPER_ADMIN_NAV :
    role === 'OFFICE_STAFF' ? OFFICE_STAFF_NAV :
    role === 'SUPERVISOR'   ? SUPERVISOR_NAV :
    role === 'DRIVER'       ? DRIVER_CLEANER_NAV :
    role === 'CLEANER'      ? DRIVER_CLEANER_NAV :
    role === 'STORE_KEEPER' ? STORE_KEEPER_NAV :
    role === 'SERVICE_MEN'  ? SERVICE_MEN_NAV :
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
      <div className="flex items-center justify-center h-16 px-5 border-b border-white/10 shrink-0 relative">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName ?? 'Logo'} className="h-9 w-auto object-contain max-w-[160px]" />
        ) : (
          <img src={leftMenuLogo} alt="FEROS" className="h-9 w-auto object-contain" />
        )}
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="absolute right-4 text-gray-400 hover:text-white">
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
      <div className="shrink-0 p-3 border-t border-white/10 space-y-0.5">
        <NotifNavLink />
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

          {/* User menu — navigate to profile */}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-feros-navy flex items-center justify-center text-white text-sm font-semibold">
              {name?.[0] ?? phone?.[0] ?? 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-800">{name ?? phone}</p>
              <p className="text-xs text-gray-500">{companyName ?? getRoleLabel(role)}</p>
            </div>
          </button>
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

        {/* Subscription lockout banner */}
        {(subStatus === 'EXPIRED' || subStatus === 'SUSPENDED') && (
          <div className={cn(
            'px-5 py-2.5 flex items-center gap-3 text-sm shrink-0',
            subStatus === 'EXPIRED' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white'
          )}>
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              {subStatus === 'EXPIRED'
                ? 'Your subscription has expired. All actions are disabled. Please contact FEROS support to renew.'
                : 'Your account has been suspended. Please contact FEROS support for assistance.'}
            </span>
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
