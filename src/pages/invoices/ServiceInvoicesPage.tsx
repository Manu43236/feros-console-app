import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search, ExternalLink, CheckCircle2, Clock, Wrench,
  Receipt, FileText, BadgeCheck, AlertCircle,
} from 'lucide-react'
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { Label }   from '@/components/ui/label'
import { Badge }   from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { serviceInvoicesApi } from '@/api/serviceInvoices'
import type { ServiceInvoice, ServiceInvoiceType, ServiceInvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n?: number) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function openPdfInTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  // revoke after a short delay to allow the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ── Badges ────────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: ServiceInvoiceType }) {
  return type === 'INTERNAL'
    ? <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs">Internal</Badge>
    : <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50 text-xs">External</Badge>
}

function StatusBadge({ status }: { status: ServiceInvoiceStatus }) {
  return status === 'PAID'
    ? <Badge className="bg-green-50 text-green-700 hover:bg-green-50 text-xs">Paid</Badge>
    : <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-xs">Pending</Badge>
}

// ── Mark Paid Dialog ──────────────────────────────────────────────────────────
function MarkPaidDialog({ invoice, onClose }: { invoice: ServiceInvoice; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => serviceInvoicesApi.markPaid(invoice.id),
    onSuccess: () => {
      toast.success('Invoice marked as paid')
      qc.invalidateQueries({ queryKey: ['service-invoices'] })
      onClose()
    },
    onError: () => toast.error('Failed to mark as paid'),
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Mark as Paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-medium mb-1">{invoice.invoiceNumber}</p>
            <p className="text-xs text-amber-700">Total: {fmt(invoice.totalAmount ?? invoice.vendorAmount)}</p>
          </div>
          <p className="text-sm text-gray-600">This will record the invoice as fully paid. Continue?</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {mutation.isPending ? 'Saving…' : 'Mark Paid'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Update Vendor Amount Dialog ───────────────────────────────────────────────
function UpdateVendorDialog({ invoice, onClose }: { invoice: ServiceInvoice; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount]     = useState(String(invoice.vendorAmount ?? ''))
  const [invoiceNo, setInvoiceNo] = useState(invoice.vendorInvoiceNo ?? '')

  const mutation = useMutation({
    mutationFn: () => serviceInvoicesApi.updateVendorAmount(invoice.id, {
      vendorAmount:   Number(amount),
      vendorInvoiceNo: invoiceNo.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Vendor amount updated')
      qc.invalidateQueries({ queryKey: ['service-invoices'] })
      onClose()
    },
    onError: () => toast.error('Failed to update vendor amount'),
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Update Vendor Amount</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-gray-500">{invoice.invoiceNumber} — {invoice.vendorName ?? 'External'}</p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Vendor Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 8500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Vendor Invoice No (optional)</Label>
            <Input
              value={invoiceNo}
              onChange={e => setInvoiceNo(e.target.value)}
              placeholder="e.g. VND-2026-001"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !amount || isNaN(Number(amount))}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Invoice Detail Dialog ─────────────────────────────────────────────────────
function InvoiceDetailDialog({ invoice, onClose }: { invoice: ServiceInvoice; onClose: () => void }) {
  const isInternal = invoice.invoiceType === 'INTERNAL'

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <FileText size={16} className="text-feros-navy" />
            {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-gray-50 rounded-lg p-3">
            <Row label="Service #"  value={invoice.serviceNumber} />
            <Row label="Vehicle"    value={invoice.vehicleRegistrationNumber} />
            <Row label="Type"       value={<TypeBadge type={invoice.invoiceType} />} />
            <Row label="Status"     value={<StatusBadge status={invoice.paymentStatus} />} />
            {invoice.completedDate && <Row label="Completed" value={fmtDate(invoice.completedDate)} />}
            {invoice.vendorName    && <Row label="Vendor"    value={invoice.vendorName} />}
          </div>

          {/* Tasks */}
          {isInternal && invoice.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Work Performed</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Task</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.tasks.map((t, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-3 text-gray-700">{t.name}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{t.cost > 0 ? fmt(t.cost) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Parts */}
          {isInternal && invoice.parts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parts Used</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Part</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.parts.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-3 text-gray-700">
                          <p>{p.partName}</p>
                          <p className="text-xs text-gray-400">{p.partNumber}</p>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">{p.quantity} {p.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cost summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost Summary</p>
            {isInternal ? (
              <>
                <SummaryRow label="Tasks Total"     value={fmt(invoice.tasksTotal)} />
                <SummaryRow label="Labour Charges"  value={fmt(invoice.labourCharges)} />
                <SummaryRow label="Sub Total"       value={fmt(invoice.subTotal)} />
                <SummaryRow label={`GST (${invoice.gstRate ?? 18}%)`} value={fmt(invoice.gstAmount)} />
                <div className="border-t pt-1.5 mt-1">
                  <SummaryRow label="Total" value={fmt(invoice.totalAmount)} bold />
                </div>
              </>
            ) : (
              <>
                {invoice.vendorInvoiceNo && (
                  <SummaryRow label="Vendor Invoice #" value={invoice.vendorInvoiceNo} />
                )}
                <SummaryRow label="Vendor Amount" value={fmt(invoice.vendorAmount)} bold />
                <p className="text-xs text-gray-400 mt-1">Vendor bill includes GST — no separate calculation</p>
              </>
            )}
          </div>

          {/* Payment info */}
          {invoice.paymentStatus === 'PAID' && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <BadgeCheck size={16} />
              <span>Paid {invoice.paidAt ? `on ${fmtDate(invoice.paidAt)}` : ''}{invoice.paidByName ? ` by ${invoice.paidByName}` : ''}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <div className="text-sm font-medium text-gray-800 mt-0.5">{value}</div>
    </div>
  )
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between', bold && 'font-semibold text-gray-900')}>
      <span className={bold ? '' : 'text-gray-600'}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TYPE_FILTERS   = ['ALL', 'INTERNAL', 'EXTERNAL'] as const
const STATUS_FILTERS = ['ALL', 'PENDING', 'PAID'] as const

export function ServiceInvoicesPage() {
  const [search,        setSearch]        = useState('')
  const [typeFilter,    setTypeFilter]    = useState<typeof TYPE_FILTERS[number]>('ALL')
  const [statusFilter,  setStatusFilter]  = useState<typeof STATUS_FILTERS[number]>('ALL')
  const [detailInv,     setDetailInv]     = useState<ServiceInvoice | null>(null)
  const [markPaidInv,   setMarkPaidInv]   = useState<ServiceInvoice | null>(null)
  const [vendorInv,     setVendorInv]     = useState<ServiceInvoice | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data: res, isLoading } = useQuery({
    queryKey: ['service-invoices'],
    queryFn:  serviceInvoicesApi.getAll,
  })

  const all = [...(res?.data ?? [])].sort((a, b) => b.id - a.id)

  const filtered = all.filter(inv => {
    const q = search.toLowerCase()
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.serviceNumber.toLowerCase().includes(q) ||
      inv.vehicleRegistrationNumber.toLowerCase().includes(q) ||
      (inv.vendorName?.toLowerCase().includes(q) ?? false)
    const matchType   = typeFilter   === 'ALL' || inv.invoiceType   === typeFilter
    const matchStatus = statusFilter === 'ALL' || inv.paymentStatus === statusFilter
    return matchSearch && matchType && matchStatus
  })

  // Stats
  const total    = all.length
  const internal = all.filter(i => i.invoiceType   === 'INTERNAL').length
  const external = all.filter(i => i.invoiceType   === 'EXTERNAL').length
  const pending  = all.filter(i => i.paymentStatus === 'PENDING').length
  const paid     = all.filter(i => i.paymentStatus === 'PAID').length

  async function handleViewPdf(inv: ServiceInvoice) {
    setDownloadingId(inv.id)
    try {
      const blob = await serviceInvoicesApi.downloadPdf(inv.id)
      openPdfInTab(blob)
    } catch {
      toast.error('Failed to load PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Invoices</h1>
        <p className="text-gray-500 text-sm mt-0.5">{total} total service invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { icon: <Receipt size={16} className="text-gray-400" />,      label: 'Total',    value: total    },
          { icon: <Wrench  size={16} className="text-blue-400" />,       label: 'Internal', value: internal },
          { icon: <FileText size={16} className="text-purple-400" />,    label: 'External', value: external },
          { icon: <Clock   size={16} className="text-amber-400" />,      label: 'Pending',  value: pending, accent: pending > 0 },
          { icon: <CheckCircle2 size={16} className="text-green-400" />, label: 'Paid',     value: paid     },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              {card.icon}
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', card.accent ? 'text-amber-600' : 'text-gray-900')}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by invoice #, service #, vehicle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-80"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as typeof TYPE_FILTERS[number])}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="ALL">All Types</option>
          <option value="INTERNAL">Internal</option>
          <option value="EXTERNAL">External</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof STATUS_FILTERS[number])}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading service invoices…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <AlertCircle size={36} className="text-gray-200" />
            <p className="text-sm">
              {search || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No invoices match your filters'
                : 'No service invoices yet. They are created automatically when a service is completed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Service #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const amount = inv.invoiceType === 'INTERNAL' ? inv.totalAmount : inv.vendorAmount
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setDetailInv(inv)}
                    >
                      <td className="py-3 px-4">
                        <p className="text-sm font-semibold text-feros-navy">{inv.invoiceNumber}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{inv.serviceNumber}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{inv.vehicleRegistrationNumber}</td>
                      <td className="py-3 px-4"><TypeBadge type={inv.invoiceType} /></td>
                      <td className="py-3 px-4 text-sm text-gray-500">{fmtDate(inv.completedDate)}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-right">
                        {amount != null ? fmt(amount) : <span className="text-gray-400 text-xs">Not set</span>}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={inv.paymentStatus} /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {/* Update vendor amount — EXTERNAL + PENDING */}
                          {inv.invoiceType === 'EXTERNAL' && inv.paymentStatus === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => setVendorInv(inv)}
                            >
                              Edit Amount
                            </Button>
                          )}
                          {/* Mark Paid — PENDING only */}
                          {inv.paymentStatus === 'PENDING' && (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => setMarkPaidInv(inv)}
                            >
                              Mark Paid
                            </Button>
                          )}
                          {/* View PDF */}
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
                            title="View PDF"
                            onClick={() => handleViewPdf(inv)}
                            disabled={downloadingId === inv.id}
                          >
                            {downloadingId === inv.id
                              ? <span className="text-xs">…</span>
                              : <ExternalLink size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {detailInv   && <InvoiceDetailDialog   invoice={detailInv}   onClose={() => setDetailInv(null)}   />}
      {markPaidInv && <MarkPaidDialog         invoice={markPaidInv} onClose={() => setMarkPaidInv(null)} />}
      {vendorInv   && <UpdateVendorDialog     invoice={vendorInv}   onClose={() => setVendorInv(null)}   />}
    </div>
  )
}
