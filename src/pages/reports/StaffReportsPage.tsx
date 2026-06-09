import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, UserCheck, Users, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { DriverPerformanceRow, CleanerPerformanceRow, MechanicPerformanceRow } from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const thisWeekStart = () => {
  const d = new Date(); const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(new Date(d).setDate(diff)).toISOString().split('T')[0]
}
const thisMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const TABS = [
  { key: 'drivers',   label: 'Driver Performance',   icon: UserCheck },
  { key: 'cleaners',  label: 'Cleaner Performance',  icon: Users },
  { key: 'mechanics', label: 'Mechanic Performance', icon: Wrench },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

function ReportTable({ headers, rows, loading }: {
  headers: string[]; rows: React.ReactNode[][]; loading: boolean
}) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (rows.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead>
          <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white whitespace-nowrap bg-feros-navy">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{cell}</td>)}
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

const dash = (v: unknown) => (v != null && v !== '' ? String(v) : '—')

function PctBadge({ pct }: { pct?: number }) {
  if (pct == null) return <span className="text-gray-400">—</span>
  const color = pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-amber-700' : 'text-red-700'
  return <span className={`font-medium ${color}`}>{pct}%</span>
}

function DriverTable({ rows, loading }: { rows: DriverPerformanceRow[]; loading: boolean }) {
  return (
    <ReportTable loading={loading}
      headers={['Driver', 'Trips', 'Weight (T)', 'Delivered', 'On Time', 'On-Time %', 'Present Days', 'Attendance Days', 'Attendance %']}
      rows={rows.map(r => [
        <span className="font-medium text-feros-navy">{r.driverName}</span>,
        <span className="font-medium">{r.totalTrips}</span>,
        dash(r.totalWeight),
        r.deliveredTrips,
        r.onTimeDeliveries,
        <PctBadge pct={r.onTimePct} />,
        r.presentDays,
        r.totalAttendanceDays,
        <PctBadge pct={r.attendancePct} />,
      ])}
    />
  )
}

function CleanerTable({ rows, loading }: { rows: CleanerPerformanceRow[]; loading: boolean }) {
  return (
    <ReportTable loading={loading}
      headers={['Cleaner', 'Trips', 'Weight (T)', 'Present Days', 'Attendance Days', 'Attendance %']}
      rows={rows.map(r => [
        <span className="font-medium text-feros-navy">{r.cleanerName}</span>,
        <span className="font-medium">{r.totalTrips}</span>,
        dash(r.totalWeight),
        r.presentDays,
        r.totalAttendanceDays,
        <PctBadge pct={r.attendancePct} />,
      ])}
    />
  )
}

function MechanicTable({ rows, loading }: { rows: MechanicPerformanceRow[]; loading: boolean }) {
  return (
    <ReportTable loading={loading}
      headers={['Mechanic', 'Designation', 'Tasks Assigned', 'Completed', 'Mech. Closed', 'In Progress', 'Services', 'Avg Duration']}
      rows={rows.map(r => [
        <span className="font-medium text-feros-navy">{r.mechanicName}</span>,
        dash(r.designation),
        <span className="font-medium">{r.tasksAssigned}</span>,
        <span className="text-green-700 font-medium">{r.tasksCompleted}</span>,
        <span className="text-purple-700">{r.tasksMechanicClosed}</span>,
        <span className="text-orange-600">{r.tasksInProgress}</span>,
        r.servicesWorkedOn,
        r.avgDurationMinutes != null
          ? <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium">{r.avgDurationMinutes} min</span>
          : <span className="text-gray-400">—</span>,
      ])}
    />
  )
}

export default function StaffReportsPage() {
  const [tab, setTab]         = useState<TabKey>('drivers')
  const [preset, setPreset]   = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate,   setEndDate]   = useState(todayStr())
  const [downloading, setDownloading] = useState(false)

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());       setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart());  setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  const driverQuery = useQuery({
    queryKey: ['report-driver-performance', startDate, endDate],
    queryFn: () => reportsApi.getDriverPerformance(startDate, endDate),
    enabled: tab === 'drivers',
  })
  const cleanerQuery = useQuery({
    queryKey: ['report-cleaner-performance', startDate, endDate],
    queryFn: () => reportsApi.getCleanerPerformance(startDate, endDate),
    enabled: tab === 'cleaners',
  })
  const mechanicQuery = useQuery({
    queryKey: ['report-mechanic-performance', startDate, endDate],
    queryFn: () => reportsApi.getMechanicPerformance(startDate, endDate),
    enabled: tab === 'mechanics',
  })

  const driverRows   = driverQuery.data?.data   ?? []
  const cleanerRows  = cleanerQuery.data?.data  ?? []
  const mechanicRows = mechanicQuery.data?.data ?? []

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if (tab === 'drivers')   await reportsApi.exportDriverPerformance(startDate, endDate, format)
      else if (tab === 'cleaners')  await reportsApi.exportCleanerPerformance(startDate, endDate, format)
      else                          await reportsApi.exportMechanicPerformance(startDate, endDate, format)
    } catch { toast.error('Export failed') }
    finally  { setDownloading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Performance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Driver and cleaner performance by trip activity and attendance</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-white border rounded-xl p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key ? 'bg-feros-navy text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
          <div className="flex gap-1">
            {(['today', 'this-week', 'this-month', 'custom'] as DatePreset[]).map(p => (
              <button key={p} onClick={() => applyPreset(p)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
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

        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('csv')} className="gap-1.5">
            <Download size={14} />CSV
          </Button>
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('pdf')} className="gap-1.5">
            <Download size={14} />PDF
          </Button>
        </div>
      </div>

      {tab === 'drivers'   && <DriverTable   rows={driverRows}   loading={driverQuery.isLoading} />}
      {tab === 'cleaners'  && <CleanerTable  rows={cleanerRows}  loading={cleanerQuery.isLoading} />}
      {tab === 'mechanics' && <MechanicTable rows={mechanicRows} loading={mechanicQuery.isLoading} />}
    </div>
  )
}
