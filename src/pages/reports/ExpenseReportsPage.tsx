import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Receipt, Fuel, Wrench, FileText, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type { TripExpenseReportRow, FuelCostRow, MaintenanceCostRow, DocumentCostRow, TyreCostRow } from '@/types'

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

const TABS = [
  { key: 'trips',       label: 'Trip Expenses',   icon: Receipt },
  { key: 'fuel',        label: 'Fuel Cost',        icon: Fuel },
  { key: 'maintenance', label: 'Maintenance Cost', icon: Wrench },
  { key: 'documents',   label: 'Document Costs',   icon: FileText },
  { key: 'tyres',       label: 'Tyre Expenses',    icon: CircleDot },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

const EXPENSE_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SETTLED', 'REJECTED']
const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED:  'bg-green-100 text-green-700',
  SETTLED:   'bg-green-200 text-green-800',
  REJECTED:  'bg-red-100 text-red-700',
}

function Badge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const cls = colorMap[label] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

function ReportTable({ headers, rows, loading }: {
  headers: string[]; rows: React.ReactNode[][]; loading: boolean
}) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (rows.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No records found for this period</div>
  return (
    <div className="overflow-x-auto rounded-lg border">
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

const dash = (v: unknown) => (v != null && v !== '' ? String(v) : '—')

function TripExpenseTable({ rows, loading }: { rows: TripExpenseReportRow[]; loading: boolean }) {
  const totalExpense = rows.reduce((s, r) => s + (r.totalExpense ?? 0), 0)
  return (
    <>
      <ReportTable loading={loading}
        headers={['LR No.', 'LR Date', 'Vehicle', 'Driver', 'Cleaner', 'From', 'To',
          'Advance', 'Driver Batta', 'Cleaner Batta', 'Mamulu', 'Other', 'Total', 'Settlement', 'Status']}
        rows={rows.map(r => [
          <span className="font-medium text-feros-navy">{r.lrNumber}</span>,
          r.lrDate, r.vehicleNumber, r.driverName, r.cleanerName, r.fromCity, r.toCity,
          dash(r.advanceAmount), dash(r.driverBatta), dash(r.cleanerBatta),
          dash(r.tripMamulu), dash(r.itemsTotal),
          <span className="font-medium">{dash(r.totalExpense)}</span>,
          dash(r.settlementAmount),
          <Badge label={r.status} colorMap={STATUS_COLORS} />,
        ])}
      />
      {!loading && rows.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm font-medium text-amber-800">
          Total Expenses: ₹{totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      )}
    </>
  )
}

function FuelCostTable({ rows, loading }: { rows: FuelCostRow[]; loading: boolean }) {
  const totalCost = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  const totalLitres = rows.reduce((s, r) => s + (r.totalLitres ?? 0), 0)
  return (
    <>
      <ReportTable loading={loading}
        headers={['Vehicle', 'Type', 'Total Fills', 'Total Litres', 'Total Cost']}
        rows={rows.map(r => [
          <span className="font-medium text-feros-navy">{r.registrationNumber}</span>,
          r.vehicleType,
          <span className="font-medium">{r.totalFills}</span>,
          dash(r.totalLitres),
          <span className="font-medium text-orange-700">{dash(r.totalCost)}</span>,
        ])}
      />
      {!loading && rows.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm font-medium text-orange-800 flex gap-6">
          <span>Total Litres: {totalLitres.toLocaleString('en-IN', { minimumFractionDigits: 2 })} L</span>
          <span>Total Cost: ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      )}
    </>
  )
}

function MaintenanceCostTable({ rows, loading }: { rows: MaintenanceCostRow[]; loading: boolean }) {
  const totalServiceCost = rows.reduce((s, r) => s + (r.serviceCost ?? 0), 0)
  const totalPartsCost = rows.reduce((s, r) => s + (r.sparePartsCost ?? 0), 0)
  const totalCost = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  return (
    <>
      <ReportTable loading={loading}
        headers={['Vehicle', 'Type', 'Total Services', 'Service Cost (₹)', 'Parts Cost (₹)', 'Total Cost (₹)']}
        rows={rows.map(r => [
          <span className="font-medium text-feros-navy">{r.registrationNumber}</span>,
          r.vehicleType,
          <span className="font-medium">{r.totalServices}</span>,
          <span className="text-orange-700">{dash(r.serviceCost)}</span>,
          <span className="text-blue-700">{dash(r.sparePartsCost)}</span>,
          <span className="font-medium text-red-700">{dash(r.totalCost)}</span>,
        ])}
      />
      {!loading && rows.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm font-medium text-red-800 flex gap-6">
          <span>Service Cost: ₹{totalServiceCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span>Parts Cost: ₹{totalPartsCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span>Total: ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      )}
    </>
  )
}

function DocumentCostTable({ rows, loading }: { rows: DocumentCostRow[]; loading: boolean }) {
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0)
  return (
    <>
      <ReportTable loading={loading}
        headers={['Vehicle', 'Type', 'Document Type', 'Document No.', 'Issuer', 'Paid On', 'Cost (₹)']}
        rows={rows.map(r => [
          <span className="font-medium text-feros-navy">{r.registrationNumber}</span>,
          r.vehicleType,
          r.documentTypeName,
          dash(r.documentNumber),
          dash(r.issuerName),
          dash(r.paidOn),
          <span className="font-medium text-purple-700">{dash(r.cost)}</span>,
        ])}
      />
      {!loading && rows.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm font-medium text-purple-800">
          Total Document Cost: ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      )}
    </>
  )
}

function TyreCostTable({ rows, loading }: { rows: TyreCostRow[]; loading: boolean }) {
  const totalPurchase = rows.reduce((s, r) => s + (r.purchaseCost ?? 0), 0)
  const totalRetreat  = rows.reduce((s, r) => s + (r.retreadingCost ?? 0), 0)
  const totalCost     = rows.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  return (
    <>
      <p className="text-xs text-amber-600 px-4 pt-3 pb-1">
        * Retreading cost is the lifetime total for each tyre, not filtered by the selected period.
      </p>
      <ReportTable loading={loading}
        headers={['Vehicle', 'Type', 'Tyres Purchased', 'Purchase Cost (₹)', 'Retreading Cost (₹) *', 'Total Cost (₹)']}
        rows={rows.map(r => [
          <span className="font-medium text-feros-navy">{r.registrationNumber}</span>,
          r.vehicleType,
          <span className="font-medium">{r.tyreCount}</span>,
          <span className="text-orange-700">{dash(r.purchaseCost)}</span>,
          <span className="text-blue-700">{dash(r.retreadingCost)}</span>,
          <span className="font-medium text-red-700">{dash(r.totalCost)}</span>,
        ])}
      />
      {!loading && rows.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm font-medium text-red-800 flex gap-6">
          <span>Purchase Cost: ₹{totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span>Retreading Cost: ₹{totalRetreat.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span>Total: ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      )}
    </>
  )
}

export default function ExpenseReportsPage() {
  const [tab, setTab] = useState<TabKey>('trips')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [downloading, setDownloading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [vehicleFilter, setVehicleFilter] = useState('ALL')

  function handleTabChange(key: TabKey) {
    setTab(key); setStatusFilter('ALL'); setVehicleFilter('ALL')
  }

  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p === 'today')      { setStartDate(todayStr());       setEndDate(todayStr()) }
    if (p === 'this-week')  { setStartDate(thisWeekStart());  setEndDate(todayStr()) }
    if (p === 'this-month') { setStartDate(thisMonthStart()); setEndDate(todayStr()) }
  }

  const tripQuery = useQuery({
    queryKey: ['report-trip-expenses', startDate, endDate],
    queryFn: () => reportsApi.getTripExpenses(startDate, endDate),
    enabled: tab === 'trips',
  })
  const fuelQuery = useQuery({
    queryKey: ['report-fuel-cost', startDate, endDate],
    queryFn: () => reportsApi.getFuelCostSummary(startDate, endDate),
    enabled: tab === 'fuel',
  })
  const maintenanceQuery = useQuery({
    queryKey: ['report-maintenance-cost', startDate, endDate],
    queryFn: () => reportsApi.getMaintenanceCostSummary(startDate, endDate),
    enabled: tab === 'maintenance',
  })

  const documentQuery = useQuery({
    queryKey: ['report-document-cost', startDate, endDate],
    queryFn: () => reportsApi.getDocumentCostSummary(startDate, endDate),
    enabled: tab === 'documents',
  })

  const tyreQuery = useQuery({
    queryKey: ['report-tyre-cost', startDate, endDate],
    queryFn: () => reportsApi.getTyreCostSummary(startDate, endDate),
    enabled: tab === 'tyres',
  })

  const allTripRows        = tripQuery.data?.data ?? []
  const allFuelRows        = fuelQuery.data?.data ?? []
  const allMaintenanceRows = maintenanceQuery.data?.data ?? []
  const allDocumentRows    = documentQuery.data?.data ?? []
  const allTyreRows        = tyreQuery.data?.data ?? []

  const tripRows = allTripRows.filter(r =>
    (statusFilter === 'ALL' || r.status === statusFilter) &&
    (vehicleFilter === 'ALL' || r.vehicleNumber === vehicleFilter)
  )
  const fuelRows        = allFuelRows.filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)
  const maintenanceRows = allMaintenanceRows.filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)
  const documentRows    = allDocumentRows.filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)
  const tyreRows        = allTyreRows.filter(r => vehicleFilter === 'ALL' || r.registrationNumber === vehicleFilter)

  const vehicleSource =
    tab === 'trips'     ? allTripRows.map(r => r.vehicleNumber) :
    tab === 'fuel'      ? allFuelRows.map(r => r.registrationNumber) :
    tab === 'documents' ? allDocumentRows.map(r => r.registrationNumber) :
    tab === 'tyres'     ? allTyreRows.map(r => r.registrationNumber) :
                          allMaintenanceRows.map(r => r.registrationNumber)
  const vehicleOptions = [
    { value: 'ALL', label: 'All Vehicles' },
    ...Array.from(new Set(vehicleSource.filter(Boolean))).sort().map(v => ({ value: v, label: v })),
  ]

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if      (tab === 'trips')       await reportsApi.exportTripExpenses(startDate, endDate, format)
      else if (tab === 'fuel')        await reportsApi.exportFuelCostSummary(startDate, endDate, format)
      else if (tab === 'documents')   await reportsApi.exportDocumentCostSummary(startDate, endDate, format)
      else if (tab === 'tyres')       await reportsApi.exportTyreCostSummary(startDate, endDate, format)
      else                            await reportsApi.exportMaintenanceCostSummary(startDate, endDate, format)
    } catch { toast.error('Export failed') }
    finally  { setDownloading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expense Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Trip expenses, fuel cost & maintenance cost by vehicle</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-white border rounded-xl p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => handleTabChange(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key ? 'bg-feros-navy text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end gap-4">

        {/* Vehicle filter */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
          <SearchableSelect value={vehicleFilter} onValueChange={setVehicleFilter}
            options={vehicleOptions} className="w-44" />
        </div>

        {/* Status filter — trips only */}
        {tab === 'trips' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <SearchableSelect value={statusFilter} onValueChange={setStatusFilter}
              showSearch={false} className="w-40"
              options={[
                { value: 'ALL', label: 'All Statuses' },
                ...EXPENSE_STATUSES.map(s => ({ value: s, label: s })),
              ]}
            />
          </div>
        )}

        {/* Date range */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
          <div className="flex gap-1">
            {(['today', 'this-week', 'this-month', 'custom'] as DatePreset[]).map(p => (
              <button key={p} onClick={() => applyPreset(p)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
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

        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('csv')} className="gap-1.5">
            <Download size={14} />CSV
          </Button>
          <Button variant="outline" size="sm" disabled={downloading} onClick={() => handleDownload('pdf')} className="gap-1.5">
            <Download size={14} />PDF
          </Button>
        </div>
      </div>

      {tab === 'trips'       && <TripExpenseTable    rows={tripRows}        loading={tripQuery.isLoading} />}
      {tab === 'fuel'        && <FuelCostTable        rows={fuelRows}        loading={fuelQuery.isLoading} />}
      {tab === 'maintenance' && <MaintenanceCostTable rows={maintenanceRows} loading={maintenanceQuery.isLoading} />}
      {tab === 'documents'   && <DocumentCostTable    rows={documentRows}    loading={documentQuery.isLoading} />}
      {tab === 'tyres'       && <TyreCostTable        rows={tyreRows}        loading={tyreQuery.isLoading} />}
    </div>
  )
}
