import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Boxes, Activity, Fuel, AlertTriangle, FileText, Wrench, ClipboardList, Gauge, IndianRupee, CalendarDays } from 'lucide-react'
import { Spinner } from '@/components/ui/loader'
import { HScroll } from '@/components/ui/h-scroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type {
  EquipmentMasterRow, EquipmentFleetStatusRow, EquipmentFuelHmrRow,
  EquipmentBreakdownRow, EquipmentDocumentExpiryRow, EquipmentMaintenanceRow,
  WorkOrderRegisterRow, WorkOrderUtilizationRow, WorkOrderReceivableRow, DailyMachineRegisterRow,
} from '@/types'

// ── Date helpers ─────────────────────────────────────────────────────────────
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
  { key: 'master',       label: 'Equipment Master', icon: Boxes },
  { key: 'fleet-status', label: 'Fleet Status',     icon: Activity },
  { key: 'fuel-hmr',     label: 'Fuel & HMR',       icon: Fuel },
  { key: 'breakdowns',   label: 'Breakdowns',       icon: AlertTriangle },
  { key: 'doc-expiry',   label: 'Document Expiry',  icon: FileText },
  { key: 'maintenance',  label: 'Maintenance',      icon: Wrench },
  { key: 'wo-register',    label: 'WO Register',    icon: ClipboardList },
  { key: 'wo-utilization', label: 'WO Utilization', icon: Gauge },
  { key: 'wo-receivables', label: 'WO Receivables', icon: IndianRupee },
  { key: 'daily-register', label: 'Daily Register', icon: CalendarDays },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

// ── Badges / formatters ──────────────────────────────────────────────────────
// ponytail: ReportTable/Badge kept local — same tiny presentational helpers as
// VehicleReportsPage; extract to shared only if a third reports page needs them.
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  ASSIGNED:  'bg-blue-100 text-blue-700',
  BUSY:      'bg-orange-100 text-orange-700',
  IN_REPAIR: 'bg-yellow-100 text-yellow-700',
  BREAKDOWN: 'bg-red-100 text-red-700',
  REPORTED:  'bg-red-100 text-red-700',
  RESOLVED:  'bg-green-100 text-green-700',
  OPEN:      'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  DRAFT:     'bg-gray-100 text-gray-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  INVOICED:  'bg-purple-100 text-purple-700',
  WORKING:   'bg-green-100 text-green-700',
  STANDBY:   'bg-amber-100 text-amber-700',
  IDLE:      'bg-amber-100 text-amber-700',
  NO_MACHINE: 'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID:      'bg-green-100 text-green-700',
}
const AGING_COLORS: Record<string, string> = {
  CURRENT: 'bg-green-100 text-green-700',
  '0-30':  'bg-yellow-100 text-yellow-700',
  '31-60': 'bg-amber-100 text-amber-700',
  '61-90': 'bg-orange-100 text-orange-700',
  '90+':   'bg-red-100 text-red-700',
}
function Badge({ label }: { label: string | null }) {
  if (!label) return <span>—</span>
  const cls = STATUS_COLORS[label] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label.replace(/_/g, ' ')}</span>
}
function ExpiryBadge({ status }: { status: 'GREEN' | 'AMBER' | 'RED' }) {
  const cls = { GREEN: 'bg-green-100 text-green-700', AMBER: 'bg-amber-100 text-amber-700', RED: 'bg-red-100 text-red-700' }[status]
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>
}
const dash = (v: unknown) => (v != null && v !== '' ? String(v) : '—')
const fmtRupee = (v: number | null) => v != null ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'
const fmtNum = (v: number | null, dec = 2) => v != null ? v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'
const AMBER_DAYS = 30
// Equipment identity = reg no. (rented) or serial no. (owned).
const ident = (r: { registrationNumber: string | null; serialNumber: string | null }) =>
  r.registrationNumber || r.serialNumber || '—'

// ── Generic table ──────────────────────────────────────────────────────────────
function ReportTable({ headers, rows, loading }: {
  headers: string[]; rows: React.ReactNode[][]; loading: boolean
}) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm"><Spinner /></div>
  if (rows.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  return (
    <div className="rounded-lg border overflow-hidden">
      <HScroll className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white whitespace-nowrap bg-feros-navy">{h}</th>
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
      </HScroll>
    </div>
  )
}

// ── Table renderers ────────────────────────────────────────────────────────────
function MasterTable({ rows, loading }: { rows: EquipmentMasterRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Serial No.', 'Reg No.', 'Make', 'Model', 'Type', 'Fuel', 'Ownership', 'Status', 'Meter', 'Current Reading',
      'Mfg Year', 'Tank Cap.', 'Chassis No.', 'Engine No.', 'Financed', 'Financer', 'Hired From', 'Hire Rate']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.serialNumber)}</span>, dash(r.registrationNumber),
      dash(r.make), dash(r.model), dash(r.equipmentType), dash(r.fuelType), dash(r.ownershipType),
      <Badge label={r.workStatus} />, dash(r.meterType), fmtNum(r.currentMeterReading, 1),
      dash(r.manufactureYear), r.fuelTankCapacity != null ? `${r.fuelTankCapacity} L` : '—',
      dash(r.chassisNumber), dash(r.engineNumber),
      r.isFinanced
        ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Yes</span>
        : <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">No</span>,
      dash(r.financerName), dash(r.hiredFrom),
      r.hireRate != null ? `${fmtRupee(r.hireRate)}${r.hireRateUnit ? ` / ${r.hireRateUnit.replace('PER_', '').toLowerCase()}` : ''}` : '—',
    ])}
  />
}

function FleetStatusTable({ rows, loading }: { rows: EquipmentFleetStatusRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Serial No.', 'Reg No.', 'Type', 'Make', 'Model', 'Status', 'Current Reading', 'Work Order', 'Client', 'Site']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.serialNumber)}</span>, dash(r.registrationNumber),
      dash(r.equipmentType), dash(r.make), dash(r.model), <Badge label={r.workStatus} />,
      r.currentMeterReading != null ? `${fmtNum(r.currentMeterReading, 1)}${r.meterType ? ` ${r.meterType}` : ''}` : '—',
      dash(r.workOrderNumber), dash(r.clientName), dash(r.site),
    ])}
  />
}

function FuelHmrTable({ rows, loading }: { rows: EquipmentFuelHmrRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Serial No.', 'Reg No.', 'Type', 'Fills', 'Total Litres', 'Total Cost', 'Opening HMR', 'Closing HMR', 'Hours Run', 'Litres / Hour']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.serialNumber)}</span>, dash(r.registrationNumber), dash(r.equipmentType),
      r.fillCount, fmtNum(r.totalLitresFilled, 1) + (r.totalLitresFilled != null ? ' L' : ''),
      fmtRupee(r.totalFuelCost), fmtNum(r.openingHmr, 1), fmtNum(r.closingHmr, 1),
      fmtNum(r.totalHours, 1), fmtNum(r.litresPerHour),
    ])}
  />
}

function BreakdownsTable({ rows, loading }: { rows: EquipmentBreakdownRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Serial No.', 'Reg No.', 'Type', 'Date', 'Location', 'Reason', 'Status', 'Days Lost', 'Reported By', 'Work Order']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.serialNumber)}</span>, dash(r.registrationNumber), dash(r.equipmentType),
      dash(r.breakdownDate), dash(r.location),
      <span className="whitespace-normal max-w-[16rem] inline-block">{dash(r.reason)}</span>,
      <Badge label={r.status} />,
      r.daysLost != null ? r.daysLost : <span className="text-amber-600 font-medium">Ongoing</span>,
      dash(r.reportedBy), dash(r.workOrderNumber),
    ])}
  />
}

function DocExpiryTable({ rows, loading }: { rows: EquipmentDocumentExpiryRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Serial No.', 'Reg No.', 'Type', 'Document', 'Doc No.', 'Issue Date', 'Expiry Date', 'Issuer', 'Cost', 'Days Left', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.serialNumber)}</span>, dash(r.registrationNumber), dash(r.equipmentType),
      dash(r.documentType), dash(r.documentNumber), dash(r.issueDate), dash(r.expiryDate), dash(r.issuerName),
      fmtRupee(r.cost),
      <span className={(r.daysLeft ?? 0) < 0 ? 'text-red-600 font-medium' : (r.daysLeft ?? 0) <= AMBER_DAYS ? 'text-amber-600 font-medium' : 'text-gray-700'}>
        {r.daysLeft == null ? '—' : r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d`}
      </span>,
      <ExpiryBadge status={r.expiryStatus} />,
    ])}
  />
}

function MaintenanceTable({ rows, loading }: { rows: EquipmentMaintenanceRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Serial No.', 'Reg No.', 'Type', 'Service No.', 'Service Date', 'Completed', 'Type', 'Triggered By', 'Reason',
      'Tasks', 'Cost', 'Status', 'Vendor', 'HMR at Service', 'Due at HMR', 'Downtime (hrs)']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.serialNumber)}</span>, dash(r.registrationNumber), dash(r.equipmentType),
      dash(r.serviceNumber), dash(r.serviceDate), dash(r.completedDate),
      <Badge label={r.serviceType} />, <Badge label={r.triggeredBy} />,
      <span className="whitespace-normal max-w-[16rem] inline-block">{dash(r.reason)}</span>,
      r.taskCount, fmtRupee(r.totalCost), <Badge label={r.status} />, dash(r.vendorName),
      fmtNum(r.hmrAtService, 1), fmtNum(r.dueAtHmr, 1), fmtNum(r.downtimeHours, 1),
    ])}
  />
}

function WoRegisterTable({ rows, loading }: { rows: WorkOrderRegisterRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['WO No.', 'Client', 'Site', 'Type', 'Status', 'Start', 'End', 'Machines', 'Mobilization',
      'Demobilization', 'Agreed Amount', 'GST %', 'Retention %', 'TDS %', 'Billing Cycle', 'Days Left']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.woNumber)}</span>, dash(r.clientName), dash(r.site),
      <Badge label={r.workOrderType} />, <Badge label={r.status} />, dash(r.startDate), dash(r.endDate),
      dash(r.machineCount), fmtRupee(r.mobilizationCharge), fmtRupee(r.demobilizationCharge), fmtRupee(r.agreedJobAmount),
      r.gstPercent != null ? `${r.gstPercent}%` : '—', r.retentionPercent != null ? `${r.retentionPercent}%` : '—',
      r.tdsPercent != null ? `${r.tdsPercent}%` : '—', r.billingCycleMonths != null ? `${r.billingCycleMonths} mo` : '—',
      r.daysRemaining == null ? '—'
        : r.daysRemaining < 0 ? <span className="text-red-600 font-medium">{Math.abs(r.daysRemaining)}d overdue</span>
        : <span className={r.daysRemaining <= 7 ? 'text-amber-600 font-medium' : 'text-gray-700'}>{r.daysRemaining}d</span>,
    ])}
  />
}

function WoUtilizationTable({ rows, loading }: { rows: WorkOrderUtilizationRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['WO No.', 'Client', 'Days Logged', 'Working', 'Idle', 'Standby', 'Breakdown', 'Total Hrs',
      'Utilization %', 'Penalty Threshold', 'Penalty']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.woNumber)}</span>, dash(r.clientName), r.daysLogged,
      fmtNum(r.workingHours, 1), fmtNum(r.idleHours, 1), fmtNum(r.standbyHours, 1), fmtNum(r.breakdownHours, 1),
      fmtNum(r.totalHours, 1),
      r.utilizationPct == null ? '—'
        : <span className={r.utilizationPct >= 70 ? 'text-green-700 font-bold' : r.utilizationPct >= 40 ? 'text-amber-600 font-medium' : 'text-red-600 font-medium'}>{r.utilizationPct}%</span>,
      r.penaltyThresholdHours != null ? `${r.penaltyThresholdHours} hrs` : '—',
      r.penaltyBreached
        ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Breached</span>
        : <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">OK</span>,
    ])}
  />
}

function WoReceivablesTable({ rows, loading }: { rows: WorkOrderReceivableRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['WO No.', 'Client', 'Invoices', 'Gross Billed', 'Received', 'Retention Held', 'Advances',
      'Balance Due', 'Oldest Due', 'Days Overdue', 'Aging']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.woNumber)}</span>, dash(r.clientName), r.invoiceCount,
      fmtRupee(r.grossBilled), fmtRupee(r.totalReceived), fmtRupee(r.retentionHeld), fmtRupee(r.totalAdvances),
      <span className={(r.balanceDue ?? 0) > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>{fmtRupee(r.balanceDue)}</span>,
      dash(r.oldestUnpaidDueDate), r.daysOverdue != null ? `${r.daysOverdue}d` : '—',
      r.agingBucket
        ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${AGING_COLORS[r.agingBucket] ?? 'bg-gray-100 text-gray-600'}`}>{r.agingBucket}</span>
        : <span>—</span>,
    ])}
  />
}

function DailyRegisterTable({ rows, loading }: { rows: DailyMachineRegisterRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Date', 'Machine', 'Type', 'WO No.', 'Client', 'Status', 'Start HMR', 'End HMR', 'Hours Worked',
      'Working', 'Idle', 'Standby', 'Breakdown', 'Fuel', 'Idle Reason']}
    rows={rows.map(r => [
      <span className="font-medium">{dash(r.logDate)}</span>, dash(r.machine), dash(r.equipmentType),
      dash(r.woNumber), dash(r.clientName), <Badge label={r.status} />,
      fmtNum(r.startHourMeter, 1), fmtNum(r.endHourMeter, 1), fmtNum(r.hoursWorked, 1),
      fmtNum(r.workingHours, 1), fmtNum(r.idleHours, 1), fmtNum(r.standbyHours, 1), fmtNum(r.breakdownHours, 1),
      r.fuelConsumed != null ? `${fmtNum(r.fuelConsumed, 1)} L` : '—',
      <span className="whitespace-normal max-w-[16rem] inline-block">{dash(r.idleReason)}</span>,
    ])}
  />
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EquipmentReportsPage() {
  const [tab, setTab] = useState<TabKey>('master')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [days, setDays] = useState(90)
  const [docStatusFilter, setDocStatusFilter] = useState<'ALL' | 'EXPIRED' | 'EXPIRING' | 'VALID'>('ALL')
  const [woFilter, setWoFilter] = useState<'ALL' | 'LIVE' | 'OVERDUE' | 'CLOSED'>('ALL')
  const [equipFilter, setEquipFilter] = useState('ALL')
  const [downloading, setDownloading] = useState(false)

  function handleTabChange(key: TabKey) {
    setTab(key)
    setEquipFilter('ALL')
    setDocStatusFilter('ALL')
    setWoFilter('ALL')
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());       setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart());  setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  const masterQuery = useQuery({
    queryKey: ['eq-report-master'], queryFn: () => reportsApi.getEquipmentMaster(), enabled: tab === 'master',
  })
  const fleetQuery = useQuery({
    queryKey: ['eq-report-fleet'], queryFn: () => reportsApi.getEquipmentFleetStatus(), enabled: tab === 'fleet-status',
  })
  const fuelQuery = useQuery({
    queryKey: ['eq-report-fuel', startDate, endDate], queryFn: () => reportsApi.getEquipmentFuelHmr(startDate, endDate), enabled: tab === 'fuel-hmr',
  })
  const breakdownQuery = useQuery({
    queryKey: ['eq-report-breakdowns', startDate, endDate], queryFn: () => reportsApi.getEquipmentBreakdowns(startDate, endDate), enabled: tab === 'breakdowns',
  })
  const docExpiryQuery = useQuery({
    queryKey: ['eq-report-doc-expiry', days], queryFn: () => reportsApi.getEquipmentDocumentExpiry(days), enabled: tab === 'doc-expiry',
  })
  const maintenanceQuery = useQuery({
    queryKey: ['eq-report-maintenance', startDate, endDate], queryFn: () => reportsApi.getEquipmentMaintenance(startDate, endDate), enabled: tab === 'maintenance',
  })
  const woRegisterQuery = useQuery({
    queryKey: ['wo-report-register'], queryFn: () => reportsApi.getWorkOrderRegister(), enabled: tab === 'wo-register',
  })
  const woUtilQuery = useQuery({
    queryKey: ['wo-report-util', startDate, endDate], queryFn: () => reportsApi.getWorkOrderUtilization(startDate, endDate), enabled: tab === 'wo-utilization',
  })
  const woReceivablesQuery = useQuery({
    queryKey: ['wo-report-receivables'], queryFn: () => reportsApi.getWorkOrderReceivables(), enabled: tab === 'wo-receivables',
  })
  const dailyRegisterQuery = useQuery({
    queryKey: ['wo-report-daily', startDate, endDate], queryFn: () => reportsApi.getDailyMachineRegister(startDate, endDate), enabled: tab === 'daily-register',
  })

  // WO Register — client-side quick filters (All / Live / Overdue / Closed).
  const woAllRows = woRegisterQuery.data?.data ?? []
  const CLOSED = new Set(['COMPLETED', 'INVOICED', 'CANCELLED'])
  const woCounts = {
    all: woAllRows.length,
    live: woAllRows.filter(r => !CLOSED.has(r.status ?? '')).length,
    overdue: woAllRows.filter(r => r.overdue).length,
    closed: woAllRows.filter(r => CLOSED.has(r.status ?? '')).length,
  }
  const woRows = woAllRows.filter(r =>
    woFilter === 'ALL' ||
    (woFilter === 'LIVE' && !CLOSED.has(r.status ?? '')) ||
    (woFilter === 'OVERDUE' && r.overdue) ||
    (woFilter === 'CLOSED' && CLOSED.has(r.status ?? '')))

  // Doc expiry client-side counts + filter (matches vehicle report chips).
  const docAllRows = docExpiryQuery.data?.data ?? []
  const docCounts = {
    all:      docAllRows.length,
    expired:  docAllRows.filter(r => r.expiryStatus === 'RED').length,
    expiring: docAllRows.filter(r => r.expiryStatus === 'AMBER').length,
    valid:    docAllRows.filter(r => r.expiryStatus === 'GREEN').length,
  }
  const docRows = docAllRows.filter(r =>
    docStatusFilter === 'ALL' ||
    (docStatusFilter === 'EXPIRED' && r.expiryStatus === 'RED') ||
    (docStatusFilter === 'EXPIRING' && r.expiryStatus === 'AMBER') ||
    (docStatusFilter === 'VALID' && r.expiryStatus === 'GREEN'))

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if (tab === 'master') await reportsApi.exportEquipmentMaster(format)
      else if (tab === 'fleet-status') await reportsApi.exportEquipmentFleetStatus(format)
      else if (tab === 'fuel-hmr') await reportsApi.exportEquipmentFuelHmr(startDate, endDate, format)
      else if (tab === 'breakdowns') await reportsApi.exportEquipmentBreakdowns(startDate, endDate, format)
      else if (tab === 'doc-expiry') await reportsApi.exportEquipmentDocumentExpiry(days, format)
      else if (tab === 'maintenance') await reportsApi.exportEquipmentMaintenance(startDate, endDate, format)
      else if (tab === 'wo-register') await reportsApi.exportWorkOrderRegister(format)
      else if (tab === 'wo-utilization') await reportsApi.exportWorkOrderUtilization(startDate, endDate, format)
      else if (tab === 'wo-receivables') await reportsApi.exportWorkOrderReceivables(format)
      else if (tab === 'daily-register') await reportsApi.exportDailyMachineRegister(startDate, endDate, format)
    } catch {
      toast.error('Export failed')
    } finally {
      setDownloading(false)
    }
  }

  const usesDateRange = tab === 'fuel-hmr' || tab === 'breakdowns' || tab === 'maintenance' || tab === 'wo-utilization' || tab === 'daily-register'
  const usesEquipFilter = tab === 'fuel-hmr' || tab === 'breakdowns' || tab === 'maintenance'

  // Equipment dropdown options for the filterable list tabs.
  const equipRows: { registrationNumber: string | null; serialNumber: string | null }[] =
    tab === 'fuel-hmr'    ? (fuelQuery.data?.data ?? []) :
    tab === 'breakdowns'  ? (breakdownQuery.data?.data ?? []) :
    tab === 'maintenance' ? (maintenanceQuery.data?.data ?? []) : []
  const equipOptions = [
    { value: 'ALL', label: `All Equipment (${equipRows.length})` },
    ...Array.from(new Set(equipRows.map(ident))).sort().map(v => ({ value: v, label: v })),
  ]
  const matchEquip = (r: { registrationNumber: string | null; serialNumber: string | null }) =>
    equipFilter === 'ALL' || ident(r) === equipFilter

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipment Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Machine fleet analytics and insights</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap bg-white border rounded-xl p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => handleTabChange(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key ? 'bg-feros-navy text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100')}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Controls card */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">
        {usesEquipFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Equipment</label>
            <SearchableSelect value={equipFilter} onValueChange={setEquipFilter} options={equipOptions} className="w-52" />
          </div>
        )}

        {tab === 'doc-expiry' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Within (days)</label>
            <Input type="number" min={1} max={3650} value={days}
              onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 90))} className="w-24" />
          </div>
        )}

        {usesDateRange && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
              <div className="flex gap-1">
                {(['today', 'this-week', 'this-month', 'custom'] as DatePreset[]).map(p => (
                  <button key={p} onClick={() => applyPreset(p)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                      preset === p ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 hover:border-gray-400')}>
                    {p === 'today' ? 'Today' : p === 'this-week' ? 'This Week' : p === 'this-month' ? 'This Month' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>
            {preset === 'custom' ? (
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
            ) : (
              <div className="pb-1 text-xs text-gray-400">{startDate} → {endDate}</div>
            )}
          </>
        )}

        {/* Download buttons */}
        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('csv')} className="gap-1.5">
            <Download size={14} /> CSV
          </Button>
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('pdf')} className="gap-1.5">
            <Download size={14} /> PDF
          </Button>
        </div>
      </div>

      {/* Tables */}
      {tab === 'master' && <MasterTable rows={masterQuery.data?.data ?? []} loading={masterQuery.isLoading} />}
      {tab === 'fleet-status' && <FleetStatusTable rows={fleetQuery.data?.data ?? []} loading={fleetQuery.isLoading} />}
      {tab === 'fuel-hmr' && <FuelHmrTable rows={(fuelQuery.data?.data ?? []).filter(matchEquip)} loading={fuelQuery.isLoading} />}
      {tab === 'breakdowns' && <BreakdownsTable rows={(breakdownQuery.data?.data ?? []).filter(matchEquip)} loading={breakdownQuery.isLoading} />}
      {tab === 'doc-expiry' && <>
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            { key: 'ALL',      label: 'All',      count: docCounts.all,      base: 'bg-feros-navy/10 text-feros-navy border-feros-navy/20', active: 'bg-feros-navy text-white border-feros-navy' },
            { key: 'EXPIRED',  label: 'Expired',  count: docCounts.expired,  base: 'bg-red-50 text-red-700 border-red-200',       active: 'bg-red-700 text-white border-red-700' },
            { key: 'EXPIRING', label: 'Expiring', count: docCounts.expiring, base: 'bg-amber-50 text-amber-700 border-amber-200', active: 'bg-amber-600 text-white border-amber-600' },
            { key: 'VALID',    label: 'Valid',    count: docCounts.valid,    base: 'bg-green-50 text-green-700 border-green-200', active: 'bg-green-700 text-white border-green-700' },
          ] as const).map(c => (
            <button key={c.key} onClick={() => setDocStatusFilter(c.key)}
              className={cn('border rounded-lg px-3 py-1.5 text-center min-w-[84px] transition-colors', docStatusFilter === c.key ? c.active : c.base)}>
              <div className="text-xs font-medium opacity-80">{c.label}</div>
              <div className="text-xl font-bold">{c.count}</div>
            </button>
          ))}
        </div>
        <DocExpiryTable rows={docRows} loading={docExpiryQuery.isLoading} />
      </>}
      {tab === 'maintenance' && <MaintenanceTable rows={(maintenanceQuery.data?.data ?? []).filter(matchEquip)} loading={maintenanceQuery.isLoading} />}
      {tab === 'wo-register' && <>
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            { key: 'ALL',     label: 'All',     count: woCounts.all,     base: 'bg-feros-navy/10 text-feros-navy border-feros-navy/20', active: 'bg-feros-navy text-white border-feros-navy' },
            { key: 'LIVE',    label: 'Live',    count: woCounts.live,    base: 'bg-blue-50 text-blue-700 border-blue-200',    active: 'bg-blue-700 text-white border-blue-700' },
            { key: 'OVERDUE', label: 'Overdue', count: woCounts.overdue, base: 'bg-red-50 text-red-700 border-red-200',       active: 'bg-red-700 text-white border-red-700' },
            { key: 'CLOSED',  label: 'Closed',  count: woCounts.closed,  base: 'bg-gray-50 text-gray-600 border-gray-200',    active: 'bg-gray-600 text-white border-gray-600' },
          ] as const).map(c => (
            <button key={c.key} onClick={() => setWoFilter(c.key)}
              className={cn('border rounded-lg px-3 py-1.5 text-center min-w-[84px] transition-colors', woFilter === c.key ? c.active : c.base)}>
              <div className="text-xs font-medium opacity-80">{c.label}</div>
              <div className="text-xl font-bold">{c.count}</div>
            </button>
          ))}
        </div>
        <WoRegisterTable rows={woRows} loading={woRegisterQuery.isLoading} />
      </>}
      {tab === 'wo-utilization' && <WoUtilizationTable rows={woUtilQuery.data?.data ?? []} loading={woUtilQuery.isLoading} />}
      {tab === 'wo-receivables' && <WoReceivablesTable rows={woReceivablesQuery.data?.data ?? []} loading={woReceivablesQuery.isLoading} />}
      {tab === 'daily-register' && <DailyRegisterTable rows={dailyRegisterQuery.data?.data ?? []} loading={dailyRegisterQuery.isLoading} />}
    </div>
  )
}
