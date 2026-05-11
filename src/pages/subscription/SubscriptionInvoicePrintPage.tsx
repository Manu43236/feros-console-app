import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { subscriptionsApi } from '@/api/superadmin'
import type { SubscriptionInvoice } from '@/types'

// ── Amount in words ───────────────────────────────────────────────────────
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

const fmt     = (n?: number | null) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function billingCycleLabel(cycle?: string | null) {
  const map: Record<string, string> = {
    MONTHLY: 'Monthly', THREE_MONTHS: '3 Months', SIX_MONTHS: '6 Months', YEARLY: 'Annual (12 Months)',
  }
  return cycle ? (map[cycle] ?? cycle) : '—'
}

// cell style helpers
const thStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '6px 8px', background: '#1e3a5f', color: '#fff',
  fontSize: 11, fontWeight: 600, textAlign: 'left', borderRight: '1px solid #2d4f7a', ...extra,
})
const tdStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '5px 8px', fontSize: 12, borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #e5e7eb', verticalAlign: 'top', ...extra,
})

// ── FEROS company details (vendor side of subscription invoice) ───────────
const FEROS = {
  name:    'FEROS Platform Pvt. Ltd.',
  address: 'Technology Hub, Bangalore, Karnataka - 560001',
  gstin:   'Applicable',
  hsn:     '998315', // Cloud/SaaS subscription services
  state:   'Karnataka',
}

// ── Invoice Document ──────────────────────────────────────────────────────
function SubscriptionInvoiceDocument({ inv }: { inv: SubscriptionInvoice }) {
  const subtotal   = Number(inv.amount ?? 0)
  const gstAmt     = Number(inv.gstAmount ?? 0)
  const totalAmt   = Number(inv.totalAmount ?? 0)
  const cgst       = gstAmt / 2
  const sgst       = gstAmt / 2

  const tenantAddr = [
    inv.tenantAddress,
    inv.tenantCity,
    [inv.tenantState, inv.tenantPincode].filter(Boolean).join(' - '),
  ].filter(Boolean).join(', ')

  const invoiceDate = inv.createdAt
    ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 28px', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#111' }}>

      {/* ── Header ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
        <tbody>
          <tr>
            {/* Left: FEROS (vendor) */}
            <td style={{ width: '55%', verticalAlign: 'top', paddingRight: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                {FEROS.name}
              </div>
              <div style={{ fontSize: 11, color: '#333', lineHeight: 1.6 }}>
                <div>{FEROS.address}</div>
                <div><strong>GSTIN/UIN:</strong> {FEROS.gstin}</div>
                <div>State Name: {FEROS.state}</div>
              </div>
            </td>
            {/* Right: invoice meta */}
            <td style={{ width: '45%', verticalAlign: 'top' }}>
              <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                Tax Invoice
              </div>
              <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600, width: '40%' }}>Invoice No.</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 700 }}>{inv.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600 }}>Dated</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 700 }}>{invoiceDate}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600 }}>Billing Cycle</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #333' }}>{billingCycleLabel(inv.billingCycle)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600 }}>Period</td>
                    <td style={{ padding: '4px 6px', border: '1px solid #333' }}>{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd ?? null)}</td>
                  </tr>
                  {inv.paymentRef && (
                    <tr>
                      <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600 }}>Payment Ref</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #333' }}>{inv.paymentRef}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Bill To ── */}
      <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={thStyle()}>Bill To</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '6px 8px', fontSize: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{inv.companyName}</div>
              {tenantAddr && <div style={{ color: '#333' }}>{tenantAddr}</div>}
              {inv.tenantGstin && <div style={{ marginTop: 2 }}><strong>GSTIN:</strong> {inv.tenantGstin}</div>}
              {inv.tenantState && <div>State Name: {inv.tenantState}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Service Line Items ── */}
      <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={thStyle({ width: 40, textAlign: 'center' })}>#</th>
            <th style={thStyle()}>Description of Service</th>
            <th style={thStyle({ width: 80, textAlign: 'center' })}>HSN/SAC</th>
            <th style={thStyle({ width: 80, textAlign: 'center' })}>Qty</th>
            <th style={thStyle({ width: 80, textAlign: 'right' })}>Rate (₹)</th>
            <th style={thStyle({ width: 80, textAlign: 'right', borderRight: 'none' })}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle({ textAlign: 'center' })}>1</td>
            <td style={tdStyle()}>
              <div style={{ fontWeight: 600 }}>
                FEROS Platform Subscription — {inv.planName ?? 'Plan'}
              </div>
              <div style={{ color: '#555', marginTop: 2 }}>
                {billingCycleLabel(inv.billingCycle)} · {fmtDate(inv.periodStart)} to {fmtDate(inv.periodEnd ?? null)}
              </div>
              {inv.vehicleCount && inv.pricePerVehicle && (
                <div style={{ color: '#555', marginTop: 1 }}>
                  {inv.vehicleCount} vehicles × ₹{fmt(inv.pricePerVehicle)}/vehicle
                </div>
              )}
            </td>
            <td style={tdStyle({ textAlign: 'center' })}>{FEROS.hsn}</td>
            <td style={tdStyle({ textAlign: 'center' })}>1</td>
            <td style={tdStyle({ textAlign: 'right' })}>{fmt(subtotal)}</td>
            <td style={tdStyle({ textAlign: 'right', borderRight: 'none' })}>{fmt(subtotal)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr style={{ background: '#f9fafb' }}>
            <td colSpan={5} style={{ padding: '5px 8px', fontWeight: 600, textAlign: 'right', borderTop: '1px solid #e5e7eb', fontSize: 11 }}>
              Sub Total
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', borderTop: '1px solid #e5e7eb', fontWeight: 600, fontSize: 11, borderLeft: '1px solid #e5e7eb' }}>
              {fmt(subtotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Amount in Words ── */}
      <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ padding: '4px 8px', borderRight: '1px solid #333', width: '60%' }}>
              <span style={{ fontWeight: 600 }}>Amount Chargeable (in words)</span>
              <span style={{ float: 'right', fontStyle: 'italic' }}>E. &amp; O.E</span>
            </td>
            <td style={{ padding: '4px 8px' }}></td>
          </tr>
          <tr>
            <td colSpan={2} style={{ padding: '4px 8px', fontWeight: 700 }}>
              {amountInWords(totalAmt)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── GST Breakdown ── */}
      <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f0f4ff' }}>
            <th style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'left' }}>HSN/SAC</th>
            <th style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>Taxable Value</th>
            <th style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>CGST Rate</th>
            <th style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>CGST Amount</th>
            <th style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>SGST Rate</th>
            <th style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>SGST Amount</th>
            <th style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>Total Tax</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '4px 8px', border: '1px solid #333' }}>{FEROS.hsn}</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(subtotal)}</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>9%</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(cgst)}</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>9%</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(sgst)}</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right', fontWeight: 700 }}>{fmt(gstAmt)}</td>
          </tr>
          <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
            <td style={{ padding: '4px 8px', border: '1px solid #333' }}>Total</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(subtotal)}</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333' }}></td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(cgst)}</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333' }}></td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(sgst)}</td>
            <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(gstAmt)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} style={{ padding: '4px 8px', border: '1px solid #333', fontStyle: 'italic' }}>
              Tax Amount (in words): {amountInWords(gstAmt)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Total & Signature ── */}
      <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ padding: '6px 8px', width: '50%', verticalAlign: 'top', borderRight: '1px solid #333' }}>
              <div style={{ marginTop: 4, color: '#555', fontSize: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Declaration</div>
                We declare that this invoice shows the actual price of the services
                described and that all particulars are true and correct.
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: '#555' }}>
                GST paid is claimable as Input Tax Credit (ITC) for GST-registered businesses.
              </div>
            </td>
            <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
              <div style={{ textAlign: 'right', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Total Amount: ₹{fmt(totalAmt)}</div>
              </div>
              <div style={{ marginTop: 24, textAlign: 'right', fontSize: 11 }}>
                <div style={{ marginBottom: 2 }}>For {FEROS.name}</div>
                <div style={{ marginTop: 28, fontWeight: 700 }}>Authorised Signatory</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 10, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
        This is a Computer Generated Invoice
      </div>
    </div>
  )
}

// ── Print Page ────────────────────────────────────────────────────────────
export function SubscriptionInvoicePrintPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const id = parseInt(invoiceId!)

  const { data: inv, isLoading } = useQuery({
    queryKey: ['sub-invoice', id],
    queryFn:  () => subscriptionsApi.getMyInvoice(id).then(r => r.data),
    enabled:  !isNaN(id),
  })

  useEffect(() => {
    if (inv) {
      document.title = `Subscription Invoice ${inv.invoiceNumber}`
      setTimeout(() => window.print(), 500)
    }
  }, [inv])

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial' }}>Loading…</div>
  if (!inv)      return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial' }}>Invoice not found.</div>

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          @page { margin: 10mm; size: A4; }
        }
        body { background: #fff; }
      `}</style>
      <SubscriptionInvoiceDocument inv={inv} />
    </>
  )
}
