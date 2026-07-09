import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, FileText, X, Receipt, DollarSign, Percent } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { leaseInvoicesApi } from '@/api/leaseInvoices'
import type { LeaseInvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | undefined | null) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<LeaseInvoiceStatus, string> = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIALLY_PAID: 'Partially Paid', PAID: 'Paid', CANCELLED: 'Cancelled',
}
const STATUS_COLORS: Record<LeaseInvoiceStatus, string> = {
  DRAFT:          'bg-gray-100 text-gray-600',
  SENT:           'bg-blue-50 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700',
  PAID:           'bg-green-50 text-green-700',
  CANCELLED:      'bg-red-50 text-red-600',
}
const NEXT_STATUS: Partial<Record<LeaseInvoiceStatus, LeaseInvoiceStatus[]>> = {
  DRAFT:          ['SENT', 'CANCELLED'],
  SENT:           ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED'],
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

// ── Detail Page ───────────────────────────────────────────────────────────────
export function LeaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['lease-invoice', Number(id)],
    queryFn: () => leaseInvoicesApi.getById(Number(id)),
    enabled: !!id,
  })

  const invoice = data?.data

  const statusMutation = useMutation({
    mutationFn: (status: LeaseInvoiceStatus) => leaseInvoicesApi.updateStatus(Number(id), status),
    onSuccess: (_data, status) => {
      toast.success('Invoice updated')
      qc.invalidateQueries({ queryKey: ['lease-invoice', Number(id)] })
      qc.invalidateQueries({ queryKey: ['lease-invoices', invoice?.leaseId] })
      if (status === 'CANCELLED') navigate(-1)
    },
    onError: () => toast.error('Failed to update invoice'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => leaseInvoicesApi.delete(Number(id)),
    onSuccess: () => {
      toast.success('Invoice deleted')
      navigate(-1)
    },
    onError: () => toast.error('Failed to delete invoice'),
  })

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading…</div>
  if (!invoice)  return <div className="p-12 text-center text-gray-400">Invoice not found</div>

  const nextStatuses = NEXT_STATUS[invoice.status] ?? []
  const subtotal  = Number(invoice.subtotal  ?? 0)
  const taxAmount = Number(invoice.taxAmount ?? 0)
  const total     = Number(invoice.totalAmount ?? 0)
  const cgstPct   = Number(invoice.cgstPercentage ?? 0)
  const sgstPct   = Number(invoice.sgstPercentage ?? 0)
  const igstPct   = Number(invoice.igstPercentage ?? 0)
  const isIntra   = cgstPct > 0 || sgstPct > 0

  const taxLabel = isIntra
    ? `CGST ${cgstPct}% + SGST ${sgstPct}%`
    : igstPct > 0 ? `IGST ${igstPct}%` : 'Tax (0%)'

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-feros-navy/80 rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Receipt size={180} />
        </div>
        <div className="relative px-6 py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-wide">{invoice.invoiceNumber}</h1>
                <Badge className={cn('text-xs font-medium', STATUS_COLORS[invoice.status])}>
                  {STATUS_LABELS[invoice.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-blue-300">
                <span>Client: <span className="text-white font-medium">{invoice.clientName}</span></span>
                <span>Lease: <span className="text-white font-medium">{invoice.leaseNumber}</span></span>
                {invoice.invoiceDate && (
                  <span>Date: <span className="text-white font-medium">{fmtDate(invoice.invoiceDate)}</span></span>
                )}
                {invoice.billingPeriodStart && (
                  <span>Period: <span className="text-white font-medium">
                    {fmtDate(invoice.billingPeriodStart)} → {fmtDate(invoice.billingPeriodEnd)}
                  </span></span>
                )}
                {invoice.dueDate && (
                  <span>Due: <span className="text-white font-medium">{fmtDate(invoice.dueDate)}</span></span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <button
                onClick={() => window.open(`/vehicle-leases/invoices/${invoice.id}/print`, '_blank')}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FileText className="h-4 w-4" /> View Invoice
              </button>
              {nextStatuses.filter(s => s !== 'CANCELLED').map(s => (
                <button key={s}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Mark {STATUS_LABELS[s]}
                </button>
              ))}
              {nextStatuses.includes('CANCELLED') && (
                <button
                  onClick={() => statusMutation.mutate('CANCELLED')}
                  disabled={statusMutation.isPending}
                  className="flex items-center gap-2 bg-white/10 hover:bg-red-500/30 text-red-300 border border-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              )}
              {invoice.status === 'DRAFT' && (
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 bg-white/10 hover:bg-red-500/30 text-red-300 border border-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Subtotal" value={`₹${fmt(subtotal)}`} />
        <StatCard icon={<Percent className="h-4 w-4" />}   label={taxLabel}   value={`₹${fmt(taxAmount)}`} />
        <StatCard icon={<Receipt className="h-4 w-4" />}   label="Total"      value={`₹${fmt(total)}`} />
      </div>

      {/* ── Line Items ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Days</th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Rate (₹)</th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                  <td className="py-3 px-4 text-gray-800">{item.description ?? item.registrationNumber ?? '—'}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.days ?? '—'}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.rate != null ? fmt(item.rate) : '—'}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="py-2.5 px-4 text-sm font-semibold text-gray-700 text-right">Subtotal</td>
                <td className="py-2.5 px-4 text-right font-bold text-gray-900">{fmt(subtotal)}</td>
              </tr>
              {isIntra && taxAmount > 0 && <>
                <tr>
                  <td colSpan={4} className="py-1 px-4 text-sm text-gray-500 text-right">CGST {cgstPct}%</td>
                  <td className="py-1 px-4 text-right text-gray-600">{fmt(Number(invoice.cgstAmount ?? 0))}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-1 px-4 text-sm text-gray-500 text-right">SGST {sgstPct}%</td>
                  <td className="py-1 px-4 text-right text-gray-600">{fmt(Number(invoice.sgstAmount ?? 0))}</td>
                </tr>
              </>}
              {!isIntra && igstPct > 0 && (
                <tr>
                  <td colSpan={4} className="py-1 px-4 text-sm text-gray-500 text-right">IGST {igstPct}%</td>
                  <td className="py-1 px-4 text-right text-gray-600">{fmt(Number(invoice.igstAmount ?? 0))}</td>
                </tr>
              )}
              <tr className="border-t border-gray-200">
                <td colSpan={4} className="py-2.5 px-4 text-sm font-bold text-gray-900 text-right">Total</td>
                <td className="py-2.5 px-4 text-right font-bold text-gray-900 text-base">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Notes ── */}
      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700">{invoice.notes}</p>
        </div>
      )}

    </div>
  )
}
