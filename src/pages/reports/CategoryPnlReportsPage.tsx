import { Spinner } from '@/components/ui/loader'
import { useState } from 'react'
import { HScroll } from '@/components/ui/h-scroll'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { CategoryPnlRow } from '@/types'

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

type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

function PnlCell({ value }: { value: number }) {
  const pos = value >= 0
  return (
    <span className={cn('font-semibold tabular-nums', pos ? 'text-emerald-600' : 'text-red-600')}>
      {pos ? '+' : ''}{fmt(value)}
    </span>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-1', color)}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-800 tabular-nums">{value}</p>
    </div>
  )
}

export default function CategoryPnlReportsPage() {
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

  const query = useQuery({
    queryKey: ['pnl-category', startDate, endDate],
    queryFn: () => reportsApi.getCategoryPnl(startDate, endDate),
  })

  const rows: CategoryPnlRow[] = query.data?.data ?? []

  const totals = rows.reduce((t, r) => ({
    revenue: t.revenue + r.revenue,
    diesel: t.diesel + r.diesel,
    salaries: t.salaries + r.salaries,
    spares: t.spares + r.spares,
    service: t.service + r.service,
    tripExpenses: t.tripExpenses + r.tripExpenses,
    others: t.others + r.others,
    totalExpenses: t.totalExpenses + r.totalExpenses,
    netPnl: t.netPnl + r.netPnl,
  }), { revenue: 0, diesel: 0, salaries: 0, spares: 0, service: 0, tripExpenses: 0, others: 0, totalExpenses: 0, netPnl: 0 })

  const handleExport = async () => {
    setExporting(true)
    try {
      await reportsApi.exportCategoryPnl(startDate, endDate, exportFormat)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const expCell = 'px-3 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap'
  const expHead = 'px-3 py-2 text-right text-xs font-semibold text-white whitespace-nowrap'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Layers className="w-6 h-6 text-feros-navy" />
        <h1 className="text-2xl font-bold text-feros-navy">P&amp;L by Vehicle Category</h1>
        <span className="text-xs text-gray-400 ml-1">Grouped by tyre type × vehicle type · figures aligned to LR date</span>
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
      {!query.isLoading && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total Revenue"  value={fmt(totals.revenue)}       color="bg-blue-50 border-blue-100" />
          <SummaryCard label="Total Expenses" value={fmt(totals.totalExpenses)} color="bg-slate-50 border-slate-100" />
          <SummaryCard label="Net Profit & Loss" value={fmt(totals.netPnl)}
            color={totals.netPnl >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} />
          <SummaryCard label="Categories" value={String(rows.length)} color="bg-amber-50 border-amber-100" />
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <p className="text-xs text-gray-400 px-4 pt-3">
          Salaries are lease-aware (driver &amp; cleaner pay attributed to the vehicle actually worked). Others = tyre purchase + document costs.
        </p>
        {query.isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm"><Spinner /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
        ) : (
          <div className="p-3">
            <div className="rounded-lg border overflow-hidden">
              <HScroll className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    {/* Group header row */}
                    <tr>
                      <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap bg-feros-navy border-r border-white/20">Tyre Type</th>
                      <th rowSpan={2} className="px-3 py-2 text-left text-xs font-semibold text-white whitespace-nowrap bg-feros-navy border-r border-white/20">Vehicle Type</th>
                      <th rowSpan={2} className={cn(expHead, 'bg-feros-navy border-r border-white/20')}>Revenue</th>
                      <th colSpan={6} className="px-3 py-2 text-center text-xs font-semibold text-white whitespace-nowrap bg-feros-navy/90 border-r border-white/20">Expenses</th>
                      <th rowSpan={2} className={cn(expHead, 'bg-feros-navy')}>Profit &amp; Loss</th>
                    </tr>
                    <tr>
                      <th className={cn(expHead, 'bg-feros-navy/90')}>Diesel</th>
                      <th className={cn(expHead, 'bg-feros-navy/90')}>Salaries</th>
                      <th className={cn(expHead, 'bg-feros-navy/90')}>Spares</th>
                      <th className={cn(expHead, 'bg-feros-navy/90')}>Service</th>
                      <th className={cn(expHead, 'bg-feros-navy/90')}>Trip Exp</th>
                      <th className={cn(expHead, 'bg-feros-navy/90 border-r border-white/20')}>Others</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.tyreType}-${r.vehicleType}`} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-2.5 font-medium text-feros-navy whitespace-nowrap">{r.tyreType}</td>
                        <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                          {r.vehicleType}
                          <span className="text-gray-400 text-xs ml-1">({r.vehicleCount})</span>
                        </td>
                        <td className={expCell}>{fmt(r.revenue)}</td>
                        <td className={expCell}>{fmt(r.diesel)}</td>
                        <td className={expCell}>{fmt(r.salaries)}</td>
                        <td className={expCell}>{fmt(r.spares)}</td>
                        <td className={expCell}>{fmt(r.service)}</td>
                        <td className={expCell}>{fmt(r.tripExpenses)}</td>
                        <td className={expCell}>{fmt(r.others)}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap"><PnlCell value={r.netPnl} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                      <td className="px-3 py-2.5 text-feros-navy" colSpan={2}>Total</td>
                      <td className={expCell}>{fmt(totals.revenue)}</td>
                      <td className={expCell}>{fmt(totals.diesel)}</td>
                      <td className={expCell}>{fmt(totals.salaries)}</td>
                      <td className={expCell}>{fmt(totals.spares)}</td>
                      <td className={expCell}>{fmt(totals.service)}</td>
                      <td className={expCell}>{fmt(totals.tripExpenses)}</td>
                      <td className={expCell}>{fmt(totals.others)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap"><PnlCell value={totals.netPnl} /></td>
                    </tr>
                  </tfoot>
                </table>
              </HScroll>
            </div>
            <div className="px-1 py-2 text-xs text-gray-500">
              {rows.length} categor{rows.length !== 1 ? 'ies' : 'y'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
