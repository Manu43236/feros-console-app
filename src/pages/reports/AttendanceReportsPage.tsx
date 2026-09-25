import { Spinner } from '@/components/ui/loader'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Users, ClipboardList, CalendarCheck, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import { downloadDailyFleetAttendancePdf, downloadTablePdf } from './DailyFleetAttendancePdf'
import type { AttendanceDailyRow, AttendanceSummaryRow, AttendanceRoleSummaryRow, DailyFleetAttendanceReport } from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const thisWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(new Date(d).setDate(diff)).toISOString().split('T')[0]
}
const thisMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Tab config ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'daily',        label: 'Daily Register',   icon: ClipboardList  },
  { key: 'summary',      label: 'Monthly Summary',  icon: Users          },
  { key: 'fleet',        label: 'Daily Attendance', icon: CalendarCheck  },
  { key: 'role-summary', label: 'Role Summary',     icon: BarChart2      },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

const ROLES = ['ALL', 'DRIVER', 'CLEANER', 'SUPERVISOR', 'OFFICE_STAFF', 'SERVICE_MANAGER', 'STORE_KEEPER']

// ── Status / type badges ───────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  PRESENT:   'bg-green-100 text-green-700',
  ABSENT:    'bg-red-100 text-red-700',
  LEAVE:     'bg-blue-100 text-blue-700',
  'HALF DAY': 'bg-amber-100 text-amber-700',
  APPROVED:  'bg-green-100 text-green-700',
  PENDING:   'bg-yellow-100 text-yellow-700',
  REJECTED:  'bg-red-100 text-red-700',
}
function Badge({ label }: { label: string }) {
  const key = label.toUpperCase()
  const cls = TYPE_COLORS[key] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

// ── Generic table ──────────────────────────────────────────────────────────────
function ReportTable({ headers, rows, loading }: {
  headers: string[]
  rows: React.ReactNode[][]
  loading: boolean
}) {
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const top = topRef.current, bottom = bottomRef.current, mirror = mirrorRef.current
    if (!top || !bottom || !mirror) return
    const ro = new ResizeObserver(() => { mirror.style.width = `${bottom.scrollWidth}px` })
    ro.observe(bottom)
    let syncing = false
    const t = top, b = bottom
    function onTop()    { if (!syncing) { syncing = true; b.scrollLeft = t.scrollLeft; syncing = false } }
    function onBottom() { if (!syncing) { syncing = true; t.scrollLeft = b.scrollLeft; syncing = false } }
    top.addEventListener('scroll', onTop)
    bottom.addEventListener('scroll', onBottom)
    return () => { ro.disconnect(); top.removeEventListener('scroll', onTop); bottom.removeEventListener('scroll', onBottom) }
  }, [rows])
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm"><Spinner /></div>
  if (rows.length === 0) return (
    <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  )
  return (
    <div className="rounded-lg border overflow-hidden">
      <div ref={topRef} className="overflow-x-auto border-b bg-gray-50" style={{ height: 14 }}>
        <div ref={mirrorRef} style={{ height: 1 }} />
      </div>
      <div ref={bottomRef} className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white whitespace-nowrap bg-feros-navy">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
          {rows.length} record{rows.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

// ── Formatters ─────────────────────────────────────────────────────────────────
const dash = (v: unknown) => (v != null && v !== '' ? String(v) : '—')
function fmtTime(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

// ── Table renderers ────────────────────────────────────────────────────────────
function DailyTable({ rows, loading }: { rows: AttendanceDailyRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Date', 'Employee', 'Role', 'Vehicle', 'Type', 'Mark In', 'Mark Out', 'Hours', 'Approval', 'Leave Type', 'Remarks']}
    rows={rows.map(r => [
      r.attendanceDate,
      <span className="font-medium">{r.employeeName}</span>,
      <span className="text-xs text-gray-500">{r.role.replace(/_/g, ' ')}</span>,
      dash(r.vehicleRegistrationNumber),
      <Badge label={r.attendanceType} />,
      fmtTime(r.markedAt),
      fmtTime(r.markedOutAt),
      r.hoursWorked != null ? `${r.hoursWorked} h` : '—',
      <Badge label={r.approvalStatus} />,
      dash(r.leaveType),
      dash(r.remarks),
    ])}
  />
}

function SummaryTable({ rows, loading }: { rows: AttendanceSummaryRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Employee', 'Role', 'Vehicle', 'Present', 'Absent', 'Leave', 'Half Day', 'Other', 'Total', 'Present %']}
    rows={rows.map(r => [
      <span className="font-medium">{r.employeeName}</span>,
      <span className="text-xs text-gray-500">{r.role.replace(/_/g, ' ')}</span>,
      dash(r.vehicleRegistrationNumber),
      <span className="text-green-700 font-medium">{r.presentDays}</span>,
      <span className={r.absentDays > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{r.absentDays}</span>,
      r.leaveDays,
      r.halfDays,
      r.otherDays,
      r.totalRecords,
      <span className={cn(
        'font-medium',
        r.presentPercent >= 90 ? 'text-green-600' :
        r.presentPercent >= 75 ? 'text-amber-600' : 'text-red-600'
      )}>{r.presentPercent}%</span>,
    ])}
  />
}

// ── Fleet Attendance helpers ───────────────────────────────────────────────────
function applyFleetFilter(rows: DailyFleetAttendanceReport['rows'], filter: 'all' | 'drivers' | 'cleaners' | 'unassigned' | 'empty') {
  if (filter === 'drivers')    return rows.filter(r => r.driverName !== '—')
  if (filter === 'cleaners')   return rows.filter(r => r.cleanerName !== '—')
  if (filter === 'unassigned') return rows.filter(r => r.driverName === '—')
  if (filter === 'empty')      return rows.filter(r => r.driverName === '—' && r.cleanerName === '—')
  return rows
}

function DailyFleetTable({ report, filter, loading }: { report: DailyFleetAttendanceReport | undefined; filter: 'all' | 'drivers' | 'cleaners' | 'unassigned' | 'empty'; loading: boolean }) {
  const rows = applyFleetFilter(report?.rows ?? [], filter)
  return <ReportTable
    loading={loading}
    headers={['#', 'Vehicle No.', 'Scope', 'Type', 'Driver', 'Cleaner']}
    rows={rows.map((r, i) => [
      <span className="text-gray-400">{i + 1}</span>,
      <span className="font-medium">{r.registrationNumber}</span>,
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{r.scope}</span>,
      dash(r.vehicleType),
      r.driverName === '—'
        ? <span className="text-gray-300">—</span>
        : <span className="text-green-700 font-medium">{r.driverName}</span>,
      r.cleanerName === '—'
        ? <span className="text-gray-300">—</span>
        : <span className="text-teal-700 font-medium">{r.cleanerName}</span>,
    ])}
  />
}

const ROLE_LABELS: Record<string, string> = {
  DRIVER: 'Drivers', CLEANER: 'Cleaners', SUPERVISOR: 'Supervisors',
  OFFICE_STAFF: 'Office Staff', SERVICE_MANAGER: 'Service Managers',
  TECHNICIAN: 'Technicians', STORE_KEEPER: 'Store Keepers', ADMIN: 'Admins',
}

function RoleSummaryTable({ rows, loading }: { rows: AttendanceRoleSummaryRow[]; loading: boolean }) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm"><Spinner /></div>
  if (rows.length === 0) return (
    <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  )
  const HEADERS = ['Role', 'Staff Count', 'Pending', 'Present', 'Half Day', 'Leave', 'Holiday', 'Week Off', 'Absent', 'No Attendance']
  return (
    <div className="rounded-lg border overflow-hidden overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            {HEADERS.map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white whitespace-nowrap bg-feros-navy">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.role} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{ROLE_LABELS[r.role] ?? r.role.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3 text-gray-700 font-semibold">{r.staffCount}</td>
              <td className="px-4 py-3">
                <span className={r.pending > 0 ? 'text-yellow-600 font-semibold' : 'text-gray-400'}>{r.pending}</span>
              </td>
              <td className="px-4 py-3">
                <span className={r.present > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>{r.present}</span>
              </td>
              <td className="px-4 py-3">
                <span className={r.halfDay > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'}>{r.halfDay}</span>
              </td>
              <td className="px-4 py-3">
                <span className={r.onLeave > 0 ? 'text-blue-600 font-semibold' : 'text-gray-400'}>{r.onLeave}</span>
              </td>
              <td className="px-4 py-3">
                <span className={r.holiday > 0 ? 'text-purple-600 font-semibold' : 'text-gray-400'}>{r.holiday}</span>
              </td>
              <td className="px-4 py-3">
                <span className={r.weekOff > 0 ? 'text-teal-600 font-semibold' : 'text-gray-400'}>{r.weekOff}</span>
              </td>
              <td className="px-4 py-3">
                <span className={r.absent > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>{r.absent}</span>
              </td>
              <td className="px-4 py-3">
                <span className={r.noAttendance > 0 ? 'text-gray-500 font-semibold' : 'text-gray-400'}>{r.noAttendance}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AttendanceReportsPage() {
  const [tab, setTab] = useState<TabKey>('daily')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [downloading, setDownloading] = useState(false)
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [fleetDate, setFleetDate] = useState(todayStr())
  const [fleetScope, setFleetScope] = useState<'INTRA_STATE' | 'INTER_STATE'>('INTRA_STATE')
  const [roleSummaryDate, setRoleSummaryDate] = useState(todayStr())
  const [fleetFilter, setFleetFilter] = useState<'all' | 'drivers' | 'cleaners' | 'unassigned' | 'empty'>('all')

  function handleTabChange(key: TabKey) {
    setTab(key)
    setVehicleFilter('ALL')
    setRoleFilter('ALL')
    setFleetFilter('all')
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());       setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart());  setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  // ── Queries ──
  const dailyQuery = useQuery({
    queryKey: ['report-attendance-daily', startDate, endDate],
    queryFn: () => reportsApi.getAttendanceDaily(startDate, endDate),
    enabled: tab === 'daily',
  })
  const summaryQuery = useQuery({
    queryKey: ['report-attendance-summary', startDate, endDate],
    queryFn: () => reportsApi.getAttendanceSummary(startDate, endDate),
    enabled: tab === 'summary',
  })
  const fleetQuery = useQuery({
    queryKey: ['report-daily-fleet', fleetDate, fleetScope],
    queryFn: () => reportsApi.getDailyFleetAttendance(fleetDate, fleetScope),
    enabled: tab === 'fleet',
  })
  const roleSummaryQuery = useQuery({
    queryKey: ['report-attendance-role-summary', roleSummaryDate],
    queryFn: () => reportsApi.getAttendanceRoleSummary(roleSummaryDate, roleSummaryDate),
    enabled: tab === 'role-summary',
  })

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if (tab === 'daily')   await reportsApi.exportAttendanceDaily(startDate, endDate, format)
      else if (tab === 'summary') await reportsApi.exportAttendanceSummary(startDate, endDate, format)
      else if (tab === 'role-summary') {
        const rows = roleSummaryQuery.data?.data ?? []
        const headers = ['Role', 'Staff Count', 'Pending', 'Present', 'Half Day', 'Leave', 'Holiday', 'Week Off', 'Absent', 'No Attendance']
        const csvRows = rows.map(r => [
          ROLE_LABELS[r.role] ?? r.role.replace(/_/g, ' '),
          String(r.staffCount), String(r.pending), String(r.present),
          String(r.halfDay), String(r.onLeave), String(r.holiday), String(r.weekOff),
          String(r.absent), String(r.noAttendance),
        ])
        if (format === 'csv') {
          const content = [headers, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
          a.download = `role-summary-attendance-${roleSummaryDate}.csv`
          a.click()
        } else {
          await downloadTablePdf(
            'Role Summary — Attendance Report',
            `Date: ${roleSummaryDate}`,
            headers,
            csvRows,
            `role-summary-attendance-${roleSummaryDate}.pdf`,
          )
        }
      } else if (tab === 'fleet') {
        const report = fleetQuery.data?.data
        if (report) {
          const filtered = applyFleetFilter(report.rows, fleetFilter)
          const label = fleetFilter !== 'all' ? fleetFilter.charAt(0).toUpperCase() + fleetFilter.slice(1) : undefined
          if (format === 'csv') {
            const header = ['#', 'Vehicle No.', 'Scope', 'Type', 'Driver', 'Cleaner']
            const csvRows = filtered.map((r, i) => [i + 1, r.registrationNumber, r.scope, r.vehicleType ?? '—', r.driverName, r.cleanerName])
            const content = [header, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
            a.download = `fleet-attendance-${report.scope.replace(' ', '-').toLowerCase()}-${report.date}${label ? `-${label.toLowerCase()}` : ''}.csv`
            a.click()
          } else {
            await downloadDailyFleetAttendancePdf(report, filtered, label)
          }
        }
      }
    } catch {
      toast.error('Export failed')
    } finally {
      setDownloading(false)
    }
  }

  // ── Derive filter options from loaded data ──
  const allRows: { vehicleRegistrationNumber: string; role: string }[] =
    tab === 'daily'
      ? (dailyQuery.data?.data ?? [])
      : (summaryQuery.data?.data ?? [])

  const vehicles = Array.from(new Set(
    allRows.map(r => r.vehicleRegistrationNumber).filter(v => v && v !== '—')
  )).sort()
  const vehicleOptions = [
    { value: 'ALL', label: `All Vehicles (${allRows.length})` },
    ...vehicles.map(v => ({ value: v, label: v })),
  ]

  // ── Apply filters ──
  const filteredDaily = (dailyQuery.data?.data ?? []).filter(r =>
    (vehicleFilter === 'ALL' || r.vehicleRegistrationNumber === vehicleFilter) &&
    (roleFilter === 'ALL' || r.role === roleFilter)
  )
  const filteredSummary = (summaryQuery.data?.data ?? []).filter(r =>
    (vehicleFilter === 'ALL' || r.vehicleRegistrationNumber === vehicleFilter) &&
    (roleFilter === 'ALL' || r.role === roleFilter)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Staff attendance analytics</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border rounded-xl p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key
                ? 'bg-feros-navy text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Controls card */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">
        {(tab === 'daily' || tab === 'summary') && (
          <>
            {/* Vehicle + role filters */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
              <SearchableSelect
                value={vehicleFilter}
                onValueChange={setVehicleFilter}
                options={vehicleOptions}
                className="w-52"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <SearchableSelect
                value={roleFilter}
                onValueChange={setRoleFilter}
                options={ROLES.map(r => ({ value: r, label: r === 'ALL' ? 'All Roles' : r.replace(/_/g, ' ') }))}
                showSearch={false}
                className="w-44"
              />
            </div>

            {/* Period presets */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
              <div className="flex gap-1">
                {(['today', 'this-week', 'this-month', 'custom'] as DatePreset[]).map(p => (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                      preset === p ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 hover:border-gray-400'
                    )}
                  >
                    {p === 'today' ? 'Today' : p === 'this-week' ? 'This Week' : p === 'this-month' ? 'This Month' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {preset === 'custom' && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-36 h-9 border rounded-md px-2 text-sm" />
                </div>
                <span className="pb-2 text-gray-400 text-sm">→</span>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-36 h-9 border rounded-md px-2 text-sm" />
                </div>
              </div>
            )}
            {preset !== 'custom' && (
              <div className="pb-1 text-xs text-gray-400">{startDate} → {endDate}</div>
            )}
          </>
        )}

        {/* Role Summary — single date picker */}
        {tab === 'role-summary' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <Input type="date" value={roleSummaryDate} onChange={e => setRoleSummaryDate(e.target.value)} className="w-40" />
          </div>
        )}

        {/* Fleet Attendance controls */}
        {tab === 'fleet' && (() => {
          const report = fleetQuery.data?.data
          const stats: { label: string; value: number; key: typeof fleetFilter; base: string; active: string }[] = report ? [
            { label: 'Total Vehicles', value: report.totalVehicles, key: 'all',        base: 'bg-blue-50 text-blue-700 border-blue-200',      active: 'bg-blue-700 text-white border-blue-700' },
            { label: 'Drivers',        value: report.drivers,       key: 'drivers',    base: 'bg-green-50 text-green-700 border-green-200',    active: 'bg-green-700 text-white border-green-700' },
            { label: 'Cleaners',       value: report.cleaners,      key: 'cleaners',   base: 'bg-teal-50 text-teal-700 border-teal-200',      active: 'bg-teal-700 text-white border-teal-700' },
            { label: 'Unassigned',     value: report.unassigned,    key: 'unassigned', base: 'bg-red-50 text-red-700 border-red-200',         active: 'bg-red-700 text-white border-red-700' },
            { label: 'Empty',          value: report.empty ?? 0,    key: 'empty',      base: 'bg-orange-50 text-orange-700 border-orange-200', active: 'bg-orange-700 text-white border-orange-700' },
          ] : []
          return (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <Input type="date" value={fleetDate} onChange={e => setFleetDate(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
                <SearchableSelect
                  value={fleetScope}
                  onValueChange={v => setFleetScope(v as 'INTRA_STATE' | 'INTER_STATE')}
                  options={[
                    { value: 'INTRA_STATE', label: 'Local (Intra State)' },
                    { value: 'INTER_STATE', label: 'Out Station (Inter State)' },
                  ]}
                  showSearch={false}
                  className="w-52"
                />
              </div>
              {stats.length > 0 && (
                <div className="flex gap-3 items-end">
                  {stats.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setFleetFilter(f => f === s.key ? 'all' : s.key)}
                      className={cn(
                        'border rounded-lg px-3 py-1.5 text-center min-w-[80px] transition-colors cursor-pointer',
                        fleetFilter === s.key ? s.active : s.base
                      )}
                    >
                      <div className="text-xs font-medium opacity-80">{s.label}</div>
                      <div className="text-xl font-bold">{s.value}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )
        })()}

        {/* Download buttons */}
        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" disabled={downloading || (tab === 'fleet' && !fleetQuery.data?.data)} onClick={() => handleDownload('csv')} className="gap-1.5">
            <Download size={14} />CSV
          </Button>
          <Button variant="outline" size="sm" disabled={downloading || (tab === 'fleet' && !fleetQuery.data?.data)} onClick={() => handleDownload('pdf')} className="gap-1.5">
            <Download size={14} />PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      {tab === 'daily'        && <DailyTable        rows={filteredDaily}                    loading={dailyQuery.isLoading} />}
      {tab === 'summary'      && <SummaryTable      rows={filteredSummary}                  loading={summaryQuery.isLoading} />}
      {tab === 'fleet'        && <DailyFleetTable   report={fleetQuery.data?.data}          filter={fleetFilter} loading={fleetQuery.isLoading} />}
      {tab === 'role-summary' && <RoleSummaryTable  rows={roleSummaryQuery.data?.data ?? []} loading={roleSummaryQuery.isLoading} />}
    </div>
  )
}
