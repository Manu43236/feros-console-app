import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, CircleDot, ArrowDownToLine, ArrowUpFromLine, BarChart2, ClipboardList, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { TyreInventoryRow, TyreFittingRow, TyreRemovalRow, TyreLifeRow, TyreRequestRow, TyreRotationRow } from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const thisMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Tab config ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'inventory',  label: 'Current Inventory', icon: CircleDot },
  { key: 'fittings',   label: 'Fitting Register',  icon: ArrowDownToLine },
  { key: 'removals',   label: 'Removal Register',  icon: ArrowUpFromLine },
  { key: 'life',       label: 'Tyre Life',         icon: BarChart2 },
  { key: 'requests',   label: 'Request Register',  icon: ClipboardList },
  { key: 'rotations',  label: 'Rotation Log',      icon: RotateCcw },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'this-month' | 'custom'

// ── Formatters ─────────────────────────────────────────────────────────────────
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
function fmtKm(val?: number | null) {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-IN').format(val) + ' km'
}

// ── Status badge ───────────────────────────────────────────────────────────────
function TyreStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'IN_STOCK'   ? 'bg-green-100 text-green-700' :
    status === 'FITTED'     ? 'bg-blue-100 text-blue-700' :
    status === 'RETREADING' ? 'bg-amber-100 text-amber-700' :
    status === 'SCRAPPED'   ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
  const label = status.replace(/_/g, ' ')
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cls)}>{label}</span>
}

function RequestStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'APPROVED' ? 'bg-green-100 text-green-700' :
    status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cls)}>{status}</span>
}

// ── Life bar ───────────────────────────────────────────────────────────────────
function LifeBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Date bar ──────────────────────────────────────────────────────────────────
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
            preset === p ? 'bg-navy-600 text-white border-navy-600' : 'bg-white text-gray-600 border-gray-200 hover:border-navy-400')}>
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

// ── Export button ─────────────────────────────────────────────────────────────
function ExportBtn({ onExport, loading }: { onExport: (f: 'csv' | 'pdf') => void; loading?: boolean }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={loading} onClick={() => onExport('csv')}><Download className="w-3.5 h-3.5 mr-1" />CSV</Button>
      <Button variant="outline" size="sm" disabled={loading} onClick={() => onExport('pdf')}><Download className="w-3.5 h-3.5 mr-1" />PDF</Button>
    </div>
  )
}

// ── Table helpers ──────────────────────────────────────────────────────────────
function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm">{children}</table></div>
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn('px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 border-b whitespace-nowrap', right && 'text-right')}>{children}</th>
}
function Td({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return <td className={cn('px-3 py-2 border-b border-gray-100 whitespace-nowrap', right && 'text-right', muted && 'text-gray-400')}>{children}</td>
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TyreReportsPage() {
  const [tab, setTab]       = useState<TabKey>('inventory')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate]     = useState(todayStr())
  const [exporting, setExporting] = useState(false)

  const effectiveStart = preset === 'this-month' ? thisMonthStart() : startDate
  const effectiveEnd   = preset === 'this-month' ? todayStr() : endDate

  function handlePreset(p: DatePreset) {
    setPreset(p)
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  // ── Queries ──────────────────────────────────────────────────────────────────
  const invQ  = useQuery({ queryKey: ['report-tyre-inventory'],  queryFn: () => reportsApi.getTyreInventory(), enabled: tab === 'inventory' })
  const fitQ  = useQuery({ queryKey: ['report-tyre-fittings', effectiveStart, effectiveEnd],  queryFn: () => reportsApi.getTyreFittingRegister(effectiveStart, effectiveEnd), enabled: tab === 'fittings' })
  const remQ  = useQuery({ queryKey: ['report-tyre-removals',  effectiveStart, effectiveEnd], queryFn: () => reportsApi.getTyreRemovalRegister(effectiveStart, effectiveEnd), enabled: tab === 'removals' })
  const lifeQ = useQuery({ queryKey: ['report-tyre-life'],       queryFn: () => reportsApi.getTyreLifeReport(), enabled: tab === 'life' })
  const reqQ  = useQuery({ queryKey: ['report-tyre-requests',  effectiveStart, effectiveEnd], queryFn: () => reportsApi.getTyreRequests(effectiveStart, effectiveEnd), enabled: tab === 'requests' })
  const rotQ  = useQuery({ queryKey: ['report-tyre-rotations', effectiveStart, effectiveEnd], queryFn: () => reportsApi.getTyreRotationLog(effectiveStart, effectiveEnd), enabled: tab === 'rotations' })

  async function doExport(format: 'csv' | 'pdf') {
    setExporting(true)
    try {
      if      (tab === 'inventory') await reportsApi.exportTyreInventory(format)
      else if (tab === 'fittings')  await reportsApi.exportTyreFittingRegister(effectiveStart, effectiveEnd, format)
      else if (tab === 'removals')  await reportsApi.exportTyreRemovalRegister(effectiveStart, effectiveEnd, format)
      else if (tab === 'life')      await reportsApi.exportTyreLifeReport(format)
      else if (tab === 'requests')  await reportsApi.exportTyreRequests(effectiveStart, effectiveEnd, format)
      else if (tab === 'rotations') await reportsApi.exportTyreRotationLog(effectiveStart, effectiveEnd, format)
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const needsDate = tab !== 'inventory' && tab !== 'life'

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tyre Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Inventory, fittings, removals, life tracking, requests and rotation logs</p>
        </div>
        <ExportBtn onExport={doExport} loading={exporting} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t.key ? 'border-navy-600 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          )
        })}
      </div>

      {/* Date bar */}
      {needsDate && (
        <div className="bg-white rounded-lg border p-3">
          <DateBar startDate={startDate} endDate={endDate} preset={preset}
            onStartDate={setStartDate} onEndDate={setEndDate} onPreset={handlePreset} />
        </div>
      )}

      {/* Tab content */}
      <div className="bg-white rounded-lg border">
        {tab === 'inventory' && <TyreInventoryTab rows={invQ.data?.data}  loading={invQ.isLoading} />}
        {tab === 'fittings'  && <FittingsTab      rows={fitQ.data?.data}  loading={fitQ.isLoading} />}
        {tab === 'removals'  && <RemovalsTab      rows={remQ.data?.data}  loading={remQ.isLoading} />}
        {tab === 'life'      && <TyreLifeTab      rows={lifeQ.data?.data} loading={lifeQ.isLoading} />}
        {tab === 'requests'  && <RequestsTab      rows={reqQ.data?.data}  loading={reqQ.isLoading} />}
        {tab === 'rotations' && <RotationsTab     rows={rotQ.data?.data}  loading={rotQ.isLoading} />}
      </div>
    </div>
  )
}

// ── Current Inventory ─────────────────────────────────────────────────────────
function TyreInventoryTab({ rows, loading }: { rows?: TyreInventoryRow[]; loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No tyres found</div>

  const statuses = ['ALL', 'IN_STOCK', 'FITTED', 'RETREADING', 'SCRAPPED', 'DISPOSED']
  const counts: Record<string, number> = { ALL: rows.length }
  for (const s of statuses.slice(1)) counts[s] = rows.filter(r => r.status === s).length
  const filtered = statusFilter === 'ALL' ? rows : rows.filter(r => r.status === statusFilter)

  return (
    <div>
      <div className="flex gap-2 p-3 border-b flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('px-3 py-1 rounded text-xs font-medium border transition-colors',
              statusFilter === s ? 'bg-navy-600 text-white border-navy-600' : 'bg-white text-gray-600 border-gray-200 hover:border-navy-400')}>
            {s.replace(/_/g, ' ')} ({counts[s] ?? 0})
          </button>
        ))}
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Serial No.</Th><Th>Brand</Th><Th>Size</Th><Th>Type</Th><Th>Ply</Th>
            <Th>Purchase Date</Th><Th right>Cost (₹)</Th><Th>Status</Th>
            <Th right>Lifetime KM</Th><Th right>Max KM</Th><Th>Life Used</Th>
            <Th right>Retreads</Th><Th>Expiry</Th><Th>Fitted On</Th><Th>Position</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.tyreId} className="hover:bg-gray-50">
              <Td><span className="font-mono font-medium">{r.serialNumber}</span></Td>
              <Td>{r.brand}</Td>
              <Td muted>{r.size}</Td>
              <Td muted>{r.tyreType}</Td>
              <Td muted>{r.plyRating || '—'}</Td>
              <Td muted>{fmtDate(r.purchaseDate)}</Td>
              <Td right>{r.purchaseCost != null ? `₹${fmt(r.purchaseCost)}` : '—'}</Td>
              <Td><TyreStatusBadge status={r.status} /></Td>
              <Td right>{fmtKm(r.totalLifetimeKm)}</Td>
              <Td right muted>{r.maxLifetimeKm ? fmtKm(r.maxLifetimeKm) : '—'}</Td>
              <Td><LifeBar pct={r.percentLifeUsed} /></Td>
              <Td right>{r.retreadCount}</Td>
              <Td muted>{fmtDate(r.expiryDate)}</Td>
              <Td>{r.fittedOnVehicle || '—'}</Td>
              <Td muted>{r.fittedPosition || '—'}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Fitting Register ───────────────────────────────────────────────────────────
function FittingsTab({ rows, loading }: { rows?: TyreFittingRow[]; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No fittings in this period</div>
  return (
    <div>
      <div className="px-4 py-2 border-b text-sm text-gray-500">{rows.length} fittings</div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Fitted Date</Th><Th>Vehicle</Th><Th>Type</Th>
            <Th>Tyre Serial</Th><Th>Brand</Th><Th>Size</Th><Th>Tyre Type</Th>
            <Th>Position</Th><Th right>Fitted At KM</Th><Th>Fitted By</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.fittingId} className="hover:bg-gray-50">
              <Td>{fmtDate(r.fittedDate)}</Td>
              <Td><span className="font-medium">{r.vehicleRegistration}</span></Td>
              <Td muted>{r.vehicleType}</Td>
              <Td><span className="font-mono">{r.tyreSerial}</span></Td>
              <Td>{r.tyreBrand}</Td>
              <Td muted>{r.tyreSize}</Td>
              <Td muted>{r.tyreType}</Td>
              <Td>{r.position}</Td>
              <Td right>{fmtKm(r.fittedAtKm)}</Td>
              <Td muted>{r.fittedBy}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Removal Register ──────────────────────────────────────────────────────────
function RemovalsTab({ rows, loading }: { rows?: TyreRemovalRow[]; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No removals in this period</div>
  return (
    <div>
      <div className="px-4 py-2 border-b text-sm text-gray-500">{rows.length} removals</div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Removed Date</Th><Th>Vehicle</Th><Th>Type</Th>
            <Th>Tyre Serial</Th><Th>Brand</Th><Th>Size</Th><Th>Position</Th>
            <Th right>Fitted At KM</Th><Th right>Removed At KM</Th><Th right>KM Driven</Th>
            <Th>Reason</Th><Th>Removed By</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.fittingId} className="hover:bg-gray-50">
              <Td>{fmtDate(r.removedDate)}</Td>
              <Td><span className="font-medium">{r.vehicleRegistration}</span></Td>
              <Td muted>{r.vehicleType}</Td>
              <Td><span className="font-mono">{r.tyreSerial}</span></Td>
              <Td>{r.tyreBrand}</Td>
              <Td muted>{r.tyreSize}</Td>
              <Td>{r.position}</Td>
              <Td right>{fmtKm(r.fittedAtKm)}</Td>
              <Td right>{fmtKm(r.removedAtKm)}</Td>
              <Td right><span className="font-medium">{fmtKm(r.kmDriven)}</span></Td>
              <Td><span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{r.removalReason}</span></Td>
              <Td muted>{r.removedBy}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Tyre Life ──────────────────────────────────────────────────────────────────
function TyreLifeTab({ rows, loading }: { rows?: TyreLifeRow[]; loading: boolean }) {
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No tyres found</div>
  const critical = rows.filter(r => r.percentLifeUsed >= 90).length
  return (
    <div>
      <div className="px-4 py-2 border-b text-sm text-gray-500 flex gap-4">
        <span>{rows.length} tyres</span>
        {critical > 0 && <span className="text-red-600 font-medium">{critical} critical (≥90% life used)</span>}
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Serial No.</Th><Th>Brand</Th><Th>Size</Th><Th>Type</Th>
            <Th right>Lifetime KM</Th><Th right>Max KM</Th><Th>Life Used</Th>
            <Th right>Retreads</Th><Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.tyreId} className={cn('hover:bg-gray-50', r.percentLifeUsed >= 90 && 'bg-red-50/50')}>
              <Td><span className="font-mono font-medium">{r.serialNumber}</span></Td>
              <Td>{r.brand}</Td>
              <Td muted>{r.size}</Td>
              <Td muted>{r.tyreType}</Td>
              <Td right>{fmtKm(r.totalLifetimeKm)}</Td>
              <Td right muted>{r.maxLifetimeKm ? fmtKm(r.maxLifetimeKm) : '—'}</Td>
              <Td><LifeBar pct={r.percentLifeUsed} /></Td>
              <Td right>{r.retreadCount}</Td>
              <Td><TyreStatusBadge status={r.status} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Request Register ──────────────────────────────────────────────────────────
function RequestsTab({ rows, loading }: { rows?: TyreRequestRow[]; loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No requests in this period</div>
  const filtered = statusFilter === 'ALL' ? rows : rows.filter(r => r.status === statusFilter)
  return (
    <div>
      <div className="flex gap-2 p-3 border-b flex-wrap">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={cn('px-3 py-1 rounded text-xs font-medium border transition-colors',
              statusFilter === f ? 'bg-navy-600 text-white border-navy-600' : 'bg-white text-gray-600 border-gray-200 hover:border-navy-400')}>
            {f}
          </button>
        ))}
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Date</Th><Th>Vehicle</Th><Th>Type</Th><Th>Position</Th>
            <Th>Requested By</Th><Th>Approved By</Th>
            <Th>Issued Tyre</Th><Th right>Fitted At KM</Th><Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.requestId} className="hover:bg-gray-50">
              <Td>{fmtDt(r.createdAt)}</Td>
              <Td><span className="font-medium">{r.vehicleRegistration}</span></Td>
              <Td muted>{r.vehicleType}</Td>
              <Td>{r.position}</Td>
              <Td>{r.requestedBy}</Td>
              <Td muted>{r.approvedBy || '—'}</Td>
              <Td>
                {r.issuedTyreSerial
                  ? <div><span className="font-mono text-xs">{r.issuedTyreSerial}</span><div className="text-xs text-gray-400">{r.issuedTyreBrand}</div></div>
                  : <span className="text-gray-400">—</span>}
              </Td>
              <Td right>{r.fittedAtKm ? fmtKm(r.fittedAtKm) : '—'}</Td>
              <Td><RequestStatusBadge status={r.status} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ── Rotation Log ──────────────────────────────────────────────────────────────
function RotationsTab({ rows, loading }: { rows?: TyreRotationRow[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!rows?.length) return <div className="p-8 text-center text-gray-400">No rotation logs in this period</div>

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div>
      <div className="px-4 py-2 border-b text-sm text-gray-500">{rows.length} rotation sessions</div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Date</Th><Th>Vehicle</Th><Th>Type</Th>
            <Th right>Odometer KM</Th><Th right>Tyres Rotated</Th><Th>Performed By</Th><Th>Movements</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <>
              <tr key={r.rotationLogId} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggle(r.rotationLogId)}>
                <Td>{fmtDate(r.rotationDate)}</Td>
                <Td><span className="font-medium">{r.vehicleRegistration}</span></Td>
                <Td muted>{r.vehicleType}</Td>
                <Td right>{fmtKm(r.odometerKm)}</Td>
                <Td right>{r.tyresRotated}</Td>
                <Td muted>{r.performedBy}</Td>
                <Td>
                  <button className="text-xs text-navy-600 hover:underline">
                    {expanded.has(r.rotationLogId) ? 'Hide' : 'Show'} movements
                  </button>
                </Td>
              </tr>
              {expanded.has(r.rotationLogId) && r.movements.map((m, i) => (
                <tr key={i} className="bg-blue-50/40">
                  <td colSpan={2} />
                  <Td muted><span className="font-mono text-xs">{m.tyreSerial}</span></Td>
                  <Td muted>{m.tyreBrand}</Td>
                  <td colSpan={3} className="px-3 py-2 text-sm">
                    <span className="text-xs text-gray-600">
                      <span className="font-medium">{m.fromPosition}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="font-medium">{m.toPosition}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}
