import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, ClipboardList, AlertCircle, Users, AlertTriangle, Scale, MapPin, CreditCard, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import { ordersApi } from '@/api/orders'
import { lrsApi } from '@/api/lrs'
import { downloadOrderSummaryPdf } from './OrderSummaryPdf'
import type {
  OrderRegisterRow, OpenOrderRow, OrderClientSummaryRow,
  OverdueOrderRow, WeightFulfillmentRow, OrderRouteSummaryRow, OrderPaymentStatusRow,
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
  { key: 'register',        label: 'Order Register',     icon: ClipboardList },
  { key: 'open',            label: 'Open Orders',        icon: AlertCircle },
  { key: 'client-summary',  label: 'Client Summary',     icon: Users },
  { key: 'overdue',         label: 'Overdue Orders',     icon: AlertTriangle },
  { key: 'fulfillment',     label: 'Weight Fulfillment', icon: Scale },
  { key: 'route-summary',   label: 'Route Summary',      icon: MapPin },
  { key: 'payment-status',  label: 'Payment Status',     icon: CreditCard },
  { key: 'order-summary',   label: 'Order Summary',      icon: FileText },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

const ORDER_STATUSES = ['PENDING', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'COMPLETED']
const PAYMENT_STATUSES = ['UNPAID', 'ADVANCE_PAID', 'PARTIALLY_PAID', 'PAID']

// ── Badges ─────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  PENDING:              'bg-gray-100 text-gray-600',
  PARTIALLY_ASSIGNED:   'bg-blue-50 text-blue-600',
  FULLY_ASSIGNED:       'bg-blue-100 text-blue-700',
  IN_TRANSIT:           'bg-amber-100 text-amber-700',
  PARTIALLY_DELIVERED:  'bg-orange-100 text-orange-700',
  DELIVERED:            'bg-green-100 text-green-700',
  COMPLETED:            'bg-green-200 text-green-800',
  CANCELLED:            'bg-red-100 text-red-600',
}
const PAYMENT_COLORS: Record<string, string> = {
  UNPAID:         'bg-red-100 text-red-700',
  ADVANCE_PAID:   'bg-yellow-100 text-yellow-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID:           'bg-green-100 text-green-700',
}
function StatusBadge({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const cls = colorMap[status] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status.replace(/_/g, ' ')}</span>
}

// ── Generic table ──────────────────────────────────────────────────────────────
function ReportTable({ headers, rows, loading }: {
  headers: string[]
  rows: React.ReactNode[][]
  loading: boolean
}) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (rows.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  return (
    <div className="overflow-x-auto rounded-lg border">
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
    </div>
  )
}

const dash = (v: unknown) => (v != null && v !== '' ? String(v) : '—')

// ── Table renderers ────────────────────────────────────────────────────────────
function OrderRegisterTable({ rows, loading }: { rows: OrderRegisterRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Order No.', 'Date', 'Exp. Delivery', 'Duration', 'Client', 'Material', 'From', 'To',
      'Total Wt', 'Fulfilled Wt', 'Freight Amt', 'Vehicles', 'Status', 'Payment']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.orderNumber}</span>,
      r.orderDate, dash(r.expectedDeliveryDate),
      r.durationDays != null ? <span className="text-gray-600">{r.durationDays}d</span> : <span className="text-gray-300">—</span>,
      r.clientName, r.materialType,
      `${r.fromCity}, ${r.fromState}`, `${r.toCity}, ${r.toState}`,
      dash(r.totalWeight), dash(r.totalWeightFulfilled), dash(r.totalFreightAmount),
      <span className="font-medium">{r.vehicleCount}</span>,
      <StatusBadge status={r.orderStatus} colorMap={STATUS_COLORS} />,
      <StatusBadge status={r.orderPaymentStatus} colorMap={PAYMENT_COLORS} />,
    ])}
  />
}

function OpenOrderTable({ rows, loading }: { rows: OpenOrderRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Order No.', 'Date', 'Exp. Delivery', 'Client', 'Material', 'From', 'To',
      'Total Wt', 'Fulfilled Wt', 'Pending Wt', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.orderNumber}</span>,
      r.orderDate, dash(r.expectedDeliveryDate), r.clientName, r.materialType,
      r.fromCity, r.toCity,
      dash(r.totalWeight), dash(r.totalWeightFulfilled),
      <span className="text-amber-600 font-medium">{dash(r.pendingWeight)}</span>,
      <StatusBadge status={r.orderStatus} colorMap={STATUS_COLORS} />,
    ])}
  />
}

function ClientSummaryTable({ rows, loading }: { rows: OrderClientSummaryRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Client', 'Total Orders', 'Completed', 'In Progress', 'Cancelled',
      'Total Wt', 'Fulfilled Wt', 'Total Freight']}
    rows={rows.map(r => [
      <span className="font-medium">{r.clientName}</span>,
      <span className="font-medium">{r.totalOrders}</span>,
      <span className="text-green-700 font-medium">{r.completedOrders}</span>,
      <span className={r.inProgressOrders > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{r.inProgressOrders}</span>,
      <span className={r.cancelledOrders > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{r.cancelledOrders}</span>,
      dash(r.totalWeight), dash(r.totalWeightFulfilled), dash(r.totalFreightAmount),
    ])}
  />
}

function OverdueTable({ rows, loading }: { rows: OverdueOrderRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Order No.', 'Date', 'Exp. Delivery', 'Days Overdue', 'Client', 'Material',
      'From', 'To', 'Total Wt', 'Fulfilled Wt', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.orderNumber}</span>,
      r.orderDate, r.expectedDeliveryDate,
      <span className={cn('font-medium', r.daysOverdue >= 7 ? 'text-red-600' : r.daysOverdue >= 3 ? 'text-amber-600' : 'text-orange-500')}>
        {r.daysOverdue} days
      </span>,
      r.clientName, r.materialType, r.fromCity, r.toCity,
      dash(r.totalWeight), dash(r.totalWeightFulfilled),
      <StatusBadge status={r.orderStatus} colorMap={STATUS_COLORS} />,
    ])}
  />
}

function FulfillmentTable({ rows, loading }: { rows: WeightFulfillmentRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Order No.', 'Date', 'Client', 'Material', 'From', 'To',
      'Total Wt', 'Fulfilled Wt', 'Pending Wt', 'Fulfillment %', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.orderNumber}</span>,
      r.orderDate, r.clientName, r.materialType, r.fromCity, r.toCity,
      dash(r.totalWeight), dash(r.totalWeightFulfilled),
      <span className="text-amber-600 font-medium">{dash(r.pendingWeight)}</span>,
      <span className={cn('font-medium',
        r.fulfillmentPercent >= 100 ? 'text-green-600' :
        r.fulfillmentPercent >= 75  ? 'text-amber-600' : 'text-red-600'
      )}>{r.fulfillmentPercent}%</span>,
      <StatusBadge status={r.orderStatus} colorMap={STATUS_COLORS} />,
    ])}
  />
}

function RouteSummaryTable({ rows, loading }: { rows: OrderRouteSummaryRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['From City', 'From State', 'To City', 'To State',
      'Total Orders', 'Completed', 'Total Wt', 'Fulfilled Wt', 'Total Freight']}
    rows={rows.map(r => [
      r.fromCity, r.fromState, r.toCity, r.toState,
      <span className="font-medium">{r.totalOrders}</span>,
      <span className="text-green-700 font-medium">{r.completedOrders}</span>,
      dash(r.totalWeight), dash(r.totalWeightFulfilled), dash(r.totalFreightAmount),
    ])}
  />
}

function PaymentStatusTable({ rows, loading }: { rows: OrderPaymentStatusRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Order No.', 'Order Date', 'Client', 'Total Freight', 'Order Status', 'Payment Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.orderNumber}</span>,
      r.orderDate, r.clientName, dash(r.totalFreightAmount),
      <StatusBadge status={r.orderStatus} colorMap={STATUS_COLORS} />,
      <StatusBadge status={r.orderPaymentStatus} colorMap={PAYMENT_COLORS} />,
    ])}
  />
}

// ── Order Summary helpers ──────────────────────────────────────────────────────
function calcDuration(from?: string | null, to?: string | null): string {
  if (!from || !to) return '—'
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (isNaN(ms) || ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m || !parts.length) parts.push(`${m}m`)
  return parts.join(' ')
}

function fmtDT(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

// ── Order Summary Tab ──────────────────────────────────────────────────────────
function OrderSummaryTab() {
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [downloading, setDownloading] = useState(false)

  const ordersQuery = useQuery({
    queryKey: ['orders-for-summary'],
    queryFn: () => ordersApi.getAll({ size: 500 }),
  })
  const orderDetailQuery = useQuery({
    queryKey: ['order-detail-summary', selectedOrderId],
    queryFn: () => ordersApi.getById(Number(selectedOrderId)),
    enabled: !!selectedOrderId,
  })
  const lrsQuery = useQuery({
    queryKey: ['lrs-for-summary', selectedOrderId],
    queryFn: () => lrsApi.getByOrder(Number(selectedOrderId)),
    enabled: !!selectedOrderId,
  })

  const orders = ordersQuery.data?.data?.content ?? []
  const orderOptions = [
    { value: '', label: 'Select an order…' },
    ...orders.map(o => ({ value: String(o.id), label: `${o.orderNumber} — ${o.clientName}` })),
  ]

  const order = orderDetailQuery.data?.data
  const lrs = lrsQuery.data?.data ?? []
  const lrByAlloc = new Map(lrs.map(lr => [lr.vehicleAllocationId, lr]))
  const allocs = order?.vehicleAllocations ?? []

  async function handleDownload() {
    if (!order) return
    setDownloading(true)
    try {
      await downloadOrderSummaryPdf(order, lrs)
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setDownloading(false)
    }
  }

  const loading = selectedOrderId && (orderDetailQuery.isLoading || lrsQuery.isLoading)

  return (
    <div className="space-y-4">
      {/* Selector + download */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-60">
          <label className="block text-xs font-medium text-gray-600 mb-1">Order</label>
          <SearchableSelect
            value={selectedOrderId}
            onValueChange={setSelectedOrderId}
            options={orderOptions}
            className="w-full"
            placeholder="Search by order number or client…"
          />
        </div>
        <Button onClick={handleDownload} disabled={!order || downloading} className="gap-2">
          <Download size={15} />
          {downloading ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading order…</div>}

      {order && (
        <div className="space-y-4">
          {/* Header cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Order No.',        value: <span className="font-bold text-feros-navy">{order.orderNumber}</span> },
              { label: 'Status',           value: <StatusBadge status={order.orderStatus} colorMap={STATUS_COLORS} /> },
              { label: 'Client',           value: order.clientName },
              { label: 'Payment',          value: <StatusBadge status={order.orderPaymentStatus} colorMap={PAYMENT_COLORS} /> },
              { label: 'Material',         value: order.materialTypeName },
              { label: 'Total Weight',     value: `${order.totalWeight} MT` },
              { label: 'Order Date',       value: order.orderDate },
              { label: 'Exp. Delivery',    value: order.expectedDeliveryDate ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">{label}</div>
                <div className="text-sm font-medium text-gray-800">{value}</div>
              </div>
            ))}
          </div>

          {/* Route */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
            <div>
              <div className="font-bold text-feros-navy">{order.sourceCityName}</div>
              <div className="text-xs text-gray-500">{order.sourceStateName}</div>
            </div>
            <div className="text-2xl text-blue-300 font-light">→</div>
            <div>
              <div className="font-bold text-feros-navy">{order.destinationCityName}</div>
              <div className="text-xs text-gray-500">{order.destinationStateName}</div>
            </div>
          </div>

          {/* Vehicles */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Vehicle Assignments ({allocs.length})
            </h3>

            {allocs.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm border rounded-xl bg-white">
                No vehicles assigned
              </div>
            )}

            {allocs.map(alloc => {
              const lr = lrByAlloc.get(alloc.id)
              const regNum = alloc.vehicleRegistrationNumber ?? alloc.registrationNumber ?? '—'
              const assignedAt   = alloc.createdAt
              const lrCreatedAt  = lr?.createdAt
              const tripStartAt  = lr?.loadedAt
              const tripEndAt    = lr?.deliveredAt

              const timeline = [
                { event: 'Vehicle Assigned', at: assignedAt,   nextAt: lrCreatedAt },
                { event: 'LR Created',       at: lrCreatedAt,  nextAt: tripStartAt },
                { event: 'Trip Started',     at: tripStartAt,  nextAt: tripEndAt   },
                { event: 'Trip Ended',       at: tripEndAt,    nextAt: null        },
              ]

              return (
                <div key={alloc.id} className="bg-white border rounded-xl p-4 mb-3">
                  {/* Vehicle header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-feros-navy text-base">{regNum}</span>
                      {alloc.vehicleTypeName && (
                        <span className="text-xs text-gray-400">({alloc.vehicleTypeName})</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 bg-slate-100 px-2 py-1 rounded-md">
                      {alloc.allocatedWeight} MT allocated
                    </span>
                  </div>

                  {/* Staff */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { role: 'Driver',          name: alloc.currentDriverName,  phone: alloc.currentDriverPhone },
                      { role: 'Cleaner / Helper', name: alloc.currentCleanerName, phone: alloc.currentCleanerPhone },
                      { role: 'LR No.',           name: lr?.lrNumber ?? '—',      phone: lr?.paperLrNumber ? `Paper: ${lr.paperLrNumber}` : undefined },
                    ].map(({ role, name, phone }) => (
                      <div key={role} className="bg-slate-50 rounded-lg p-2.5">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{role}</div>
                        <div className={cn('text-sm font-medium', role === 'LR No.' ? 'text-feros-navy' : 'text-gray-800')}>
                          {name ?? '—'}
                        </div>
                        {phone && <div className="text-xs text-gray-400 mt-0.5">{phone}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Timeline */}
                  <div className="border-t pt-3">
                    <div className="grid grid-cols-[2fr_3fr_2fr] text-xs text-gray-400 uppercase tracking-wide font-medium mb-1 px-1">
                      <span>Event</span><span>Date &amp; Time</span><span className="text-right">Duration</span>
                    </div>
                    {timeline.map(({ event, at, nextAt }) => (
                      <div key={event} className="grid grid-cols-[2fr_3fr_2fr] text-sm py-1.5 border-t border-gray-100 px-1">
                        <span className="text-gray-600">{event}</span>
                        <span className="text-gray-500 text-xs flex items-center">{fmtDT(at)}</span>
                        <span className="text-right font-medium">
                          {nextAt
                            ? <span className="text-feros-navy">{calcDuration(at, nextAt)}</span>
                            : at
                              ? <span className="text-green-600 text-xs">Total: {calcDuration(assignedAt, at)}</span>
                              : <span className="text-gray-300">—</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {order.specialInstructions && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <span className="font-medium">Special Instructions: </span>{order.specialInstructions}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function OrderReportsPage() {
  const [tab, setTab] = useState<TabKey>('register')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [downloading, setDownloading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [clientFilter, setClientFilter] = useState('ALL')
  const [thresholdDays, setThresholdDays] = useState(1)

  function handleTabChange(key: TabKey) {
    setTab(key)
    setStatusFilter('ALL')
    setPaymentFilter('ALL')
    setClientFilter('ALL')
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());       setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart());  setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  // ── Queries ──
  const registerQuery = useQuery({
    queryKey: ['report-order-register', startDate, endDate],
    queryFn: () => reportsApi.getOrderRegister(startDate, endDate),
    enabled: tab === 'register',
  })
  const openQuery = useQuery({
    queryKey: ['report-open-orders'],
    queryFn: () => reportsApi.getOpenOrders(),
    enabled: tab === 'open',
  })
  const clientSummaryQuery = useQuery({
    queryKey: ['report-order-client-summary', startDate, endDate],
    queryFn: () => reportsApi.getOrderClientSummary(startDate, endDate),
    enabled: tab === 'client-summary',
  })
  const overdueQuery = useQuery({
    queryKey: ['report-overdue-orders', thresholdDays],
    queryFn: () => reportsApi.getOverdueOrders(thresholdDays),
    enabled: tab === 'overdue',
  })
  const fulfillmentQuery = useQuery({
    queryKey: ['report-weight-fulfillment', startDate, endDate],
    queryFn: () => reportsApi.getWeightFulfillment(startDate, endDate),
    enabled: tab === 'fulfillment',
  })
  const routeSummaryQuery = useQuery({
    queryKey: ['report-order-route-summary', startDate, endDate],
    queryFn: () => reportsApi.getOrderRouteSummary(startDate, endDate),
    enabled: tab === 'route-summary',
  })
  const paymentQuery = useQuery({
    queryKey: ['report-order-payment-status', startDate, endDate],
    queryFn: () => reportsApi.getOrderPaymentStatus(startDate, endDate),
    enabled: tab === 'payment-status',
  })

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if      (tab === 'register')       await reportsApi.exportOrderRegister(startDate, endDate, format)
      else if (tab === 'open')           await reportsApi.exportOpenOrders(format)
      else if (tab === 'client-summary') await reportsApi.exportOrderClientSummary(startDate, endDate, format)
      else if (tab === 'overdue')        await reportsApi.exportOverdueOrders(thresholdDays, format)
      else if (tab === 'fulfillment')    await reportsApi.exportWeightFulfillment(startDate, endDate, format)
      else if (tab === 'route-summary')  await reportsApi.exportOrderRouteSummary(startDate, endDate, format)
      else                               await reportsApi.exportOrderPaymentStatus(startDate, endDate, format, paymentFilter !== 'ALL' ? paymentFilter : undefined)
    } catch {
      toast.error('Export failed')
    } finally {
      setDownloading(false)
    }
  }

  // ── Apply filters ──
  const allRegisterRows  = registerQuery.data?.data ?? []
  const allOpenRows      = openQuery.data?.data ?? []
  const allOverdueRows   = overdueQuery.data?.data ?? []
  const allPaymentRows   = paymentQuery.data?.data ?? []

  const registerRows = allRegisterRows.filter(r =>
    (statusFilter === 'ALL' || r.orderStatus === statusFilter) &&
    (clientFilter === 'ALL' || r.clientName === clientFilter)
  )
  const openRows = allOpenRows.filter(r =>
    clientFilter === 'ALL' || r.clientName === clientFilter
  )
  const overdueRows = allOverdueRows.filter(r =>
    clientFilter === 'ALL' || r.clientName === clientFilter
  )
  const paymentRows = allPaymentRows.filter(r =>
    (paymentFilter === 'ALL' || r.orderPaymentStatus === paymentFilter) &&
    (clientFilter === 'ALL' || r.clientName === clientFilter)
  )

  // ── Client options per tab ──
  const tabClientSource: string[] =
    tab === 'register'      ? allRegisterRows.map(r => r.clientName) :
    tab === 'open'          ? allOpenRows.map(r => r.clientName) :
    tab === 'overdue'       ? allOverdueRows.map(r => r.clientName) :
    tab === 'payment-status'? allPaymentRows.map(r => r.clientName) : []
  const clientOptions = [
    { value: 'ALL', label: 'All Clients' },
    ...Array.from(new Set(tabClientSource.filter(Boolean))).sort().map(c => ({ value: c, label: c })),
  ]
  const showClientFilter = ['register', 'open', 'overdue', 'payment-status'].includes(tab)

  // ── Date-range tabs (show/hide date controls) ──
  const noDateFilter = tab === 'open' || tab === 'overdue'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Order Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Order register, fulfillment, overdue & payment tracking</p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-white border rounded-xl p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => handleTabChange(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key ? 'bg-feros-navy text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Controls — hidden for order-summary tab */}
      {tab !== 'order-summary' && <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">

        {/* Status filter — register tab */}
        {tab === 'register' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <SearchableSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                ...ORDER_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
              ]}
              showSearch={false}
              className="w-48"
            />
          </div>
        )}

        {/* Client filter */}
        {showClientFilter && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
            <SearchableSelect
              value={clientFilter}
              onValueChange={setClientFilter}
              options={clientOptions}
              className="w-48"
            />
          </div>
        )}

        {/* Payment filter — payment-status tab */}
        {tab === 'payment-status' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Status</label>
            <SearchableSelect
              value={paymentFilter}
              onValueChange={setPaymentFilter}
              options={[
                { value: 'ALL', label: 'All' },
                ...PAYMENT_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
              ]}
              showSearch={false}
              className="w-44"
            />
          </div>
        )}

        {/* Threshold filter — overdue tab */}
        {tab === 'overdue' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min. Days Overdue</label>
            <select value={thresholdDays} onChange={e => setThresholdDays(Number(e.target.value))}
              className="h-9 border rounded-md px-2 text-sm">
              {[1, 2, 3, 5, 7, 14].map(d => <option key={d} value={d}>{d}+ days</option>)}
            </select>
          </div>
        )}

        {/* Date controls — hidden for snapshot tabs */}
        {!noDateFilter && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
              <div className="flex gap-1">
                {(['today', 'this-week', 'this-month', 'custom'] as DatePreset[]).map(p => (
                  <button key={p} onClick={() => applyPreset(p)}
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

        {/* Download */}
        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('csv')} className="gap-1.5">
            <Download size={14} />CSV
          </Button>
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('pdf')} className="gap-1.5">
            <Download size={14} />PDF
          </Button>
        </div>
      </div>}

      {/* Tables */}
      {tab === 'register'       && <OrderRegisterTable  rows={registerRows}                            loading={registerQuery.isLoading} />}
      {tab === 'open'           && <OpenOrderTable       rows={openRows}                                loading={openQuery.isLoading} />}
      {tab === 'client-summary' && <ClientSummaryTable   rows={clientSummaryQuery.data?.data ?? []}     loading={clientSummaryQuery.isLoading} />}
      {tab === 'overdue'        && <OverdueTable          rows={overdueRows}                             loading={overdueQuery.isLoading} />}
      {tab === 'fulfillment'    && <FulfillmentTable      rows={fulfillmentQuery.data?.data ?? []}       loading={fulfillmentQuery.isLoading} />}
      {tab === 'route-summary'  && <RouteSummaryTable     rows={routeSummaryQuery.data?.data ?? []}      loading={routeSummaryQuery.isLoading} />}
      {tab === 'payment-status' && <PaymentStatusTable    rows={paymentRows}                             loading={paymentQuery.isLoading} />}
      {tab === 'order-summary'  && <OrderSummaryTab />}
    </div>
  )
}
