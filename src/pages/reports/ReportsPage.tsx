import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { reportsApi } from '@/api/reports'
import { clientsApi } from '@/api/clients'
import { toast } from 'sonner'
import type {
  LrRegisterRow, InvoiceOutstandingRow, PayrollSummaryRow,
  CollectionReportRow, ClientStatementResponse, VehicleTripRow,
  OrderStatusRow, AttendanceReportRow, TenantTargetResponse,
  DailyVehicleActivityResponse, LocalLongTripSummaryResponse,
  IdleDriverResponse, DocumentExpiryAlertResponse,
  TodayAttendanceSummaryResponse, DelayedTripResponse, OrdersBacklogResponse,
  OrderFulfillmentRateResponse, OrderLeadTimeResponse,
  UnassignedVehiclesResponse, DriverAssignmentHistoryResponse,
  TripInProgressResponse, LrStatusFunnelResponse, UnbilledLrResponse,
  InvoiceTurnaroundResponse, TripDurationResponse,
  WeightVarianceReportResponse, OverloadingIncidentResponse,
  VehicleRevenueResponse, VehicleIdleDaysResponse, VehicleTripCountResponse,
  BreakdownFrequencyResponse, VehicleServiceCostResponse,
  DriverPerformanceResponse, AttendanceGapsResponse,
  AttendanceTrendResponse, AttendanceCalendarResponse,
  InvoiceAgingResponse, RevenueTrendResponse, RouteProfitabilityResponse,
  GstSummaryResponse, CreditNoteSummaryResponse, ClientPendingBillingResponse,
  TopClientResponse, TopMaterialResponse, TopRouteResponse,
  OnTimeDeliveryResponse, OrderCancellationRateResponse,
  StockLevelResponse, StockMovementResponse, VehiclePartConsumptionResponse,
  PartConsumptionByTypeResponse, ServiceCostBreakdownResponse,
  TiresByVehicleResponse, KmPerTireResponse,
  TireReplacementProjectionResponse, TireCostPerKmResponse,
} from '@/types'

type ReportTab =
  'daily-vehicles' | 'local-long-trips' | 'idle-drivers' | 'doc-expiry' | 'today-attendance' | 'delayed-trips' | 'orders-backlog' |
  'order-fulfillment' | 'order-lead-time' | 'unassigned-vehicles' | 'driver-assignments' |
  'trips-in-progress' | 'lr-status-funnel' | 'unbilled-lrs' | 'invoice-turnaround' | 'trip-duration' | 'weight-variance' | 'overloading' |
  'vehicle-revenue' | 'vehicle-idle-days' | 'vehicle-trip-count' | 'breakdown-frequency' | 'vehicle-service-cost' |
  'driver-performance' | 'attendance-gaps' | 'attendance-trend' | 'attendance-calendar' |
  'invoice-aging' | 'revenue-trend' | 'route-profitability' | 'gst-summary' | 'credit-notes' | 'client-pending-billing' |
  'top-clients' | 'top-materials' | 'top-routes' | 'on-time-delivery' | 'cancellation-rate' |
  'stock-levels' | 'stock-movement' | 'parts-by-vehicle' | 'parts-by-type' | 'service-cost-breakdown' |
  'tires-by-vehicle' | 'km-per-tire' | 'tire-replacement' | 'tire-cost-per-km' |
  'targets' | 'lr-register' | 'outstanding' | 'collections' | 'client-statement' | 'vehicle-trips' | 'order-status' | 'payroll' | 'attendance'

const DAILY_OPS_TABS: { id: ReportTab; label: string }[] = [
  { id: 'daily-vehicles',   label: 'Vehicle Activity' },
  { id: 'local-long-trips', label: 'Local vs Long Trips' },
  { id: 'idle-drivers',     label: 'Idle Drivers' },
  { id: 'doc-expiry',       label: 'Document Expiry' },
  { id: 'today-attendance', label: "Today's Attendance" },
  { id: 'delayed-trips',    label: 'Delayed Trips' },
  { id: 'orders-backlog',   label: 'Orders Backlog' },
]

const ORDERS_TABS: { id: ReportTab; label: string }[] = [
  { id: 'order-fulfillment',   label: 'Fulfillment Rate' },
  { id: 'order-lead-time',     label: 'Lead Time' },
  { id: 'unassigned-vehicles', label: 'Unassigned Vehicles' },
  { id: 'driver-assignments',  label: 'Driver Assignments' },
]

const TRIPS_TABS: { id: ReportTab; label: string }[] = [
  { id: 'trips-in-progress',  label: 'Trips In Progress' },
  { id: 'lr-status-funnel',   label: 'LR Status Funnel' },
  { id: 'unbilled-lrs',       label: 'Unbilled LRs' },
  { id: 'invoice-turnaround', label: 'Invoice Turnaround' },
  { id: 'trip-duration',      label: 'Trip Duration' },
  { id: 'weight-variance',    label: 'Weight Variance' },
  { id: 'overloading',        label: 'Overloading' },
]

const VEHICLE_PERF_TABS: { id: ReportTab; label: string }[] = [
  { id: 'vehicle-revenue',     label: 'Revenue per Vehicle' },
  { id: 'vehicle-idle-days',   label: 'Idle Days' },
  { id: 'vehicle-trip-count',  label: 'Trips per Vehicle' },
  { id: 'breakdown-frequency', label: 'Breakdown Frequency' },
  { id: 'vehicle-service-cost', label: 'Service Cost' },
]

const DRIVER_TABS: { id: ReportTab; label: string }[] = [
  { id: 'driver-performance',   label: 'Driver Trips' },
  { id: 'attendance-gaps',      label: 'Attendance Gaps' },
  { id: 'attendance-trend',     label: 'Attendance Trend' },
  { id: 'attendance-calendar',  label: 'Attendance Calendar' },
]

const FINANCIAL_TABS: { id: ReportTab; label: string }[] = [
  { id: 'invoice-aging',        label: 'Invoice Aging' },
  { id: 'revenue-trend',        label: 'Revenue Trend' },
  { id: 'route-profitability',  label: 'Route Profitability' },
  { id: 'gst-summary',         label: 'GST Summary' },
  { id: 'credit-notes',        label: 'Credit Notes' },
  { id: 'client-pending-billing', label: 'Pending Billing' },
]

const BI_TABS: { id: ReportTab; label: string }[] = [
  { id: 'top-clients',      label: 'Top Clients' },
  { id: 'top-materials',    label: 'Top Materials' },
  { id: 'top-routes',       label: 'Top Routes' },
  { id: 'on-time-delivery', label: 'On-Time Delivery' },
  { id: 'cancellation-rate', label: 'Cancellation Rate' },
]

const INVENTORY_TABS: { id: ReportTab; label: string }[] = [
  { id: 'stock-levels',          label: 'Stock Levels' },
  { id: 'stock-movement',        label: 'Stock Movement' },
  { id: 'parts-by-vehicle',      label: 'Parts by Vehicle' },
  { id: 'parts-by-type',         label: 'Parts by Type' },
  { id: 'service-cost-breakdown', label: 'Service Cost' },
]

const TIRE_TABS: { id: ReportTab; label: string }[] = [
  { id: 'tires-by-vehicle',  label: 'Tires per Vehicle' },
  { id: 'km-per-tire',       label: 'Km per Tire' },
  { id: 'tire-replacement',  label: 'Replacement Projection' },
  { id: 'tire-cost-per-km',  label: 'Cost per Km' },
]

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'targets',          label: 'Targets' },
  { id: 'lr-register',      label: 'LR Register' },
  { id: 'outstanding',      label: 'Invoice Outstanding' },
  { id: 'collections',      label: 'Collections' },
  { id: 'client-statement', label: 'Client Statement' },
  { id: 'vehicle-trips',    label: 'Vehicle Trips' },
  { id: 'order-status',     label: 'Order Status' },
  { id: 'payroll',          label: 'Payroll Summary' },
  { id: 'attendance',       label: 'Attendance' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n?: number | null) =>
  n == null ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
const fmtRs = (n?: number | null) =>
  n == null ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
}
function monthEnd() {
  const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10)
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    CREATED: 'bg-blue-100 text-blue-800', IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-green-100 text-green-800', INVOICED: 'bg-purple-100 text-purple-800',
    CANCELLED: 'bg-red-100 text-red-800', DRAFT: 'bg-gray-100 text-gray-700',
    SENT: 'bg-blue-100 text-blue-800', PARTIAL: 'bg-orange-100 text-orange-800',
    PAID: 'bg-green-100 text-green-800', PENDING: 'bg-yellow-100 text-yellow-800',
    PRESENT: 'bg-green-100 text-green-800', ABSENT: 'bg-red-100 text-red-800',
    HALF_DAY: 'bg-orange-100 text-orange-800', LEAVE: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800', GENERATED: 'bg-blue-100 text-blue-800',
  }
  const cls = map[s] ?? 'bg-gray-100 text-gray-700'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{s.replace('_', ' ')}</span>
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{msg}</div>
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 mt-0.5">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

// ─── Date Range Filter ─────────────────────────────────────────────────────────
function DateRange({ from, to, onChange }: {
  from: string; to: string; onChange: (from: string, to: string) => void
}) {
  return (
    <div className="flex gap-3 items-end">
      <div>
        <Label className="text-xs text-gray-500">From</Label>
        <Input type="date" value={from} onChange={e => onChange(e.target.value, to)} className="h-8 text-sm w-36" />
      </div>
      <div>
        <Label className="text-xs text-gray-500">To</Label>
        <Input type="date" value={to} onChange={e => onChange(from, e.target.value)} className="h-8 text-sm w-36" />
      </div>
    </div>
  )
}

// ─── Client Dropdown ──────────────────────────────────────────────────────────
function ClientSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.getAll })
  const clients = data?.data ?? []
  return (
    <div>
      <Label className="text-xs text-gray-500">Client</Label>
      <SearchableSelect
        value={value}
        onValueChange={onChange}
        options={[{ value: 'all', label: 'All Clients' }, ...clients.map(c => ({ value: String(c.id), label: c.clientName }))]}
        placeholder="All Clients"
        className="w-48"
        triggerClassName="h-8 text-sm"
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Ops — A1: Daily Vehicle Activity
// ═══════════════════════════════════════════════════════════════════════════════
function VehicleActivityTable({ rows, emptyMsg }: { rows: DailyVehicleActivityResponse['onRoad']; emptyMsg: string }) {
  if (rows.length === 0) return <EmptyState msg={emptyMsg} />
  return (
    <table className="w-full text-xs border rounded-lg overflow-hidden">
      <thead className="bg-gray-50 text-gray-600 uppercase">
        <tr>
          {['Vehicle', 'Type', 'Client', 'From', 'To', 'LR #', 'Loaded At', 'Delivered At'].map(h => (
            <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map(r => (
          <tr key={r.vehicleId} className="hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
            <td className="px-3 py-2 text-gray-500">{r.vehicleType ?? '—'}</td>
            <td className="px-3 py-2">{r.clientName ?? '—'}</td>
            <td className="px-3 py-2">{r.fromCity ?? '—'}</td>
            <td className="px-3 py-2">{r.toCity ?? '—'}</td>
            <td className="px-3 py-2 text-blue-700">{r.lrNumber ?? '—'}</td>
            <td className="px-3 py-2 whitespace-nowrap">{r.loadedAt ?? '—'}</td>
            <td className="px-3 py-2 whitespace-nowrap">{r.deliveredAt ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DailyVehicleActivityTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-daily-vehicles'],
    queryFn: reportsApi.getDailyVehicleActivity,

  })
  const d: DailyVehicleActivityResponse | undefined = data?.data
  const [section, setSection] = useState<'on-road' | 'started' | 'delivered' | 'idle'>('on-road')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Today\'s Data'}
        </Button>
      </div>

      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => setSection('on-road')} className={`rounded-xl p-4 text-left border transition-all ${section === 'on-road' ? 'border-blue-400 bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
              <div className="text-2xl font-bold text-blue-700">{d.onRoadCount}</div>
              <div className="text-xs text-gray-500 mt-1">On Road</div>
            </button>
            <button onClick={() => setSection('started')} className={`rounded-xl p-4 text-left border transition-all ${section === 'started' ? 'border-orange-400 bg-orange-50' : 'bg-white hover:bg-gray-50'}`}>
              <div className="text-2xl font-bold text-orange-600">{d.startedTodayCount}</div>
              <div className="text-xs text-gray-500 mt-1">Started Today</div>
            </button>
            <button onClick={() => setSection('delivered')} className={`rounded-xl p-4 text-left border transition-all ${section === 'delivered' ? 'border-green-400 bg-green-50' : 'bg-white hover:bg-gray-50'}`}>
              <div className="text-2xl font-bold text-green-600">{d.deliveredTodayCount}</div>
              <div className="text-xs text-gray-500 mt-1">Delivered Today</div>
            </button>
            <button onClick={() => setSection('idle')} className={`rounded-xl p-4 text-left border transition-all ${section === 'idle' ? 'border-gray-400 bg-gray-100' : 'bg-white hover:bg-gray-50'}`}>
              <div className="text-2xl font-bold text-gray-500">{d.idleCount}</div>
              <div className="text-xs text-gray-500 mt-1">Idle</div>
            </button>
          </div>
          <div className="overflow-x-auto">
            {section === 'on-road'   && <VehicleActivityTable rows={d.onRoad}        emptyMsg="No vehicles on road" />}
            {section === 'started'   && <VehicleActivityTable rows={d.startedToday}  emptyMsg="No vehicles started today" />}
            {section === 'delivered' && <VehicleActivityTable rows={d.deliveredToday} emptyMsg="No deliveries today" />}
            {section === 'idle'      && <VehicleActivityTable rows={d.idle}          emptyMsg="No idle vehicles" />}
          </div>
        </>
      )}
      {!d && !isFetching && <EmptyState msg="Click Fetch to load today's vehicle activity" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Ops — A2: Local vs Long Trips
// ═══════════════════════════════════════════════════════════════════════════════
function LocalLongTripsTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-local-long'],
    queryFn: reportsApi.getLocalLongTripSummary,

  })
  const d: LocalLongTripSummaryResponse | undefined = data?.data

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading...' : "Fetch Today's Data"}
        </Button>
      </div>
      {d && (
        <>
          <div className="flex gap-3 flex-wrap">
            <SummaryCard label="Total Trips Today" value={String(d.totalToday)} />
            <SummaryCard label="Local Trips" value={String(d.localCount)} sub="Same state" />
            <SummaryCard label="Long Distance" value={String(d.longDistanceCount)} sub="Different state" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  {['Type', 'LR #', 'Vehicle', 'Client', 'From', 'To'].map(h => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.trips.length === 0 && <tr><td colSpan={6}><EmptyState msg="No trips started today" /></td></tr>}
                {d.trips.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.tripType === 'LOCAL' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {r.tripType}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-blue-700">{r.lrNumber}</td>
                    <td className="px-3 py-2">{r.registrationNumber}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.fromCity}, {r.fromState}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.toCity}, {r.toState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!d && !isFetching && <EmptyState msg="Click Fetch to load today's trip data" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Ops — A3: Idle Drivers
// ═══════════════════════════════════════════════════════════════════════════════
function IdleDriversTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-idle-drivers'],
    queryFn: reportsApi.getIdleDrivers,

  })
  const rows: IdleDriverResponse[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Idle Drivers'}
        </Button>
      </div>
      {data && (
        <>
          <SummaryCard label="Idle Drivers / Supervisors" value={String(rows.length)} sub="No active trip assignment" />
          <table className="w-full text-xs border rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                {['Name', 'Phone', 'Role'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && <tr><td colSpan={3}><EmptyState msg="All drivers are assigned" /></td></tr>}
              {rows.map(r => (
                <tr key={r.userId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.userName}</td>
                  <td className="px-3 py-2">{r.phone}</td>
                  <td className="px-3 py-2">{statusBadge(r.roleName ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch to check idle drivers" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Ops — A4: Document Expiry Alerts
// ═══════════════════════════════════════════════════════════════════════════════
function DocumentExpiryTab() {
  const [daysAhead, setDaysAhead] = useState('60')
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-doc-expiry', daysAhead],
    queryFn: () => reportsApi.getDocumentExpiryAlerts(Number(daysAhead)),

  })
  const rows: DocumentExpiryAlertResponse[] = data?.data ?? []
  const expired = rows.filter(r => r.expired)
  const expiring = rows.filter(r => !r.expired)

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <div>
          <Label className="text-xs text-gray-500">Alert Window (days)</Label>
          <SearchableSelect
            value={daysAhead}
            onValueChange={setDaysAhead}
            options={[{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }]}
            placeholder="60 days"
            className="w-32"
            triggerClassName="h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Alerts'}
        </Button>
      </div>
      {data && (
        <>
          <div className="flex gap-3">
            <SummaryCard label="Expired" value={String(expired.length)} sub="Action required now" />
            <SummaryCard label="Expiring Soon" value={String(expiring.length)} sub={`Within ${daysAhead} days`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  {['Vehicle', 'Document Type', 'Doc Number', 'Expiry Date', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && <tr><td colSpan={5}><EmptyState msg="No expiring documents found" /></td></tr>}
                {rows.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 ${r.expired ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
                    <td className="px-3 py-2">{r.documentType}</td>
                    <td className="px-3 py-2 text-gray-500">{r.documentNumber ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.expiryDate}</td>
                    <td className="px-3 py-2">
                      {r.expired
                        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Expired {Math.abs(r.daysUntilExpiry)}d ago</span>
                        : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">Expires in {r.daysUntilExpiry}d</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch Alerts to check document expiry" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Ops — A5: Today's Attendance
// ═══════════════════════════════════════════════════════════════════════════════
function TodayAttendanceTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-today-attendance'],
    queryFn: reportsApi.getTodayAttendance,

  })
  const d: TodayAttendanceSummaryResponse | undefined = data?.data
  const [filter, setFilter] = useState('ALL')

  const filtered = d?.records.filter(r => filter === 'ALL' || r.attendanceStatus === filter) ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading...' : "Fetch Today's Attendance"}
        </Button>
      </div>
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Staff', value: d.totalStaff, color: 'text-gray-900', filter: 'ALL' },
              { label: 'Present', value: d.presentCount, color: 'text-green-600', filter: 'PRESENT' },
              { label: 'Absent', value: d.absentCount, color: 'text-red-600', filter: 'ABSENT' },
              { label: 'On Leave', value: d.leaveCount, color: 'text-blue-600', filter: 'LEAVE' },
              { label: 'Not Marked', value: d.notMarkedCount, color: 'text-orange-500', filter: 'NOT_MARKED' },
            ].map(c => (
              <button key={c.filter} onClick={() => setFilter(c.filter)}
                className={`rounded-xl p-4 text-left border transition-all ${filter === c.filter ? 'border-blue-400 bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 mt-1">{c.label}</div>
              </button>
            ))}
          </div>
          <table className="w-full text-xs border rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                {['Name', 'Phone', 'Role', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && <tr><td colSpan={4}><EmptyState msg="No records" /></td></tr>}
              {filtered.map(r => (
                <tr key={r.userId} className={`hover:bg-gray-50 ${r.attendanceStatus === 'NOT_MARKED' ? 'bg-orange-50/40' : ''}`}>
                  <td className="px-3 py-2 font-medium">{r.userName}</td>
                  <td className="px-3 py-2">{r.phone}</td>
                  <td className="px-3 py-2 text-gray-500">{r.roleName}</td>
                  <td className="px-3 py-2">{statusBadge(r.attendanceStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {!d && !isFetching && <EmptyState msg="Click Fetch to load today's attendance" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Ops — A6: Delayed Trips
// ═══════════════════════════════════════════════════════════════════════════════
function DelayedTripsTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-delayed-trips'],
    queryFn: reportsApi.getDelayedTrips,

  })
  const rows: DelayedTripResponse[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Delayed Trips'}
        </Button>
      </div>
      {data && (
        <>
          {rows.length > 0 && <SummaryCard label="Delayed Trips" value={String(rows.length)} sub="IN_TRANSIT past expected delivery date" />}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  {[['LR #','left'],['Vehicle','left'],['Client','left'],['From','left'],['To','left'],['Expected By','left'],['Days Delayed','center'],['Loaded At','left']].map(([h,a])=>(
                    <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && <tr><td colSpan={8}><EmptyState msg="No delayed trips" /></td></tr>}
                {rows.map(r => (
                  <tr key={r.lrId} className="bg-red-50 hover:bg-red-100/50">
                    <td className="px-3 py-2 font-medium text-blue-700">{r.lrNumber}</td>
                    <td className="px-3 py-2">{r.registrationNumber}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2">{r.fromCity}</td>
                    <td className="px-3 py-2">{r.toCity}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.expectedDeliveryDate}</td>
                    <td className="px-3 py-2 text-center font-semibold text-red-600">{r.daysDelayed}d</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{r.loadedAt ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch to check delayed trips" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daily Ops — A7: Orders Backlog
// ═══════════════════════════════════════════════════════════════════════════════
function OrdersBacklogTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-orders-backlog'],
    queryFn: reportsApi.getOrdersBacklog,

  })
  const rows: OrdersBacklogResponse[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Backlog'}
        </Button>
      </div>
      {data && (
        <>
          {rows.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              <SummaryCard label="Total Backlog" value={String(rows.length)} sub="Pending or partially assigned" />
              <SummaryCard label="Pending" value={String(rows.filter(r => r.orderStatus === 'PENDING').length)} />
              <SummaryCard label="Partially Assigned" value={String(rows.filter(r => r.orderStatus === 'PARTIALLY_ASSIGNED').length)} />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  {[['Order #','left'],['Date','left'],['Client','left'],['From','left'],['To','left'],['Material','left'],['Weight (T)','right'],['Status','left'],['Waiting Days','center']].map(([h,a])=>(
                    <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && <tr><td colSpan={9}><EmptyState msg="No backlog orders" /></td></tr>}
                {rows.map(r => (
                  <tr key={r.orderId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-blue-700">{r.orderNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.orderDate}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2">{r.fromCity}</td>
                    <td className="px-3 py-2">{r.toCity}</td>
                    <td className="px-3 py-2">{r.materialType}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.totalWeight)}</td>
                    <td className="px-3 py-2">{statusBadge(r.orderStatus)}</td>
                    <td className={`px-3 py-2 text-center font-medium ${r.daysWaiting > 3 ? 'text-red-600' : 'text-orange-500'}`}>
                      {r.daysWaiting}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch to check orders backlog" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section C — Orders & Assignments
// ═══════════════════════════════════════════════════════════════════════════════

function OrderFulfillmentTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-order-fulfillment', from, to],
    queryFn: () => reportsApi.getOrderFulfillmentRate(from, to),

  })
  const d: OrderFulfillmentRateResponse | undefined = data?.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Total Orders" value={String(d.totalOrders)} />
            <SummaryCard label="Fulfillment Rate" value={`${d.fulfillmentRate}%`} sub="Delivered + Completed" />
            <SummaryCard label="Delivered + Completed" value={String(d.delivered + d.completed)} />
            <SummaryCard label="Cancelled" value={String(d.cancelled)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>{['Status', 'Count', '% of Total'].map(h => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: 'Pending', count: d.pending, color: 'bg-yellow-100 text-yellow-800' },
                  { label: 'Partially Assigned', count: d.partiallyAssigned, color: 'bg-orange-100 text-orange-800' },
                  { label: 'Fully Assigned', count: d.fullyAssigned, color: 'bg-blue-100 text-blue-800' },
                  { label: 'In Transit', count: d.inTransit, color: 'bg-purple-100 text-purple-800' },
                  { label: 'Delivered', count: d.delivered, color: 'bg-green-100 text-green-800' },
                  { label: 'Completed', count: d.completed, color: 'bg-green-100 text-green-800' },
                  { label: 'Cancelled', count: d.cancelled, color: 'bg-red-100 text-red-800' },
                ].map(r => (
                  <tr key={r.label} className="hover:bg-gray-50">
                    <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.color}`}>{r.label}</span></td>
                    <td className="px-4 py-2 font-semibold">{r.count}</td>
                    <td className="px-4 py-2">{d.totalOrders > 0 ? `${((r.count / d.totalOrders) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!d && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

function OrderLeadTimeTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-order-lead-time', from, to],
    queryFn: () => reportsApi.getOrderLeadTime(from, to),

  })
  const rows: OrderLeadTimeResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <SummaryCard label="Overall Avg Lead Time" value={`${(rows.reduce((s, r) => s + r.avgLeadTimeDays * r.orderCount, 0) / rows.reduce((s, r) => s + r.orderCount, 0)).toFixed(1)} days`} />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Route','left'],['Orders','center'],['Avg Days','center'],['Min Days','center'],['Max Days','center']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={5}><EmptyState msg="Select filters and click Fetch Report" /></td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.fromCity} → {r.toCity}</td>
                <td className="px-3 py-2 text-center">{r.orderCount}</td>
                <td className="px-3 py-2 text-center font-semibold">{r.avgLeadTimeDays}d</td>
                <td className="px-3 py-2 text-center text-green-700">{r.minLeadTimeDays}d</td>
                <td className="px-3 py-2 text-center text-red-600">{r.maxLeadTimeDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UnassignedVehiclesTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-unassigned-vehicles'],
    queryFn: reportsApi.getUnassignedVehicles,

  })
  const rows: UnassignedVehiclesResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Loading...' : 'Fetch Report'}</Button>
      </div>
      {data && (
        <>
          {rows.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              <SummaryCard label="Orders Needing Vehicles" value={String(rows.length)} />
              <SummaryCard label="Pending" value={String(rows.filter(r => r.orderStatus === 'PENDING').length)} />
              <SummaryCard label="Partially Assigned" value={String(rows.filter(r => r.orderStatus === 'PARTIALLY_ASSIGNED').length)} />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>{[['Order #','left'],['Date','left'],['Client','left'],['Route','left'],['Material','left'],['Weight (T)','right'],['Vehicles Assigned','center'],['Status','left'],['Waiting','center']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && <tr><td colSpan={9}><EmptyState msg="No unassigned orders" /></td></tr>}
                {rows.map(r => (
                  <tr key={r.orderId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-blue-700">{r.orderNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.orderDate}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.fromCity} → {r.toCity}</td>
                    <td className="px-3 py-2">{r.materialType}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.totalWeight)}</td>
                    <td className="px-3 py-2 text-center">{r.vehiclesAssigned}</td>
                    <td className="px-3 py-2">{statusBadge(r.orderStatus)}</td>
                    <td className={`px-3 py-2 text-center font-medium ${r.daysWaiting > 3 ? 'text-red-600' : 'text-orange-500'}`}>{r.daysWaiting}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch to load unassigned vehicles report" />}
    </div>
  )
}

function DriverAssignmentsTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-driver-assignments', from, to],
    queryFn: () => reportsApi.getDriverAssignmentHistory(from, to),

  })
  const rows: DriverAssignmentHistoryResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && <SummaryCard label="Total Assignments" value={String(rows.length)} />}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{['Driver', 'Phone', 'Role', 'Vehicle', 'Order #', 'Client', 'Route', 'Start Date', 'End Date', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={10}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.allocationId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.driverName}</td>
                <td className="px-3 py-2">{r.driverPhone}</td>
                <td className="px-3 py-2 text-gray-500">{r.roleName}</td>
                <td className="px-3 py-2">{r.registrationNumber}</td>
                <td className="px-3 py-2 text-blue-700">{r.orderNumber}</td>
                <td className="px-3 py-2">{r.clientName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.fromCity} → {r.toCity}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.expectedStartDate ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.expectedEndDate ?? '—'}</td>
                <td className="px-3 py-2">{statusBadge(r.allocationStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section D — Trips & LRs
// ═══════════════════════════════════════════════════════════════════════════════

function TripsInProgressTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-trips-in-progress'],
    queryFn: reportsApi.getTripsInProgress,

  })
  const rows: TripInProgressResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Loading...' : 'Fetch Live Trips'}</Button>
      </div>
      {data && (
        <>
          {rows.length > 0 && <SummaryCard label="Trips In Transit" value={String(rows.length)} />}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>{[['LR #','left'],['Vehicle','left'],['Client','left'],['From','left'],['To','left'],['Loaded At','left'],['Expected Delivery','left'],['Days In Transit','center'],['Weight (T)','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && <tr><td colSpan={9}><EmptyState msg="No trips currently in transit" /></td></tr>}
                {rows.map(r => (
                  <tr key={r.lrId} className={`hover:bg-gray-50 ${r.expectedDeliveryDate && new Date(r.expectedDeliveryDate) < new Date() ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-blue-700">{r.lrNumber}</td>
                    <td className="px-3 py-2">{r.registrationNumber}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2">{r.fromCity}</td>
                    <td className="px-3 py-2">{r.toCity}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.loadedAt ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.expectedDeliveryDate ?? '—'}</td>
                    <td className="px-3 py-2 text-center font-semibold">{r.daysInTransit}d</td>
                    <td className="px-3 py-2 text-right">{fmt(r.loadedWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch to load live trips" />}
    </div>
  )
}

function LrStatusFunnelTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-lr-funnel', from, to],
    queryFn: () => reportsApi.getLrStatusFunnel(from, to),

  })
  const d: LrStatusFunnelResponse | undefined = data?.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {d && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total LRs', value: d.total, color: 'text-gray-900' },
            { label: 'Created', value: d.created, color: 'text-blue-600' },
            { label: 'In Transit', value: d.inTransit, color: 'text-orange-500' },
            { label: 'Delivered', value: d.delivered, color: 'text-green-600' },
            { label: 'Cancelled', value: d.cancelled, color: 'text-red-500' },
          ].map(c => (
            <div key={c.label} className="bg-white border rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.label}</div>
              {d.total > 0 && c.label !== 'Total LRs' && (
                <div className="text-xs text-gray-400">{((c.value / d.total) * 100).toFixed(1)}%</div>
              )}
            </div>
          ))}
        </div>
      )}
      {!d && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

function UnbilledLrsTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-unbilled-lrs'],
    queryFn: reportsApi.getUnbilledLrs,

  })
  const rows: UnbilledLrResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Loading...' : 'Fetch Unbilled LRs'}</Button>
      </div>
      {data && (
        <>
          {rows.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              <SummaryCard label="Unbilled LRs" value={String(rows.length)} sub="Delivered but not invoiced" />
              <SummaryCard label="Oldest" value={rows.length > 0 ? `${rows[0].daysSinceDelivery}d` : '—'} sub="Days since delivery" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>{[['LR #','left'],['Vehicle','left'],['Client','left'],['From','left'],['To','left'],['Delivered At','left'],['Delivered Wt (T)','right'],['Days Pending','center']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && <tr><td colSpan={8}><EmptyState msg="All delivered LRs are invoiced" /></td></tr>}
                {rows.map(r => (
                  <tr key={r.lrId} className={`hover:bg-gray-50 ${r.daysSinceDelivery > 7 ? 'bg-red-50' : r.daysSinceDelivery > 3 ? 'bg-orange-50/40' : ''}`}>
                    <td className="px-3 py-2 font-medium text-blue-700">{r.lrNumber}</td>
                    <td className="px-3 py-2">{r.registrationNumber}</td>
                    <td className="px-3 py-2">{r.clientName}</td>
                    <td className="px-3 py-2">{r.fromCity}</td>
                    <td className="px-3 py-2">{r.toCity}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.deliveredAt ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.deliveredWeight)}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${r.daysSinceDelivery > 7 ? 'text-red-600' : r.daysSinceDelivery > 3 ? 'text-orange-500' : 'text-gray-700'}`}>{r.daysSinceDelivery}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch to check unbilled LRs" />}
    </div>
  )
}

function InvoiceTurnaroundTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-invoice-turnaround', from, to],
    queryFn: () => reportsApi.getInvoiceTurnaround(from, to),

  })
  const rows: InvoiceTurnaroundResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <SummaryCard label="Overall Avg Turnaround" value={`${(rows.reduce((s, r) => s + r.avgTurnaroundDays * r.lrCount, 0) / rows.reduce((s, r) => s + r.lrCount, 0)).toFixed(1)} days`} sub="Delivery to invoice" />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{['Client', 'LR Count', 'Avg Days', 'Max Days'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={4}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.clientName}</td>
                <td className="px-3 py-2 text-center">{r.lrCount}</td>
                <td className={`px-3 py-2 text-center font-semibold ${r.avgTurnaroundDays > 7 ? 'text-red-600' : r.avgTurnaroundDays > 3 ? 'text-orange-500' : 'text-green-600'}`}>{r.avgTurnaroundDays}d</td>
                <td className="px-3 py-2 text-center text-red-600">{r.maxTurnaroundDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TripDurationTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-trip-duration', from, to],
    queryFn: () => reportsApi.getTripDurationAnalysis(from, to),

  })
  const rows: TripDurationResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Route','left'],['Trips','center'],['Avg Duration','center'],['Min','center'],['Max','center']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={5}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.fromCity} → {r.toCity}</td>
                <td className="px-3 py-2 text-center">{r.tripCount}</td>
                <td className="px-3 py-2 text-center font-semibold">{r.avgDurationHours}h</td>
                <td className="px-3 py-2 text-center text-green-700">{r.minDurationHours}h</td>
                <td className="px-3 py-2 text-center text-red-600">{r.maxDurationHours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WeightVarianceTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-weight-variance', from, to],
    queryFn: () => reportsApi.getWeightVarianceReport(from, to),

  })
  const rows: WeightVarianceReportResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Loaded (T)" value={fmt(rows.reduce((s, r) => s + r.totalLoadedWeight, 0))} />
          <SummaryCard label="Total Delivered (T)" value={fmt(rows.reduce((s, r) => s + r.totalDeliveredWeight, 0))} />
          <SummaryCard label="Total Variance (T)" value={fmt(rows.reduce((s, r) => s + r.totalVariance, 0))} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Client','left'],['LRs','center'],['Loaded (T)','right'],['Delivered (T)','right'],['Variance (T)','right'],['Variance %','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={6}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.clientId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.clientName}</td>
                <td className="px-3 py-2 text-center">{r.lrCount}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalLoadedWeight)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalDeliveredWeight)}</td>
                <td className="px-3 py-2 text-right font-medium text-red-600">{fmt(r.totalVariance)}</td>
                <td className={`px-3 py-2 text-right font-medium ${r.avgVariancePct > 5 ? 'text-red-600' : r.avgVariancePct > 2 ? 'text-orange-500' : 'text-green-600'}`}>{r.avgVariancePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OverloadingTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-overloading', from, to],
    queryFn: () => reportsApi.getOverloadingIncidents(from, to),

  })
  const rows: OverloadingIncidentResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && <SummaryCard label="Overloading Incidents" value={String(rows.length)} sub="LRs exceeding allocated weight" />}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['LR #','left'],['Date','left'],['Vehicle','left'],['Client','left'],['Route','left'],['Allocated (T)','right'],['Loaded (T)','right'],['Excess (T)','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={8}><EmptyState msg="No overloading incidents in this period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.lrId} className="bg-red-50 hover:bg-red-100/50">
                <td className="px-3 py-2 font-medium text-blue-700">{r.lrNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.lrDate}</td>
                <td className="px-3 py-2">{r.registrationNumber}</td>
                <td className="px-3 py-2">{r.clientName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.fromCity} → {r.toCity}</td>
                <td className="px-3 py-2 text-right">{fmt(r.allocatedWeight)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmt(r.loadedWeight)}</td>
                <td className="px-3 py-2 text-right font-semibold text-red-600">+{fmt(r.overloadWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 0 — Trip & Tonnage Targets
// ═══════════════════════════════════════════════════════════════════════════════
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(pct, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

function SetTargetForm({ year, month, existing, onSaved }: {
  year: number; month: number; existing?: TenantTargetResponse; onSaved: () => void
}) {
  const qc = useQueryClient()
  const [trips, setTrips] = useState(existing?.targetTrips?.toString() ?? '')
  const [tons, setTons] = useState(existing?.targetTons?.toString() ?? '')

  const mutation = useMutation({
    mutationFn: () => reportsApi.setTarget({
      year, month,
      targetTrips: trips ? Number(trips) : undefined,
      targetTons: tons ? Number(tons) : undefined,
    }),
    onSuccess: () => {
      toast.success('Target saved')
      qc.invalidateQueries({ queryKey: ['targets'] })
      onSaved()
    },
    onError: () => toast.error('Failed to save target'),
  })

  return (
    <div className="flex gap-3 items-end flex-wrap">
      <div>
        <Label className="text-xs text-gray-500">Target Trips</Label>
        <Input type="number" value={trips} onChange={e => setTrips(e.target.value)} className="h-8 text-sm w-32" placeholder="e.g. 600" />
      </div>
      <div>
        <Label className="text-xs text-gray-500">Target Tons</Label>
        <Input type="number" value={tons} onChange={e => setTons(e.target.value)} className="h-8 text-sm w-36" placeholder="e.g. 15000" />
      </div>
      <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save Target'}
      </Button>
    </div>
  )
}

function TargetsTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [editing, setEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['targets', year, month],
    queryFn: () => reportsApi.getTarget(year, month),
  })
  const target: TenantTargetResponse | undefined = data?.data

  const { data: allData } = useQuery({
    queryKey: ['targets'],
    queryFn: () => reportsApi.getAllTargets(),
  })
  const allTargets: TenantTargetResponse[] = allData?.data ?? []

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <div>
          <Label className="text-xs text-gray-500">Year</Label>
          <SearchableSelect
            value={String(year)}
            onValueChange={v => { setYear(Number(v)); setEditing(false) }}
            options={years.map(y => ({ value: String(y), label: String(y) }))}
            placeholder="Year"
            className="w-28"
            triggerClassName="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Month</Label>
          <SearchableSelect
            value={String(month)}
            onValueChange={v => { setMonth(Number(v)); setEditing(false) }}
            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
            placeholder="Month"
            className="w-28"
            triggerClassName="h-8 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(e => !e)}>
          {editing ? 'Cancel' : (target?.targetTrips || target?.targetTons ? 'Edit Target' : 'Set Target')}
        </Button>
      </div>

      {editing && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-sm font-medium text-amber-800 mb-3">
            Set target for {MONTHS[month - 1]} {year}
          </div>
          <SetTargetForm year={year} month={month} existing={target} onSaved={() => setEditing(false)} />
        </div>
      )}

      {/* Current month progress */}
      {!isLoading && target && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trips */}
          <div className="bg-white border rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold text-gray-700">Trip Progress</div>
              <div className="text-xs text-gray-400">{MONTHS[month - 1]} {year}</div>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-gray-900">{target.actualTrips}</span>
              <span className="text-sm text-gray-400 mb-1">
                {target.targetTrips ? `/ ${target.targetTrips} trips` : 'trips (no target set)'}
              </span>
            </div>
            {target.targetTrips && target.tripsProgressPct != null ? (
              <ProgressBar
                pct={target.tripsProgressPct}
                color={target.tripsProgressPct >= 100 ? 'bg-green-500' : target.tripsProgressPct >= 75 ? 'bg-blue-500' : 'bg-orange-400'}
              />
            ) : (
              <div className="text-xs text-gray-400">Set a target to track progress</div>
            )}
            {target.targetTrips && (
              <div className="text-xs text-gray-500">
                {Math.max(0, target.targetTrips - target.actualTrips)} trips remaining
              </div>
            )}
          </div>

          {/* Tons */}
          <div className="bg-white border rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold text-gray-700">Tonnage Progress</div>
              <div className="text-xs text-gray-400">{MONTHS[month - 1]} {year}</div>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-gray-900">{fmt(target.actualTons)}</span>
              <span className="text-sm text-gray-400 mb-1">
                {target.targetTons ? `/ ${fmt(target.targetTons)} tons` : 'tons (no target set)'}
              </span>
            </div>
            {target.targetTons && target.tonsProgressPct != null ? (
              <ProgressBar
                pct={target.tonsProgressPct}
                color={target.tonsProgressPct >= 100 ? 'bg-green-500' : target.tonsProgressPct >= 75 ? 'bg-blue-500' : 'bg-orange-400'}
              />
            ) : (
              <div className="text-xs text-gray-400">Set a target to track progress</div>
            )}
            {target.targetTons && (
              <div className="text-xs text-gray-500">
                {fmt(Math.max(0, Number(target.targetTons) - Number(target.actualTons)))} tons remaining
              </div>
            )}
          </div>
        </div>
      )}

      {/* All targets history */}
      {allTargets.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">All Targets</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  {[['Period','left'],['Target Trips','center'],['Actual Trips','center'],['Trips %','left'],['Target Tons','center'],['Actual Tons','center'],['Tons %','left']].map(([h,a])=>(
                    <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allTargets.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{MONTHS[(t.month ?? 1) - 1]} {t.year}</td>
                    <td className="px-3 py-2 text-center">{t.targetTrips ?? '—'}</td>
                    <td className="px-3 py-2 text-center font-medium">{t.actualTrips}</td>
                    <td className="px-3 py-2">
                      {t.tripsProgressPct != null
                        ? <ProgressBar pct={t.tripsProgressPct} color={t.tripsProgressPct >= 100 ? 'bg-green-500' : 'bg-blue-400'} />
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">{t.targetTons != null ? fmt(t.targetTons) : '—'}</td>
                    <td className="px-3 py-2 text-center font-medium">{fmt(t.actualTons)}</td>
                    <td className="px-3 py-2">
                      {t.tonsProgressPct != null
                        ? <ProgressBar pct={t.tonsProgressPct} color={t.tonsProgressPct >= 100 ? 'bg-green-500' : 'bg-blue-400'} />
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allTargets.length === 0 && !isLoading && (
        <EmptyState msg="No targets set yet. Select a month and click Set Target." />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1 — LR Register
// ═══════════════════════════════════════════════════════════════════════════════
function LrRegisterTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [clientId, setClientId] = useState('all')


  const { data, isFetching } = useQuery({
    queryKey: ['report-lr-register', from, to, clientId],
    queryFn: () => reportsApi.getLrRegister(from, to, clientId !== 'all' ? Number(clientId) : undefined),

  })
  const rows: LrRegisterRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <ClientSelect value={clientId} onChange={v => { setClientId(v) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total LRs" value={String(rows.length)} />
          <SummaryCard label="Total Allocated (T)" value={fmt(rows.reduce((s, r) => s + (r.allocatedWeight ?? 0), 0))} />
          <SummaryCard label="Total Loaded (T)" value={fmt(rows.reduce((s, r) => s + (r.loadedWeight ?? 0), 0))} />
          <SummaryCard label="Total Delivered (T)" value={fmt(rows.reduce((s, r) => s + (r.deliveredWeight ?? 0), 0))} />
          <SummaryCard label="Overloaded" value={String(rows.filter(r => r.isOverloaded).length)} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {[['LR #','left'],['Date','left'],['Order #','left'],['Client','left'],['Vehicle','left'],['From','left'],['To','left'],['Material','left'],
                ['Allocated','right'],['Loaded','right'],['Delivered','right'],['Variance','right'],['Rate Type','left'],['Rate','right'],['Status','left']].map(([h,a])=>(
                <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={15}><EmptyState msg="Select filters and click Fetch Report" /></td></tr>
            )}
            {rows.map(r => (
              <tr key={r.lrId} className={`hover:bg-gray-50 ${r.isOverloaded ? 'bg-red-50' : ''}`}>
                <td className="px-3 py-2 font-medium text-blue-700">{r.lrNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.lrDate}</td>
                <td className="px-3 py-2">{r.orderNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.clientName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.vehicleRegistrationNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.fromCity}, {r.fromState}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.toCity}, {r.toState}</td>
                <td className="px-3 py-2">{r.materialType}</td>
                <td className="px-3 py-2 text-right">{fmt(r.allocatedWeight)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.loadedWeight)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.deliveredWeight)}</td>
                <td className={`px-3 py-2 text-right ${r.isOverloaded ? 'text-red-600 font-medium' : ''}`}>
                  {fmt(r.weightVariance)} {r.isOverloaded ? '⚠' : ''}
                </td>
                <td className="px-3 py-2">{r.freightRateType}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.freightRate)}</td>
                <td className="px-3 py-2">{statusBadge(r.lrStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Invoice Outstanding
// ═══════════════════════════════════════════════════════════════════════════════
function InvoiceOutstandingTab() {
  const [clientId, setClientId] = useState('all')


  const { data, isFetching } = useQuery({
    queryKey: ['report-invoice-outstanding', clientId],
    queryFn: () => reportsApi.getInvoiceOutstanding(clientId !== 'all' ? Number(clientId) : undefined),

  })
  const rows: InvoiceOutstandingRow[] = data?.data ?? []
  const totalOutstanding = rows.reduce((s, r) => s + r.balanceDue, 0)
  const overdueCount = rows.filter(r => r.daysOverdue > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <ClientSelect value={clientId} onChange={v => { setClientId(v) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Invoices" value={String(rows.length)} />
          <SummaryCard label="Total Outstanding" value={fmtRs(totalOutstanding)} />
          <SummaryCard label="Overdue" value={String(overdueCount)} sub="invoices past due date" />
          <SummaryCard label="Total Invoiced" value={fmtRs(rows.reduce((s, r) => s + r.totalAmount, 0))} />
          <SummaryCard label="Total Collected" value={fmtRs(rows.reduce((s, r) => s + r.amountPaid, 0))} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {[['Invoice #','left'],['Date','left'],['Due Date','left'],['Client','left'],['Total','right'],['Paid','right'],['Balance Due','right'],['Status','left'],['Days Overdue','right']].map(([h,a])=>(
                <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={9}><EmptyState msg="Select filters and click Fetch Report" /></td></tr>
            )}
            {rows.map(r => (
              <tr key={r.invoiceId} className={`hover:bg-gray-50 ${r.daysOverdue > 0 ? 'bg-red-50' : ''}`}>
                <td className="px-3 py-2 font-medium text-blue-700">{r.invoiceNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.invoiceDate}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.dueDate ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.clientName}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.totalAmount)}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtRs(r.amountPaid)}</td>
                <td className="px-3 py-2 text-right font-medium text-red-600">{fmtRs(r.balanceDue)}</td>
                <td className="px-3 py-2">{statusBadge(r.invoiceStatus)}</td>
                <td className={`px-3 py-2 text-right ${r.daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                  {r.daysOverdue > 0 ? `${r.daysOverdue}d` : '—'}
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-gray-50 font-semibold text-xs">
                <td colSpan={4} className="px-3 py-2 text-right text-gray-600">Total</td>
                <td className="px-3 py-2 text-right">{fmtRs(rows.reduce((s, r) => s + r.totalAmount, 0))}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtRs(rows.reduce((s, r) => s + r.amountPaid, 0))}</td>
                <td className="px-3 py-2 text-right text-red-600">{fmtRs(totalOutstanding)}</td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3 — Collection Report
// ═══════════════════════════════════════════════════════════════════════════════
function CollectionReportTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [clientId, setClientId] = useState('all')


  const { data, isFetching } = useQuery({
    queryKey: ['report-collections', from, to, clientId],
    queryFn: () => reportsApi.getCollectionReport(from, to, clientId !== 'all' ? Number(clientId) : undefined),

  })
  const rows: CollectionReportRow[] = data?.data ?? []
  const totalCollected = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <ClientSelect value={clientId} onChange={v => { setClientId(v) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Payments" value={String(rows.length)} />
          <SummaryCard label="Total Collected" value={fmtRs(totalCollected)} />
          {['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI'].map(mode => {
            const amt = rows.filter(r => r.paymentMode === mode).reduce((s, r) => s + r.amount, 0)
            return amt > 0 ? <SummaryCard key={mode} label={mode} value={fmtRs(amt)} /> : null
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {[['Date','left'],['Client','left'],['Invoice #','left'],['Amount','right'],['Mode','left'],['Reference','left'],['Remarks','left']].map(([h,a])=>(
                <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={7}><EmptyState msg="Select filters and click Fetch Report" /></td></tr>
            )}
            {rows.map(r => (
              <tr key={r.paymentId} className="hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.paymentDate}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.clientName}</td>
                <td className="px-3 py-2 font-medium text-blue-700">{r.invoiceNumber}</td>
                <td className="px-3 py-2 text-right font-medium text-green-700">{fmtRs(r.amount)}</td>
                <td className="px-3 py-2">{statusBadge(r.paymentMode)}</td>
                <td className="px-3 py-2 text-gray-500">{r.referenceNumber ?? '—'}</td>
                <td className="px-3 py-2 text-gray-500">{r.remarks ?? '—'}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-gray-50 font-semibold text-xs">
                <td colSpan={3} className="px-3 py-2 text-right text-gray-600">Total</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtRs(totalCollected)}</td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4 — Client Statement
// ═══════════════════════════════════════════════════════════════════════════════
function ClientStatementTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [clientId, setClientId] = useState('all')


  const canFetch = clientId !== 'all'

  const { data, isFetching } = useQuery({
    queryKey: ['report-client-statement', clientId, from, to],
    queryFn: () => reportsApi.getClientStatement(Number(clientId), from, to),
    enabled: canFetch,
  })
  const stmt: ClientStatementResponse | undefined = data?.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <ClientSelect value={clientId} onChange={v => { setClientId(v) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
        {!canFetch && <span className="text-xs text-amber-600 self-center">Select a client first</span>}
      </div>

      {stmt && (
        <>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-gray-900 text-sm">{stmt.clientName}</div>
                {stmt.clientPhone && <div className="text-xs text-gray-500">{stmt.clientPhone}</div>}
                {stmt.gstin && <div className="text-xs text-gray-500">GSTIN: {stmt.gstin}</div>}
              </div>
              <div className="flex gap-3">
                <SummaryCard label="Total Invoiced" value={fmtRs(stmt.totalInvoiced)} />
                <SummaryCard label="Total Paid" value={fmtRs(stmt.totalPaid)} />
                <SummaryCard label="Closing Balance" value={fmtRs(stmt.closingBalance)}
                  sub={stmt.closingBalance > 0 ? 'Amount due' : 'No dues'} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>
                  {[['Date','left'],['Type','left'],['Reference','left'],['Description','left'],['Debit (Dr)','right'],['Credit (Cr)','right'],['Balance','right']].map(([h,a])=>(
                    <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stmt.rows.length === 0 && (
                  <tr><td colSpan={7}><EmptyState msg="No transactions in this period" /></td></tr>
                )}
                {stmt.rows.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 ${r.type === 'PAYMENT' ? 'bg-green-50/40' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.type === 'INVOICE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{r.referenceNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.description}</td>
                    <td className="px-3 py-2 text-right text-red-600">{r.debit > 0 ? fmtRs(r.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right text-green-700">{r.credit > 0 ? fmtRs(r.credit) : '—'}</td>
                    <td className={`px-3 py-2 text-right font-medium ${r.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {fmtRs(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!stmt && !isFetching && canFetch && (
        <EmptyState msg="No data found for selected period" />
      )}
      {!canFetch && <EmptyState msg="Select a client and date range to view statement" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5 — Vehicle Trip Report
// ═══════════════════════════════════════════════════════════════════════════════
function VehicleTripTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())


  const { data, isFetching } = useQuery({
    queryKey: ['report-vehicle-trips', from, to],
    queryFn: () => reportsApi.getVehicleTripReport(from, to),

  })
  const rows: VehicleTripRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Vehicles Active" value={String(rows.length)} />
          <SummaryCard label="Total Trips" value={String(rows.reduce((s, r) => s + r.totalTrips, 0))} />
          <SummaryCard label="Total Loaded (T)" value={fmt(rows.reduce((s, r) => s + (r.totalLoadedWeight ?? 0), 0))} />
          <SummaryCard label="Total Delivered (T)" value={fmt(rows.reduce((s, r) => s + (r.totalDeliveredWeight ?? 0), 0))} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {[['Vehicle','left'],['Type','left'],['Brand','left'],['Total Trips','center'],['Allocated (T)','right'],['Loaded (T)','right'],['Delivered (T)','right']].map(([h,a])=>(
                <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={7}><EmptyState msg="No data found for the selected period" /></td></tr>
            )}
            {rows.map(r => (
              <tr key={r.vehicleId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
                <td className="px-3 py-2 text-gray-600">{r.vehicleType ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{r.brand ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                    {r.totalTrips}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{fmt(r.totalAllocatedWeight)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalLoadedWeight)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalDeliveredWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 6 — Order Status Report
// ═══════════════════════════════════════════════════════════════════════════════
const ORDER_STATUSES = [
  'PENDING', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED',
  'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'COMPLETED',
]
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', PARTIALLY_ASSIGNED: 'Partially Assigned', FULLY_ASSIGNED: 'Fully Assigned',
  IN_TRANSIT: 'In Transit', PARTIALLY_DELIVERED: 'Partially Delivered',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled', COMPLETED: 'Completed',
}

function OrderStatusTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [status, setStatus] = useState('all')


  const { data, isFetching } = useQuery({
    queryKey: ['report-order-status', from, to, status],
    queryFn: () => reportsApi.getOrderStatusReport(from, to, status !== 'all' ? status : undefined),

  })
  const rows: OrderStatusRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <div>
          <Label className="text-xs text-gray-500">Status</Label>
          <SearchableSelect
            value={status}
            onValueChange={v => { setStatus(v) }}
            options={[{ value: 'all', label: 'All Statuses' }, ...ORDER_STATUSES.map(s => ({ value: s, label: ORDER_STATUS_LABELS[s] ?? s }))]}
            placeholder="All Statuses"
            className="w-40"
            triggerClassName="h-8 text-sm"
          />
        </div>
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Orders" value={String(rows.length)} />
          <SummaryCard label="Total Weight (T)" value={fmt(rows.reduce((s, r) => s + (r.totalWeight ?? 0), 0))} />
          <SummaryCard label="Total Freight" value={fmtRs(rows.reduce((s, r) => s + (r.totalFreightAmount ?? 0), 0))} />
          {ORDER_STATUSES.map(s => {
            const cnt = rows.filter(r => r.orderStatus === s).length
            return cnt > 0 ? <SummaryCard key={s} label={ORDER_STATUS_LABELS[s] ?? s} value={String(cnt)} /> : null
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {[['Order #','left'],['Date','left'],['Client','left'],['From','left'],['To','left'],['Material','left'],['Weight (T)','right'],['Freight','right'],['Status','left'],['Payment','left']].map(([h,a])=>(
                <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={10}><EmptyState msg="Select filters and click Fetch Report" /></td></tr>
            )}
            {rows.map(r => (
              <tr key={r.orderId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-blue-700">{r.orderNumber}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.orderDate}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.clientName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.fromCity}, {r.fromState}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.toCity}, {r.toState}</td>
                <td className="px-3 py-2">{r.materialType}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalWeight)}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.totalFreightAmount)}</td>
                <td className="px-3 py-2">{statusBadge(r.orderStatus)}</td>
                <td className="px-3 py-2">{statusBadge(r.orderPaymentStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 7 — Payroll Summary
// ═══════════════════════════════════════════════════════════════════════════════
function PayrollSummaryTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(monthEnd())


  const { data, isFetching } = useQuery({
    queryKey: ['report-payroll-summary', from, to],
    queryFn: () => reportsApi.getPayrollSummary(from, to),

  })
  const rows: PayrollSummaryRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Staff" value={String(rows.length)} />
          <SummaryCard label="Total Gross" value={fmtRs(rows.reduce((s, r) => s + r.grossPay, 0))} />
          <SummaryCard label="Total Deductions" value={fmtRs(rows.reduce((s, r) => s + r.totalDeductions, 0))} />
          <SummaryCard label="Total Net Pay" value={fmtRs(rows.reduce((s, r) => s + r.netPay, 0))} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {[['Staff','left'],['Phone','left'],['Role','left'],['Pay Cycle','left'],['Days','center'],['Present','center'],['Absent','center'],['Half Day','center'],
                ['Daily Rate','right'],['Basic','right'],['OT','right'],['Bonus','right'],['Gross','right'],['Deductions','right'],['Net Pay','right'],['Status','left']].map(([h,a])=>(
                <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={16}><EmptyState msg="No data found for the selected period" /></td></tr>
            )}
            {rows.map(r => (
              <tr key={r.payrollId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.userName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.userPhone}</td>
                <td className="px-3 py-2">{r.roleName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.payCycleStartDate} → {r.payCycleEndDate}</td>
                <td className="px-3 py-2 text-center">{r.totalDays}</td>
                <td className="px-3 py-2 text-center text-green-700">{r.presentDays}</td>
                <td className="px-3 py-2 text-center text-red-600">{r.absentDays}</td>
                <td className="px-3 py-2 text-center text-orange-600">{r.halfDays}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.dailyRate)}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.basicPay)}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.overtimePay)}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.tripBonus)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtRs(r.grossPay)}</td>
                <td className="px-3 py-2 text-right text-red-600">{fmtRs(r.totalDeductions)}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtRs(r.netPay)}</td>
                <td className="px-3 py-2">{statusBadge(r.payrollStatus)}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-gray-50 font-semibold text-xs">
                <td colSpan={12} className="px-3 py-2 text-right text-gray-600">Total</td>
                <td className="px-3 py-2 text-right">{fmtRs(rows.reduce((s, r) => s + r.grossPay, 0))}</td>
                <td className="px-3 py-2 text-right text-red-600">{fmtRs(rows.reduce((s, r) => s + r.totalDeductions, 0))}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtRs(rows.reduce((s, r) => s + r.netPay, 0))}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 8 — Attendance Report
// ═══════════════════════════════════════════════════════════════════════════════
function AttendanceReportTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())


  const { data, isFetching } = useQuery({
    queryKey: ['report-attendance', from, to],
    queryFn: () => reportsApi.getAttendanceReport(from, to),

  })
  const rows: AttendanceReportRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Staff" value={String(rows.length)} />
          <SummaryCard label="Avg Attendance" value={`${(rows.reduce((s, r) => s + r.attendancePercentage, 0) / rows.length).toFixed(1)}%`} />
          <SummaryCard label="Total Present Days" value={String(rows.reduce((s, r) => s + r.presentDays, 0))} />
          <SummaryCard label="Total Absent Days" value={String(rows.reduce((s, r) => s + r.absentDays, 0))} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {[['Staff','left'],['Phone','left'],['Role','left'],['Total Days','center'],['Present','center'],['Absent','center'],['Half Day','center'],['Leave','center'],['Attendance %','left']].map(([h,a])=>(
                <th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={9}><EmptyState msg="No data found for the selected period" /></td></tr>
            )}
            {rows.map(r => (
              <tr key={r.userId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.userName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.userPhone}</td>
                <td className="px-3 py-2">{r.roleName}</td>
                <td className="px-3 py-2 text-center">{r.totalDays}</td>
                <td className="px-3 py-2 text-center text-green-700 font-medium">{r.presentDays}</td>
                <td className="px-3 py-2 text-center text-red-600 font-medium">{r.absentDays}</td>
                <td className="px-3 py-2 text-center text-orange-600">{r.halfDays}</td>
                <td className="px-3 py-2 text-center text-blue-600">{r.leaveDays}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${r.attendancePercentage >= 90 ? 'bg-green-500' : r.attendancePercentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(r.attendancePercentage, 100)}%` }}
                      />
                    </div>
                    <span className={`font-medium ${r.attendancePercentage >= 90 ? 'text-green-700' : r.attendancePercentage >= 75 ? 'text-yellow-700' : 'text-red-600'}`}>
                      {r.attendancePercentage}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section E — Vehicle Performance
// ═══════════════════════════════════════════════════════════════════════════════
function VehicleRevenueTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-vehicle-revenue', from, to],
    queryFn: () => reportsApi.getVehicleRevenue(from, to),

  })
  const rows: VehicleRevenueResponse[] = data?.data ?? []
  const totalRevenue = rows.reduce((s, r) => s + r.estimatedRevenue, 0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Vehicles" value={String(rows.length)} />
          <SummaryCard label="Total Trips" value={String(rows.reduce((s, r) => s + r.tripCount, 0))} />
          <SummaryCard label="Total Loaded (T)" value={fmt(rows.reduce((s, r) => s + r.totalLoadedTons, 0))} />
          <SummaryCard label="Est. Revenue" value={fmtRs(totalRevenue)} sub="Based on freight rate" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Vehicle','left'],['Type','left'],['Trips','center'],['Loaded (T)','right'],['Est. Revenue','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={5}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.vehicleId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
                <td className="px-3 py-2 text-gray-500">{r.vehicleType ?? '—'}</td>
                <td className="px-3 py-2 text-center">{r.tripCount}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalLoadedTons)}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtRs(r.estimatedRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VehicleIdleDaysTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-vehicle-idle', from, to],
    queryFn: () => reportsApi.getVehicleIdleDays(from, to),

  })
  const rows: VehicleIdleDaysResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Vehicles" value={String(rows.length)} />
          <SummaryCard label="Avg Idle Days" value={`${(rows.reduce((s, r) => s + r.idleDays, 0) / rows.length).toFixed(1)}`} />
          <SummaryCard label="Avg Idle %" value={`${(rows.reduce((s, r) => s + r.idlePct, 0) / rows.length).toFixed(1)}%`} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Vehicle','left'],['Type','left'],['Total Days','center'],['Active Days','center'],['Idle Days','center'],['Idle %','left']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={6}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.vehicleId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
                <td className="px-3 py-2 text-gray-500">{r.vehicleType ?? '—'}</td>
                <td className="px-3 py-2 text-center">{r.totalDays}</td>
                <td className="px-3 py-2 text-center text-green-700">{r.activeDays}</td>
                <td className={`px-3 py-2 text-center font-semibold ${r.idleDays > r.totalDays * 0.5 ? 'text-red-600' : r.idleDays > r.totalDays * 0.25 ? 'text-orange-500' : 'text-gray-700'}`}>{r.idleDays}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${r.idlePct > 50 ? 'bg-red-500' : r.idlePct > 25 ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${Math.min(r.idlePct, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">{r.idlePct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VehicleTripCountTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-vehicle-trip-count', from, to],
    queryFn: () => reportsApi.getVehicleTripCount(from, to),

  })
  const rows: VehicleTripCountResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Active Vehicles" value={String(rows.length)} />
          <SummaryCard label="Total Trips" value={String(rows.reduce((s, r) => s + r.tripCount, 0))} />
          <SummaryCard label="Total Loaded (T)" value={fmt(rows.reduce((s, r) => s + r.totalLoadedTons, 0))} />
          <SummaryCard label="Total Delivered (T)" value={fmt(rows.reduce((s, r) => s + r.totalDeliveredTons, 0))} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Vehicle','left'],['Type','left'],['Trips','center'],['Loaded (T)','right'],['Delivered (T)','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={5}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.vehicleId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
                <td className="px-3 py-2 text-gray-500">{r.vehicleType ?? '—'}</td>
                <td className="px-3 py-2 text-center font-semibold">{r.tripCount}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalLoadedTons)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalDeliveredTons)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BreakdownFrequencyTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-breakdown-freq', from, to],
    queryFn: () => reportsApi.getBreakdownFrequency(from, to),

  })
  const rows: BreakdownFrequencyResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <SummaryCard label="Total Breakdowns" value={String(rows.reduce((s, r) => s + r.breakdownCount, 0))} sub={`Across ${rows.length} vehicles`} />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Vehicle','left'],['Type','left'],['Breakdowns','center'],['Types','left'],['Last Breakdown','left']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={5}><EmptyState msg="No breakdowns in this period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.vehicleId} className={`hover:bg-gray-50 ${r.breakdownCount >= 3 ? 'bg-red-50' : ''}`}>
                <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
                <td className="px-3 py-2 text-gray-500">{r.vehicleType ?? '—'}</td>
                <td className={`px-3 py-2 text-center font-semibold ${r.breakdownCount >= 3 ? 'text-red-600' : r.breakdownCount >= 2 ? 'text-orange-500' : 'text-gray-700'}`}>{r.breakdownCount}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.breakdownTypes.map(t => <span key={t} className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{t.replace('_', ' ')}</span>)}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-500">{r.lastBreakdownDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VehicleServiceCostTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-vehicle-service-cost', from, to],
    queryFn: () => reportsApi.getVehicleServiceCost(from, to),

  })
  const rows: VehicleServiceCostResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Vehicles Serviced" value={String(rows.length)} />
          <SummaryCard label="Total Services" value={String(rows.reduce((s, r) => s + r.serviceCount, 0))} />
          <SummaryCard label="Total Cost" value={fmtRs(rows.reduce((s, r) => s + r.totalServiceCost, 0))} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Vehicle','left'],['Type','left'],['Services','center'],['Total Cost','right'],['Last Service','left']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={5}><EmptyState msg="No services in this period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.vehicleId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.registrationNumber}</td>
                <td className="px-3 py-2 text-gray-500">{r.vehicleType ?? '—'}</td>
                <td className="px-3 py-2 text-center">{r.serviceCount}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtRs(r.totalServiceCost)}</td>
                <td className="px-3 py-2 text-gray-500">{r.lastServiceDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section F — Driver & Staff Performance
// ═══════════════════════════════════════════════════════════════════════════════
function DriverPerformanceTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-driver-perf', from, to],
    queryFn: () => reportsApi.getDriverPerformance(from, to),

  })
  const rows: DriverPerformanceResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Active Drivers" value={String(rows.length)} />
          <SummaryCard label="Total Trips" value={String(rows.reduce((s, r) => s + r.tripCount, 0))} />
          <SummaryCard label="Total Loaded (T)" value={fmt(rows.reduce((s, r) => s + r.totalLoadedTons, 0))} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Driver','left'],['Phone','left'],['Role','left'],['Trips','center'],['Loaded (T)','right'],['Delivered (T)','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={6}><EmptyState msg="No driver trips in this period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.userId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.driverName}</td>
                <td className="px-3 py-2">{r.phone}</td>
                <td className="px-3 py-2">{statusBadge(r.roleName ?? '')}</td>
                <td className="px-3 py-2 text-center font-semibold">{r.tripCount}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalLoadedTons)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalDeliveredTons)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttendanceGapsTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-att-gaps', from, to],
    queryFn: () => reportsApi.getAttendanceGaps(from, to),

  })
  const rows: AttendanceGapsResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <SummaryCard label="Staff with Gaps" value={String(rows.length)} sub="Unmarked attendance days" />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Staff','left'],['Role','left'],['Gap Days','center'],['Missing Dates (first 5)','left']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={4}><EmptyState msg="No attendance gaps in this period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.userId} className={`hover:bg-gray-50 ${r.totalGapDays > 7 ? 'bg-red-50' : ''}`}>
                <td className="px-3 py-2 font-medium">{r.userName}</td>
                <td className="px-3 py-2">{statusBadge(r.roleName ?? '')}</td>
                <td className={`px-3 py-2 text-center font-semibold ${r.totalGapDays > 7 ? 'text-red-600' : r.totalGapDays > 3 ? 'text-orange-500' : 'text-gray-700'}`}>{r.totalGapDays}</td>
                <td className="px-3 py-2 text-gray-500">{r.gapDates.slice(0, 5).join(', ')}{r.gapDates.length > 5 ? ` +${r.gapDates.length - 5} more` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttendanceTrendTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-att-trend', from, to],
    queryFn: () => reportsApi.getAttendanceTrend(from, to),

  })
  const rows: AttendanceTrendResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Date','left'],['Total Staff','center'],['Present','center'],['Absent','center'],['Leave','center'],['Not Marked','center']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={6}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.date} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2 text-center">{r.totalStaff}</td>
                <td className="px-3 py-2 text-center font-semibold text-green-700">{r.presentCount}</td>
                <td className="px-3 py-2 text-center font-semibold text-red-600">{r.absentCount}</td>
                <td className="px-3 py-2 text-center text-blue-600">{r.leaveCount}</td>
                <td className="px-3 py-2 text-center text-gray-400">{r.notMarkedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttendanceCalendarTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const { data, isLoading } = useQuery({
    queryKey: ['report-att-calendar', year, month],
    queryFn: () => reportsApi.getAttendanceCalendar(year, month),
  })
  const cal: AttendanceCalendarResponse | undefined = data?.data

  const STATUS_COLOR: Record<string, string> = {
    PRESENT: 'bg-green-100 text-green-700',
    ABSENT: 'bg-red-100 text-red-700',
    HALF_DAY: 'bg-orange-100 text-orange-700',
    LEAVE: 'bg-blue-100 text-blue-700',
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - 1 + i)
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <div>
          <Label className="text-xs text-gray-500">Year</Label>
          <SearchableSelect
            value={String(year)} onValueChange={v => setYear(Number(v))}
            options={years.map(y => ({ value: String(y), label: String(y) }))}
            placeholder="Year" className="w-24" triggerClassName="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Month</Label>
          <SearchableSelect
            value={String(month)} onValueChange={v => setMonth(Number(v))}
            options={monthNames.map((m, i) => ({ value: String(i + 1), label: m }))}
            placeholder="Month" className="w-24" triggerClassName="h-8 text-sm"
          />
        </div>
      </div>

      {isLoading && <EmptyState msg="Loading calendar..." />}
      {cal && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border rounded-lg overflow-hidden" style={{ minWidth: `${cal.daysInMonth * 32 + 200}px` }}>
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-gray-50 border-r">Staff</th>
                {Array.from({ length: cal.daysInMonth }, (_, i) => (
                  <th key={i + 1} className="px-1 py-2 text-center font-medium w-8">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cal.users.length === 0 && <tr><td colSpan={cal.daysInMonth + 1}><EmptyState msg="No staff found" /></td></tr>}
              {cal.users.map(u => (
                <tr key={u.userId} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap sticky left-0 bg-white border-r">{u.userName}</td>
                  {Array.from({ length: cal.daysInMonth }, (_, i) => {
                    const status = u.dailyStatus[i + 1]
                    return (
                      <td key={i + 1} className="px-0.5 py-1 text-center">
                        {status
                          ? <span className={`inline-block w-7 h-5 rounded text-[10px] font-medium leading-5 ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`} title={status}>
                              {status[0]}
                            </span>
                          : <span className="inline-block w-7 h-5 rounded bg-gray-50 text-gray-300 text-[10px] leading-5">—</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            {Object.entries(STATUS_COLOR).map(([s, cls]) => (
              <div key={s} className="flex items-center gap-1">
                <span className={`inline-block w-4 h-4 rounded ${cls}`} />
                {s.replace('_', ' ')}
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="inline-block w-4 h-4 rounded bg-gray-50 border" />
              Not Marked
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section G — Financial Intelligence
// ═══════════════════════════════════════════════════════════════════════════════
function InvoiceAgingTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-invoice-aging'],
    queryFn: reportsApi.getInvoiceAging,

  })
  const d: InvoiceAgingResponse | undefined = data?.data
  const [bucket, setBucket] = useState<'0-30' | '31-60' | '61-90' | '90+'>('0-30')

  const buckets = d ? [
    { key: '0-30' as const, label: '0–30 Days', data: d.bucket0to30, color: 'text-green-700 border-green-300 bg-green-50' },
    { key: '31-60' as const, label: '31–60 Days', data: d.bucket31to60, color: 'text-yellow-700 border-yellow-300 bg-yellow-50' },
    { key: '61-90' as const, label: '61–90 Days', data: d.bucket61to90, color: 'text-orange-700 border-orange-300 bg-orange-50' },
    { key: '90+' as const, label: '90+ Days', data: d.bucket90plus, color: 'text-red-700 border-red-300 bg-red-50' },
  ] : []

  const activeBucket = buckets.find(b => b.key === bucket)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Loading...' : 'Fetch Aging'}</Button>
      </div>
      {d && (
        <>
          <div className="flex gap-3 flex-wrap">
            <SummaryCard label="Total Outstanding" value={String(d.totalOutstanding)} />
            <SummaryCard label="Total Amount" value={fmtRs(d.totalAmount)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {buckets.map(b => (
              <button key={b.key} onClick={() => setBucket(b.key)}
                className={`rounded-xl p-4 text-left border-2 transition-all ${bucket === b.key ? b.color : 'bg-white hover:bg-gray-50 border-gray-200'}`}>
                <div className="text-xl font-bold">{b.data.count}</div>
                <div className="text-xs mt-0.5 font-medium">{b.label}</div>
                <div className="text-xs mt-1 text-gray-600">{fmtRs(b.data.amount)}</div>
              </button>
            ))}
          </div>
          {activeBucket && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-600 uppercase">
                  <tr>{[['Invoice #','left'],['Client','left'],['Invoice Date','left'],['Balance Due','right'],['Age (Days)','center']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeBucket.data.invoices.length === 0 && <tr><td colSpan={5}><EmptyState msg="No invoices in this bucket" /></td></tr>}
                  {activeBucket.data.invoices.map(r => (
                    <tr key={r.invoiceId} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-blue-700">{r.invoiceNumber}</td>
                      <td className="px-3 py-2">{r.clientName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.invoiceDate}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">{fmtRs(r.balanceDue)}</td>
                      <td className={`px-3 py-2 text-center font-medium ${r.ageInDays > 90 ? 'text-red-600' : r.ageInDays > 60 ? 'text-orange-500' : r.ageInDays > 30 ? 'text-yellow-600' : 'text-green-600'}`}>{r.ageInDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {!d && !isFetching && <EmptyState msg="Click Fetch Aging to load outstanding invoices" />}
    </div>
  )
}

function RevenueTrendTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-revenue-trend'],
    queryFn: reportsApi.getRevenueTrend,
  })
  const rows: RevenueTrendResponse[] = data?.data ?? []
  const maxRevenue = Math.max(...rows.map(r => r.totalRevenue), 1)

  return (
    <div className="space-y-4">
      {isLoading && <EmptyState msg="Loading..." />}
      {rows.length > 0 && (
        <>
          <div className="flex gap-3 flex-wrap">
            <SummaryCard label="Total Revenue (6m)" value={fmtRs(rows.reduce((s, r) => s + r.totalRevenue, 0))} />
            <SummaryCard label="Total Invoices" value={String(rows.reduce((s, r) => s + r.invoiceCount, 0))} />
            <SummaryCard label="Best Month" value={rows.reduce((a, b) => a.totalRevenue > b.totalRevenue ? a : b).period} />
          </div>
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.period} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600 w-20 shrink-0">{r.period}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div className="h-6 bg-blue-500 rounded-full transition-all" style={{ width: `${(r.totalRevenue / maxRevenue) * 100}%` }} />
                  <span className="absolute right-2 top-0 h-6 flex items-center text-xs font-medium text-gray-700">{fmtRs(r.totalRevenue)}</span>
                </div>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">{r.invoiceCount} inv</span>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>{[['Period','left'],['Invoices','center'],['Subtotal','right'],['Tax','right'],['Total Revenue','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.period} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{r.period}</td>
                    <td className="px-3 py-2 text-center">{r.invoiceCount}</td>
                    <td className="px-3 py-2 text-right">{fmtRs(r.subtotal)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmtRs(r.taxAmount)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtRs(r.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!isLoading && rows.length === 0 && <EmptyState msg="No invoice data found" />}
    </div>
  )
}

function RouteProfitabilityTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-route-profit', from, to],
    queryFn: () => reportsApi.getRouteProfitability(from, to),

  })
  const rows: RouteProfitabilityResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Routes" value={String(rows.length)} />
          <SummaryCard label="Total Revenue" value={fmtRs(rows.reduce((s, r) => s + r.totalRevenue, 0))} />
          <SummaryCard label="Total Charges" value={fmtRs(rows.reduce((s, r) => s + r.totalCharges, 0))} />
          <SummaryCard label="Net Profit" value={fmtRs(rows.reduce((s, r) => s + r.netProfit, 0))} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Route','left'],['Trips','center'],['Revenue','right'],['Charges','right'],['Net Profit','right'],['Margin %','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={6}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.fromCity} → {r.toCity}</td>
                <td className="px-3 py-2 text-center">{r.tripCount}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtRs(r.totalRevenue)}</td>
                <td className="px-3 py-2 text-right text-red-500">{fmtRs(r.totalCharges)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtRs(r.netProfit)}</td>
                <td className={`px-3 py-2 text-right font-medium ${r.profitMarginPct < 0 ? 'text-red-600' : r.profitMarginPct < 10 ? 'text-orange-500' : 'text-green-600'}`}>{r.profitMarginPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GstSummaryTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-gst', from, to],
    queryFn: () => reportsApi.getGstSummary(from, to),

  })
  const rows: GstSummaryResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total CGST" value={fmtRs(rows.reduce((s, r) => s + r.cgstAmount, 0))} />
          <SummaryCard label="Total SGST" value={fmtRs(rows.reduce((s, r) => s + r.sgstAmount, 0))} />
          <SummaryCard label="Total Tax" value={fmtRs(rows.reduce((s, r) => s + r.totalTax, 0))} />
          <SummaryCard label="Taxable Value" value={fmtRs(rows.reduce((s, r) => s + r.subtotal, 0))} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Period','left'],['Invoices','center'],['Taxable Value','right'],['CGST','right'],['SGST','right'],['Total Tax','right'],['Total Amount','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={7}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.period} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.period}</td>
                <td className="px-3 py-2 text-center">{r.invoiceCount}</td>
                <td className="px-3 py-2 text-right">{fmtRs(r.subtotal)}</td>
                <td className="px-3 py-2 text-right text-orange-600">{fmtRs(r.cgstAmount)}</td>
                <td className="px-3 py-2 text-right text-orange-600">{fmtRs(r.sgstAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold text-orange-700">{fmtRs(r.totalTax)}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtRs(r.totalAmount)}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-gray-50 font-semibold text-xs">
                <td colSpan={2} className="px-3 py-2 text-right text-gray-600">Total</td>
                <td className="px-3 py-2 text-right">{fmtRs(rows.reduce((s,r)=>s+r.subtotal,0))}</td>
                <td className="px-3 py-2 text-right text-orange-600">{fmtRs(rows.reduce((s,r)=>s+r.cgstAmount,0))}</td>
                <td className="px-3 py-2 text-right text-orange-600">{fmtRs(rows.reduce((s,r)=>s+r.sgstAmount,0))}</td>
                <td className="px-3 py-2 text-right text-orange-700">{fmtRs(rows.reduce((s,r)=>s+r.totalTax,0))}</td>
                <td className="px-3 py-2 text-right text-green-700">{fmtRs(rows.reduce((s,r)=>s+r.totalAmount,0))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreditNotesTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-credit-notes', from, to],
    queryFn: () => reportsApi.getCreditNotesSummary(from, to),

  })
  const rows: CreditNoteSummaryResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Credit Notes" value={String(rows.length)} />
          <SummaryCard label="Total Amount" value={fmtRs(rows.reduce((s, r) => s + r.amount, 0))} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Credit Note #','left'],['Client','left'],['Date','left'],['Amount','right'],['Invoice #','left'],['Status','left'],['Reason','left']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={7}><EmptyState msg="No credit notes in this period" /></td></tr>}
            {rows.map(r => (
              <tr key={r.creditNoteId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-blue-700">{r.creditNoteNumber}</td>
                <td className="px-3 py-2">{r.clientName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.creditNoteDate}</td>
                <td className="px-3 py-2 text-right font-semibold text-red-600">{fmtRs(r.amount)}</td>
                <td className="px-3 py-2 text-gray-500">{r.invoiceNumber ?? '—'}</td>
                <td className="px-3 py-2">{statusBadge(r.status)}</td>
                <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ClientPendingBillingTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['report-client-pending'],
    queryFn: reportsApi.getClientPendingBilling,

  })
  const rows: ClientPendingBillingResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Loading...' : 'Fetch Pending Billing'}</Button>
      </div>
      {data && (
        <>
          <div className="flex gap-3 flex-wrap">
            <SummaryCard label="Clients with Pending LRs" value={String(rows.length)} />
            <SummaryCard label="Total Pending LRs" value={String(rows.reduce((s, r) => s + r.pendingLrCount, 0))} />
            <SummaryCard label="Total Tons" value={fmt(rows.reduce((s, r) => s + r.totalDeliveredTons, 0))} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-600 uppercase">
                <tr>{[['Client','left'],['Pending LRs','center'],['Total Tons','right'],['Oldest Delivery','left'],['Days Pending','center']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 && <tr><td colSpan={5}><EmptyState msg="All delivered LRs are invoiced" /></td></tr>}
                {rows.map(r => (
                  <tr key={r.clientId} className={`hover:bg-gray-50 ${r.daysPending > 14 ? 'bg-red-50' : r.daysPending > 7 ? 'bg-orange-50/50' : ''}`}>
                    <td className="px-3 py-2 font-medium">{r.clientName}</td>
                    <td className="px-3 py-2 text-center font-semibold">{r.pendingLrCount}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.totalDeliveredTons)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.oldestDeliveryDate ?? '—'}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${r.daysPending > 14 ? 'text-red-600' : r.daysPending > 7 ? 'text-orange-500' : 'text-gray-700'}`}>{r.daysPending}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && !isFetching && <EmptyState msg="Click Fetch to see clients with uninvoiced deliveries" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section H — Monthly Business Intelligence
// ═══════════════════════════════════════════════════════════════════════════════
function TopClientsTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-top-clients', from, to],
    queryFn: () => reportsApi.getTopClients(from, to),

  })
  const rows: TopClientResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['#','left'],['Client','left'],['Orders','center'],['Trips','center'],['Tonnage (T)','right'],['Revenue','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={6}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map((r, i) => (
              <tr key={r.clientId} className={`hover:bg-gray-50 ${i === 0 ? 'bg-yellow-50' : ''}`}>
                <td className="px-3 py-2 font-semibold text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.clientName}</td>
                <td className="px-3 py-2 text-center">{r.orderCount}</td>
                <td className="px-3 py-2 text-center">{r.tripCount}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalTonnage)}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtRs(r.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TopMaterialsTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-top-materials', from, to],
    queryFn: () => reportsApi.getTopMaterials(from, to),

  })
  const rows: TopMaterialResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['Material','left'],['Orders','center'],['Total Weight (T)','right'],['Share %','left']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={4}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.materialType}</td>
                <td className="px-3 py-2 text-center">{r.orderCount}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalWeight)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">{r.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TopRoutesTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-top-routes', from, to],
    queryFn: () => reportsApi.getTopRoutes(from, to),

  })
  const rows: TopRouteResponse[] = data?.data ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>{[['#','left'],['Route','left'],['Orders','center'],['Total Weight (T)','right']].map(([h,a])=><th key={h} className={`px-3 py-2 text-${a} whitespace-nowrap font-medium`}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && <tr><td colSpan={4}><EmptyState msg="No data found for the selected period" /></td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className={`hover:bg-gray-50 ${i === 0 ? 'bg-yellow-50' : ''}`}>
                <td className="px-3 py-2 font-semibold text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.fromCity} → {r.toCity}</td>
                <td className="px-3 py-2 text-center font-semibold">{r.orderCount}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OnTimeDeliveryTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-on-time', from, to],
    queryFn: () => reportsApi.getOnTimeDeliveryRate(from, to),

  })
  const d: OnTimeDeliveryResponse | undefined = data?.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-800">{d.totalDelivered}</div>
              <div className="text-xs text-gray-500 mt-1">Total Delivered</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{d.onTime}</div>
              <div className="text-xs text-green-600 mt-1">On Time</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{d.delayed}</div>
              <div className="text-xs text-red-500 mt-1">Delayed</div>
            </div>
            <div className={`border rounded-xl p-4 text-center ${d.onTimeRate >= 90 ? 'bg-green-50 border-green-200' : d.onTimeRate >= 75 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`text-3xl font-bold ${d.onTimeRate >= 90 ? 'text-green-700' : d.onTimeRate >= 75 ? 'text-yellow-700' : 'text-red-600'}`}>{d.onTimeRate}%</div>
              <div className="text-xs text-gray-500 mt-1">On-Time Rate</div>
            </div>
          </div>
          <div className="bg-gray-100 rounded-full h-4 mt-2">
            <div className={`h-4 rounded-full transition-all ${d.onTimeRate >= 90 ? 'bg-green-500' : d.onTimeRate >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${d.onTimeRate}%` }} />
          </div>
          <p className="text-xs text-gray-500">Based on LRs delivered vs. order expected delivery date.</p>
        </>
      )}
      {!d && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

function CancellationRateTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['report-cancellation', from, to],
    queryFn: () => reportsApi.getOrderCancellationRate(from, to),

  })
  const d: OrderCancellationRateResponse | undefined = data?.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {d && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-800">{d.totalOrders}</div>
            <div className="text-xs text-gray-500 mt-1">Total Orders</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{d.active}</div>
            <div className="text-xs text-green-600 mt-1">Active Orders</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{d.cancelled}</div>
            <div className="text-xs text-red-500 mt-1">Cancelled</div>
          </div>
          <div className={`border rounded-xl p-4 text-center ${d.cancellationRate <= 5 ? 'bg-green-50 border-green-200' : d.cancellationRate <= 15 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`text-3xl font-bold ${d.cancellationRate <= 5 ? 'text-green-700' : d.cancellationRate <= 15 ? 'text-yellow-700' : 'text-red-600'}`}>{d.cancellationRate}%</div>
            <div className="text-xs text-gray-500 mt-1">Cancellation Rate</div>
          </div>
        </div>
      )}
      {!d && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

// ─── Section I — Inventory Reports ───────────────────────────────────────────

function StockLevelsTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['stock-levels'],
    queryFn: reportsApi.getStockLevels,

  })
  const rows = (data?.data ?? []) as StockLevelResponse[]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Stock Levels &amp; Low Stock Alerts</h2>
        {isFetching
          ? <span className="text-sm text-gray-400 animate-pulse">Loading…</span>
          : <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Part Name</th>
              <th className="pb-2 pr-4">Category</th>
              <th className="pb-2 pr-4 text-right">Current Stock</th>
              <th className="pb-2 pr-4 text-right">Min Level</th>
              <th className="pb-2">Status</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.partId} className={`border-b ${r.isLowStock ? 'bg-red-50' : ''}`}>
                  <td className="py-2 pr-4 font-medium">{r.partName}{r.partNumber && <span className="text-gray-400 text-xs ml-1">({r.partNumber})</span>}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.category ?? '—'}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{r.currentStock} {r.unit}</td>
                  <td className="py-2 pr-4 text-right text-gray-500">{r.minStockLevel}</td>
                  <td className="py-2">
                    {r.isLowStock
                      ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Low Stock</span>
                      : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && !isFetching && <EmptyState msg="No data available — stock levels" />}
    </div>
  )
}

function StockMovementTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['stock-movement', from, to],
    queryFn: () => reportsApi.getStockMovement(from, to),

  })
  const rows = (data?.data ?? []) as StockMovementResponse[]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-800">Stock Movement</h2>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Part Name</th>
              <th className="pb-2 pr-4">Category</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4 text-right">Qty</th>
              <th className="pb-2 pr-4 text-right">Unit Cost</th>
              <th className="pb-2 pr-4 text-right">Total Cost</th>
              <th className="pb-2">Supplier / Notes</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.transactionId} className="border-b">
                  <td className="py-2 pr-4 text-gray-500">{r.date}</td>
                  <td className="py-2 pr-4 font-medium">{r.partName}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.category ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.transactionType === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {r.transactionType}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">{r.quantity}</td>
                  <td className="py-2 pr-4 text-right">{fmtRs(r.unitCost)}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{fmtRs(r.totalCost)}</td>
                  <td className="py-2 text-gray-500 text-xs">{r.supplierName ?? r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

function PartsByVehicleTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['parts-by-vehicle', from, to],
    queryFn: () => reportsApi.getPartsByVehicle(from, to),

  })
  const rows = (data?.data ?? []) as VehiclePartConsumptionResponse[]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-800">Parts Consumption by Vehicle</h2>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Vehicle</th>
              <th className="pb-2 pr-4">Part Name</th>
              <th className="pb-2 pr-4">Category</th>
              <th className="pb-2 text-right">Qty Used</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 pr-4 font-medium">{r.regNo}<span className="text-gray-400 text-xs ml-1">{r.vehicleType}</span></td>
                  <td className="py-2 pr-4">{r.partName}{r.partNumber && <span className="text-gray-400 text-xs ml-1">({r.partNumber})</span>}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.category ?? '—'}</td>
                  <td className="py-2 text-right font-semibold">{r.totalQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

function PartsByTypeTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['parts-by-type', from, to],
    queryFn: () => reportsApi.getPartsByType(from, to),

  })
  const rows = (data?.data ?? []) as PartConsumptionByTypeResponse[]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-800">Parts Consumption by Type</h2>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Part Name</th>
              <th className="pb-2 pr-4">Category</th>
              <th className="pb-2 pr-4">Unit</th>
              <th className="pb-2 pr-4 text-right">Total Qty</th>
              <th className="pb-2 text-right">Services</th>
            </tr></thead>
            <tbody>
              {rows.sort((a, b) => b.totalQuantity - a.totalQuantity).map(r => (
                <tr key={r.partId} className="border-b">
                  <td className="py-2 pr-4 font-medium">{r.partName}{r.partNumber && <span className="text-gray-400 text-xs ml-1">({r.partNumber})</span>}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.category ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.unit}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{r.totalQuantity}</td>
                  <td className="py-2 text-right text-gray-600">{r.serviceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

function ServiceCostBreakdownTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const { data, isFetching } = useQuery({
    queryKey: ['service-cost-breakdown', from, to],
    queryFn: () => reportsApi.getServiceCostBreakdown(from, to),

  })
  const rows = (data?.data ?? []) as ServiceCostBreakdownResponse[]
  const totalCost = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-800">Service Cost Breakdown</h2>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        {isFetching && <span className="text-sm text-gray-400 animate-pulse">Loading…</span>}
      </div>
      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Total Services" value={String(rows.length)} />
            <SummaryCard label="Total Cost" value={fmtRs(totalCost)} />
            <SummaryCard label="Avg Cost per Service" value={fmtRs(rows.length ? totalCost / rows.length : 0)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Vehicle</th>
                <th className="pb-2 pr-4">Service Type</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4 text-right">Total Cost</th>
                <th className="pb-2 text-right">Parts Used</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.serviceId} className="border-b">
                    <td className="py-2 pr-4 text-gray-500">{r.serviceDate}</td>
                    <td className="py-2 pr-4 font-medium">{r.regNo}<span className="text-gray-400 text-xs ml-1">{r.vehicleType}</span></td>
                    <td className="py-2 pr-4 text-gray-600">{r.serviceType.replace('_', ' ')}</td>
                    <td className="py-2 pr-4">{statusBadge(r.status)}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{fmtRs(r.totalCost)}</td>
                    <td className="py-2 text-right text-gray-600">{r.partsUsedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!rows.length && !isFetching && <EmptyState msg="No data found for the selected period" />}
    </div>
  )
}

// ─── Section J — Tire Reports ─────────────────────────────────────────────────

function TiresByVehicleTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['tires-by-vehicle'],
    queryFn: reportsApi.getTiresByVehicle,

  })
  const vehicles = (data?.data ?? []) as TiresByVehicleResponse[]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Tires per Vehicle</h2>
        {isFetching
          ? <span className="text-sm text-gray-400 animate-pulse">Loading…</span>
          : <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>}
      </div>
      {vehicles.length > 0 && (
        <div className="space-y-4">
          {vehicles.map(v => (
            <div key={v.vehicleId} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                <span className="font-semibold text-gray-800">{v.regNo} <span className="text-gray-400 text-sm">{v.vehicleType}</span></span>
                <span className="text-sm text-gray-500">{v.activeTireCount} tire{v.activeTireCount !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500">
                  <th className="pb-2 px-4 pt-2">Serial No</th>
                  <th className="pb-2 pr-4">Brand</th>
                  <th className="pb-2 pr-4">Size</th>
                  <th className="pb-2 pr-4">Position</th>
                  <th className="pb-2 pr-4">Fitted Date</th>
                  <th className="pb-2 pr-4 text-right">Fitted at (km)</th>
                  <th className="pb-2 text-right pr-4">Km Driven</th>
                </tr></thead>
                <tbody>
                  {v.tires.map(t => (
                    <tr key={t.fittingId} className="border-b">
                      <td className="py-2 px-4 font-mono text-xs">{t.serialNumber}</td>
                      <td className="py-2 pr-4">{t.brand}</td>
                      <td className="py-2 pr-4 text-gray-500">{t.size}</td>
                      <td className="py-2 pr-4 text-gray-600">{t.positionCode}</td>
                      <td className="py-2 pr-4 text-gray-500">{t.fittedDate}</td>
                      <td className="py-2 pr-4 text-right">{fmt(t.fittedAtKm)}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{fmt(t.kmDriven)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {!vehicles.length && !isFetching && <EmptyState msg="No data available — tire data" />}
    </div>
  )
}

function KmPerTireTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['km-per-tire'],
    queryFn: reportsApi.getKmPerTire,

  })
  const rows = (data?.data ?? []) as KmPerTireResponse[]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Km Run per Tire</h2>
        {isFetching
          ? <span className="text-sm text-gray-400 animate-pulse">Loading…</span>
          : <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Serial No</th>
              <th className="pb-2 pr-4">Brand / Size</th>
              <th className="pb-2 pr-4">Vehicle</th>
              <th className="pb-2 pr-4">Position</th>
              <th className="pb-2 pr-4">Fitted Date</th>
              <th className="pb-2 pr-4 text-right">Fitted km</th>
              <th className="pb-2 pr-4 text-right">Removed km</th>
              <th className="pb-2 pr-4 text-right">Km Driven</th>
              <th className="pb-2">Status</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.fittingId} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{r.serialNumber}</td>
                  <td className="py-2 pr-4">{r.brand} <span className="text-gray-400">{r.size}</span></td>
                  <td className="py-2 pr-4 font-medium">{r.vehicleRegNo}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.positionCode}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.fittedDate}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.fittedAtKm)}</td>
                  <td className="py-2 pr-4 text-right">{r.removedAtKm != null ? fmt(r.removedAtKm) : '—'}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{fmt(r.kmDriven)}</td>
                  <td className="py-2">
                    {r.active
                      ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Fitted</span>
                      : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">Removed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && !isFetching && <EmptyState msg="No data available — km data" />}
    </div>
  )
}

function TireReplacementTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['tire-replacement'],
    queryFn: reportsApi.getTireReplacementProjection,

  })
  const rows = (data?.data ?? []) as TireReplacementProjectionResponse[]
  const urgencyColor = (u: string) =>
    u === 'HIGH' ? 'bg-red-100 text-red-800' : u === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Tire Replacement Projection</h2>
        {isFetching
          ? <span className="text-sm text-gray-400 animate-pulse">Loading…</span>
          : <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>}
      </div>
      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="HIGH Urgency" value={String(rows.filter(r => r.urgency === 'HIGH').length)} sub="< 10% life remaining" />
            <SummaryCard label="MEDIUM Urgency" value={String(rows.filter(r => r.urgency === 'MEDIUM').length)} sub="10–30% life remaining" />
            <SummaryCard label="LOW Urgency" value={String(rows.filter(r => r.urgency === 'LOW').length)} sub="> 30% life remaining" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Serial No</th>
                <th className="pb-2 pr-4">Brand / Size</th>
                <th className="pb-2 pr-4">Vehicle</th>
                <th className="pb-2 pr-4">Position</th>
                <th className="pb-2 pr-4 text-right">Lifetime km</th>
                <th className="pb-2 pr-4 text-right">Max km</th>
                <th className="pb-2 pr-4 text-right">Remaining km</th>
                <th className="pb-2">Urgency</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.tireId} className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">{r.serialNumber}</td>
                    <td className="py-2 pr-4">{r.brand} <span className="text-gray-400">{r.size}</span></td>
                    <td className="py-2 pr-4 font-medium">{r.vehicleRegNo}</td>
                    <td className="py-2 pr-4 text-gray-500">{r.positionCode}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.totalLifetimeKm)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.maxLifetimeKm)}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{fmt(r.remainingKm)}</td>
                    <td className="py-2"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${urgencyColor(r.urgency)}`}>{r.urgency}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!rows.length && !isFetching && <EmptyState msg="No data available — projection data" />}
    </div>
  )
}

function TireCostPerKmTab() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['tire-cost-per-km'],
    queryFn: reportsApi.getTireCostPerKm,

  })
  const rows = (data?.data ?? []) as TireCostPerKmResponse[]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Tire Cost per Km</h2>
        {isFetching
          ? <span className="text-sm text-gray-400 animate-pulse">Loading…</span>
          : <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>}
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Serial No</th>
              <th className="pb-2 pr-4">Brand / Size</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4 text-right">Purchase Cost</th>
              <th className="pb-2 pr-4 text-right">Total km</th>
              <th className="pb-2 text-right">Cost / km</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.tireId} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{r.serialNumber}</td>
                  <td className="py-2 pr-4">{r.brand} <span className="text-gray-400">{r.size}</span></td>
                  <td className="py-2 pr-4 text-gray-500">{r.tireType}</td>
                  <td className="py-2 pr-4 text-right">{fmtRs(r.purchaseCost)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.totalLifetimeKm)} km</td>
                  <td className="py-2 text-right font-semibold">{fmtRs(r.costPerKm)}/km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && !isFetching && <EmptyState msg="Click Fetch Report — only shows tires with km data" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section config
// ═══════════════════════════════════════════════════════════════════════════════
const SECTION_CONFIG: Record<string, { label: string; tabs: { id: ReportTab; label: string }[]; defaultTab: ReportTab }> = {
  'daily-operations':      { label: 'Daily Operations',       tabs: DAILY_OPS_TABS,   defaultTab: 'daily-vehicles' },
  'orders':                { label: 'Orders & Assignments',   tabs: ORDERS_TABS,      defaultTab: 'order-fulfillment' },
  'trips':                 { label: 'Trips & LRs',            tabs: TRIPS_TABS,       defaultTab: 'trips-in-progress' },
  'vehicle-performance':   { label: 'Vehicle Performance',    tabs: VEHICLE_PERF_TABS, defaultTab: 'vehicle-revenue' },
  'driver-staff':          { label: 'Driver & Staff',         tabs: DRIVER_TABS,      defaultTab: 'driver-performance' },
  'financial':             { label: 'Financial Intelligence', tabs: FINANCIAL_TABS,   defaultTab: 'invoice-aging' },
  'business-intelligence': { label: 'Business Intelligence',  tabs: BI_TABS,          defaultTab: 'top-clients' },
  'inventory':             { label: 'Inventory Reports',      tabs: INVENTORY_TABS,   defaultTab: 'stock-levels' },
  'tires':                 { label: 'Tire Reports',           tabs: TIRE_TABS,        defaultTab: 'tires-by-vehicle' },
  'periodic':              { label: 'Periodic Reports',       tabs: TABS,             defaultTab: 'targets' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export function ReportsPage() {
  const { section = 'daily-operations' } = useParams<{ section: string }>()
  const config = SECTION_CONFIG[section]

  const [tab, setTab] = useState<ReportTab>(config?.defaultTab ?? 'daily-vehicles')

  useEffect(() => {
    if (config) setTab(config.defaultTab)
  }, [section])

  if (!config) return <Navigate to="/reports/daily-operations" replace />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{config.label}</h1>
        <p className="text-gray-500 text-sm mt-1">Business analytics and operational insights</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {config.tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {tab === 'daily-vehicles'    && <DailyVehicleActivityTab />}
        {tab === 'local-long-trips'  && <LocalLongTripsTab />}
        {tab === 'idle-drivers'      && <IdleDriversTab />}
        {tab === 'doc-expiry'        && <DocumentExpiryTab />}
        {tab === 'today-attendance'  && <TodayAttendanceTab />}
        {tab === 'delayed-trips'     && <DelayedTripsTab />}
        {tab === 'orders-backlog'    && <OrdersBacklogTab />}
        {tab === 'order-fulfillment'   && <OrderFulfillmentTab />}
        {tab === 'order-lead-time'     && <OrderLeadTimeTab />}
        {tab === 'unassigned-vehicles' && <UnassignedVehiclesTab />}
        {tab === 'driver-assignments'  && <DriverAssignmentsTab />}
        {tab === 'trips-in-progress'   && <TripsInProgressTab />}
        {tab === 'lr-status-funnel'    && <LrStatusFunnelTab />}
        {tab === 'unbilled-lrs'        && <UnbilledLrsTab />}
        {tab === 'invoice-turnaround'  && <InvoiceTurnaroundTab />}
        {tab === 'trip-duration'       && <TripDurationTab />}
        {tab === 'weight-variance'     && <WeightVarianceTab />}
        {tab === 'overloading'         && <OverloadingTab />}
        {tab === 'vehicle-revenue'     && <VehicleRevenueTab />}
        {tab === 'vehicle-idle-days'   && <VehicleIdleDaysTab />}
        {tab === 'vehicle-trip-count'  && <VehicleTripCountTab />}
        {tab === 'breakdown-frequency' && <BreakdownFrequencyTab />}
        {tab === 'vehicle-service-cost' && <VehicleServiceCostTab />}
        {tab === 'driver-performance'  && <DriverPerformanceTab />}
        {tab === 'attendance-gaps'     && <AttendanceGapsTab />}
        {tab === 'attendance-trend'    && <AttendanceTrendTab />}
        {tab === 'attendance-calendar' && <AttendanceCalendarTab />}
        {tab === 'invoice-aging'        && <InvoiceAgingTab />}
        {tab === 'revenue-trend'        && <RevenueTrendTab />}
        {tab === 'route-profitability'  && <RouteProfitabilityTab />}
        {tab === 'gst-summary'          && <GstSummaryTab />}
        {tab === 'credit-notes'         && <CreditNotesTab />}
        {tab === 'client-pending-billing' && <ClientPendingBillingTab />}
        {tab === 'top-clients'          && <TopClientsTab />}
        {tab === 'top-materials'        && <TopMaterialsTab />}
        {tab === 'top-routes'           && <TopRoutesTab />}
        {tab === 'on-time-delivery'     && <OnTimeDeliveryTab />}
        {tab === 'cancellation-rate'    && <CancellationRateTab />}
        {tab === 'stock-levels'         && <StockLevelsTab />}
        {tab === 'stock-movement'       && <StockMovementTab />}
        {tab === 'parts-by-vehicle'     && <PartsByVehicleTab />}
        {tab === 'parts-by-type'        && <PartsByTypeTab />}
        {tab === 'service-cost-breakdown' && <ServiceCostBreakdownTab />}
        {tab === 'tires-by-vehicle'     && <TiresByVehicleTab />}
        {tab === 'km-per-tire'          && <KmPerTireTab />}
        {tab === 'tire-replacement'     && <TireReplacementTab />}
        {tab === 'tire-cost-per-km'     && <TireCostPerKmTab />}
        {tab === 'targets'             && <TargetsTab />}
        {tab === 'lr-register'         && <LrRegisterTab />}
        {tab === 'outstanding'         && <InvoiceOutstandingTab />}
        {tab === 'collections'         && <CollectionReportTab />}
        {tab === 'client-statement'    && <ClientStatementTab />}
        {tab === 'vehicle-trips'       && <VehicleTripTab />}
        {tab === 'order-status'        && <OrderStatusTab />}
        {tab === 'payroll'             && <PayrollSummaryTab />}
        {tab === 'attendance'          && <AttendanceReportTab />}
      </div>
    </div>
  )
}
