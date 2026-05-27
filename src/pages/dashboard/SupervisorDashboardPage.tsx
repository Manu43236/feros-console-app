import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '@/api/dashboard'
import { format } from 'date-fns'
import {
  ClipboardList, Truck, UserCheck,
  AlertTriangle, CheckCircle, Clock,
} from 'lucide-react'
import type { SupervisorDashboardResponse, VehicleAlert } from '@/types'
import { cn } from '@/lib/utils'

function fmt(n?: number) {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('en-IN')
}
function alertColor(days: number, expired: boolean) {
  if (expired)   return 'text-red-600 bg-red-50'
  if (days <= 7) return 'text-orange-600 bg-orange-50'
  return 'text-yellow-700 bg-yellow-50'
}
function alertBadge(days: number, expired: boolean) {
  if (expired)    return 'Expired'
  if (days === 0) return 'Today'
  return `${days}d left`
}

function StatCard({
  label, value, sub, icon: Icon, iconBg, href,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; iconBg: string; href?: string
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => href && navigate(href)}
      className={cn(
        'bg-white rounded-xl p-5 shadow-sm border border-gray-100 transition-all duration-200',
        href && 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-blue-200'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={cn('p-3 rounded-xl', iconBg)}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function VehicleAlertRow({ a }: { a: VehicleAlert }) {
  const navigate = useNavigate()
  return (
    <tr
      className="border-b border-gray-50 last:border-0 hover:bg-orange-50 transition-colors cursor-pointer"
      onClick={() => navigate(`/vehicles/${a.vehicleId}?tab=Documents`)}
    >
      <td className="py-3 px-4 text-sm font-medium text-gray-800">{a.registrationNumber}</td>
      <td className="py-3 px-4 text-sm text-gray-600">
        {a.alertType === 'DOCUMENT' ? a.documentName : a.alertType.replace(/_/g, ' ')}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">{format(new Date(a.expiryDate), 'dd MMM yyyy')}</td>
      <td className="py-3 px-4">
        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', alertColor(a.daysLeft, a.expired))}>
          {alertBadge(a.daysLeft, a.expired)}
        </span>
      </td>
    </tr>
  )
}

export function SupervisorDashboardPage() {
  const navigate = useNavigate()

  const { data: summaryRes, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
  })

  const { data: alertsRes, isLoading: loadingAlerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => dashboardApi.getExpiryAlerts(30),
  })

  const s      = summaryRes?.data as SupervisorDashboardResponse | undefined
  const alerts = alertsRes?.data

  const statCards = [
    {
      label: 'Orders',
      value: fmt(s?.orders.total),
      sub: `${fmt(s?.orders.active)} active · ${fmt(s?.orders.pending)} pending`,
      icon: ClipboardList,
      iconBg: 'bg-blue-50 text-feros-navy',
      href: '/orders',
    },
    {
      label: 'Fleet Size',
      value: fmt(s?.vehicles.total),
      sub: `${fmt(s?.vehicles.onTrip)} on trip · ${fmt(s?.vehicles.available)} available`,
      icon: Truck,
      iconBg: 'bg-orange-50 text-feros-orange',
      href: '/vehicles',
    },
    {
      label: "Today's Attendance",
      value: fmt(s?.attendance.present),
      sub: `of ${fmt(s?.attendance.total)} · ${fmt(s?.attendance.absent)} absent`,
      icon: UserCheck,
      iconBg: 'bg-green-50 text-green-600',
      href: '/attendance',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        {alerts && alerts.vehicleAlerts.length > 0 && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm font-medium px-4 py-2 rounded-lg border border-red-100">
            <AlertTriangle size={16} />
            {alerts.vehicleAlerts.length} expiry alert{alerts.vehicleAlerts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Stat cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map(c => <StatCard key={c.label} {...c} />)}
        </div>
      )}

      {/* Order status breakdown */}
      {s && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Order Status Breakdown</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { label: 'Pending',   value: s.orders.pending,   color: 'text-gray-600   bg-gray-50',   status: 'PENDING' },
              { label: 'Active',    value: s.orders.active,    color: 'text-orange-600 bg-orange-50', status: 'IN_TRANSIT' },
              { label: 'Completed', value: s.orders.completed, color: 'text-blue-600   bg-blue-50',   status: 'COMPLETED' },
              { label: 'Delivered', value: s.orders.delivered, color: 'text-green-600  bg-green-50',  status: 'DELIVERED' },
              { label: 'Cancelled', value: s.orders.cancelled, color: 'text-red-600    bg-red-50',    status: 'CANCELLED' },
            ].map(({ label, value, color, status }) => (
              <div
                key={label}
                onClick={() => navigate(`/orders?status=${status}`)}
                className={cn('rounded-lg p-3 text-center cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md', color)}
              >
                <p className="text-2xl font-bold">{fmt(value)}</p>
                <p className="text-xs mt-1 opacity-80">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vehicle document alerts — full width */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Truck size={16} className="text-feros-orange" />
            Vehicle Document Alerts
          </h2>
          {alerts && <span className="text-xs text-gray-500">{alerts.vehicleAlerts.length} alerts</span>}
        </div>
        {loadingAlerts ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading…</div>
        ) : !alerts?.vehicleAlerts.length ? (
          <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
            <CheckCircle size={24} className="text-green-400" />
            <span className="text-sm">All vehicle documents are up to date</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Vehicle</th>
                  <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Document</th>
                  <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Expiry</th>
                  <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.vehicleAlerts.map((a, i) => <VehicleAlertRow key={i} a={a} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drivers & Cleaners attendance snapshot */}
      {s && (
        <div className="bg-feros-navy rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-feros-orange" />
            <span className="text-sm font-medium text-blue-200">Drivers & Cleaners Snapshot</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Present',    value: s.attendance.present },
              { label: 'Absent',     value: s.attendance.absent },
              { label: 'Half Day',   value: s.attendance.halfDay },
              { label: 'Weekly Off', value: s.attendance.weeklyOff },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold">{fmt(value)}</p>
                <p className="text-xs text-blue-300 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
