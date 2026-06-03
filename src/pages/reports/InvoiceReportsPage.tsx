import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileText, AlertCircle, Clock, Banknote, FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type {
  InvoiceRegisterRow, OutstandingInvoiceRow, InvoiceAgingReportRow,
  CollectionRow, CreditNoteRegisterRow,
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
  { key: 'register',      label: 'Invoice Register',      icon: FileText },
  { key: 'outstanding',   label: 'Outstanding Invoices',  icon: AlertCircle },
  { key: 'aging',         label: 'Invoice Aging',         icon: Clock },
  { key: 'collections',   label: 'Collections',           icon: Banknote },
  { key: 'credit-notes',  label: 'Credit Notes',          icon: FileX },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'today' | 'this-week' | 'this-month' | 'custom'

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']
const PAYMENT_MODES    = ['CASH', 'CHEQUE', 'NEFT', 'UPI', 'RTGS']
const AGING_BUCKETS    = ['1-30 days', '31-60 days', '61-90 days', '90+ days']

// ── Badges ─────────────────────────────────────────────────────────────────────
const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT:          'bg-gray-100 text-gray-600',
  SENT:           'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID:           'bg-green-100 text-green-700',
  OVERDUE:        'bg-red-100 text-red-700',
  CANCELLED:      'bg-gray-200 text-gray-500',
}
const CREDIT_STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-600',
  APPROVED: 'bg-green-100 text-green-700',
  APPLIED:  'bg-blue-100 text-blue-700',
  CANCELLED:'bg-gray-200 text-gray-500',
}
const PAYMENT_MODE_COLORS: Record<string, string> = {
  CASH:   'bg-green-50 text-green-700',
  CHEQUE: 'bg-blue-50 text-blue-700',
  NEFT:   'bg-purple-50 text-purple-700',
  UPI:    'bg-orange-50 text-orange-700',
  RTGS:   'bg-indigo-50 text-indigo-700',
}
function Badge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const cls = colorMap[label] ?? 'bg-gray-100 text-gray-600'
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label.replace(/_/g, ' ')}</span>
}

// ── Generic table ──────────────────────────────────────────────────────────────
function ReportTable({ headers, rows, loading }: {
  headers: string[]
  rows: React.ReactNode[][]
  loading: boolean
}) {
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
  if (rows.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">No records found</div>
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
function InvoiceRegisterTable({ rows, loading }: { rows: InvoiceRegisterRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Invoice No.', 'Invoice Date', 'Due Date', 'Client', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance Due', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.invoiceNumber}</span>,
      r.invoiceDate, dash(r.dueDate), r.clientName,
      dash(r.subtotal), dash(r.taxAmount), dash(r.totalAmount), dash(r.amountPaid),
      <span className={r.balanceDue && r.balanceDue > 0 ? 'text-red-600 font-medium' : ''}>{dash(r.balanceDue)}</span>,
      <Badge label={r.invoiceStatus} colorMap={INVOICE_STATUS_COLORS} />,
    ])}
  />
}

function OutstandingTable({ rows, loading }: { rows: OutstandingInvoiceRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Invoice No.', 'Invoice Date', 'Due Date', 'Client', 'Total', 'Paid', 'Balance Due', 'Status', 'Days Overdue']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.invoiceNumber}</span>,
      r.invoiceDate, dash(r.dueDate), r.clientName,
      dash(r.totalAmount), dash(r.amountPaid),
      <span className="text-red-600 font-medium">{dash(r.balanceDue)}</span>,
      <Badge label={r.invoiceStatus} colorMap={INVOICE_STATUS_COLORS} />,
      r.daysOverdue != null
        ? <span className={cn('font-medium', r.daysOverdue >= 60 ? 'text-red-600' : r.daysOverdue >= 30 ? 'text-amber-600' : 'text-orange-500')}>
            {r.daysOverdue} days
          </span>
        : <span className="text-gray-400">—</span>,
    ])}
  />
}

function AgingTable({ rows, loading }: { rows: InvoiceAgingReportRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Invoice No.', 'Invoice Date', 'Due Date', 'Client', 'Balance Due', 'Days Overdue', 'Bucket']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.invoiceNumber}</span>,
      r.invoiceDate, dash(r.dueDate), r.clientName,
      <span className="text-red-600 font-medium">{dash(r.balanceDue)}</span>,
      <span className={cn('font-medium',
        r.daysOverdue > 90 ? 'text-red-700' :
        r.daysOverdue > 60 ? 'text-red-500' :
        r.daysOverdue > 30 ? 'text-amber-600' : 'text-orange-500'
      )}>{r.daysOverdue} days</span>,
      <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
        r.agingBucket === '90+ days'    ? 'bg-red-100 text-red-700' :
        r.agingBucket === '61-90 days'  ? 'bg-red-50 text-red-600' :
        r.agingBucket === '31-60 days'  ? 'bg-amber-100 text-amber-700' :
                                          'bg-orange-50 text-orange-600'
      )}>{r.agingBucket}</span>,
    ])}
  />
}

function CollectionsTable({ rows, loading }: { rows: CollectionRow[]; loading: boolean }) {
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  return (
    <>
      <ReportTable loading={loading}
        headers={['Payment Date', 'Invoice No.', 'Client', 'Amount', 'Mode', 'Reference', 'Remarks']}
        rows={rows.map(r => [
          r.paymentDate,
          <span className="font-medium text-feros-navy">{r.invoiceNumber}</span>,
          r.clientName,
          <span className="font-medium text-green-700">{dash(r.amount)}</span>,
          <Badge label={r.paymentMode} colorMap={PAYMENT_MODE_COLORS} />,
          dash(r.referenceNumber), dash(r.remarks),
        ])}
      />
      {!loading && rows.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm font-medium text-green-800">
          Total Collected: ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      )}
    </>
  )
}

function CreditNotesTable({ rows, loading }: { rows: CreditNoteRegisterRow[]; loading: boolean }) {
  return <ReportTable loading={loading}
    headers={['Credit Note No.', 'Date', 'Client', 'Linked Invoice', 'Amount', 'Reason', 'Status']}
    rows={rows.map(r => [
      <span className="font-medium text-feros-navy">{r.creditNoteNumber}</span>,
      r.creditNoteDate, r.clientName,
      dash(r.linkedInvoiceNumber),
      dash(r.amount),
      <span className="max-w-xs truncate block" title={r.reason}>{r.reason}</span>,
      <Badge label={r.creditNoteStatus} colorMap={CREDIT_STATUS_COLORS} />,
    ])}
  />
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function InvoiceReportsPage() {
  const [tab, setTab] = useState<TabKey>('register')
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [startDate, setStartDate] = useState(thisMonthStart())
  const [endDate, setEndDate] = useState(todayStr())
  const [downloading, setDownloading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [modeFilter, setModeFilter] = useState('ALL')
  const [bucketFilter, setBucketFilter] = useState('ALL')
  const [clientFilter, setClientFilter] = useState('ALL')

  function handleTabChange(key: TabKey) {
    setTab(key)
    setStatusFilter('ALL')
    setModeFilter('ALL')
    setBucketFilter('ALL')
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
    queryKey: ['report-invoice-register', startDate, endDate],
    queryFn: () => reportsApi.getInvoiceRegister(startDate, endDate),
    enabled: tab === 'register',
  })
  const outstandingQuery = useQuery({
    queryKey: ['report-outstanding-invoices'],
    queryFn: () => reportsApi.getOutstandingInvoices(),
    enabled: tab === 'outstanding',
  })
  const agingQuery = useQuery({
    queryKey: ['report-invoice-aging'],
    queryFn: () => reportsApi.getInvoiceAging(),
    enabled: tab === 'aging',
  })
  const collectionsQuery = useQuery({
    queryKey: ['report-collections', startDate, endDate],
    queryFn: () => reportsApi.getCollections(startDate, endDate),
    enabled: tab === 'collections',
  })
  const creditNotesQuery = useQuery({
    queryKey: ['report-credit-notes', startDate, endDate],
    queryFn: () => reportsApi.getCreditNoteRegister(startDate, endDate),
    enabled: tab === 'credit-notes',
  })

  // ── Apply filters ──
  const allRegisterRows    = registerQuery.data?.data ?? []
  const allOutstandingRows = outstandingQuery.data?.data ?? []
  const allAgingRows       = agingQuery.data?.data ?? []
  const allCollectionRows  = collectionsQuery.data?.data ?? []
  const allCreditNoteRows  = creditNotesQuery.data?.data ?? []

  const registerRows = allRegisterRows.filter(r =>
    (statusFilter === 'ALL' || r.invoiceStatus === statusFilter) &&
    (clientFilter === 'ALL' || r.clientName === clientFilter)
  )
  const outstandingRows = allOutstandingRows.filter(r =>
    (statusFilter === 'ALL' || r.invoiceStatus === statusFilter) &&
    (clientFilter === 'ALL' || r.clientName === clientFilter)
  )
  const agingRows = allAgingRows.filter(r =>
    (bucketFilter === 'ALL' || r.agingBucket === bucketFilter) &&
    (clientFilter === 'ALL' || r.clientName === clientFilter)
  )
  const collectionRows = allCollectionRows.filter(r =>
    (modeFilter === 'ALL' || r.paymentMode === modeFilter) &&
    (clientFilter === 'ALL' || r.clientName === clientFilter)
  )
  const creditNoteRows = allCreditNoteRows.filter(r =>
    clientFilter === 'ALL' || r.clientName === clientFilter
  )

  // ── Client options per tab ──
  const tabClientSource: string[] =
    tab === 'register'    ? allRegisterRows.map(r => r.clientName) :
    tab === 'outstanding' ? allOutstandingRows.map(r => r.clientName) :
    tab === 'aging'       ? allAgingRows.map(r => r.clientName) :
    tab === 'collections' ? allCollectionRows.map(r => r.clientName) :
                            allCreditNoteRows.map(r => r.clientName)
  const clientOptions = [
    { value: 'ALL', label: 'All Clients' },
    ...Array.from(new Set(tabClientSource.filter(Boolean))).sort().map(c => ({ value: c, label: c })),
  ]

  const noDateFilter = tab === 'outstanding' || tab === 'aging'

  async function handleDownload(format: 'csv' | 'pdf') {
    setDownloading(true)
    try {
      if      (tab === 'register')    await reportsApi.exportInvoiceRegister(startDate, endDate, format, statusFilter !== 'ALL' ? statusFilter : undefined)
      else if (tab === 'outstanding') await reportsApi.exportOutstandingInvoices(format)
      else if (tab === 'aging')       await reportsApi.exportInvoiceAging(format)
      else if (tab === 'collections') await reportsApi.exportCollections(startDate, endDate, format)
      else                            await reportsApi.exportCreditNoteRegister(startDate, endDate, format)
    } catch {
      toast.error('Export failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoice Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Invoice register, outstanding, aging, collections & credit notes</p>
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

        {/* Client filter — all tabs */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
          <SearchableSelect
            value={clientFilter}
            onValueChange={setClientFilter}
            options={clientOptions}
            className="w-48"
          />
        </div>

        {/* Status filter — register + outstanding */}
        {(tab === 'register' || tab === 'outstanding') && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <SearchableSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                ...INVOICE_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
              ]}
              showSearch={false}
              className="w-44"
            />
          </div>
        )}

        {/* Payment mode filter — collections */}
        {tab === 'collections' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
            <SearchableSelect
              value={modeFilter}
              onValueChange={setModeFilter}
              options={[
                { value: 'ALL', label: 'All Modes' },
                ...PAYMENT_MODES.map(m => ({ value: m, label: m })),
              ]}
              showSearch={false}
              className="w-36"
            />
          </div>
        )}

        {/* Bucket filter — aging */}
        {tab === 'aging' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Aging Bucket</label>
            <SearchableSelect
              value={bucketFilter}
              onValueChange={setBucketFilter}
              options={[
                { value: 'ALL', label: 'All Buckets' },
                ...AGING_BUCKETS.map(b => ({ value: b, label: b })),
              ]}
              showSearch={false}
              className="w-40"
            />
          </div>
        )}

        {/* Date controls */}
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
      {tab === 'register'    && <InvoiceRegisterTable rows={registerRows}    loading={registerQuery.isLoading} />}
      {tab === 'outstanding' && <OutstandingTable     rows={outstandingRows} loading={outstandingQuery.isLoading} />}
      {tab === 'aging'       && <AgingTable           rows={agingRows}       loading={agingQuery.isLoading} />}
      {tab === 'collections' && <CollectionsTable     rows={collectionRows}  loading={collectionsQuery.isLoading} />}
      {tab === 'credit-notes'&& <CreditNotesTable     rows={creditNoteRows}  loading={creditNotesQuery.isLoading} />}
    </div>
  )
}
