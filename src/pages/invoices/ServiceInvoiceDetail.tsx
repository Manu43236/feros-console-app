import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { Badge }  from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { serviceInvoicesApi } from '@/api/serviceInvoices'
import type { ServiceInvoice, ServiceInvoiceType, ServiceInvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmt(n?: number) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function openPdfInTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  // revoke after a short delay to allow the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ── Badges ────────────────────────────────────────────────────────────────────
export function TypeBadge({ type }: { type: ServiceInvoiceType }) {
  return type === 'INTERNAL'
    ? <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs">Internal</Badge>
    : <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50 text-xs">External</Badge>
}

export function StatusBadge({ status }: { status: ServiceInvoiceStatus }) {
  return status === 'PAID'
    ? <Badge className="bg-green-50 text-green-700 hover:bg-green-50 text-xs">Paid</Badge>
    : <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-xs">Pending</Badge>
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

// ── Mark Paid Dialog ──────────────────────────────────────────────────────────
export function MarkPaidDialog({ invoice, onClose }: { invoice: ServiceInvoice; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => serviceInvoicesApi.markPaid(invoice.id),
    onSuccess: () => {
      toast.success('Invoice marked as paid')
      qc.invalidateQueries({ queryKey: ['service-invoices'] })
      qc.invalidateQueries({ queryKey: ['service-invoice', invoice.id] })
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
export function UpdateVendorDialog({ invoice, onClose }: { invoice: ServiceInvoice; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount]       = useState(String(invoice.vendorAmount ?? ''))
  const [invoiceNo, setInvoiceNo] = useState(invoice.vendorInvoiceNo ?? '')

  const mutation = useMutation({
    mutationFn: () => serviceInvoicesApi.updateVendorAmount(invoice.id, {
      vendorAmount:    Number(amount),
      vendorInvoiceNo: invoiceNo.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Vendor amount updated')
      qc.invalidateQueries({ queryKey: ['service-invoices'] })
      qc.invalidateQueries({ queryKey: ['service-invoice', invoice.id] })
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

// ── Detail body (shared by list modal → page) ─────────────────────────────────
export function ServiceInvoiceDetail({ invoice }: { invoice: ServiceInvoice }) {
  const isInternal = invoice.invoiceType === 'INTERNAL'

  return (
    <div className="space-y-4">
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
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Unit Cost</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Total</th>
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
                    <td className="py-2 px-3 text-right text-gray-600">{fmt(p.unitCost)}</td>
                    <td className="py-2 px-3 text-right text-gray-700 font-medium">{fmt(p.totalCost)}</td>
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
            {(invoice.partsTotal ?? 0) > 0 && (
              <SummaryRow label="Parts Total" value={fmt(invoice.partsTotal)} />
            )}
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
  )
}
