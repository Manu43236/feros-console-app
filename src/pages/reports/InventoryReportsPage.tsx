import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Package, ArrowDownToLine, ArrowUpFromLine, ClipboardList, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { StockSummaryRow, StockInwardRow, StockOutwardRow, PartRequestRow, ConsumptionByVehicleRow } from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const thisMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Tab config ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'stock-summary',  label: 'Current Stock',       icon: Package },
  { key: 'inward',         label: 'Stock Inward',        icon: ArrowDownToLine },
  { key: 'outward',        label: 'Stock Outward',       icon: ArrowUpFromLine },
  { key: 'part-requests',  label: 'Part Requests',       icon: ClipboardList },
  { key: 'consumption',    label: 'Consumption by Vehicle', icon: Truck },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'this-month' | 'custom'

// ── Status badge ───────────────────────────────────────────────────────────────
function StockBadge({ status }: { status: string }) {
  const cls =
    status === 'OK'  ? 'bg-green-100 text-green-700' :
    status === 'LOW' ? 'bg-amber-100 text-amber-700' :
                       'bg-red-100 text-red-700'
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cls)}>{status}</span>
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'APPROVED'  ? 'bg-green-100 text-green-700' :
    status === 'REJECTED'  ? 'bg-red-100 text-red-700' :
                             'bg-amber-100 text-amber-700'
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cls)}>{status}</span>
}

function fmt(val?: number | null) {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}
function fmtDate(val?: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDt(val?: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Shared date range bar ──────────────────────────────────────────────────────
function DateBar({
  startDate, endDate, preset, onStartDate, onEndDate, onPreset,
}: {
  startDate: string; endDate: string; preset: DatePreset
  onStartDate: (v: string) => void; onEndDate: (v: string) => void; onPreset: (p: DatePreset) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['this-month', 'custom'] as const).map(p => (
        <button key={p} onClick={() => onPreset(p)}
          className={cn('px-3 py-1.5 rounded text-xs font-medium border transition-colors',
            preset === p ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
          {p === 'this-month' ? 'This Month' : 'Custom'}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-1">
          <Input type="date" value={startDate} onChange={e => onStartDate(e.target.value)} className="h-8 text-sm w-36" />
          <span className="text-gray-400 text-sm">—</span>
          <Input type="date" value={endDate} onChange={e => onEndDate(e.target.value)} className="h-8 text-sm w-36" />
        </div>
      )}
    </div>
  )
}

// ── Export button ──────────────────────────────────────────────────────────────
function ExportBtn({ onExport, loading }: { onExport: (f: 'csv' | 'pdf') => void; loading?: boolean }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={loading} onClick={() => onExport('csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => onExport('pdf')}><Download className="w-3.5 h-3.5 mr-1" />PDF</Button>
    </div>
  )
}

// ── Table wrapper ──────────────────────────────────────────────────────────────
function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm">{children}</table></div>
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('px-4 py-3 text-xs font-semibold text-white whitespace-nowrap bg-feros-navy', right && 'text-right')}>{children}</th>
}
function Td({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return <td className={cn('px-4 py-2.5 text-gray-700 border-b border-gray-100 whitespace-nowrap', right && 'text-right', muted && 'text-gray-400')}>{children}</td>
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export default function InventoryReportsPage() {
  const [tab, setTab] = useState<TabKey>('stock-summary')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [exporting, setExporting] = useState(false)

  const effectiveStart = preset === 'this-month' ? thisMonthStart() : startDate
  const effectiveEnd   = preset === 'this-month' ? todayStr() : endDate

  function handlePreset(p: DatePreset) {
    setPreset(p)
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  // ── Queries ──────────────────────────────────────────────────────────────────
  const stockQ  = useQuery({ queryKey: ['report-stock-summary'], queryFn: () => reportsApi.getStockSummary(), enabled: tab === 'stock-summary' })
  const inwardQ = useQuery({ queryKey: ['report-inward', effectiveStart, effectiveEnd], queryFn: () => reportsApi.getStockInward(effectiveStart, effectiveEnd), enabled: tab === 'inward' })
  const outQ    = useQuery({ queryKey: ['report-outward', effectiveStart, effectiveEnd], queryFn: () => reportsApi.getStockOutward(effectiveStart, effectiveEnd), enabled: tab === 'outward' })
  const reqQ    = useQuery({ queryKey: ['report-part-requests', effectiveStart, effectiveEnd], queryFn: () => reportsApi.getPartRequests(effectiveStart, effectiveEnd), enabled: tab === 'part-requests' })
  const conQ    = useQuery({ queryKey: ['report-consumption', effectiveStart, effectiveEnd], queryFn: () => reportsApi.getConsumptionByVehicle(effectiveStart, effectiveEnd), enabled: tab === 'consumption' })

  async function doExport(format: 'csv' | 'pdf') {
    setExporting(true)
    try {
      if (tab === 'stock-summary') await reportsApi.exportStockSummary(format)
      else if (tab === 'inward')       await reportsApi.exportStockInward(effectiveStart, effectiveEnd, format)
      else if (tab === 'outward')      await reportsApi.exportStockOutward(effectiveStart, effectiveEnd, format)
      else if (tab === 'part-requests') await reportsApi.exportPartRequests(effectiveStart, effectiveEnd, format)
      else if (tab === 'consumption')  await reportsApi.exportConsumptionByVehicle(effectiveStart, effectiveEnd, format)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const needsDate = tab !== 'stock-summary'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stock, inward, outward, part requests and consumption analytics</p>
        </div>
        <ExportBtn onExport={doExport} loading={exporting} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border rounded-xl p-1.5 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                tab === t.key ? 'bg-feros-navy text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100')}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          )
        })}
      </div>

      {/* Date bar */}
      {needsDate && (
        <div className="bg-white border rounded-xl p-4">
          <DateBar startDate={startDate} endDate={endDate} preset={preset}
            onStartDate={setStartDate} onEndDate={setEndDate} onPreset={handlePreset} />
        </div>
      )}

      {/* Tab content */}
      <div className="bg-white border rounded-xl">
        {tab === 'stock-summary' && <StockSummaryTab rows={stockQ.data?.data} loading={stockQ.isLoading} />}
        {tab === 'inward'        && <InwardTab        rows={inwardQ.data?.data} loading={inwardQ.isLoading} />}
        {tab === 'outward'       && <OutwardTab       rows={outQ.data?.data}    loading={outQ.isLoading} />}
        {tab === 'part-requests' && <PartRequestsTab  rows={reqQ.data?.data}    loading={reqQ.isLoading} />}
        {tab === 'consumption'   && <ConsumptionTab   rows={conQ.data?.data}    loading={conQ.isLoading} />}
      </div>
    </div>
  )
}

// ── Stock Summary ──────────────────────────────────────────────────────────────
function StockSummaryTab({ rows, loading }: { rows?: StockSummaryRow[]; loading: boolean }) {
  const [filter, setFilter] = useState<'ALL' | 'OK' | 'LOW' | 'OUT'>('ALL')
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No data</div>
  const filtered = filter === 'ALL' ? rows : rows.filter(r => r.stockStatus === filter)

  const counts = { ALL: rows.length, OK: rows.filter(r => r.stockStatus === 'OK').length, LOW: rows.filter(r => r.stockStatus === 'LOW').length, OUT: rows.filter(r => r.stockStatus === 'OUT').length }
  return (
    <div>
      <div className="flex gap-2 p-3 border-b flex-wrap">
        {(['ALL', 'OK', 'LOW', 'OUT'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1 rounded text-xs font-medium border transition-colors',
              filter === f ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>
      <TableWrap>
        <thead><tr><Th>Part Name</Th><Th>Part No.</Th><Th>Category</Th><Th>Unit</Th><Th right>Qty On Hand</Th><Th right>Min Level</Th><Th>Status</Th></tr></thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.partId} className="hover:bg-gray-50">
              <Td>{r.partName}</Td>
              <Td muted>{r.partNumber || '—'}</Td>
              <Td muted>{r.category || '—'}</Td>
              <Td muted>{r.unit}</Td>
              <Td right><span className={r.quantityOnHand === 0 ? 'text-red-600 font-semibold' : r.quantityOnHand <= r.minStockLevel ? 'text-amber-600 font-medium' : ''}>{r.quantityOnHand}</span></Td>
              <Td right muted>{r.minStockLevel}</Td>
              <Td><StockBadge status={r.stockStatus} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Stock Inward ───────────────────────────────────────────────────────────────
function InwardTab({ rows, loading }: { rows?: StockInwardRow[]; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No inward transactions in this period</div>
  const total = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)

  // Group rows: invoiced together if same invoiceNo+supplier, ungrouped otherwise
  type Group = { key: string; invoiceNo?: string; invoiceDate?: string; supplier?: string; rows: StockInwardRow[] }
  const groups: Group[] = []
  const seen = new Map<string, Group>()
  for (const r of rows) {
    if (r.invoiceNo) {
      const groupKey = `${r.supplierName ?? ''}__${r.invoiceNo}`
      if (!seen.has(groupKey)) {
        const g: Group = { key: groupKey, invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate, supplier: r.supplierName, rows: [] }
        seen.set(groupKey, g)
        groups.push(g)
      }
      seen.get(groupKey)!.rows.push(r)
    } else {
      groups.push({ key: `single_${r.transactionId}`, rows: [r] })
    }
  }

  return (
    <div>
      <div className="px-4 py-2 border-b text-sm text-gray-500">
        {rows.length} transaction{rows.length !== 1 ? 's' : ''} · Total value: <span className="font-semibold text-gray-800">₹{fmt(total)}</span>
      </div>
      <TableWrap>
        <thead><tr><Th>Date & Time</Th><Th>Part</Th><Th>Category</Th><Th>Unit</Th><Th right>Qty</Th><Th right>Unit Cost</Th><Th right>Total Cost</Th><Th>Supplier / Invoice</Th><Th>Received By</Th><Th>Notes</Th></tr></thead>
        <tbody>
          {groups.map(g => {
            if (g.rows.length > 1) {
              const groupTotal = g.rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)
              return (
                <Fragment key={g.key}>
                  {/* Invoice header row */}
                  <tr className="bg-blue-50 border-t border-blue-100">
                    <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-blue-700">
                      Invoice: {g.invoiceNo}
                      {g.invoiceDate && <span className="ml-2 font-normal text-blue-500">{fmtDate(g.invoiceDate)}</span>}
                      {g.supplier && <span className="ml-2 font-normal text-blue-500">· {g.supplier}</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-blue-700">₹{fmt(groupTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                  {/* Invoice line rows */}
                  {g.rows.map(r => (
                    <tr key={r.transactionId} className="hover:bg-gray-50 bg-blue-50/30">
                      <Td muted>{fmtDt(r.transactionDate)}</Td>
                      <Td><div className="font-medium pl-3">{r.partName}</div>{r.partNumber && <div className="text-xs text-gray-400 pl-3">{r.partNumber}</div>}</Td>
                      <Td muted>{r.category || '—'}</Td>
                      <Td muted>{r.unit}</Td>
                      <Td right>{r.quantity}</Td>
                      <Td right muted>{r.unitCost != null ? `₹${fmt(r.unitCost)}` : '—'}</Td>
                      <Td right>{r.totalCost != null ? `₹${fmt(r.totalCost)}` : '—'}</Td>
                      <Td muted>—</Td>
                      <Td>{r.receivedBy}</Td>
                      <Td muted>{r.notes || '—'}</Td>
                    </tr>
                  ))}
                </Fragment>
              )
            }
            const r = g.rows[0]
            return (
              <tr key={r.transactionId} className="hover:bg-gray-50">
                <Td>{fmtDt(r.transactionDate)}</Td>
                <Td><div className="font-medium">{r.partName}</div>{r.partNumber && <div className="text-xs text-gray-400">{r.partNumber}</div>}</Td>
                <Td muted>{r.category || '—'}</Td>
                <Td muted>{r.unit}</Td>
                <Td right>{r.quantity}</Td>
                <Td right muted>{r.unitCost != null ? `₹${fmt(r.unitCost)}` : '—'}</Td>
                <Td right>{r.totalCost != null ? `₹${fmt(r.totalCost)}` : '—'}</Td>
                <Td>
                  <div>{r.supplierName || '—'}</div>
                  {r.invoiceNo && <div className="text-xs text-gray-400">{r.invoiceNo}{r.invoiceDate ? ` · ${fmtDate(r.invoiceDate)}` : ''}</div>}
                </Td>
                <Td>{r.receivedBy}</Td>
                <Td muted>{r.notes || '—'}</Td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Stock Outward ──────────────────────────────────────────────────────────────
function OutwardTab({ rows, loading }: { rows?: StockOutwardRow[]; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No outward transactions in this period</div>
  const total = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  return (
    <div>
      <div className="px-4 py-2 border-b text-sm text-gray-500">
        {rows.length} transactions · Total value: <span className="font-semibold text-gray-800">₹{fmt(total)}</span>
      </div>
      <TableWrap>
        <thead><tr><Th>Date & Time</Th><Th>Part</Th><Th>Category</Th><Th>Unit</Th><Th right>Qty</Th><Th right>Total Cost</Th><Th>Type</Th><Th>Vehicle</Th><Th>Requested By</Th><Th>Approved By</Th><Th>Notes</Th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.transactionId} className="hover:bg-gray-50">
              <Td>{fmtDt(r.transactionDate)}</Td>
              <Td><div className="font-medium">{r.partName}</div>{r.partNumber && <div className="text-xs text-gray-400">{r.partNumber}</div>}</Td>
              <Td muted>{r.category || '—'}</Td>
              <Td muted>{r.unit}</Td>
              <Td right>{r.quantity}</Td>
              <Td right>{r.totalCost != null ? `₹${fmt(r.totalCost)}` : '—'}</Td>
              <Td><span className={cn('px-2 py-0.5 rounded text-xs font-medium', r.transactionType === 'DAMAGE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>{r.transactionType}</span></Td>
              <Td>{r.vehicleRegistration || '—'}</Td>
              <Td muted>{r.requestedBy || '—'}</Td>
              <Td muted>{r.approvedBy || '—'}</Td>
              <Td muted>{r.notes || '—'}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Part Requests ──────────────────────────────────────────────────────────────
function PartRequestsTab({ rows, loading }: { rows?: PartRequestRow[]; loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REQUESTED' | 'APPROVED' | 'REJECTED'>('ALL')
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No part requests in this period</div>
  const filtered = statusFilter === 'ALL' ? rows : rows.filter(r => r.status === statusFilter)
  return (
    <div>
      <div className="flex gap-2 p-3 border-b flex-wrap">
        {(['ALL', 'REQUESTED', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={cn('px-3 py-1 rounded text-xs font-medium border transition-colors',
              statusFilter === f ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
            {f}
          </button>
        ))}
      </div>
      <TableWrap>
        <thead><tr><Th>Service Date</Th><Th>Part</Th><Th>Category</Th><Th>Unit</Th><Th right>Qty Req.</Th><Th right>Qty Appr.</Th><Th>Vehicle</Th><Th>Requested By</Th><Th>Approved By</Th><Th>Status</Th></tr></thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.servicePartId} className="hover:bg-gray-50">
              <Td>{fmtDate(r.serviceDate)}</Td>
              <Td><div className="font-medium">{r.partName}</div>{r.partNumber && <div className="text-xs text-gray-400">{r.partNumber}</div>}</Td>
              <Td muted>{r.category || '—'}</Td>
              <Td muted>{r.unit}</Td>
              <Td right>{r.quantityRequested}</Td>
              <Td right>{r.quantityApproved || '—'}</Td>
              <Td>{r.vehicleRegistration || '—'}<br />{r.vehicleType && <span className="text-xs text-gray-400">{r.vehicleType}</span>}</Td>
              <Td muted>{r.requestedBy || '—'}</Td>
              <Td muted>{r.approvedBy || '—'}</Td>
              <Td><StatusBadge status={r.status} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Consumption by Vehicle ─────────────────────────────────────────────────────
function ConsumptionTab({ rows, loading }: { rows?: ConsumptionByVehicleRow[]; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No consumption data in this period</div>

  const vehicles = new Set(rows.map(r => r.registrationNumber)).size
  const totalCost = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  return (
    <div>
      <div className="px-4 py-2 border-b text-sm text-gray-500 flex gap-4">
        <span>{vehicles} vehicle{vehicles !== 1 ? 's' : ''}</span>
        <span>{rows.length} part line{rows.length !== 1 ? 's' : ''}</span>
        <span>Total cost: <span className="font-semibold text-gray-800">₹{fmt(totalCost)}</span></span>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Vehicle</Th>
            <Th>Vehicle Type</Th>
            <Th>Part Name</Th>
            <Th>Category</Th>
            <Th right>Qty Consumed</Th>
            <Th right>Total Cost (₹)</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isNewGroup = i === 0 || rows[i - 1].registrationNumber !== r.registrationNumber
            return (
              <tr key={`${r.vehicleId}-${r.partId}`}
                className={cn('hover:bg-gray-50', isNewGroup && i > 0 && 'border-t-2 border-gray-200')}>
                <Td><span className="font-semibold">{r.registrationNumber}</span></Td>
                <Td muted>{r.vehicleType}</Td>
                <Td>{r.partName}</Td>
                <Td muted>{r.partCategory || '—'}</Td>
                <Td right><span className="font-medium">{r.timesConsumed}</span></Td>
                <Td right>{r.totalCost != null ? `₹${fmt(r.totalCost)}` : '—'}</Td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </div>
  )
}
