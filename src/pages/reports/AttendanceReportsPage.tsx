import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Users, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { AttendanceDailyRow, AttendanceSummaryRow } from '@/types'

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
  { key: 'daily',   label: 'Daily Register',  icon: ClipboardList },
  { key: 'summary', label: 'Monthly Summary', icon: Users },
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
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (rows.length === 0) return (
    <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  )
  return (
    <div className="overflow-x-auto rounded-lg border">
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AttendanceReportsPage() {
  const [tab, setTab] = useState<TabKey>('daily')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [downloading, setDownloading] = useState(false)
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')

  function handleTabChange(key: TabKey) {
    setTab(key)
    setVehicleFilter('ALL')
    setRoleFilter('ALL')
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

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if (tab === 'daily')   await reportsApi.exportAttendanceDaily(startDate, endDate, format)
      else                   await reportsApi.exportAttendanceSummary(startDate, endDate, format)
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
        {/* Vehicle filter */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
          <SearchableSelect
            value={vehicleFilter}
            onValueChange={setVehicleFilter}
            options={vehicleOptions}
            className="w-52"
          />
        </div>

        {/* Role filter */}
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

        {/* Download buttons */}
        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('csv')} className="gap-1.5">
            <Download size={14} />CSV
          </Button>
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('pdf')} className="gap-1.5">
            <Download size={14} />PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      {tab === 'daily'   && <DailyTable   rows={filteredDaily}   loading={dailyQuery.isLoading} />}
      {tab === 'summary' && <SummaryTable rows={filteredSummary} loading={summaryQuery.isLoading} />}
    </div>
  )
}
