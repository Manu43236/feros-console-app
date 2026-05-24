import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import {
  ArrowLeft, FileText, CheckCircle2, Send,
  DollarSign, Truck, CreditCard, X, Pencil, Trash2, Download,
} from 'lucide-react'
import { invoicesApi } from '@/api/invoices'
import { toast } from 'sonner'
import { InvoiceStatusBadge } from './InvoicesPage'
import { InvoiceDocument } from './InvoicePrintPage'
import type { PaymentMode } from '@/types'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

// ── Edit Invoice Dialog ───────────────────────────────────────────────────
function EditInvoiceDialog({ invoiceId, currentDueDate, currentRemarks, open, onClose }: {
  invoiceId: number; currentDueDate?: string; currentRemarks?: string; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [dueDate, setDueDate]   = useState(currentDueDate ?? '')
  const [remarks, setRemarks]   = useState(currentRemarks ?? '')

  const mutation = useMutation({
    mutationFn: () => invoicesApi.update(invoiceId, {
      dueDate:  dueDate || undefined,
      remarks:  remarks || undefined,
    }),
    onSuccess: () => {
      toast.success('Invoice updated')
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to update invoice')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Invoice</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={3}
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background"
              placeholder="Optional note…"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white"
            >
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

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

function RecordPaymentDialog({ invoiceId, balanceDue, open, onClose }: {
  invoiceId: number; balanceDue: number; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<PaymentForm>({
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
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to record payment')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          {balanceDue > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">
              Balance due: <span className="font-bold">₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" step="0.01" min="0" {...register('amount')} placeholder="0.00" autoFocus />
              {errors.amount && <p className="text-red-500 text-xs">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" {...register('paymentDate')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payment Mode *</Label>
            <select {...register('paymentMode')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference / UTR Number</Label>
            <Input {...register('referenceNumber')} placeholder="Cheque number, UTR, UPI ref…" />
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <textarea {...register('remarks')} rows={2} className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background" />
          </div>
          {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {mutation.isPending ? 'Recording…' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
  const [showEdit, setShowEdit]   = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const invoicePrintRef = useRef<HTMLDivElement>(null)

  const handleDownloadPdf = async () => {
    if (!invoicePrintRef.current) return
    const html2pdf = (await import('html2pdf.js')).default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      margin: 10,
      filename: `${invoice?.invoiceNumber ?? 'invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pageBreaks: { mode: 'css', before: '.annexure-page' },
    }
    await html2pdf()
      .set(opts)
      .from(invoicePrintRef.current)
      .save()
  }
  const [dlg, setDlg]             = useState<{ title: string; desc: string; onOk: () => void } | null>(null)

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
    onSuccess: (_data, status) => {
      toast.success('Invoice status updated')
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      if (status === 'CANCELLED') navigate('/invoices')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => invoicesApi.deletePayment(id, paymentId),
    onSuccess: () => {
      toast.success('Payment removed')
      qc.invalidateQueries({ queryKey: ['invoice', id] })
      qc.invalidateQueries({ queryKey: ['invoice-payments', id] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: () => toast.error('Failed to remove payment'),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>
  if (!invoice)  return <div className="p-8 text-center text-gray-500">Invoice not found.</div>

  if (invoice.invoiceStatus === 'CANCELLED') {
    return (
      <div className="space-y-5">
        <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-blue-900 rounded-xl overflow-hidden">
          <div className="relative px-6 py-6">
            <button
              onClick={() => navigate('/invoices')}
              className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Invoices
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-white">{invoice.invoiceNumber}</h1>
              <InvoiceStatusBadge status={invoice.invoiceStatus} />
            </div>
            <p className="text-blue-200 text-sm mt-1">{invoice.clientName}</p>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
          <X className="h-8 w-8 mx-auto mb-2 text-rose-400" />
          <p className="font-semibold text-base">This invoice has been cancelled.</p>
          <p className="text-sm mt-1 text-rose-500">No further actions are available.</p>
        </div>
      </div>
    )
  }

  const lrItems    = invoice.lrItems ?? []
  const balanceDue = Number(invoice.balanceDue)
  const canSend    = invoice.invoiceStatus === 'DRAFT'
  const canPay     = ['SENT','PARTIALLY_PAID','OVERDUE'].includes(invoice.invoiceStatus)
  const canCancel  = ['DRAFT','SENT'].includes(invoice.invoiceStatus)
  const canEdit    = ['DRAFT','SENT','PARTIALLY_PAID','OVERDUE'].includes(invoice.invoiceStatus)

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-blue-900 rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <FileText size={180} />
        </div>
        <div className="relative px-6 py-6">
          <button
            onClick={() => navigate('/invoices')}
            className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Invoices
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-wide">{invoice.invoiceNumber}</h1>
                <InvoiceStatusBadge status={invoice.invoiceStatus} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-blue-300">
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
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FileText className="h-4 w-4" />
                View Invoice
              </button>
              {canEdit && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
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
                  onClick={() => setDlg({ title: 'Cancel Invoice', desc: 'Are you sure you want to cancel this invoice? This cannot be undone.', onOk: () => statusMutation.mutate('CANCELLED') })}
                  className="flex items-center gap-2 bg-white/10 hover:bg-red-500/30 text-red-300 border border-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
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
          sub={Number(invoice.taxAmount) > 0
            ? `CGST ${invoice.cgstPercentage}% + SGST ${invoice.sgstPercentage}% = ₹${Number(invoice.taxAmount).toLocaleString('en-IN')}`
            : undefined}
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

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {([
            { key: 'lrs',      label: 'LR Items',  icon: <Truck className="h-4 w-4" />,      count: lrItems.length },
            { key: 'payments', label: 'Payments',  icon: <CreditCard className="h-4 w-4" />, count: payments.length },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t.key
                  ? 'border-feros-navy text-feros-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
              )}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
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
                    className="mt-3 text-sm text-feros-navy hover:underline"
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
                      <th className="py-2.5 px-3" />
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
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setDlg({
                              title: 'Remove Payment',
                              desc: `Remove payment of ₹${Number(p.amount).toLocaleString('en-IN')}? This will reduce the amount paid and revert the invoice status.`,
                              onOk: () => deletePaymentMutation.mutate(p.id),
                            })}
                            className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Remove payment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
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
                        <td /><td />
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

      {/* ── Dialogs ── */}
      <EditInvoiceDialog
        invoiceId={id}
        currentDueDate={invoice.dueDate ?? undefined}
        currentRemarks={invoice.remarks ?? undefined}
        open={showEdit}
        onClose={() => setShowEdit(false)}
      />
      <RecordPaymentDialog
        invoiceId={id}
        balanceDue={balanceDue}
        open={showPayment}
        onClose={() => setShowPay(false)}
      />
      <ConfirmDialog
        open={!!dlg}
        title={dlg?.title ?? ''}
        description={dlg?.desc ?? ''}
        confirmLabel="Yes, Cancel"
        onConfirm={() => { dlg?.onOk(); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />

      {/* ── Invoice Preview Dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] w-[1000px] p-0 gap-0 flex flex-col [&>button]:hidden" style={{ height: '90vh' }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 flex-shrink-0">
            <span className="font-semibold text-gray-800 text-sm">
              Invoice — {invoice.invoiceNumber}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleDownloadPdf}
                className="flex items-center gap-2 h-8 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-white">
            <div ref={invoicePrintRef}>
              <InvoiceDocument invoice={invoice} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
