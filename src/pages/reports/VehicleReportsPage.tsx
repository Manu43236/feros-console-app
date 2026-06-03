import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Truck, Fuel, Wrench, AlertTriangle, FileText, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type {
  FleetStatusRow, VehicleUtilizationRow, FuelMileageRow,
  BreakdownReportRow, DocumentExpiryRow, MaintenanceServiceRow,
} from '@/types'

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
  { key: 'fleet-status',    label: 'Fleet Status',      icon: Truck         },
  { key: 'utilization',     label: 'Utilization',       icon: BarChart2     },
  { key: 'fuel-mileage',    label: 'Fuel & Mileage',    icon: Fuel          },
  { key: 'breakdowns',      label: 'Breakdowns',        icon: AlertTriangle },
  { key: 'doc-expiry',      label: 'Document Expiry',   icon: FileText      },
  { key: 'maintenance',     label: 'Maintenance',       icon: Wrench        },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

// ── Status badges ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:   'bg-green-100 text-green-700',
  ASSIGNED:    'bg-blue-100 text-blue-700',
  ON_TRIP:     'bg-orange-100 text-orange-700',
  IN_REPAIR:   'bg-yellow-100 text-yellow-700',
  BREAKDOWN:   'bg-red-100 text-red-700',
  PENDING:     'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-gray-100 text-gray-600',
  OPEN:        'bg-red-100 text-red-700',
  RESOLVED:    'bg-green-100 text-green-700',
}
function Badge({ label }: { label: string }) {
  const cls = STATUS_COLORS[label] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label.replace(/_/g, ' ')}</span>
}
function ExpiryBadge({ status }: { status: 'GREEN' | 'AMBER' | 'RED' }) {
  const cls = { GREEN: 'bg-green-100 text-green-700', AMBER: 'bg-amber-100 text-amber-700', RED: 'bg-red-100 text-red-700' }[status]
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
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
const fmtRupee = (v: number | null) => v != null ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'
const fmtNum = (v: number | null, dec = 2) => v != null ? v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'

// ── Table renderers ────────────────────────────────────────────────────────────
function FleetTable({ rows, loading }: { rows: FleetStatusRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Type', 'Ownership', 'Status', 'Driver', 'Cleaner', 'Trip Scope']}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.vehicleType), dash(r.ownershipType),
      <Badge label={r.currentStatus} />,
      dash(r.currentDriverName), dash(r.currentCleanerName), dash(r.tripScope),
    ])}
  />
}

function UtilizationTable({ rows, loading }: { rows: VehicleUtilizationRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Type', 'Total Trips', 'Days On Trip', 'Total Days', 'Utilization %', 'Last Trip']}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.vehicleType),
      r.totalTrips, r.daysOnTrip, r.totalDaysInPeriod,
      <span className={r.utilizationPercent >= 70 ? 'text-green-700 font-medium' : r.utilizationPercent >= 40 ? 'text-amber-600 font-medium' : 'text-red-600 font-medium'}>
        {r.utilizationPercent}%
      </span>,
      dash(r.lastTripDate),
    ])}
  />
}

function FuelMileageTable({ rows, loading }: { rows: FuelMileageRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Type', 'Fill Ups', 'Total Litres', 'Total Cost', 'Opening KM', 'Closing KM', 'Total KM', 'Mileage (km/L)']}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.vehicleType), r.fillCount,
      fmtNum(r.totalLitresFilled, 1) + (r.totalLitresFilled != null ? ' L' : ''),
      fmtRupee(r.totalFuelCost),
      fmtNum(r.openingOdometer, 0), fmtNum(r.closingOdometer, 0),
      fmtNum(r.totalKm, 0), fmtNum(r.mileageKmPerLitre),
    ])}
  />
}

function BreakdownsTable({ rows, loading }: { rows: BreakdownReportRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Type', 'Date', 'Location', 'Breakdown Type', 'Reason', 'Status', 'Days Lost', 'Reported By']}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.vehicleType),
      r.breakdownDate ? r.breakdownDate.split('T')[0] : '—',
      dash(r.location), <Badge label={r.breakdownType} />,
      dash(r.reason), <Badge label={r.status} />,
      r.daysLost != null ? r.daysLost : <span className="text-amber-600 font-medium">Ongoing</span>,
      dash(r.reportedBy),
    ])}
  />
}

function DocExpiryTable({ rows, loading }: { rows: DocumentExpiryRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Type', 'Document', 'Doc No.', 'Expiry Date', 'Days Left', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.vehicleType), r.documentType,
      dash(r.documentNumber), r.expiryDate,
      <span className={r.daysLeft < 0 ? 'text-red-600 font-medium' : r.daysLeft <= 30 ? 'text-amber-600 font-medium' : 'text-gray-700'}>
        {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d`}
      </span>,
      <ExpiryBadge status={r.expiryStatus} />,
    ])}
  />
}

function MaintenanceTable({ rows, loading }: { rows: MaintenanceServiceRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Type', 'Service No.', 'Service Date', 'Completed', 'Type', 'Triggered By', 'Tasks', 'Cost', 'Status', 'Vendor', 'Next Due KM']}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.vehicleType), dash(r.serviceNumber), dash(r.serviceDate), dash(r.completedDate),
      <Badge label={r.serviceType} />, <Badge label={r.triggeredBy} />,
      r.taskCount, fmtRupee(r.totalCost), <Badge label={r.status} />,
      dash(r.vendorName),
      r.nextServiceDueOdometer != null ? `${r.nextServiceDueOdometer.toLocaleString('en-IN')} km` : '—',
    ])}
  />
}

const STATUS_ORDER = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'IN_REPAIR', 'BREAKDOWN', 'OTHER']

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function VehicleReportsPage() {
  const [tab, setTab] = useState<TabKey>('fleet-status')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [singleDate, setSingleDate] = useState(todayStr())
  const [days, setDays] = useState(30)
  const [downloading, setDownloading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')

  function handleTabChange(key: TabKey) {
    setTab(key)
    setStatusFilter('ALL')
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());      setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart()); setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  // ── Queries (only active tab fetches) ──
  const fleetQuery = useQuery({
    queryKey: ['report-fleet-status', singleDate],
    queryFn: () => reportsApi.getFleetStatus(singleDate),
    enabled: tab === 'fleet-status',
  })
  const utilizationQuery = useQuery({
    queryKey: ['report-utilization', startDate, endDate],
    queryFn: () => reportsApi.getVehicleUtilization(startDate, endDate),
    enabled: tab === 'utilization',
  })
  const fuelQuery = useQuery({
    queryKey: ['report-fuel-mileage', startDate, endDate],
    queryFn: () => reportsApi.getFuelMileage(startDate, endDate),
    enabled: tab === 'fuel-mileage',
  })
  const breakdownQuery = useQuery({
    queryKey: ['report-breakdowns', startDate, endDate],
    queryFn: () => reportsApi.getBreakdowns(startDate, endDate),
    enabled: tab === 'breakdowns',
  })
  const docExpiryQuery = useQuery({
    queryKey: ['report-doc-expiry', days],
    queryFn: () => reportsApi.getDocumentExpiry(days),
    enabled: tab === 'doc-expiry',
  })
  const maintenanceQuery = useQuery({
    queryKey: ['report-maintenance', startDate, endDate],
    queryFn: () => reportsApi.getMaintenanceService(startDate, endDate),
    enabled: tab === 'maintenance',
  })

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if (tab === 'fleet-status') await reportsApi.exportFleetStatus(singleDate, format)
      else if (tab === 'utilization') await reportsApi.exportVehicleUtilization(startDate, endDate, format)
      else if (tab === 'fuel-mileage') await reportsApi.exportFuelMileage(startDate, endDate, format)
      else if (tab === 'breakdowns') await reportsApi.exportBreakdowns(startDate, endDate, format)
      else if (tab === 'doc-expiry') await reportsApi.exportDocumentExpiry(days, format)
      else if (tab === 'maintenance') await reportsApi.exportMaintenanceService(startDate, endDate, format)
    } catch {
      toast.error('Export failed')
    } finally {
      setDownloading(false)
    }
  }

  const usesDateRange = tab !== 'fleet-status' && tab !== 'doc-expiry'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fleet analytics and insights</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap bg-white border rounded-xl p-1.5">
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
        {/* Fleet Status — date + status filter */}
        {tab === 'fleet-status' && (() => {
          const allRows = fleetQuery.data?.data ?? []
          const counts = allRows.reduce<Record<string, number>>((acc, r) => {
            acc[r.currentStatus] = (acc[r.currentStatus] ?? 0) + 1
            return acc
          }, {})
          const statusOptions = [
            { value: 'ALL', label: `All (${allRows.length})` },
            ...[...STATUS_ORDER, ...Object.keys(counts).filter(s => !STATUS_ORDER.includes(s))]
              .filter(s => counts[s] != null)
              .map(s => ({ value: s, label: `${s.replace(/_/g, ' ')} (${counts[s]})` })),
          ]
          return (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <Input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )
        })()}

        {/* Document Expiry — days ahead */}
        {tab === 'doc-expiry' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Expiring within (days)</label>
            <Input
              type="number" min={1} max={365} value={days}
              onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 30))}
              className="w-28"
            />
          </div>
        )}

        {/* Date range reports */}
        {usesDateRange && (
          <>
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
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
                </div>
                <span className="pb-2 text-gray-400 text-sm">→</span>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
                </div>
              </div>
            )}
            {preset !== 'custom' && (
              <div className="pb-1 text-xs text-gray-400">
                {startDate} → {endDate}
              </div>
            )}
          </>
        )}

        {/* Download buttons */}
        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('csv')} className="gap-1.5">
            <Download size={14} />
            CSV
          </Button>
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('pdf')} className="gap-1.5">
            <Download size={14} />
            PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      {tab === 'fleet-status'  && <FleetTable
        rows={(fleetQuery.data?.data ?? []).filter(r => statusFilter === 'ALL' || r.currentStatus === statusFilter)}
        loading={fleetQuery.isLoading}
      />}
      {tab === 'utilization'   && <UtilizationTable rows={utilizationQuery.data?.data ?? []} loading={utilizationQuery.isLoading} />}
      {tab === 'fuel-mileage'  && <FuelMileageTable rows={fuelQuery.data?.data ?? []}        loading={fuelQuery.isLoading} />}
      {tab === 'breakdowns'    && <BreakdownsTable  rows={breakdownQuery.data?.data ?? []}   loading={breakdownQuery.isLoading} />}
      {tab === 'doc-expiry'    && <DocExpiryTable   rows={docExpiryQuery.data?.data ?? []}   loading={docExpiryQuery.isLoading} />}
      {tab === 'maintenance'   && <MaintenanceTable rows={maintenanceQuery.data?.data ?? []} loading={maintenanceQuery.isLoading} />}
    </div>
  )
}
