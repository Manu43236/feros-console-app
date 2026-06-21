import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, TrendingUp, Building2, Truck, MapPin, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { ClientPnlRow, VehiclePnlRow, RoutePnlRow, ClientVehiclePnlRow, TripPnlRow } from '@/types'

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

const fmt = (n?: number) => n != null
  ? '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '—'

const TABS = [
  { key: 'clients',        label: 'Per Client',         icon: Building2 },
  { key: 'client-vehicle', label: 'Client × Vehicle',   icon: Truck },
  { key: 'vehicles',       label: 'Per Vehicle',         icon: Truck },
  { key: 'routes',         label: 'Per Route',           icon: MapPin },
  { key: 'trips',          label: 'Per Trip',            icon: FileText },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

function PnlBadge({ value }: { value?: number }) {
  if (value == null) return <span className="text-gray-400">—</span>
  const pos = value >= 0
  return (
    <span className={cn('font-semibold tabular-nums', pos ? 'text-emerald-600' : 'text-red-600')}>
      {pos ? '+' : ''}{fmt(value)}
    </span>
  )
}

function SummaryCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-1', color)}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-800 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function ReportTable({ headers, rows, loading }: {
  headers: string[]; rows: React.ReactNode[][]; loading: boolean
}) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (rows.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  return (
    <div className="overflow-x-auto">
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

// Grouped Client × Vehicle table — shows client as a spanning header row, then vehicle sub-rows
function ClientVehicleTable({ rows, loading }: { rows: ClientVehiclePnlRow[]; loading: boolean }) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (rows.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>

  // Group by client
  const byClient = rows.reduce<Record<string, ClientVehiclePnlRow[]>>((acc, r) => {
    if (!acc[r.clientName]) acc[r.clientName] = []
    acc[r.clientName].push(r)
    return acc
  }, {})

  const headers = ['Vehicle', 'Type', 'Trips', 'Revenue', 'Trip Expenses', 'Net P&L']

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white whitespace-nowrap bg-feros-navy">{h}</th>)}</tr>
        </thead>
        <tbody>
          {Object.entries(byClient).map(([clientName, vRows]) => {
            const clientRevenue = vRows.reduce((s, r) => s + r.revenue, 0)
            const clientExp = vRows.reduce((s, r) => s + r.tripExpenses, 0)
            const clientPnl = vRows.reduce((s, r) => s + r.netPnl, 0)
            return [
              // Client header row
              <tr key={`client-${clientName}`} className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={3} className="px-4 py-2 font-semibold text-feros-navy">{clientName}</td>
                <td className="px-4 py-2 font-semibold text-gray-700 tabular-nums">{fmt(clientRevenue)}</td>
                <td className="px-4 py-2 font-semibold text-gray-700 tabular-nums">{fmt(clientExp)}</td>
                <td className="px-4 py-2"><PnlBadge value={clientPnl} /></td>
              </tr>,
              // Vehicle sub-rows
              ...vRows.map((r, i) => (
                <tr key={`${clientName}-${r.vehicleId}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-2.5 pl-8 text-gray-700">{r.registrationNumber}</td>
                  <td className="px-4 py-2.5 text-gray-500">{r.vehicleType}</td>
                  <td className="px-4 py-2.5 text-gray-700">{r.totalTrips}</td>
                  <td className="px-4 py-2.5 text-gray-700 tabular-nums">{fmt(r.revenue)}</td>
                  <td className="px-4 py-2.5 text-gray-700 tabular-nums">{fmt(r.tripExpenses)}</td>
                  <td className="px-4 py-2.5"><PnlBadge value={r.netPnl} /></td>
                </tr>
              )),
            ]
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
        {rows.length} row{rows.length !== 1 ? 's' : ''} across {Object.keys(byClient).length} client{Object.keys(byClient).length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

export default function PnlReportsPage() {
  const [tab, setTab] = useState<TabKey>('clients')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate]     = useState(todayStr())
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv')
  const [exporting, setExporting] = useState(false)

  const applyPreset = (p: DatePreset) => {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());       setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart());  setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  const summaryQuery = useQuery({
    queryKey: ['pnl-summary', startDate, endDate],
    queryFn: () => reportsApi.getPnlSummary(startDate, endDate),
  })

  const clientQuery = useQuery({
    queryKey: ['pnl-clients', startDate, endDate],
    queryFn: () => reportsApi.getClientPnl(startDate, endDate),
    enabled: tab === 'clients',
  })

  const clientVehicleQuery = useQuery({
    queryKey: ['pnl-client-vehicle', startDate, endDate],
    queryFn: () => reportsApi.getClientVehiclePnl(startDate, endDate),
    enabled: tab === 'client-vehicle',
  })

  const vehicleQuery = useQuery({
    queryKey: ['pnl-vehicles', startDate, endDate],
    queryFn: () => reportsApi.getVehiclePnl(startDate, endDate),
    enabled: tab === 'vehicles',
  })

  const routeQuery = useQuery({
    queryKey: ['pnl-routes', startDate, endDate],
    queryFn: () => reportsApi.getRoutePnl(startDate, endDate),
    enabled: tab === 'routes',
  })

  const tripQuery = useQuery({
    queryKey: ['pnl-trips', startDate, endDate],
    queryFn: () => reportsApi.getTripPnl(startDate, endDate),
    enabled: tab === 'trips',
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      if (tab === 'clients')        await reportsApi.exportClientPnl(startDate, endDate, exportFormat)
      if (tab === 'client-vehicle') await reportsApi.exportClientVehiclePnl(startDate, endDate, exportFormat)
      if (tab === 'vehicles')       await reportsApi.exportVehiclePnl(startDate, endDate, exportFormat)
      if (tab === 'routes')         await reportsApi.exportRoutePnl(startDate, endDate, exportFormat)
      if (tab === 'trips')          await reportsApi.exportTripPnl(startDate, endDate, exportFormat)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const summary = summaryQuery.data?.data

  const clientRows: React.ReactNode[][] = (clientQuery.data?.data ?? []).map((r: ClientPnlRow) => [
    r.clientName,
    <span className="tabular-nums">{fmt(r.totalInvoiced)}</span>,
    <span className="tabular-nums">{fmt(r.totalCollected)}</span>,
    <span className={cn('font-medium tabular-nums', r.balanceDue > 0 ? 'text-amber-600' : 'text-gray-700')}>{fmt(r.balanceDue)}</span>,
    <span className="tabular-nums">{fmt(r.tripExpenses)}</span>,
    <PnlBadge value={r.netPnl} />,
  ])

  const vehicleRows: React.ReactNode[][] = (vehicleQuery.data?.data ?? []).map((r: VehiclePnlRow) => [
    r.registrationNumber,
    r.vehicleType,
    <span className="tabular-nums">{fmt(r.revenue)}</span>,
    <span className="tabular-nums">{fmt(r.tripExpenses)}</span>,
    <span className="tabular-nums">{fmt(r.fuelCost)}</span>,
    <span className="tabular-nums">{fmt(r.maintenanceCost)}</span>,
    <span className="tabular-nums">{fmt(r.tyreCost)}</span>,
    <span className="tabular-nums">{fmt(r.documentCost)}</span>,
    <span className="tabular-nums">{fmt(r.totalExpenses)}</span>,
    <PnlBadge value={r.netPnl} />,
  ])

  const routeRows: React.ReactNode[][] = (routeQuery.data?.data ?? []).map((r: RoutePnlRow) => [
    r.fromCity,
    r.toCity,
    r.totalTrips,
    <span className="tabular-nums">{fmt(r.revenue)}</span>,
    <span className="tabular-nums">{fmt(r.tripExpenses)}</span>,
    <PnlBadge value={r.netPnl} />,
  ])

  const tripRows: React.ReactNode[][] = (tripQuery.data?.data ?? []).map((r: TripPnlRow) => [
    r.lrNumber,
    r.lrDate,
    r.registrationNumber,
    r.clientName,
    r.fromCity,
    r.toCity,
    <span className={cn('tabular-nums', r.revenue === 0 ? 'text-amber-500' : 'text-gray-700')}>{fmt(r.revenue)}</span>,
    <span className="tabular-nums">{fmt(r.tripExpenses)}</span>,
    <PnlBadge value={r.netPnl} />,
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-feros-navy" />
        <h1 className="text-2xl font-bold text-feros-navy">Profit & Loss</h1>
        <span className="text-xs text-gray-400 ml-1">All figures aligned to LR date</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end">
        <div className="flex gap-1">
          {(['today', 'this-week', 'this-month', 'custom'] as DatePreset[]).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                preset === p ? 'bg-feros-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {p === 'today' ? 'Today' : p === 'this-week' ? 'This Week' : p === 'this-month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm" />
            </div>
          </>
        )}
        <div className="ml-auto flex gap-2 items-center">
          <select value={exportFormat} onChange={e => setExportFormat(e.target.value as 'csv' | 'pdf')}
            className="border rounded-md px-2 py-1.5 text-sm">
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
          <Button size="sm" onClick={handleExport} disabled={exporting}
            className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryQuery.isLoading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading summary…</div>
      ) : summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="Total Invoiced"   value={fmt(summary.totalInvoiced)}
              sub="LRs in period" color="bg-blue-50 border-blue-100" />
            <SummaryCard label="Total Collected"  value={fmt(summary.totalCollected)}
              sub="Payments on those invoices" color="bg-emerald-50 border-emerald-100" />
            <SummaryCard label="Balance Due"      value={fmt(summary.balanceDue)}
              sub="Invoiced − Collected" color="bg-amber-50 border-amber-100" />
            <SummaryCard label="Gross P&L"        value={fmt(summary.grossPnl)}
              sub="Invoiced − Trip Exp"
              color={summary.grossPnl >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} />
            <SummaryCard label="Net P&L"          value={fmt(summary.netPnl)}
              sub="Invoiced − All Expenses"
              color={summary.netPnl >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Trip Expenses"        value={fmt(summary.tripExpenses)}        color="bg-slate-50 border-slate-100" />
            <SummaryCard label="Fuel Expenses"        value={fmt(summary.fuelExpenses)}        color="bg-slate-50 border-slate-100" />
            <SummaryCard label="Maintenance Expenses" value={fmt(summary.maintenanceExpenses)} color="bg-slate-50 border-slate-100" />
            <SummaryCard label="Tyre Expenses"        value={fmt(summary.tyreExpenses)}        color="bg-slate-50 border-slate-100" />
            <SummaryCard label="Document Expenses"    value={fmt(summary.documentExpenses)}    color="bg-slate-50 border-slate-100" />
          </div>
        </div>
      )}

      {/* Tab Bar + Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                tab === t.key
                  ? 'border-b-2 border-feros-navy text-feros-navy bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50')}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {tab === 'clients' && (
            <ReportTable
              loading={clientQuery.isLoading}
              headers={['Client', 'Invoiced', 'Collected', 'Balance Due', 'Trip Expenses', 'Net P&L']}
              rows={clientRows}
            />
          )}

          {tab === 'client-vehicle' && (
            <ClientVehicleTable
              loading={clientVehicleQuery.isLoading}
              rows={clientVehicleQuery.data?.data ?? []}
            />
          )}

          {tab === 'vehicles' && (
            <ReportTable
              loading={vehicleQuery.isLoading}
              headers={['Vehicle', 'Type', 'Revenue', 'Trip Exp', 'Fuel', 'Maintenance', 'Tyres', 'Documents', 'Total Exp', 'Net P&L']}
              rows={vehicleRows}
            />
          )}

          {tab === 'routes' && (
            <ReportTable
              loading={routeQuery.isLoading}
              headers={['From', 'To', 'Trips', 'Revenue', 'Trip Expenses', 'Net P&L']}
              rows={routeRows}
            />
          )}

          {tab === 'trips' && (
            <>
              <p className="text-xs text-gray-400 px-4 pt-3 pb-2">
                Revenue shown is 0 for trips not yet invoiced (amber). Trip expenses shown only if expense sheet exists.
              </p>
              <ReportTable
                loading={tripQuery.isLoading}
                headers={['LR No.', 'Date', 'Vehicle', 'Client', 'From', 'To', 'Revenue', 'Trip Exp', 'Net P&L']}
                rows={tripRows}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
