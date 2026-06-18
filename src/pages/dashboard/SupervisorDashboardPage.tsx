import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '@/api/dashboard'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import {
  ClipboardList, Truck, UserCheck,
  AlertTriangle, CheckCircle, ArrowRight,
} from 'lucide-react'
import type { SupervisorDashboardResponse, VehicleAlert } from '@/types'
import { cn } from '@/lib/utils'

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n?: number) {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('en-IN')
}
function alertRowStyle(days: number, expired: boolean) {
  if (expired)   return { border: 'border-l-red-400',    badge: 'bg-red-100 text-red-700',       row: 'hover:bg-red-50' }
  if (days <= 7) return { border: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700', row: 'hover:bg-orange-50' }
  return               { border: 'border-l-yellow-400',  badge: 'bg-yellow-100 text-yellow-700', row: 'hover:bg-yellow-50' }
}
function alertBadge(days: number, expired: boolean) {
  if (expired)    return 'Expired'
  if (days === 0) return 'Today'
  return `${days}d left`
}

// ─── SVG Attendance Ring ──────────────────────────────────────────────────────

function AttendanceRing({ value, total, color, label }: {
  value: number; total: number; color: string; label: string
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  const r = 22
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="60" height="60" className="-rotate-90">
          <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
          <circle
            cx="30" cy="30" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
          {fmt(value)}
        </span>
      </div>
      <span className="text-xs text-blue-300">{label}</span>
    </div>
  )
}

// ─── Segmented Bar ────────────────────────────────────────────────────────────

function SegmentedBar({ segments }: {
  segments: { value: number; tw: string }[]
}) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0)
  if (total === 0) return <div className="h-2 bg-gray-100 rounded-full" />
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
      {segments.filter(s => s.value > 0).map((s, i) => (
        <div
          key={i}
          className={cn('transition-all duration-500', s.tw)}
          style={{ width: `${(s.value / total) * 100}%` }}
        />
      ))}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, accentTw, iconBg, href, bar }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; accentTw: string; iconBg: string
  href?: string; bar?: { used: number; total: number; color: string }
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => href && navigate(href)}
      className={cn(
        'bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all duration-200 flex',
        href && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className={cn('w-1 shrink-0', accentTw)} />
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums leading-none">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl shrink-0', iconBg)}>
            <Icon size={18} />
          </div>
        </div>
        {bar && (
          <div className="mt-3.5">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Fleet utilization</span>
              <span className="font-medium">{bar.total > 0 ? Math.round((bar.used / bar.total) * 100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${bar.total > 0 ? (bar.used / bar.total) * 100 : 0}%`, backgroundColor: bar.color }}
              />
            </div>
          </div>
        )}
        {href && (
          <div className="mt-3 flex items-center gap-1 text-[11px] text-gray-400">
            <span>View all</span>
            <ArrowRight size={10} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Alert list item ──────────────────────────────────────────────────────────

function VehicleAlertItem({ a }: { a: VehicleAlert }) {
  const navigate = useNavigate()
  const s = alertRowStyle(a.daysLeft, a.expired)
  return (
    <div
      onClick={() => navigate(`/vehicles/${a.vehicleId}?tab=Documents`)}
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-l-4 border-b border-b-gray-50 last:border-b-0 cursor-pointer transition-colors',
        s.border, s.row
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{a.registrationNumber}</p>
        <p className="text-xs text-gray-400 truncate">
          {a.alertType === 'DOCUMENT' ? a.documentName : a.alertType.replace(/_/g, ' ')}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-gray-400">{format(new Date(a.expiryDate), 'dd MMM yy')}</p>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block', s.badge)}>
          {alertBadge(a.daysLeft, a.expired)}
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SupervisorDashboardPage() {
  const navigate = useNavigate()
  const name = useAuthStore(s => s.name)

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

  const fleetUtil = s && s.vehicles.total > 0
    ? { used: s.vehicles.onTrip, total: s.vehicles.total, color: '#F97316' }
    : undefined

  const orderSegments = s ? [
    { value: s.orders.pending,   tw: 'bg-gray-300' },
    { value: s.orders.active,    tw: 'bg-orange-400' },
    { value: s.orders.completed, tw: 'bg-blue-400' },
    { value: s.orders.delivered, tw: 'bg-green-400' },
    { value: s.orders.cancelled, tw: 'bg-red-300' },
  ] : []

  const vehicleAlertCount = alerts?.vehicleAlerts.length ?? 0

  return (
    <div className="space-y-5">

      {/* ── Welcome banner ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F2137 0%, #1E3A5F 100%)' }}>
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-blue-300 text-xs font-medium tracking-widest uppercase">
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
            <h1 className="text-white text-xl font-bold mt-0.5">
              Welcome back{name ? `, ${name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-blue-400 text-xs mt-1">Here's your fleet and operations overview.</p>
          </div>
          {vehicleAlertCount > 0 && (
            <button
              onClick={() => document.getElementById('vehicle-alerts')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-red-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0"
            >
              <AlertTriangle size={14} />
              <span>{vehicleAlertCount} vehicle alert{vehicleAlertCount !== 1 ? 's' : ''}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label="Orders"
            value={fmt(s?.orders.total)}
            sub={`${fmt(s?.orders.active)} active · ${fmt(s?.orders.pending)} pending`}
            icon={ClipboardList}
            accentTw="bg-feros-navy"
            iconBg="bg-blue-50 text-feros-navy"
            href="/orders"
          />
          <KpiCard
            label="Fleet Size"
            value={fmt(s?.vehicles.total)}
            sub={`${fmt(s?.vehicles.onTrip)} on trip · ${fmt(s?.vehicles.available)} available`}
            icon={Truck}
            accentTw="bg-feros-orange"
            iconBg="bg-orange-50 text-feros-orange"
            href="/vehicles"
            bar={fleetUtil}
          />
          <KpiCard
            label="Today's Attendance"
            value={fmt(s?.attendance.present)}
            sub={`of ${fmt(s?.attendance.total)} · ${fmt(s?.attendance.absent)} absent`}
            icon={UserCheck}
            accentTw="bg-green-500"
            iconBg="bg-green-50 text-green-600"
            href="/attendance"
          />
        </div>
      )}

      {/* ── Order breakdown ── */}
      {s && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-800 text-sm">Order Breakdown</h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-feros-navy hover:underline flex items-center gap-1"
            >
              View all <ArrowRight size={10} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">{fmt(s.orders.total)} orders total</p>
          <SegmentedBar segments={orderSegments} />
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
            {[
              { label: 'Pending',   value: s.orders.pending,   dot: 'bg-gray-300',   status: 'PENDING' },
              { label: 'Active',    value: s.orders.active,    dot: 'bg-orange-400', status: 'IN_TRANSIT' },
              { label: 'Completed', value: s.orders.completed, dot: 'bg-blue-400',   status: 'COMPLETED' },
              { label: 'Delivered', value: s.orders.delivered, dot: 'bg-green-400',  status: 'DELIVERED' },
              { label: 'Cancelled', value: s.orders.cancelled, dot: 'bg-red-300',    status: 'CANCELLED' },
            ].map(({ label, value, dot, status }) => (
              <div
                key={label}
                onClick={() => navigate(`/orders?status=${status}`)}
                className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-800 tabular-nums leading-none">{fmt(value)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vehicle Alerts ── */}
      <div id="vehicle-alerts" className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-50 rounded-lg">
              <Truck size={14} className="text-feros-orange" />
            </div>
            <h2 className="font-semibold text-gray-800 text-sm">Vehicle Document Alerts</h2>
          </div>
          {alerts && (
            <span className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              vehicleAlertCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
            )}>
              {vehicleAlertCount} alert{vehicleAlertCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {loadingAlerts ? (
          <div className="space-y-px">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-50 animate-pulse" />)}
          </div>
        ) : !alerts?.vehicleAlerts.length ? (
          <div className="p-10 flex flex-col items-center gap-2 text-gray-400">
            <CheckCircle size={28} className="text-green-400" />
            <span className="text-sm">All vehicle documents up to date</span>
          </div>
        ) : (
          <div>
            {alerts.vehicleAlerts.slice(0, 10).map((a, i) => <VehicleAlertItem key={i} a={a} />)}
            {alerts.vehicleAlerts.length > 10 && (
              <button
                onClick={() => navigate('/vehicles')}
                className="w-full py-3 text-xs text-feros-navy font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
              >
                +{alerts.vehicleAlerts.length - 10} more <ArrowRight size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Attendance Snapshot ── */}
      {s && (
        <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #0F2137 0%, #1E3A5F 100%)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-blue-300 text-[11px] font-semibold uppercase tracking-widest">Today's Snapshot</p>
              <p className="text-white font-semibold mt-0.5">Drivers & Cleaners Attendance</p>
            </div>
            <button
              onClick={() => navigate('/attendance')}
              className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-white transition-colors"
            >
              View details <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex items-center justify-around">
            <AttendanceRing value={s.attendance.present}   total={s.attendance.total} color="#22c55e" label="Present" />
            <AttendanceRing value={s.attendance.absent}    total={s.attendance.total} color="#ef4444" label="Absent" />
            <AttendanceRing value={s.attendance.halfDay}   total={s.attendance.total} color="#f59e0b" label="Half Day" />
            <AttendanceRing value={s.attendance.weeklyOff} total={s.attendance.total} color="#60a5fa" label="Weekly Off" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-[60px] h-[60px] rounded-full border-[5px] border-white/20 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{fmt(s.attendance.total)}</span>
              </div>
              <span className="text-xs text-blue-300">Total Staff</span>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
