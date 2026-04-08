import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { reportsApi } from '@/api/reports'
import { clientsApi } from '@/api/clients'
import type {
  LrRegisterRow, InvoiceOutstandingRow, PayrollSummaryRow,
  CollectionReportRow, ClientStatementResponse, VehicleTripRow,
  OrderStatusRow, AttendanceReportRow,
} from '@/types'

type ReportTab = 'lr-register' | 'outstanding' | 'collections' | 'client-statement' | 'vehicle-trips' | 'order-status' | 'payroll' | 'attendance'

const TABS: { id: ReportTab; label: string }[] = [
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
// Tab 1 — LR Register
// ═══════════════════════════════════════════════════════════════════════════════
function LrRegisterTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [clientId, setClientId] = useState('all')
  const [enabled, setEnabled] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['report-lr-register', from, to, clientId],
    queryFn: () => reportsApi.getLrRegister(from, to, clientId !== 'all' ? Number(clientId) : undefined),
    enabled,
  })
  const rows: LrRegisterRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setEnabled(false) }} />
        <ClientSelect value={clientId} onChange={v => { setClientId(v); setEnabled(false) }} />
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Report'}
        </Button>
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
              {['LR #', 'Date', 'Order #', 'Client', 'Vehicle', 'From', 'To', 'Material',
                'Allocated', 'Loaded', 'Delivered', 'Variance', 'Rate Type', 'Rate', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
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
  const [enabled, setEnabled] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['report-invoice-outstanding', clientId],
    queryFn: () => reportsApi.getInvoiceOutstanding(clientId !== 'all' ? Number(clientId) : undefined),
    enabled,
  })
  const rows: InvoiceOutstandingRow[] = data?.data ?? []
  const totalOutstanding = rows.reduce((s, r) => s + r.balanceDue, 0)
  const overdueCount = rows.filter(r => r.daysOverdue > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <ClientSelect value={clientId} onChange={v => { setClientId(v); setEnabled(false) }} />
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Report'}
        </Button>
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
              {['Invoice #', 'Date', 'Due Date', 'Client', 'Total', 'Paid', 'Balance Due', 'Status', 'Days Overdue'].map(h => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
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
  const [enabled, setEnabled] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['report-collections', from, to, clientId],
    queryFn: () => reportsApi.getCollectionReport(from, to, clientId !== 'all' ? Number(clientId) : undefined),
    enabled,
  })
  const rows: CollectionReportRow[] = data?.data ?? []
  const totalCollected = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setEnabled(false) }} />
        <ClientSelect value={clientId} onChange={v => { setClientId(v); setEnabled(false) }} />
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Report'}
        </Button>
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
              {['Date', 'Client', 'Invoice #', 'Amount', 'Mode', 'Reference', 'Remarks'].map(h => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
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
  const [enabled, setEnabled] = useState(false)

  const canFetch = clientId !== 'all'

  const { data, isFetching } = useQuery({
    queryKey: ['report-client-statement', clientId, from, to],
    queryFn: () => reportsApi.getClientStatement(Number(clientId), from, to),
    enabled: enabled && canFetch,
  })
  const stmt: ClientStatementResponse | undefined = data?.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setEnabled(false) }} />
        <ClientSelect value={clientId} onChange={v => { setClientId(v); setEnabled(false) }} />
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching || !canFetch}>
          {isFetching ? 'Loading...' : 'Fetch Statement'}
        </Button>
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
                  {['Date', 'Type', 'Reference', 'Description', 'Debit (Dr)', 'Credit (Cr)', 'Balance'].map(h => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
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
      {!stmt && !isFetching && enabled && canFetch && (
        <EmptyState msg="No data found for selected period" />
      )}
      {!enabled && <EmptyState msg="Select a client and date range, then click Fetch Statement" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5 — Vehicle Trip Report
// ═══════════════════════════════════════════════════════════════════════════════
function VehicleTripTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [enabled, setEnabled] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['report-vehicle-trips', from, to],
    queryFn: () => reportsApi.getVehicleTripReport(from, to),
    enabled,
  })
  const rows: VehicleTripRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setEnabled(false) }} />
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Report'}
        </Button>
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
              {['Vehicle', 'Type', 'Brand', 'Total Trips', 'Allocated (T)', 'Loaded (T)', 'Delivered (T)'].map(h => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={7}><EmptyState msg="Select date range and click Fetch Report" /></td></tr>
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
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'INVOICED', 'CANCELLED']

function OrderStatusTab() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [status, setStatus] = useState('all')
  const [enabled, setEnabled] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['report-order-status', from, to, status],
    queryFn: () => reportsApi.getOrderStatusReport(from, to, status !== 'all' ? status : undefined),
    enabled,
  })
  const rows: OrderStatusRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setEnabled(false) }} />
        <div>
          <Label className="text-xs text-gray-500">Status</Label>
          <SearchableSelect
            value={status}
            onValueChange={v => { setStatus(v); setEnabled(false) }}
            options={[{ value: 'all', label: 'All Statuses' }, ...ORDER_STATUSES.map(s => ({ value: s, label: s }))]}
            placeholder="All Statuses"
            className="w-40"
            triggerClassName="h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Report'}
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <SummaryCard label="Total Orders" value={String(rows.length)} />
          <SummaryCard label="Total Weight (T)" value={fmt(rows.reduce((s, r) => s + (r.totalWeight ?? 0), 0))} />
          <SummaryCard label="Total Freight" value={fmtRs(rows.reduce((s, r) => s + (r.totalFreightAmount ?? 0), 0))} />
          {ORDER_STATUSES.map(s => {
            const cnt = rows.filter(r => r.orderStatus === s).length
            return cnt > 0 ? <SummaryCard key={s} label={s} value={String(cnt)} /> : null
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 uppercase">
            <tr>
              {['Order #', 'Date', 'Client', 'From', 'To', 'Material', 'Weight (T)', 'Freight', 'Status', 'Payment'].map(h => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
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
  const [to, setTo] = useState(today())
  const [enabled, setEnabled] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['report-payroll-summary', from, to],
    queryFn: () => reportsApi.getPayrollSummary(from, to),
    enabled,
  })
  const rows: PayrollSummaryRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setEnabled(false) }} />
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Report'}
        </Button>
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
              {['Staff', 'Phone', 'Role', 'Pay Cycle', 'Days', 'Present', 'Absent', 'Half Day',
                'Daily Rate', 'Basic', 'OT', 'Bonus', 'Gross', 'Deductions', 'Net Pay', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={16}><EmptyState msg="Select date range and click Fetch Report" /></td></tr>
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
  const [enabled, setEnabled] = useState(false)

  const { data, isFetching } = useQuery({
    queryKey: ['report-attendance', from, to],
    queryFn: () => reportsApi.getAttendanceReport(from, to),
    enabled,
  })
  const rows: AttendanceReportRow[] = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 border rounded-lg p-3">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setEnabled(false) }} />
        <Button size="sm" onClick={() => setEnabled(true)} disabled={isFetching}>
          {isFetching ? 'Loading...' : 'Fetch Report'}
        </Button>
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
              {['Staff', 'Phone', 'Role', 'Total Days', 'Present', 'Absent', 'Half Day', 'Leave', 'Attendance %'].map(h => (
                <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && !isFetching && (
              <tr><td colSpan={9}><EmptyState msg="Select date range and click Fetch Report" /></td></tr>
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
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('lr-register')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Business analytics and data exports</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {tab === 'lr-register'      && <LrRegisterTab />}
        {tab === 'outstanding'      && <InvoiceOutstandingTab />}
        {tab === 'collections'      && <CollectionReportTab />}
        {tab === 'client-statement' && <ClientStatementTab />}
        {tab === 'vehicle-trips'    && <VehicleTripTab />}
        {tab === 'order-status'     && <OrderStatusTab />}
        {tab === 'payroll'          && <PayrollSummaryTab />}
        {tab === 'attendance'       && <AttendanceReportTab />}
      </div>
    </div>
  )
}
