import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileText, AlertTriangle, Clock, Truck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { LrRegisterRow, WeightDiscrepancyRow, DelayedDeliveryRow, VehicleTripSummaryRow, ClientTripSummaryRow } from '@/types'

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
  { key: 'lr-register',        label: 'LR Register',        icon: FileText },
  { key: 'weight-discrepancy', label: 'Weight Discrepancy',  icon: AlertTriangle },
  { key: 'delayed-deliveries', label: 'Delayed Deliveries',  icon: Clock },
  { key: 'vehicle-summary',    label: 'Vehicle Summary',     icon: Truck },
  { key: 'client-summary',     label: 'Client Summary',      icon: Users },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

// ── Status badges ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  CREATED:      'bg-gray-100 text-gray-600',
  WEIGHT_LOADED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT:   'bg-amber-100 text-amber-700',
  DELIVERED:    'bg-green-100 text-green-700',
  CANCELLED:    'bg-red-100 text-red-700',
}
function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status.replace(/_/g, ' ')}</span>
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
function fmtDateTime(dt: string | null | undefined) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

// ── Table renderers ────────────────────────────────────────────────────────────
function LrRegisterTable({ rows, loading }: { rows: LrRegisterRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['LR No.', 'LR Date', 'Order No.', 'Client', 'Vehicle', 'Driver', 'Cleaner',
      'From', 'To', 'Material', 'Alloc. Wt', 'Loaded Wt', 'Delivered Wt', 'Variance',
      'Overloaded', 'Loaded At', 'Delivered At', 'E-Way Bill', 'Status', 'Remarks']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.lrNumber}</span>,
      r.lrDate,
      r.orderNumber,
      r.clientName,
      r.vehicleRegistrationNumber,
      r.driverName,
      r.cleanerName,
      `${r.fromCity}, ${r.fromState}`,
      `${r.toCity}, ${r.toState}`,
      r.materialType,
      dash(r.allocatedWeight),
      dash(r.loadedWeight),
      dash(r.deliveredWeight),
      r.weightVariance != null
        ? <span className={r.weightVariance < 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>{r.weightVariance}</span>
        : '—',
      r.isOverloaded
        ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Yes</span>
        : <span className="text-gray-400 text-xs">No</span>,
      fmtDateTime(r.loadedAt),
      fmtDateTime(r.deliveredAt),
      dash(r.ewayBillNumber),
      <StatusBadge status={r.lrStatus} />,
      dash(r.remarks),
    ])}
  />
}

function WeightDiscrepancyTable({ rows, loading }: { rows: WeightDiscrepancyRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['LR No.', 'LR Date', 'Client', 'Vehicle', 'From', 'To', 'Material',
      'Alloc. Wt', 'Loaded Wt', 'Delivered Wt', 'Variance', 'Overloaded', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.lrNumber}</span>,
      r.lrDate,
      r.clientName,
      r.vehicleRegistrationNumber,
      r.fromCity,
      r.toCity,
      r.materialType,
      dash(r.allocatedWeight),
      dash(r.loadedWeight),
      dash(r.deliveredWeight),
      r.weightVariance != null
        ? <span className={r.weightVariance < 0 ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'}>{r.weightVariance}</span>
        : '—',
      r.isOverloaded
        ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Yes</span>
        : <span className="text-gray-400 text-xs">No</span>,
      <StatusBadge status={r.lrStatus} />,
    ])}
  />
}

function DelayedDeliveriesTable({ rows, loading }: { rows: DelayedDeliveryRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['LR No.', 'LR Date', 'Client', 'Vehicle', 'Driver', 'From', 'To', 'Material', 'Loaded At', 'Days in Transit', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.lrNumber}</span>,
      r.lrDate,
      r.clientName,
      r.vehicleRegistrationNumber,
      r.driverName,
      r.fromCity,
      r.toCity,
      r.materialType,
      fmtDateTime(r.loadedAt),
      <span className={cn(
        'font-medium',
        r.daysInTransit >= 7 ? 'text-red-600' : r.daysInTransit >= 4 ? 'text-amber-600' : 'text-gray-700'
      )}>{r.daysInTransit} days</span>,
      <StatusBadge status={r.lrStatus} />,
    ])}
  />
}

function VehicleSummaryTable({ rows, loading }: { rows: VehicleTripSummaryRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Type', 'Total Trips', 'Completed', 'In Transit', 'Cancelled',
      'Total Alloc. Wt', 'Total Loaded Wt', 'Total Delivered Wt']}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      <span className="text-xs text-gray-500">{r.vehicleType}</span>,
      <span className="font-medium">{r.totalTrips}</span>,
      <span className="text-green-700 font-medium">{r.completedTrips}</span>,
      <span className={r.inTransitTrips > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{r.inTransitTrips}</span>,
      <span className={r.cancelledTrips > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{r.cancelledTrips}</span>,
      dash(r.totalAllocatedWeight),
      dash(r.totalLoadedWeight),
      dash(r.totalDeliveredWeight),
    ])}
  />
}

function ClientSummaryTable({ rows, loading }: { rows: ClientTripSummaryRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Client', 'Total Trips', 'Completed', 'In Transit', 'Cancelled',
      'Total Alloc. Wt', 'Total Loaded Wt', 'Total Delivered Wt']}
    rows={rows.map(r => [
      <span className="font-medium">{r.clientName}</span>,
      <span className="font-medium">{r.totalTrips}</span>,
      <span className="text-green-700 font-medium">{r.completedTrips}</span>,
      <span className={r.inTransitTrips > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{r.inTransitTrips}</span>,
      <span className={r.cancelledTrips > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{r.cancelledTrips}</span>,
      dash(r.totalAllocatedWeight),
      dash(r.totalLoadedWeight),
      dash(r.totalDeliveredWeight),
    ])}
  />
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TripReportsPage() {
  const [tab, setTab] = useState<TabKey>('lr-register')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [downloading, setDownloading] = useState(false)
  const [clientFilter, setClientFilter] = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [thresholdDays, setThresholdDays] = useState(3)

  function handleTabChange(key: TabKey) {
    setTab(key)
    setClientFilter('ALL')
    setVehicleFilter('ALL')
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());       setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart());  setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  // ── Queries ──
  const lrRegisterQuery = useQuery({
    queryKey: ['report-lr-register', startDate, endDate],
    queryFn: () => reportsApi.getLrRegister(startDate, endDate),
    enabled: tab === 'lr-register',
  })
  const weightDiscrepancyQuery = useQuery({
    queryKey: ['report-weight-discrepancy', startDate, endDate],
    queryFn: () => reportsApi.getWeightDiscrepancy(startDate, endDate),
    enabled: tab === 'weight-discrepancy',
  })
  const delayedQuery = useQuery({
    queryKey: ['report-delayed-deliveries', startDate, endDate, thresholdDays],
    queryFn: () => reportsApi.getDelayedDeliveries(startDate, endDate, thresholdDays),
    enabled: tab === 'delayed-deliveries',
  })
  const vehicleSummaryQuery = useQuery({
    queryKey: ['report-vehicle-trip-summary', startDate, endDate],
    queryFn: () => reportsApi.getVehicleTripSummary(startDate, endDate),
    enabled: tab === 'vehicle-summary',
  })
  const clientSummaryQuery = useQuery({
    queryKey: ['report-client-trip-summary', startDate, endDate],
    queryFn: () => reportsApi.getClientTripSummary(startDate, endDate),
    enabled: tab === 'client-summary',
  })

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if (tab === 'lr-register') {
        const clientId = clientFilter !== 'ALL' ? Number(clientFilter) : undefined
        await reportsApi.exportLrRegister(startDate, endDate, format, clientId)
      } else if (tab === 'weight-discrepancy') {
        await reportsApi.exportWeightDiscrepancy(startDate, endDate, format)
      } else if (tab === 'delayed-deliveries') {
        await reportsApi.exportDelayedDeliveries(startDate, endDate, thresholdDays, format)
      } else if (tab === 'vehicle-summary') {
        await reportsApi.exportVehicleTripSummary(startDate, endDate, format)
      } else {
        await reportsApi.exportClientTripSummary(startDate, endDate, format)
      }
    } catch {
      toast.error('Export failed')
    } finally {
      setDownloading(false)
    }
  }

  // ── Derive filter options from active tab data ──
  const lrRows           = lrRegisterQuery.data?.data ?? []
  const weightRows       = weightDiscrepancyQuery.data?.data ?? []
  const delayedRows      = delayedQuery.data?.data ?? []

  const activeRows: { vehicleRegistrationNumber: string; clientName: string }[] =
    tab === 'lr-register' ? lrRows :
    tab === 'weight-discrepancy' ? weightRows : delayedRows

  const vehicles = Array.from(new Set(
    activeRows.map(r => r.vehicleRegistrationNumber).filter(v => v && v !== '—')
  )).sort()
  const vehicleOptions = [
    { value: 'ALL', label: `All Vehicles (${activeRows.length})` },
    ...vehicles.map(v => ({ value: v, label: v })),
  ]

  const clients = Array.from(new Set(
    lrRows.map(r => r.clientName).filter(Boolean)
  )).sort()
  const clientOptions = [
    { value: 'ALL', label: `All Clients (${lrRows.length})` },
    ...clients.map(c => ({ value: c, label: c })),
  ]

  // ── Apply filters ──
  const filteredLrRows = lrRows.filter(r =>
    (clientFilter === 'ALL' || r.clientName === clientFilter) &&
    (vehicleFilter === 'ALL' || r.vehicleRegistrationNumber === vehicleFilter)
  )
  const filteredWeightRows = weightRows.filter(r =>
    vehicleFilter === 'ALL' || r.vehicleRegistrationNumber === vehicleFilter
  )
  const filteredDelayedRows = delayedRows.filter(r =>
    vehicleFilter === 'ALL' || r.vehicleRegistrationNumber === vehicleFilter
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trip Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">LR register, weight discrepancy & delayed deliveries</p>
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
        {/* Vehicle filter — detail tabs only */}
        {tab !== 'client-summary' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
            <SearchableSelect
              value={vehicleFilter}
              onValueChange={setVehicleFilter}
              options={vehicleOptions}
              className="w-52"
            />
          </div>
        )}

        {/* Client filter — only on LR Register */}
        {tab === 'lr-register' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
            <SearchableSelect
              value={clientFilter}
              onValueChange={setClientFilter}
              options={clientOptions}
              className="w-44"
            />
          </div>
        )}

        {/* Threshold filter — only on Delayed Deliveries */}
        {tab === 'delayed-deliveries' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min. Days in Transit</label>
            <select
              value={thresholdDays}
              onChange={e => setThresholdDays(Number(e.target.value))}
              className="h-9 border rounded-md px-2 text-sm"
            >
              {[1, 2, 3, 5, 7, 10, 14].map(d => (
                <option key={d} value={d}>{d}+ days</option>
              ))}
            </select>
          </div>
        )}

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

      {/* Tables */}
      {tab === 'lr-register'        && <LrRegisterTable        rows={filteredLrRows}                              loading={lrRegisterQuery.isLoading} />}
      {tab === 'weight-discrepancy' && <WeightDiscrepancyTable rows={filteredWeightRows}                          loading={weightDiscrepancyQuery.isLoading} />}
      {tab === 'delayed-deliveries' && <DelayedDeliveriesTable rows={filteredDelayedRows}                         loading={delayedQuery.isLoading} />}
      {tab === 'vehicle-summary'    && <VehicleSummaryTable    rows={vehicleSummaryQuery.data?.data ?? []}        loading={vehicleSummaryQuery.isLoading} />}
      {tab === 'client-summary'     && <ClientSummaryTable     rows={clientSummaryQuery.data?.data ?? []}         loading={clientSummaryQuery.isLoading} />}
    </div>
  )
}
