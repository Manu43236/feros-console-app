import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import {
  ArrowLeft, FileText, CheckCircle2, Send,
  DollarSign, Truck, CreditCard, X,
} from 'lucide-react'
import { invoicesApi } from '@/api/invoices'
import { toast } from 'sonner'
import { InvoiceStatusBadge } from './InvoicesPage'
import type { PaymentMode } from '@/types'
import { cn } from '@/lib/utils'

// ── Record Payment Dialog ─────────────────────────────────────────────────
const paymentSchema = z.object({
  amount:          z.coerce.number().positive('Enter a valid amount'),
  paymentMode:     z.enum(['CASH','CHEQUE','NEFT','UPI','RTGS']),
  paymentDate:     z.string().optional(),
  referenceNumber: z.string().optional(),
  remarks:         z.string().optional(),
})
type PaymentForm = z.infer<typeof paymentSchema>

const PAYMENT_MODES: PaymentMode[] = ['CASH','CHEQUE','NEFT','UPI','RTGS']

function RecordPaymentDialog({ invoiceId, balanceDue, onClose }: {
  invoiceId: number; balanceDue: number; onClose: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema) as Resolver<PaymentForm>,
    defaultValues: {
      paymentMode: 'NEFT',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  })

  const mutation = useMutation({
    mutationFn: (data: PaymentForm) => invoicesApi.addPayment(invoiceId, {
      amount:          data.amount,
      paymentMode:     data.paymentMode,
      paymentDate:     data.paymentDate || undefined,
      referenceNumber: data.referenceNumber || undefined,
      remarks:         data.remarks || undefined,
    }),
    onSuccess: () => {
      toast.success('Payment recorded successfully')
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to record payment')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
          {balanceDue > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">
              Balance due: <span className="font-bold">₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
              <input
                type="number" step="0.01" min="0"
                {...register('amount')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                autoFocus
              />
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
              <input
                type="date"
                {...register('paymentDate')}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
            <select
              {...register('paymentMode')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference / UTR Number</label>
            <input
              {...register('referenceNumber')}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Cheque number, UTR, UPI ref…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              {...register('remarks')}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', color ?? 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate      = useNavigate()
  const qc            = useQueryClient()
  const id            = parseInt(invoiceId!)

  const [tab, setTab]             = useState<'lrs' | 'payments'>('lrs')
  const [showPayment, setShowPay] = useState(false)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn:  () => invoicesApi.getById(id).then(r => r.data),
    enabled:  !isNaN(id),
  })

  const { data: payments = [] } = useQuery({
    queryKey: ['invoice-payments', id],
    queryFn:  () => invoicesApi.getPayments(id).then(r => r.data),
    enabled:  !isNaN(id),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => invoicesApi.updateStatus(id, { invoiceStatus: status }),
    onSuccess: () => {
      toast.success('Invoice status updated')
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>
  if (!invoice)  return <div className="p-8 text-center text-gray-500">Invoice not found.</div>

  const lrItems   = invoice.lrItems ?? []
  const balanceDue = Number(invoice.balanceDue)
  const canSend    = invoice.invoiceStatus === 'DRAFT'
  const canPay     = ['SENT','PARTIALLY_PAID','OVERDUE'].includes(invoice.invoiceStatus)
  const canCancel  = ['DRAFT','SENT'].includes(invoice.invoiceStatus)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-6">
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-wide">{invoice.invoiceNumber}</h1>
              <InvoiceStatusBadge status={invoice.invoiceStatus} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-300">
              <span>Client: <span className="text-white font-medium">{invoice.clientName}</span></span>
              {invoice.invoiceDate && (
                <span>Date: <span className="text-white font-medium">
                  {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span></span>
              )}
              {invoice.dueDate && (
                <span>Due: <span className={cn('font-medium', invoice.invoiceStatus === 'OVERDUE' ? 'text-red-300' : 'text-white')}>
                  {new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span></span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {/* PDF — dummy link for now */}
            <a
              href="https://www.africau.edu/images/default/sample.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="h-4 w-4" />
              PDF
            </a>
            {canSend && (
              <button
                onClick={() => statusMutation.mutate('SENT')}
                disabled={statusMutation.isPending}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Mark as Sent
              </button>
            )}
            {canPay && (
              <button
                onClick={() => setShowPay(true)}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Record Payment
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => { if (confirm('Cancel this invoice?')) statusMutation.mutate('CANCELLED') }}
                className="flex items-center gap-2 bg-white/10 hover:bg-red-500/30 text-red-300 border border-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Subtotal"
            value={`₹${Number(invoice.subtotal).toLocaleString('en-IN')}`}
          />
          <StatCard
            icon={<CreditCard className="h-4 w-4" />}
            label="Total Amount"
            value={`₹${Number(invoice.totalAmount).toLocaleString('en-IN')}`}
            sub={Number(invoice.taxAmount) > 0 ? `incl. ₹${Number(invoice.taxAmount).toLocaleString('en-IN')} tax` : undefined}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Amount Paid"
            value={`₹${Number(invoice.amountPaid).toLocaleString('en-IN')}`}
            color="text-green-600"
          />
          <StatCard
            icon={<Truck className="h-4 w-4" />}
            label="Balance Due"
            value={`₹${balanceDue.toLocaleString('en-IN')}`}
            color={balanceDue > 0 ? 'text-red-600' : 'text-gray-400'}
            sub={balanceDue > 0 ? 'outstanding' : 'fully paid'}
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="flex border-b px-4">
            {([
              { key: 'lrs',      label: 'LR Items',  icon: <Truck className="h-4 w-4" />,      count: lrItems.length },
              { key: 'payments', label: 'Payments',  icon: <CreditCard className="h-4 w-4" />, count: payments.length },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {t.icon}
                {t.label}
                {t.count > 0 && (
                  <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-1.5 py-0.5">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* LR Items tab */}
            {tab === 'lrs' && (
              lrItems.length === 0 ? (
                <div className="text-center py-10">
                  <Truck className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No LR items found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">LR #</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Order #</th>
                        <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Freight</th>
                        <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Charges</th>
                        <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fines</th>
                        <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lrItems.map((item, i) => (
                        <tr key={item.id ?? i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <button
                              onClick={() => navigate(`/lrs/${item.lrId}`)}
                              className="font-medium text-feros-navy hover:underline"
                            >
                              {item.lrNumber}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-gray-600">{item.vehicleRegistrationNumber}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => navigate(`/orders/${item.orderId}`)}
                              className="text-gray-600 hover:text-feros-navy hover:underline"
                            >
                              {item.orderNumber}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-right text-gray-700">₹{Number(item.freightAmount).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-right text-gray-700">
                            {Number(item.chargesAmount) > 0 ? `₹${Number(item.chargesAmount).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {Number(item.checkpostFineAmount) > 0
                              ? <span className="text-red-600">₹{Number(item.checkpostFineAmount).toLocaleString('en-IN')}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-gray-900">
                            ₹{Number(item.totalAmount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {lrItems.length > 1 && (
                      <tfoot className="border-t-2 border-gray-200">
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="py-2.5 px-3 text-sm font-semibold text-gray-700">Total</td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                            ₹{lrItems.reduce((s, i) => s + Number(i.totalAmount), 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )
            )}

            {/* Payments tab */}
            {tab === 'payments' && (
              payments.length === 0 ? (
                <div className="text-center py-10">
                  <CreditCard className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No payments recorded yet</p>
                  {canPay && (
                    <button
                      onClick={() => setShowPay(true)}
                      className="mt-3 text-sm text-blue-600 hover:underline"
                    >
                      Record first payment
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Mode</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</th>
                        <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={p.id ?? i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-3 text-gray-600">
                            {p.paymentDate
                              ? new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                              {p.paymentMode}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-500">{p.referenceNumber ?? '—'}</td>
                          <td className="py-3 px-3 text-right font-semibold text-green-600">
                            ₹{Number(p.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">{p.createdByName}</td>
                        </tr>
                      ))}
                    </tbody>
                    {payments.length > 1 && (
                      <tfoot className="border-t-2 border-gray-200">
                        <tr className="bg-gray-50">
                          <td colSpan={3} className="py-2.5 px-3 text-sm font-semibold text-gray-700">Total Received</td>
                          <td className="py-2.5 px-3 text-right font-bold text-green-600">
                            ₹{payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString('en-IN')}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* Remarks + meta */}
        {invoice.remarks && (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Remarks</p>
            <p className="text-sm text-gray-700">{invoice.remarks}</p>
          </div>
        )}
        <p className="text-xs text-gray-400 text-right">
          Created by {invoice.createdByName} · {new Date(invoice.createdAt).toLocaleString()}
        </p>
      </div>

      {showPayment && (
        <RecordPaymentDialog
          invoiceId={id}
          balanceDue={balanceDue}
          onClose={() => setShowPay(false)}
        />
      )}
    </div>
  )
}
