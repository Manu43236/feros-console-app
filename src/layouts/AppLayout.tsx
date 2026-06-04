import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import leftMenuLogo from '@/assets/left_menu_logo.png'
import { useAuthStore } from '@/store/authStore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, subscriptionsApi } from '@/api/superadmin'
import { authApi } from '@/api/auth'
import {
  LayoutDashboard, Users, Truck, ClipboardList, FileText,
  Receipt, UserCheck, Calendar, Wallet, Settings,
  LogOut, Menu, X, Building2, Globe,
  BadgeCheck, UserCog, Bell, AlertTriangle, FileMinus, ClipboardCheck,
  Boxes, Fuel, Gauge, ChevronDown, ChevronRight, CircleDot,
  Activity, Banknote, Package, Wrench, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SubscriptionContext } from '@/context/SubscriptionContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import type { ModuleKey } from '@/types'

// ─── Types ─────────────────────────────────────────────────────────────────────
type NavItem = { to: string; label: string; icon: React.ElementType; moduleKey?: ModuleKey }
type NavSection = { section: string; icon?: React.ElementType; items: NavItem[] }
type FlatNav = NavItem[]
type SectionedNav = { dashboard: NavItem; sections: NavSection[] }

// ─── Admin nav (sectioned) ──────────────────────────────────────────────────────
const ADMIN_NAV: SectionedNav = {
  dashboard: { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  sections: [
    {
      section: 'Operations',
      icon: Activity,
      items: [
        { to: '/clients',     label: 'Clients',      icon: Users,          moduleKey: 'CLIENTS' },
        { to: '/orders',      label: 'Orders',       icon: ClipboardList,  moduleKey: 'ORDERS' },
        { to: '/assignments', label: 'Assignments',  icon: ClipboardCheck, moduleKey: 'ASSIGNMENTS' },
        { to: '/lrs',             label: 'LR Register',    icon: FileText,  moduleKey: 'LR_REGISTER' },
        { to: '/trip-expenses',   label: 'Trip Expenses',  icon: Wallet,    moduleKey: 'LR_REGISTER' },
      ],
    },
    {
      section: 'Finance',
      icon: Banknote,
      items: [
        { to: '/invoices',          label: 'Invoices',          icon: Receipt,   moduleKey: 'INVOICES' },
        { to: '/credit-notes',      label: 'Credit Notes',      icon: FileMinus, moduleKey: 'CREDIT_NOTES' },
        { to: '/service-invoices',  label: 'Service Invoices',  icon: Wrench,    moduleKey: 'SERVICE_INVOICES' },
      ],
    },
    {
      section: 'Fleet',
      icon: Truck,
      items: [
        { to: '/vehicles',       label: 'Vehicles',       icon: Truck },
        { to: '/fuel-logs',      label: 'Fuel Logs',      icon: Fuel },
        { to: '/meter-readings', label: 'Meter Readings', icon: Gauge },
      ],
    },
    {
      section: 'HR',
      icon: Users,
      items: [
        { to: '/staff',         label: 'Staff',         icon: UserCheck },
        { to: '/attendance',    label: 'Attendance',    icon: Calendar },
        { to: '/payroll',       label: 'Payroll',       icon: Wallet },
      ],
    },
    {
      section: 'Inventory',
      icon: Package,
      items: [
        { to: '/inventory',       label: 'Spare Parts', icon: Boxes },
        { to: '/inventory/tyres', label: 'Tyres',       icon: CircleDot },
      ],
    },
    {
      section: 'Reports',
      icon: BarChart2,
      items: [
        { to: '/reports',            label: 'Vehicle Reports',    icon: Truck },
        { to: '/reports/attendance', label: 'Attendance Reports', icon: Calendar },
        { to: '/reports/trips',      label: 'Trip Reports',       icon: FileText },
        { to: '/reports/orders',     label: 'Order Reports',      icon: ClipboardList },
        { to: '/reports/invoices',   label: 'Invoice Reports',    icon: Receipt },
        { to: '/reports/expenses',   label: 'Expense Reports',    icon: Wrench },
      ],
    },
    {
      section: '',
      items: [
        { to: '/masters',       label: 'Masters',      icon: Settings },
        { to: '/subscription',  label: 'Subscription', icon: BadgeCheck },
      ],
    },
  ],
}

// ─── Office staff nav (sectioned) ───────────────────────────────────────────────
const OFFICE_STAFF_NAV: SectionedNav = {
  dashboard: { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  sections: [
    {
      section: 'Operations',
      icon: Activity,
      items: [
        { to: '/clients',         label: 'Clients',       icon: Users,          moduleKey: 'CLIENTS' },
        { to: '/orders',          label: 'Orders',        icon: ClipboardList,  moduleKey: 'ORDERS' },
        { to: '/assignments',     label: 'Assignments',   icon: ClipboardCheck, moduleKey: 'ASSIGNMENTS' },
        { to: '/lrs',             label: 'LR Register',   icon: FileText,       moduleKey: 'LR_REGISTER' },
        { to: '/trip-expenses',   label: 'Trip Expenses', icon: Wallet,         moduleKey: 'LR_REGISTER' },
      ],
    },
    {
      section: 'Finance',
      icon: Banknote,
      items: [
        { to: '/invoices',         label: 'Invoices',         icon: Receipt,   moduleKey: 'INVOICES' },
        { to: '/credit-notes',     label: 'Credit Notes',     icon: FileMinus, moduleKey: 'CREDIT_NOTES' },
        { to: '/service-invoices', label: 'Service Invoices', icon: Wrench,    moduleKey: 'SERVICE_INVOICES' },
      ],
    },
    {
      section: 'Fleet',
      icon: Truck,
      items: [
        { to: '/vehicles',       label: 'Vehicles',       icon: Truck },
        { to: '/fuel-logs',      label: 'Fuel Logs',      icon: Fuel },
        { to: '/meter-readings', label: 'Meter Readings', icon: Gauge },
      ],
    },
    {
      section: 'HR',
      icon: Users,
      items: [
        { to: '/staff',      label: 'Staff',      icon: UserCheck },
        { to: '/attendance', label: 'Attendance', icon: Calendar,  moduleKey: 'ATTENDANCE' },
        { to: '/payroll',    label: 'Payroll',    icon: Wallet },
      ],
    },
    {
      section: 'Reports',
      icon: BarChart2,
      items: [
        { to: '/reports',            label: 'Vehicle Reports',    icon: Truck },
        { to: '/reports/attendance', label: 'Attendance Reports', icon: Calendar },
        { to: '/reports/trips',      label: 'Trip Reports',       icon: FileText },
        { to: '/reports/orders',     label: 'Order Reports',      icon: ClipboardList },
        { to: '/reports/invoices',   label: 'Invoice Reports',    icon: Receipt },
        { to: '/reports/expenses',   label: 'Expense Reports',    icon: Wrench },
      ],
    },
  ],
}

// ─── Flat navs ──────────────────────────────────────────────────────────────────
const SUPER_ADMIN_NAV: FlatNav = [
  { to: '/sa/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/sa/tenants',        label: 'Tenants',        icon: Building2 },
  { to: '/sa/subscriptions',  label: 'Subscriptions',  icon: BadgeCheck },
  { to: '/sa/users',          label: 'Users',          icon: UserCog },
  { to: '/sa/global-masters', label: 'Global Masters', icon: Globe },
  { to: '/sa/settings',       label: 'Settings',       icon: Settings },
]

const SUPERVISOR_NAV: SectionedNav = {
  dashboard: { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  sections: [
    {
      section: 'Operations',
      icon: Activity,
      items: [
        { to: '/orders',          label: 'Orders',        icon: ClipboardList,  moduleKey: 'ORDERS' },
        { to: '/assignments',     label: 'Assignments',   icon: ClipboardCheck, moduleKey: 'ASSIGNMENTS' },
        { to: '/lrs',             label: 'LR Register',   icon: FileText,       moduleKey: 'LR_REGISTER' },
        { to: '/trip-expenses',   label: 'Trip Expenses', icon: Wallet,         moduleKey: 'LR_REGISTER' },
      ],
    },
    {
      section: 'Fleet',
      icon: Truck,
      items: [
        { to: '/vehicles',       label: 'Vehicles',       icon: Truck },
        { to: '/fuel-logs',      label: 'Fuel Logs',      icon: Fuel },
        { to: '/meter-readings', label: 'Meter Readings', icon: Gauge },
      ],
    },
    {
      section: 'HR',
      icon: Users,
      items: [
        { to: '/staff',      label: 'Staff',      icon: UserCheck },
        { to: '/attendance', label: 'Attendance', icon: Calendar },
      ],
    },
    {
      section: '',
      items: [
        { to: '/my/payslip', label: 'My Payslip', icon: Wallet },
      ],
    },
  ],
}

const DRIVER_CLEANER_NAV: FlatNav = [
  { to: '/my/trips',      label: 'My Trips',      icon: Truck },
  { to: '/my/attendance', label: 'My Attendance', icon: Calendar },
  { to: '/my/payslip',    label: 'My Payslip',    icon: Wallet },
]

const STORE_KEEPER_NAV: FlatNav = [
  { to: '/inventory',               label: 'Spare Parts',   icon: Boxes,         moduleKey: 'SPARE_PARTS' },
  { to: '/inventory/tyres',         label: 'Tyres',         icon: CircleDot,     moduleKey: 'TYRES' },
  { to: '/inventory/tyre-requests', label: 'Tyre Requests', icon: ClipboardList, moduleKey: 'TYRE_REQUESTS' },
  { to: '/my/attendance',           label: 'My Attendance', icon: Calendar },
  { to: '/my/payslip',              label: 'My Payslip',    icon: Wallet },
]

const SERVICE_MEN_NAV: FlatNav = [
  { to: '/vehicle-services', label: 'Vehicle Services', icon: Truck, moduleKey: 'VEHICLE_SERVICES' },
  { to: '/my/attendance',    label: 'My Attendance',    icon: Calendar },
  { to: '/my/payslip',       label: 'My Payslip',       icon: Wallet },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────
function isSectionedNav(nav: SectionedNav | FlatNav): nav is SectionedNav {
  return !Array.isArray(nav)
}

/** Returns true if the nav item should be shown based on allowedModules. */
function isModuleAllowed(item: NavItem, allowedModules: string[] | null): boolean {
  if (allowedModules === null) return true          // ADMIN/SA — all visible
  if (!item.moduleKey) return true                   // no moduleKey = always-on item
  return allowedModules.includes(item.moduleKey)
}

// ─── Notification Nav Link ───────────────────────────────────────────────────────
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

// ─── Nav item ────────────────────────────────────────────────────────────────────
function NavItemLink({ to, label, icon: Icon, onClick }: NavItem & { onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-feros-orange text-white'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon size={18} className="shrink-0" />
      {label}
    </NavLink>
  )
}

// ─── Collapsible section ─────────────────────────────────────────────────────────
function NavSectionGroup({
  section, icon: SectionIcon, items, open, onToggle, onNavClick,
}: NavSection & { open: boolean; onToggle: () => void; onNavClick?: () => void }) {
  const { pathname } = useLocation()
  const isSectionActive = items.some(item => pathname === item.to || pathname.startsWith(item.to + '/'))

  if (section === '') {
    return (
      <div className="space-y-0.5 mt-1">
        {items.map(item => <NavItemLink key={item.to} {...item} onClick={onNavClick} />)}
      </div>
    )
  }

  return (
    <div className="mt-1">
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isSectionActive
            ? 'bg-white/10 text-white'
            : 'text-gray-300 hover:bg-white/10 hover:text-white'
        )}
      >
        {SectionIcon && <SectionIcon size={18} className="shrink-0" />}
        <span className="flex-1 text-left">{section}</span>
        {open
          ? <ChevronDown size={14} className="shrink-0" />
          : <ChevronRight size={14} className="shrink-0" />
        }
      </button>
      {open && (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
          {items.map(item => <NavItemLink key={item.to} {...item} onClick={onNavClick} />)}
        </div>
      )}
    </div>
  )
}


function getRoleLabel(role: string | null) {
  if (!role) return ''
  if (role === 'SUPER_ADMIN')  return 'Super Admin'
  if (role === 'ADMIN')        return 'Admin'
  if (role === 'OFFICE_STAFF') return 'Office Staff'
  if (role === 'SUPERVISOR')   return 'Supervisor'
  if (role === 'DRIVER')       return 'Driver'
  if (role === 'CLEANER')      return 'Cleaner'
  if (role === 'STORE_KEEPER') return 'Store Keeper'
  if (role === 'SERVICE_MEN')  return 'Service Men'
  return role
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const phone              = useAuthStore(s => s.phone)
  const name               = useAuthStore(s => s.name)
  const role               = useAuthStore(s => s.role)
  const companyName        = useAuthStore(s => s.companyName)
  const logoUrl            = useAuthStore(s => s.logoUrl)
  const saSession          = useAuthStore(s => s.saSession)
  const logout             = useAuthStore(s => s.logout)
  const exitImpersonation  = useAuthStore(s => s.exitImpersonation)
  const allowedModules     = useAuthStore(s => s.allowedModules)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const isImpersonating = !!saSession
  const tenantId = useAuthStore(s => s.tenantId)

  const { data: mySubRes } = useQuery({
    queryKey: ['my-subscription', tenantId],
    queryFn: () => subscriptionsApi.getMy(),
    enabled: role !== 'SUPER_ADMIN' && tenantId != null,
    retry: false,
  })
  const subStatus = mySubRes?.data?.status
  const subFeatures = mySubRes?.data

  const nav: SectionedNav | FlatNav =
    role === 'SUPER_ADMIN'  ? SUPER_ADMIN_NAV :
    role === 'OFFICE_STAFF' ? OFFICE_STAFF_NAV :
    role === 'SUPERVISOR'   ? SUPERVISOR_NAV :
    role === 'DRIVER'       ? DRIVER_CLEANER_NAV :
    role === 'CLEANER'      ? DRIVER_CLEANER_NAV :
    role === 'STORE_KEEPER' ? STORE_KEEPER_NAV :
    role === 'SERVICE_MEN'  ? SERVICE_MEN_NAV :
    ADMIN_NAV

  const location = useLocation()

  function getActiveSection(): string | null {
    if (!isSectionedNav(nav)) return null
    for (const { section, items } of nav.sections) {
      if (section && items.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/')))
        return section
    }
    return null
  }

  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const active = getActiveSection()
    return active ? new Set([active]) : new Set()
  })

  useEffect(() => {
    const active = getActiveSection()
    if (active) setOpenSections(prev => prev.has(active) ? prev : new Set([...prev, active]))
  }, [location.pathname])

  function toggleSection(section: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(section) ? next.delete(section) : next.add(section)
      return next
    })
  }

  async function handleLogout() {
    try { await authApi.logout() } catch (_) {}
    logout()
    qc.clear()
    navigate('/login', { replace: true })
  }

  function handleExitImpersonation() {
    exitImpersonation()
    navigate('/sa/tenants', { replace: true })
  }

  const subEndDate = mySubRes?.data?.endDate
  const isDateExpired = subEndDate != null && new Date(subEndDate) < new Date()
  const locked = subStatus === 'EXPIRED' || subStatus === 'SUSPENDED' || isDateExpired

  const FEATURE_ROUTES: Record<string, boolean | undefined> = {
    '/fuel-logs':        subFeatures?.hasFuelLogs,
    '/meter-readings':   subFeatures?.hasMeterReadings,
    '/vehicle-services': subFeatures?.hasVehicleServices,
    '/attendance':       subFeatures?.hasAttendance,
    '/payroll':          subFeatures?.hasPayroll,
    '/inventory':        subFeatures?.hasInventory,
    '/inventory/tyres':  subFeatures?.hasInventory,
    '/credit-notes':     subFeatures?.hasCreditNotes,
  }

  function isRouteAllowed(item: NavItem) {
    // 1. Check subscription feature flags
    if (role !== 'SUPER_ADMIN' && subFeatures !== undefined) {
      const flag = FEATURE_ROUTES[item.to]
      if (flag !== undefined && !flag) return false
    }
    // 2. Check module access
    return isModuleAllowed(item, allowedModules)
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => {
    const closeMobile = mobile ? () => setSidebarOpen(false) : undefined

    return (
      <aside className={cn('flex flex-col h-full bg-feros-sidebar', mobile ? 'w-72' : 'w-64')}>
        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-5 border-b border-white/10 shrink-0 relative">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName ?? 'Logo'} className="h-9 w-auto object-contain max-w-[160px]" />
          ) : (
            <img src={leftMenuLogo} alt="FEROS" className="h-9 w-auto object-contain" />
          )}
          {mobile && (
            <button onClick={closeMobile} className="absolute right-4 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {isSectionedNav(nav) ? (
            <>
              <NavItemLink {...nav.dashboard} onClick={closeMobile} />
              {nav.sections.map(({ section, icon, items }) => {
                const allowed = items.filter(i => isRouteAllowed(i))
                if (allowed.length === 0) return null
                return (
                  <NavSectionGroup
                    key={section}
                    section={section}
                    icon={icon}
                    items={allowed}
                    open={openSections.has(section)}
                    onToggle={() => toggleSection(section)}
                    onNavClick={closeMobile}
                  />
                )
              })}
            </>
          ) : (
            <div className="space-y-0.5">
              {(nav as FlatNav).filter(i => isRouteAllowed(i)).map(item => (
                <NavItemLink key={item.to} {...item} onClick={closeMobile} />
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t border-white/10 space-y-0.5">
          <NotifNavLink />
          <button
            onClick={() => setLogoutOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    )
  }

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

      <ConfirmDialog
        open={logoutOpen}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />

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

          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-feros-navy flex items-center justify-center text-white text-sm font-semibold">
              {name?.[0] ?? phone?.[0] ?? 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-800">{name ?? phone}</p>
              <p className="text-xs text-gray-500">{companyName}</p>
              {role && <p className="text-xs text-feros-navy font-medium">{getRoleLabel(role)}</p>}
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
        {locked && (
          <div className={cn(
            'px-5 py-2.5 flex items-center gap-3 text-sm shrink-0',
            subStatus === 'SUSPENDED' ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'
          )}>
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1">
              {subStatus === 'SUSPENDED'
                ? 'Your account has been suspended. Please contact FEROS support.'
                : 'Your subscription has expired. All features are disabled.'}
            </span>
            <Link
              to="/subscription"
              className="shrink-0 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-xs font-semibold transition-colors"
            >
              View Subscription
            </Link>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <SubscriptionContext.Provider value={{ locked }}>
            <Outlet />
          </SubscriptionContext.Provider>
        </main>
      </div>
    </div>
  )
}
