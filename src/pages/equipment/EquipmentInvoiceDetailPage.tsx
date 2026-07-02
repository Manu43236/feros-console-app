import { useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, FileText, X, Download, DollarSign, Receipt, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { equipmentInvoicesApi } from '@/api/equipmentInvoices'
import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'
import type { EquipmentInvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────
const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

function wordsUnder1000(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + wordsUnder1000(n % 100) : '')
}

function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  const rupees  = Math.floor(rounded)
  const paise   = Math.round((rounded - rupees) * 100)
  const parts: string[] = []
  const crore = Math.floor(rupees / 10000000)
  const lakh  = Math.floor((rupees % 10000000) / 100000)
  const thous = Math.floor((rupees % 100000) / 1000)
  const rem   = rupees % 1000
  if (crore) parts.push(wordsUnder1000(crore) + ' Crore')
  if (lakh)  parts.push(wordsUnder1000(lakh)  + ' Lakh')
  if (thous) parts.push(wordsUnder1000(thous) + ' Thousand')
  if (rem)   parts.push(wordsUnder1000(rem))
  let result = 'INR ' + (parts.join(' ') || 'Zero')
  if (paise) result += ` and ${wordsUnder1000(paise)} Paise`
  return result + ' Only'
}

const fmt = (n: number | undefined | null) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIALLY_PAID: 'Partially Paid', PAID: 'Paid', CANCELLED: 'Cancelled',
}
const STATUS_COLORS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700',
  PAID: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}
const NEXT_STATUS: Partial<Record<EquipmentInvoiceStatus, EquipmentInvoiceStatus[]>> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED'],
}

// ── Printable Invoice Document ─────────────────────────────────────────────────
const B = '1px solid #000'
const cell = (style?: React.CSSProperties): React.CSSProperties => ({
  border: B, padding: '4px 6px', fontSize: 11, ...style,
})

export function EquipmentInvoiceDocument({ invoice, companyName }: {
  invoice: import('@/types').EquipmentInvoice
  companyName: string
}) {
  const subtotal   = Number(invoice.subtotal   ?? 0)
  const taxPercent = Number(invoice.taxPercent ?? 0)
  const taxAmount  = Number(invoice.taxAmount  ?? 0)
  const total      = Number(invoice.totalAmount ?? 0)

  const billingLabel = invoice.billingPeriodStart
    ? `${fmtDate(invoice.billingPeriodStart)} to ${fmtDate(invoice.billingPeriodEnd)}`
    : '—'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000', padding: '16px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: B }}>
        <tbody>

          {/* Company Header */}
          <tr>
            <td colSpan={2} style={{ ...cell(), textAlign: 'center', padding: '10px 8px', borderBottom: B }}>
              <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {companyName}
              </div>
            </td>
          </tr>

          {/* Title */}
          <tr>
            <td colSpan={2} style={{ ...cell(), textAlign: 'center', fontWeight: 700, fontSize: 14, padding: '5px 8px', borderBottom: B }}>
              EQUIPMENT RENTAL INVOICE
            </td>
          </tr>

          {/* Client + Invoice details */}
          <tr>
            <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderRight: B, borderBottom: B, padding: '6px 8px' }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>TO,</div>
              <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{invoice.clientName}</div>
            </td>
            <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderBottom: B, padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {([
                    ['INVOICE NO',     invoice.invoiceNumber],
                    ['DATE',           fmtDate(invoice.invoiceDate)],
                    ['DUE DATE',       fmtDate(invoice.dueDate)],
                    ['WORK ORDER',     invoice.woNumber],
                    ['BILLING PERIOD', billingLabel],
                  ] as [string, string | null | undefined][]).map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ border: B, padding: '4px 6px', fontWeight: 600, width: '40%' }}>{label}</td>
                      <td style={{ border: B, padding: '4px 6px', fontWeight: 700 }}>{value ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          {/* Line items */}
          <tr>
            <td colSpan={2} style={{ ...cell(), padding: 0, borderBottom: B }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    <th style={{ ...cell(), width: 30, textAlign: 'center' }}>#</th>
                    <th style={{ ...cell(), textAlign: 'left' }}>Description</th>
                    <th style={{ ...cell(), textAlign: 'center', width: 80 }}>Billing</th>
                    <th style={{ ...cell(), textAlign: 'right', width: 60 }}>Qty</th>
                    <th style={{ ...cell(), textAlign: 'right', width: 100 }}>Rate (₹)</th>
                    <th style={{ ...cell(), textAlign: 'right', width: 110 }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ ...cell(), textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ ...cell() }}>
                        {item.description}
                        {item.serialNumber && ` (${item.serialNumber})`}
                      </td>
                      <td style={{ ...cell(), textAlign: 'center' }}>{item.billingType ?? '—'}</td>
                      <td style={{ ...cell(), textAlign: 'right' }}>{Number(item.quantity).toFixed(2)}</td>
                      <td style={{ ...cell(), textAlign: 'right' }}>{fmt(item.rate)}</td>
                      <td style={{ ...cell(), textAlign: 'right' }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - invoice.items.length) }).map((_, i) => (
                    <tr key={`pad-${i}`}>
                      {[0,1,2,3,4,5].map(c => <td key={c} style={{ ...cell() }}>&nbsp;</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          {/* Totals */}
          <tr>
            <td style={{ ...cell(), verticalAlign: 'top', borderRight: B, padding: '6px 8px' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Amount in words:</div>
              <div style={{ fontStyle: 'italic' }}>{amountInWords(total)}</div>
              {invoice.notes && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#555' }}>
                  <span style={{ fontWeight: 600 }}>Notes: </span>{invoice.notes}
                </div>
              )}
            </td>
            <td style={{ ...cell(), padding: 0, verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {([
                    ['Subtotal',               fmt(subtotal)],
                    [`GST (${taxPercent}%)`,   fmt(taxAmount)],
                    ['Total',                  fmt(total)],
                  ] as [string, string][]).map(([label, value], i) => (
                    <tr key={label}>
                      <td style={{ border: B, padding: '4px 8px', fontWeight: i === 2 ? 700 : 400 }}>{label}</td>
                      <td style={{ border: B, padding: '4px 8px', textAlign: 'right', fontWeight: i === 2 ? 700 : 400 }}>
                        ₹{value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          {/* Signature */}
          <tr>
            <td colSpan={2} style={{ ...cell(), textAlign: 'right', padding: '24px 8px 8px' }}>
              <div>For <strong>{companyName}</strong></div>
              <div style={{ marginTop: 40, fontSize: 10 }}>Authorised Signatory</div>
            </td>
          </tr>

        </tbody>
      </table>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Detail Page ────────────────────────────────────────────────────────────────
export function EquipmentInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyName = useAuthStore(s => s.companyName) ?? ''
  const [showPreview, setShowPreview] = useState(false)
  const invoiceRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['equip-invoice', Number(id)],
    queryFn: () => equipmentInvoicesApi.getById(Number(id)),
    enabled: !!id,
  })

  const invoice = data?.data

  const statusMutation = useMutation({
    mutationFn: (status: EquipmentInvoiceStatus) =>
      equipmentInvoicesApi.updateStatus(Number(id), status),
    onSuccess: (_data, status) => {
      toast.success('Invoice updated')
      qc.invalidateQueries({ queryKey: ['equip-invoice', Number(id)] })
      qc.invalidateQueries({ queryKey: ['equip-invoices-all'] })
      qc.invalidateQueries({ queryKey: ['equip-invoices'] })
      if (status === 'CANCELLED') navigate('/equipment/invoices')
    },
    onError: () => toast.error('Failed to update invoice'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => equipmentInvoicesApi.delete(Number(id)),
    onSuccess: () => {
      toast.success('Invoice deleted')
      navigate(-1)
    },
    onError: () => toast.error('Failed to delete invoice'),
  })

  async function handleDownloadPdf() {
    if (!invoiceRef.current) return
    const html2pdf = (await import('html2pdf.js')).default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      margin: 10,
      filename: `${invoice?.invoiceNumber ?? 'invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }
    await html2pdf().set(opts).from(invoiceRef.current).save()
  }

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading…</div>
  if (!invoice)  return <div className="p-12 text-center text-gray-400">Invoice not found</div>

  const nextStatuses = NEXT_STATUS[invoice.status] ?? []
  const subtotal  = Number(invoice.subtotal  ?? 0)
  const taxAmount = Number(invoice.taxAmount ?? 0)
  const total     = Number(invoice.totalAmount ?? 0)

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-feros-equip-sidebar rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Receipt size={180} />
        </div>
        <div className="relative px-6 py-6">
          <button
            onClick={() => navigate('/equipment/invoices')}
            className="flex items-center gap-1.5 text-amber-300 hover:text-white text-sm transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Invoices
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-wide">{invoice.invoiceNumber}</h1>
                <Badge className={cn('text-xs font-medium', STATUS_COLORS[invoice.status])}>
                  {STATUS_LABELS[invoice.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-amber-300">
                <span>Client: <span className="text-white font-medium">{invoice.clientName}</span></span>
                <span>WO: <span className="text-white font-medium">{invoice.woNumber}</span></span>
                {invoice.invoiceDate && (
                  <span>Date: <span className="text-white font-medium">{fmtDate(invoice.invoiceDate)}</span></span>
                )}
                {invoice.billingPeriodStart && (
                  <span>Period: <span className="text-white font-medium">
                    {fmtDate(invoice.billingPeriodStart)} → {fmtDate(invoice.billingPeriodEnd)}
                  </span></span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FileText className="h-4 w-4" /> View Invoice
              </button>
              {nextStatuses.filter(s => s !== 'CANCELLED').map(s => (
                <button
                  key={s}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Subtotal"
          value={`₹${subtotal.toLocaleString('en-IN')}`}
        />
        <StatCard
          icon={<Percent className="h-4 w-4" />}
          label={`GST (${invoice.taxPercent ?? 0}%)`}
          value={`₹${taxAmount.toLocaleString('en-IN')}`}
        />
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Total Amount"
          value={`₹${total.toLocaleString('en-IN')}`}
        />
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
                <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Billing</th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Qty</th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Rate (₹)</th>
                <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                  <td className="py-3 px-4 text-gray-800">
                    {item.description}
                    {item.serialNumber && <span className="text-gray-400 ml-1 text-xs">({item.serialNumber})</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.billingType ? (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.billingType}</span>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">{Number(item.quantity).toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{fmt(item.rate)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={5} className="py-2.5 px-4 text-sm font-semibold text-gray-700 text-right">
                  Subtotal
                </td>
                <td className="py-2.5 px-4 text-right font-bold text-gray-900">{fmt(subtotal)}</td>
              </tr>
              {taxAmount > 0 && (
                <tr>
                  <td colSpan={5} className="py-1 px-4 text-sm text-gray-500 text-right">
                    GST ({invoice.taxPercent ?? 0}%)
                  </td>
                  <td className="py-1 px-4 text-right text-gray-600">{fmt(taxAmount)}</td>
                </tr>
              )}
              <tr className="border-t border-gray-200">
                <td colSpan={5} className="py-2.5 px-4 text-sm font-bold text-gray-900 text-right">Total</td>
                <td className="py-2.5 px-4 text-right font-bold text-gray-900 text-base">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700">{invoice.notes}</p>
        </div>
      )}

      {/* ── Invoice Preview Dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent
          className="max-w-[95vw] w-[900px] p-0 gap-0 flex flex-col [&>button]:hidden"
          style={{ height: '90vh' }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 flex-shrink-0">
            <span className="font-semibold text-gray-800 text-sm">
              Invoice — {invoice.invoiceNumber}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleDownloadPdf} className="flex items-center gap-2 h-8 text-xs">
                <Download className="h-3.5 w-3.5" /> Download PDF
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
            <div ref={invoiceRef}>
              <EquipmentInvoiceDocument invoice={invoice} companyName={companyName} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
