import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { equipmentInvoicesApi } from '@/api/equipmentInvoices'
import { useAuthStore } from '@/store/authStore'
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

const B = '1px solid #000'
const cell = (style?: React.CSSProperties): React.CSSProperties => ({
  border: B, padding: '4px 6px', fontSize: 11, ...style,
})

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIALLY_PAID: 'Partially Paid', PAID: 'Paid', CANCELLED: 'Cancelled',
}
const STATUS_COLORS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SENT: 'bg-blue-50 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700', PAID: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}
const NEXT_STATUS: Partial<Record<EquipmentInvoiceStatus, EquipmentInvoiceStatus[]>> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED'],
}

// ── Invoice Document (printable) ───────────────────────────────────────────────
function InvoiceDocument({ invoice, companyName }: {
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
    <div style={{ maxWidth: 860, margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: B }}>
        <tbody>

          {/* ── Company Header ── */}
          <tr>
            <td colSpan={2} style={{ ...cell(), textAlign: 'center', padding: '10px 8px', borderBottom: B }}>
              <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {companyName}
              </div>
            </td>
          </tr>

          {/* ── Title ── */}
          <tr>
            <td colSpan={2} style={{ ...cell(), textAlign: 'center', fontWeight: 700, fontSize: 14, padding: '5px 8px', borderBottom: B }}>
              EQUIPMENT RENTAL INVOICE
            </td>
          </tr>

          {/* ── Client + Invoice details ── */}
          <tr>
            <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderRight: B, borderBottom: B, padding: '6px 8px' }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>TO,</div>
              <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{invoice.clientName}</div>
            </td>
            <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderBottom: B, padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['INVOICE NO',       invoice.invoiceNumber],
                    ['DATE',             fmtDate(invoice.invoiceDate)],
                    ['DUE DATE',         fmtDate(invoice.dueDate)],
                    ['WORK ORDER',       invoice.woNumber],
                    ['BILLING PERIOD',   billingLabel],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ border: B, padding: '4px 6px', fontWeight: 600, width: '40%' }}>{label}</td>
                      <td style={{ border: B, padding: '4px 6px', fontWeight: 700 }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          {/* ── Line items header ── */}
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
                  {/* Padding rows for short invoices */}
                  {Array.from({ length: Math.max(0, 5 - invoice.items.length) }).map((_, i) => (
                    <tr key={`pad-${i}`}>
                      <td style={{ ...cell(), textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ ...cell() }}>&nbsp;</td>
                      <td style={{ ...cell() }}>&nbsp;</td>
                      <td style={{ ...cell() }}>&nbsp;</td>
                      <td style={{ ...cell() }}>&nbsp;</td>
                      <td style={{ ...cell() }}>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          {/* ── Totals ── */}
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
                  {[
                    ['Subtotal',                     fmt(subtotal)],
                    [`GST (${taxPercent}%)`,         fmt(taxAmount)],
                    ['Total',                        fmt(total)],
                  ].map(([label, value], i) => (
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

          {/* ── Signature ── */}
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

// ── Detail Page ────────────────────────────────────────────────────────────────
export function EquipmentInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyName = useAuthStore(s => s.companyName) ?? ''
  const [printing, setPrinting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['equip-invoice', Number(id)],
    queryFn: () => equipmentInvoicesApi.getById(Number(id)),
    enabled: !!id,
  })

  const invoice = data?.data

  const statusMutation = useMutation({
    mutationFn: (status: EquipmentInvoiceStatus) =>
      equipmentInvoicesApi.updateStatus(Number(id), status),
    onSuccess: () => {
      toast.success('Invoice updated')
      qc.invalidateQueries({ queryKey: ['equip-invoice', Number(id)] })
      qc.invalidateQueries({ queryKey: ['equip-invoices-all'] })
      qc.invalidateQueries({ queryKey: ['equip-invoices'] })
    },
    onError: () => toast.error('Failed to update invoice'),
  })

  function handlePrint() {
    setPrinting(true)
    setTimeout(() => { window.print(); setPrinting(false) }, 100)
  }

  useEffect(() => {
    if (invoice) document.title = `Invoice ${invoice.invoiceNumber}`
    return () => { document.title = 'FEROS' }
  }, [invoice])

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading…</div>
  if (!invoice)  return <div className="p-12 text-center text-gray-400">Invoice not found</div>

  const nextStatuses = NEXT_STATUS[invoice.status] ?? []

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>

      {/* ── Toolbar (hidden on print) ── */}
      <div className="no-print space-y-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} className="mr-1" /> Back
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {invoice.woNumber} · {invoice.clientName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={cn('text-xs font-medium', STATUS_COLORS[invoice.status])}>
              {STATUS_LABELS[invoice.status]}
            </Badge>
            {nextStatuses.map(s => (
              <Button key={s} variant="outline" size="sm"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
              >
                Mark {STATUS_LABELS[s]}
              </Button>
            ))}
            <Button
              size="sm"
              className="bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white"
              onClick={handlePrint}
              disabled={printing}
            >
              <Printer size={14} className="mr-1.5" />
              {printing ? 'Preparing…' : 'Print / PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Invoice Document ── */}
      <InvoiceDocument invoice={invoice} companyName={companyName} />
    </>
  )
}
