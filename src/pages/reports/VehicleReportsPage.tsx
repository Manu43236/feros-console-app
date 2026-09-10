import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Truck, Fuel, Wrench, AlertTriangle, FileText, ClipboardList, CalendarCheck, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import { downloadDailyFleetAttendancePdf, downloadFleetStatusPdf, downloadTripSummaryPdf } from './DailyFleetAttendancePdf'
import type {
  VehicleMasterRow, FleetStatusRow, FuelMileageRow,
  BreakdownReportRow, DocumentExpiryRow, MaintenanceServiceRow,
  DailyFleetAttendanceReport, TripSummaryRow,
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
  { key: 'vehicle-master',  label: 'Vehicle Master',       icon: ClipboardList  },
  { key: 'fleet-status',    label: 'Fleet Status',         icon: Truck          },
  { key: 'fuel-mileage',    label: 'Fuel & Mileage',       icon: Fuel           },
  { key: 'breakdowns',      label: 'Breakdowns',           icon: AlertTriangle  },
  { key: 'doc-expiry',      label: 'Document Expiry',      icon: FileText       },
  { key: 'maintenance',     label: 'Maintenance',          icon: Wrench         },
  { key: 'daily-fleet',     label: 'Daily Attendance',     icon: CalendarCheck  },
  { key: 'trip-summary',    label: 'Trip Summary',         icon: Route          },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

// ── Status badges ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:              'bg-green-100 text-green-700',
  ASSIGNED:               'bg-blue-100 text-blue-700',
  ON_TRIP:                'bg-orange-100 text-orange-700',
  IN_REPAIR:              'bg-yellow-100 text-yellow-700',
  'BREAKDOWN IN REPAIR':  'bg-red-100 text-red-700',
  'MAINTENANCE IN REPAIR':'bg-yellow-100 text-yellow-700',
  BREAKDOWN:              'bg-red-100 text-red-700',
  PENDING:                'bg-yellow-100 text-yellow-700',
  IN_PROGRESS:            'bg-blue-100 text-blue-700',
  COMPLETED:              'bg-green-100 text-green-700',
  CANCELLED:              'bg-gray-100 text-gray-600',
  OPEN:                   'bg-red-100 text-red-700',
  RESOLVED:               'bg-green-100 text-green-700',
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
function VehicleMasterTable({ rows, loading }: { rows: VehicleMasterRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={[
      'Vehicle No.', 'Brand', 'Model', 'Type', 'Fuel Type', 'Ownership', 'Status',
      'Capacity (T)', 'GVW', 'Mfg Year', 'Tank Cap.',
      'Chassis No.', 'Engine No.',
      'RC No.', 'RC Expiry', 'Insurance No.', 'Insurance Expiry', 'Permit Expiry', 'Fitness Expiry', 'PUC No.', 'PUC Expiry', 'Road Tax Expiry',
      'Financed', 'Financer', 'Finance From', 'Finance To', 'IoT',
    ]}
    rows={rows.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.brand), dash(r.model), dash(r.vehicleType), dash(r.fuelType), dash(r.ownershipType),
      r.currentStatus ? <Badge label={r.currentStatus} /> : <span>—</span>,
      r.capacityInTons != null ? `${r.capacityInTons} T` : '—',
      r.grossVehicleWeight != null ? `${r.grossVehicleWeight} T` : '—',
      dash(r.manufactureYear),
      r.fuelTankCapacity != null ? `${r.fuelTankCapacity} L` : '—',
      dash(r.chassisNumber), dash(r.engineNumber),
      dash(r.rcNumber), dash(r.rcExpiry),
      dash(r.insuranceNumber), dash(r.insuranceExpiry),
      dash(r.permitExpiry), dash(r.fitnessExpiry),
      dash(r.pucNumber), dash(r.pucExpiry),
      dash(r.roadTaxExpiry),
      r.isFinanced
        ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Yes</span>
        : <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">No</span>,
      dash(r.financerName),
      dash(r.financeFrom), dash(r.financeTo),
      r.isIot
        ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Yes</span>
        : <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">No</span>,
    ])}
  />
}

function fleetStatusLabel(r: FleetStatusRow) {
  if (r.currentStatus === 'IN_REPAIR') {
    return r.inRepairType === 'BREAKDOWN' ? 'BREAKDOWN IN REPAIR' : 'MAINTENANCE IN REPAIR'
  }
  return r.currentStatus
}

function FleetTable({ rows, loading }: { rows: FleetStatusRow[]; loading: boolean }) {
  const sorted = [...rows].sort((a, b) => (a.vehicleType ?? '').localeCompare(b.vehicleType ?? ''))
  return <ReportTable
    loading={loading}
    headers={['Vehicle No.', 'Tyre Type', 'Status']}
    rows={sorted.map(r => [
      <span className="font-medium">{r.registrationNumber}</span>,
      dash(r.vehicleType),
      <Badge label={fleetStatusLabel(r)} />,
    ])}
  />
}


const fmtDT = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function TripSummaryTable({ rows, loading }: { rows: TripSummaryRow[]; loading: boolean }) {
  return <ReportTable
    loading={loading}
    headers={['Order No.', 'Order Created', 'Material', 'LR No.', 'LR Created', 'Vehicle No.', 'Vehicle Assigned', 'Trip Start', 'Trip End', 'Driver']}
    rows={rows.map(r => [
      <span className="font-medium">{r.orderNumber}</span>,
      fmtDT(r.orderCreatedAt),
      dash(r.material),
      <span className="font-medium">{r.lrNumber}</span>,
      fmtDT(r.lrCreatedAt),
      r.registrationNumber,
      fmtDT(r.vehicleAssignedAt),
      fmtDT(r.tripStartTime),
      fmtDT(r.tripEndTime),
      r.driverName,
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

const STATUS_ORDER = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'IN_REPAIR', 'BREAKDOWN', 'ON_LEASE', 'OTHER']

const STATUS_CHIP_COLORS: Record<string, { base: string; active: string }> = {
  AVAILABLE:               { base: 'bg-green-50 text-green-700 border-green-200',    active: 'bg-green-700 text-white border-green-700' },
  ASSIGNED:                { base: 'bg-blue-50 text-blue-700 border-blue-200',       active: 'bg-blue-700 text-white border-blue-700' },
  ON_TRIP:                 { base: 'bg-orange-50 text-orange-700 border-orange-200', active: 'bg-orange-700 text-white border-orange-700' },
  IN_REPAIR_BREAKDOWN:     { base: 'bg-red-50 text-red-700 border-red-200',          active: 'bg-red-700 text-white border-red-700' },
  IN_REPAIR_MAINTENANCE:   { base: 'bg-yellow-50 text-yellow-700 border-yellow-200', active: 'bg-yellow-700 text-white border-yellow-700' },
  BREAKDOWN:               { base: 'bg-red-50 text-red-700 border-red-200',          active: 'bg-red-700 text-white border-red-700' },
  ON_LEASE:                { base: 'bg-purple-50 text-purple-700 border-purple-200', active: 'bg-purple-700 text-white border-purple-700' },
  OTHER:                   { base: 'bg-gray-50 text-gray-600 border-gray-200',       active: 'bg-gray-600 text-white border-gray-600' },
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function VehicleReportsPage() {
  const [tab, setTab] = useState<TabKey>('vehicle-master')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [days, setDays] = useState(30)
  const [downloading, setDownloading] = useState(false)
  const [fleetDate, setFleetDate] = useState(todayStr())
  const [fleetScope, setFleetScope] = useState<'INTRA_STATE' | 'INTER_STATE'>('INTRA_STATE')
  const [fleetFilter, setFleetFilter] = useState<'all' | 'drivers' | 'cleaners' | 'unassigned' | 'empty'>('all')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('ALL')
  const [orderNumberFilter, setOrderNumberFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [fuelTypeFilter, setFuelTypeFilter] = useState('ALL')
  const [ownershipFilter, setOwnershipFilter] = useState('ALL')
  const [iotFilter, setIotFilter] = useState('ALL')
  const [financeFilter, setFinanceFilter] = useState('ALL')

  function handleTabChange(key: TabKey) {
    setTab(key)
    setStatusFilter('ALL')
    setVehicleFilter('ALL')
    setBrandFilter('ALL')
    setFuelTypeFilter('ALL')
    setOwnershipFilter('ALL')
    setIotFilter('ALL')
    setFinanceFilter('ALL')
    setFleetFilter('all')
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());      setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart()); setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  // ── Queries (only active tab fetches) ──
  const vehicleMasterQuery = useQuery({
    queryKey: ['report-vehicle-master'],
    queryFn: () => reportsApi.getVehicleMaster(),
    enabled: tab === 'vehicle-master',
  })

  const fleetQuery = useQuery({
    queryKey: ['report-fleet-status'],
    queryFn: () => reportsApi.getFleetStatus(todayStr()),
    enabled: tab === 'fleet-status',
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

  const dailyFleetQuery = useQuery({
    queryKey: ['report-daily-fleet', fleetDate, fleetScope],
    queryFn: () => reportsApi.getDailyFleetAttendance(fleetDate, fleetScope),
    enabled: tab === 'daily-fleet',
  })

  const tripSummaryQuery = useQuery({
    queryKey: ['report-trip-summary', startDate, endDate, orderNumberFilter],
    queryFn: () => reportsApi.getTripSummary(startDate, endDate, orderNumberFilter || undefined),
    enabled: tab === 'trip-summary',
  })

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if (tab === 'vehicle-master') await reportsApi.exportVehicleMaster(format)
      else if (tab === 'fleet-status') {
        const allRows = fleetQuery.data?.data ?? []
        const filtered = allRows.filter(r => {
          if (statusFilter === 'ALL') return true
          if (statusFilter === 'IN_REPAIR_BREAKDOWN') return r.currentStatus === 'IN_REPAIR' && r.inRepairType === 'BREAKDOWN'
          if (statusFilter === 'IN_REPAIR_MAINTENANCE') return r.currentStatus === 'IN_REPAIR' && r.inRepairType !== 'BREAKDOWN'
          return r.currentStatus === statusFilter
        })
        const label = statusFilter !== 'ALL' ? statusFilter.replace(/_/g, ' ') : 'ALL'
        if (format === 'csv') {
          const header = ['#', 'Vehicle No.', 'Tyre Type', 'Status']
          const csvRows = filtered.map((r, i) => [i + 1, r.registrationNumber, r.vehicleType ?? '—', fleetStatusLabel(r)])
          const content = [header, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
          a.download = `fleet-status-${todayStr()}-${label.toLowerCase().replace(/ /g, '-')}.csv`
          a.click()
        } else {
          await downloadFleetStatusPdf(filtered, label, todayStr())
        }
      }
      else if (tab === 'fuel-mileage') await reportsApi.exportFuelMileage(startDate, endDate, format)
      else if (tab === 'breakdowns') await reportsApi.exportBreakdowns(startDate, endDate, format)
      else if (tab === 'doc-expiry') await reportsApi.exportDocumentExpiry(days, format)
      else if (tab === 'maintenance') await reportsApi.exportMaintenanceService(startDate, endDate, format)
      else if (tab === 'daily-fleet') {
        const report = dailyFleetQuery.data?.data
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
      else if (tab === 'trip-summary') {
        const rows = tripSummaryQuery.data?.data ?? []
        const header = ['#', 'Order No.', 'Order Created', 'Material', 'LR No.', 'LR Created', 'Vehicle No.', 'Vehicle Assigned', 'Trip Start', 'Trip End', 'Driver']
        const csvRows = rows.map((r, i) => [
          i + 1, r.orderNumber, fmtDT(r.orderCreatedAt), r.material,
          r.lrNumber, fmtDT(r.lrCreatedAt), r.registrationNumber,
          fmtDT(r.vehicleAssignedAt), fmtDT(r.tripStartTime), fmtDT(r.tripEndTime), r.driverName,
        ])
        if (format === 'csv') {
          const content = [header, ...csvRows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
          a.download = `trip-summary-${startDate}-${endDate}.csv`
          a.click()
        } else {
          await downloadTripSummaryPdf(rows, startDate, endDate)
        }
      }
    } catch {
      toast.error('Export failed')
    } finally {
      setDownloading(false)
    }
  }

  const usesDateRange = tab !== 'vehicle-master' && tab !== 'fleet-status' && tab !== 'doc-expiry' && tab !== 'daily-fleet'

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
        {/* Vehicle Master — multi-filter */}
        {tab === 'vehicle-master' && (() => {
          const allRows = vehicleMasterQuery.data?.data ?? []

          const uniqueOptions = (getter: (r: VehicleMasterRow) => string | null) => {
            const vals = Array.from(new Set(allRows.map(getter).filter(Boolean) as string[])).sort()
            return [{ value: 'ALL', label: `All (${allRows.length})` }, ...vals.map(v => ({ value: v, label: v }))]
          }

          const statusCounts = allRows.reduce<Record<string, number>>((acc, r) => {
            if (r.currentStatus) acc[r.currentStatus] = (acc[r.currentStatus] ?? 0) + 1
            return acc
          }, {})
          const statusOptions = [
            { value: 'ALL', label: `All (${allRows.length})` },
            ...[...STATUS_ORDER, ...Object.keys(statusCounts).filter(s => !STATUS_ORDER.includes(s))]
              .filter(s => statusCounts[s] != null)
              .map(s => ({ value: s, label: `${s.replace(/_/g, ' ')} (${statusCounts[s]})` })),
          ]

          return (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <SearchableSelect value={statusFilter} onValueChange={setStatusFilter}
                  options={statusOptions} showSearch={false} className="w-44" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                <SearchableSelect value={brandFilter} onValueChange={setBrandFilter}
                  options={uniqueOptions(r => r.brand)} className="w-40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fuel Type</label>
                <SearchableSelect value={fuelTypeFilter} onValueChange={setFuelTypeFilter}
                  options={uniqueOptions(r => r.fuelType)} showSearch={false} className="w-36" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ownership</label>
                <SearchableSelect value={ownershipFilter} onValueChange={setOwnershipFilter}
                  options={uniqueOptions(r => r.ownershipType)} showSearch={false} className="w-36" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">IoT</label>
                <SearchableSelect value={iotFilter} onValueChange={setIotFilter}
                  options={[{ value: 'ALL', label: 'All' }, { value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }]}
                  showSearch={false} className="w-28" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Finance</label>
                <SearchableSelect value={financeFilter} onValueChange={setFinanceFilter}
                  options={[{ value: 'ALL', label: 'All' }, { value: 'YES', label: 'Financed' }, { value: 'NO', label: 'Owned' }]}
                  showSearch={false} className="w-32" />
              </div>
            </>
          )
        })()}

        {/* Fleet Status — chip filters (always today, no date picker) */}
        {tab === 'fleet-status' && (() => {
          const allRows = fleetQuery.data?.data ?? []
          // count by chip key, splitting IN_REPAIR into two
          const counts: Record<string, number> = {}
          for (const r of allRows) {
            if (r.currentStatus === 'IN_REPAIR') {
              const key = r.inRepairType === 'BREAKDOWN' ? 'IN_REPAIR_BREAKDOWN' : 'IN_REPAIR_MAINTENANCE'
              counts[key] = (counts[key] ?? 0) + 1
            } else {
              counts[r.currentStatus] = (counts[r.currentStatus] ?? 0) + 1
            }
          }
          const CHIP_ORDER = ['AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'IN_REPAIR_BREAKDOWN', 'IN_REPAIR_MAINTENANCE', 'BREAKDOWN', 'ON_LEASE', 'OTHER']
          const CHIP_LABELS: Record<string, string> = {
            IN_REPAIR_BREAKDOWN:   'Breakdown In Repair',
            IN_REPAIR_MAINTENANCE: 'Maintenance In Repair',
          }
          const chips = [
            { value: 'ALL', label: 'All', count: allRows.length, colors: { base: 'bg-feros-navy/10 text-feros-navy border-feros-navy/20', active: 'bg-feros-navy text-white border-feros-navy' } },
            ...[...CHIP_ORDER, ...Object.keys(counts).filter(s => !CHIP_ORDER.includes(s))]
              .filter(s => counts[s] != null)
              .map(s => ({ value: s, label: CHIP_LABELS[s] ?? s.replace(/_/g, ' '), count: counts[s], colors: STATUS_CHIP_COLORS[s] ?? { base: 'bg-gray-50 text-gray-600 border-gray-200', active: 'bg-gray-600 text-white border-gray-600' } })),
          ]
          return (
            <div className="flex flex-wrap gap-2">
              {chips.map(c => (
                <button key={c.value} onClick={() => setStatusFilter(c.value)}
                  className={cn('border rounded-lg px-3 py-1.5 text-center min-w-[80px] transition-colors',
                    statusFilter === c.value ? c.colors.active : c.colors.base)}>
                  <div className="text-xs font-medium opacity-80">{c.label}</div>
                  <div className="text-xl font-bold">{c.count}</div>
                </button>
              ))}
            </div>
          )
        })()}

        {/* Daily Fleet Attendance controls */}
        {tab === 'daily-fleet' && (() => {
          const report = dailyFleetQuery.data?.data
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
              {report && (() => {
                const stats: { label: string; value: number; key: typeof fleetFilter; base: string; active: string }[] = [
                  { label: 'Total Vehicles', value: report.totalVehicles, key: 'all',        base: 'bg-blue-50 text-blue-700 border-blue-200',  active: 'bg-blue-700 text-white border-blue-700' },
                  { label: 'Drivers',        value: report.drivers,       key: 'drivers',    base: 'bg-green-50 text-green-700 border-green-200', active: 'bg-green-700 text-white border-green-700' },
                  { label: 'Cleaners',       value: report.cleaners,      key: 'cleaners',   base: 'bg-teal-50 text-teal-700 border-teal-200',   active: 'bg-teal-700 text-white border-teal-700' },
                  { label: 'Unassigned',     value: report.unassigned,    key: 'unassigned', base: 'bg-red-50 text-red-700 border-red-200',     active: 'bg-red-700 text-white border-red-700' },
                  { label: 'Empty',          value: report.empty ?? 0,    key: 'empty',      base: 'bg-orange-50 text-orange-700 border-orange-200', active: 'bg-orange-700 text-white border-orange-700' },
                ]
                return (
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
                )
              })()}
            </>
          )
        })()}

        {/* Vehicle filter — tabs with date range */}
        {tab !== 'vehicle-master' && tab !== 'fleet-status' && tab !== 'daily-fleet' && tab !== 'trip-summary' && (() => {
          const allRows: { registrationNumber: string }[] =
            tab === 'fuel-mileage' ? (fuelQuery.data?.data ?? []) :
            tab === 'breakdowns'   ? (breakdownQuery.data?.data ?? []) :
            tab === 'doc-expiry'   ? (docExpiryQuery.data?.data ?? []) :
            (maintenanceQuery.data?.data ?? [])
          const vehicles = Array.from(new Set(allRows.map(r => r.registrationNumber))).sort()
          const vehicleOptions = [
            { value: 'ALL', label: `All Vehicles (${allRows.length})` },
            ...vehicles.map(v => ({ value: v, label: v })),
          ]
          return (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
              <SearchableSelect
                value={vehicleFilter}
                onValueChange={setVehicleFilter}
                options={vehicleOptions}
                className="w-52"
              />
            </div>
          )
        })()}

        {/* Trip Summary — order number filter */}
        {tab === 'trip-summary' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Order Number</label>
            <Input
              placeholder="e.g. ASHLAR_ORD_..."
              value={orderNumberFilter}
              onChange={e => setOrderNumberFilter(e.target.value)}
              className="w-52"
            />
          </div>
        )}

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
          <Button
            variant="outline" size="sm"
            disabled={downloading || (tab === 'daily-fleet' && !dailyFleetQuery.data?.data)}
            onClick={() => handleDownload('csv')}
            className="gap-1.5"
          >
            <Download size={14} />
            CSV
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={downloading || (tab === 'daily-fleet' && !dailyFleetQuery.data?.data)}
            onClick={() => handleDownload('pdf')}
            className="gap-1.5"
          >
            <Download size={14} />
            PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      {tab === 'vehicle-master' && <VehicleMasterTable
        rows={(vehicleMasterQuery.data?.data ?? []).filter(r =>
          (statusFilter === 'ALL' || r.currentStatus === statusFilter) &&
          (brandFilter === 'ALL' || r.brand === brandFilter) &&
          (fuelTypeFilter === 'ALL' || r.fuelType === fuelTypeFilter) &&
          (ownershipFilter === 'ALL' || r.ownershipType === ownershipFilter) &&
          (iotFilter === 'ALL' || (iotFilter === 'YES' ? r.isIot : !r.isIot)) &&
          (financeFilter === 'ALL' || (financeFilter === 'YES' ? r.isFinanced : !r.isFinanced))
        )}
        loading={vehicleMasterQuery.isLoading}
      />}
      {tab === 'fleet-status'  && <FleetTable
        rows={(fleetQuery.data?.data ?? []).filter(r => {
          if (statusFilter === 'ALL') return true
          if (statusFilter === 'IN_REPAIR_BREAKDOWN') return r.currentStatus === 'IN_REPAIR' && r.inRepairType === 'BREAKDOWN'
          if (statusFilter === 'IN_REPAIR_MAINTENANCE') return r.currentStatus === 'IN_REPAIR' && r.inRepairType !== 'BREAKDOWN'
          return r.currentStatus === statusFilter
        })}
        loading={fleetQuery.isLoading}
      />}
{tab === 'fuel-mileage'  && <FuelMileageTable rows={(fuelQuery.data?.data ?? []).filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)}        loading={fuelQuery.isLoading} />}
      {tab === 'breakdowns'    && <BreakdownsTable  rows={(breakdownQuery.data?.data ?? []).filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)}   loading={breakdownQuery.isLoading} />}
      {tab === 'doc-expiry'    && <DocExpiryTable   rows={(docExpiryQuery.data?.data ?? []).filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)}   loading={docExpiryQuery.isLoading} />}
      {tab === 'maintenance'   && <MaintenanceTable rows={(maintenanceQuery.data?.data ?? []).filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)} loading={maintenanceQuery.isLoading} />}
      {tab === 'daily-fleet'   && <DailyFleetTable  report={dailyFleetQuery.data?.data} filter={fleetFilter} loading={dailyFleetQuery.isLoading} />}
      {tab === 'trip-summary'  && <TripSummaryTable rows={tripSummaryQuery.data?.data ?? []} loading={tripSummaryQuery.isLoading} />}
    </div>
  )
}
