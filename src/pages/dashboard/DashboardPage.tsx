import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { format } from 'date-fns'
import {
  ClipboardList, Truck, Receipt, UserCheck,
  AlertTriangle, CheckCircle, Clock, TrendingUp,
} from 'lucide-react'
import type { VehicleAlert, StaffDocumentAlert } from '@/types'
import { cn } from '@/lib/utils'

function fmt(n?: number) {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('en-IN')
}
function fmtRupee(n?: number) {
  if (n === undefined || n === null) return '—'
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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
  label, value, sub, icon: Icon, iconBg,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
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
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4 text-sm font-medium text-gray-800">{a.registrationNumber}</td>
      <td className="py-3 px-4 text-sm text-gray-600">{a.alertType}</td>
      <td className="py-3 px-4 text-sm text-gray-500">{format(new Date(a.expiryDate), 'dd MMM yyyy')}</td>
      <td className="py-3 px-4">
        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', alertColor(a.daysLeft, a.expired))}>
          {alertBadge(a.daysLeft, a.expired)}
        </span>
      </td>
    </tr>
  )
}

function StaffAlertRow({ a }: { a: StaffDocumentAlert }) {
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4 text-sm font-medium text-gray-800">{a.userName}</td>
      <td className="py-3 px-4 text-sm text-gray-600">{a.documentType}</td>
      <td className="py-3 px-4 text-sm text-gray-500">{format(new Date(a.expiryDate), 'dd MMM yyyy')}</td>
      <td className="py-3 px-4">
        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', alertColor(a.daysLeft, a.expired))}>
          {alertBadge(a.daysLeft, a.expired)}
        </span>
      </td>
    </tr>
  )
}

export function DashboardPage() {
  const { data: summaryRes, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
  })

  const { data: alertsRes, isLoading: loadingAlerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => dashboardApi.getExpiryAlerts(30),
  })

  const s      = summaryRes?.data
  const alerts = alertsRes?.data

  const statCards = [
    {
      label: 'Active Orders',
      value: fmt(s?.orders.total),
      sub: `${fmt(s?.orders.inTransit)} in transit · ${fmt(s?.orders.pending)} pending`,
      icon: ClipboardList,
      iconBg: 'bg-blue-50 text-feros-navy',
    },
    {
      label: 'Fleet Size',
      value: fmt(s?.vehicles.total),
      sub: `${fmt(s?.vehicles.onTrip)} on trip · ${fmt(s?.vehicles.available)} available`,
      icon: Truck,
      iconBg: 'bg-orange-50 text-feros-orange',
    },
    {
      label: 'Outstanding',
      value: fmtRupee(s?.invoices.totalOutstanding),
      sub: `${fmt(s?.invoices.overdue)} overdue invoices`,
      icon: Receipt,
      iconBg: 'bg-red-50 text-red-600',
    },
    {
      label: "Today's Attendance",
      value: fmt(s?.todayAttendance.present),
      sub: `of ${fmt(s?.todayAttendance.total)} staff · ${fmt(s?.todayAttendance.absent)} absent`,
      icon: UserCheck,
      iconBg: 'bg-green-50 text-green-600',
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
        {alerts && alerts.totalAlerts > 0 && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm font-medium px-4 py-2 rounded-lg border border-red-100">
            <AlertTriangle size={16} />
            {alerts.totalAlerts} expiry alert{alerts.totalAlerts !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Stat cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(c => <StatCard key={c.label} {...c} />)}
        </div>
      )}

      {/* Order status breakdown */}
      {s && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Order Status Breakdown</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Pending',    value: s.orders.pending,            color: 'text-gray-600   bg-gray-50' },
              { label: 'Assigned',   value: s.orders.fullyAssigned,      color: 'text-blue-600   bg-blue-50' },
              { label: 'In Transit', value: s.orders.inTransit,          color: 'text-orange-600 bg-orange-50' },
              { label: 'Part. Del.', value: s.orders.partiallyDelivered, color: 'text-yellow-700 bg-yellow-50' },
              { label: 'Delivered',  value: s.orders.delivered,          color: 'text-green-600  bg-green-50' },
              { label: 'Cancelled',  value: s.orders.cancelled,          color: 'text-red-600    bg-red-50' },
            ].map(({ label, value, color }) => (
              <div key={label} className={cn('rounded-lg p-3 text-center', color)}>
                <p className="text-2xl font-bold">{fmt(value)}</p>
                <p className="text-xs mt-1 opacity-80">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice summary */}
      {s && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Invoice Summary</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { label: 'Draft',      value: s.invoices.draft,         color: 'text-gray-600   bg-gray-50' },
              { label: 'Sent',       value: s.invoices.sent,          color: 'text-blue-600   bg-blue-50' },
              { label: 'Part. Paid', value: s.invoices.partiallyPaid, color: 'text-yellow-700 bg-yellow-50' },
              { label: 'Overdue',    value: s.invoices.overdue,       color: 'text-red-600    bg-red-50' },
              { label: 'Paid',       value: s.invoices.paid,          color: 'text-green-600  bg-green-50' },
            ].map(({ label, value, color }) => (
              <div key={label} className={cn('rounded-lg p-3 text-center', color)}>
                <p className="text-2xl font-bold">{fmt(value)}</p>
                <p className="text-xs mt-1 opacity-80">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiry alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vehicle alerts */}
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

        {/* Staff alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <UserCheck size={16} className="text-feros-orange" />
              Staff Document Alerts
            </h2>
            {alerts && <span className="text-xs text-gray-500">{alerts.staffDocumentAlerts.length} alerts</span>}
          </div>
          {loadingAlerts ? (
            <div className="p-8 text-center text-gray-400 animate-pulse">Loading…</div>
          ) : !alerts?.staffDocumentAlerts.length ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
              <CheckCircle size={24} className="text-green-400" />
              <span className="text-sm">All staff documents are up to date</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Staff</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Document</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Expiry</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.staffDocumentAlerts.map((a, i) => <StaffAlertRow key={i} a={a} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Today's attendance footer */}
      {s && (
        <div className="bg-feros-navy rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-feros-orange" />
            <span className="text-sm font-medium text-blue-200">Today's Snapshot</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Present',  value: s.todayAttendance.present },
              { label: 'Absent',   value: s.todayAttendance.absent },
              { label: 'Half Day', value: s.todayAttendance.halfDay },
              { label: 'On Leave', value: s.todayAttendance.onLeave },
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
