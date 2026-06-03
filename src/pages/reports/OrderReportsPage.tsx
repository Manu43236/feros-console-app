import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, ClipboardList, AlertCircle, Users, AlertTriangle, Scale, MapPin, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
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
    headers={['Order No.', 'Date', 'Exp. Delivery', 'Client', 'Material', 'From', 'To',
      'Total Wt', 'Fulfilled Wt', 'Freight Amt', 'Status', 'Payment']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.orderNumber}</span>,
      r.orderDate, dash(r.expectedDeliveryDate), r.clientName, r.materialType,
      `${r.fromCity}, ${r.fromState}`, `${r.toCity}, ${r.toState}`,
      dash(r.totalWeight), dash(r.totalWeightFulfilled), dash(r.totalFreightAmount),
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function OrderReportsPage() {
  const [tab, setTab] = useState<TabKey>('register')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [downloading, setDownloading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [thresholdDays, setThresholdDays] = useState(1)

  function handleTabChange(key: TabKey) {
    setTab(key)
    setStatusFilter('ALL')
    setPaymentFilter('ALL')
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
  const registerRows = (registerQuery.data?.data ?? []).filter(r =>
    statusFilter === 'ALL' || r.orderStatus === statusFilter
  )
  const paymentRows = (paymentQuery.data?.data ?? []).filter(r =>
    paymentFilter === 'ALL' || r.orderPaymentStatus === paymentFilter
  )

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

      {/* Controls */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">

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
      </div>

      {/* Tables */}
      {tab === 'register'       && <OrderRegisterTable  rows={registerRows}                            loading={registerQuery.isLoading} />}
      {tab === 'open'           && <OpenOrderTable       rows={openQuery.data?.data ?? []}              loading={openQuery.isLoading} />}
      {tab === 'client-summary' && <ClientSummaryTable   rows={clientSummaryQuery.data?.data ?? []}     loading={clientSummaryQuery.isLoading} />}
      {tab === 'overdue'        && <OverdueTable          rows={overdueQuery.data?.data ?? []}           loading={overdueQuery.isLoading} />}
      {tab === 'fulfillment'    && <FulfillmentTable      rows={fulfillmentQuery.data?.data ?? []}       loading={fulfillmentQuery.isLoading} />}
      {tab === 'route-summary'  && <RouteSummaryTable     rows={routeSummaryQuery.data?.data ?? []}      loading={routeSummaryQuery.isLoading} />}
      {tab === 'payment-status' && <PaymentStatusTable    rows={paymentRows}                             loading={paymentQuery.isLoading} />}
    </div>
  )
}
