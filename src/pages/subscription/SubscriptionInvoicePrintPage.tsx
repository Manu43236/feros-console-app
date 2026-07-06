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

// ── MandM Technologies company details (vendor side of subscription invoice) ─
const FEROS = {
  name:    'MandM Technologies',
  address: '2nd Floor, Dwaraka Meadows, Madhurawada, Visakhapatnam, Andhra Pradesh',
  pan:     'ACHFM8981H',
  gstin:   'Applicable',
  hsn:     '998315', // Cloud/SaaS subscription services
  state:   'Andhra Pradesh',
}

// ── Invoice Document ──────────────────────────────────────────────────────
function SubscriptionInvoiceDocument({ inv }: { inv: SubscriptionInvoice }) {
  const subtotal      = Number(inv.amount ?? 0)
  const installation  = Number(inv.installationCharges ?? 0)
  const gstAmt        = Number(inv.gstAmount ?? 0)
  const totalAmt      = Number(inv.totalAmount ?? 0)
  const taxableTotal  = subtotal + installation

  // Intra-state (AP → AP): CGST 9% + SGST 9%
  // Inter-state (AP → other): IGST 18%
  const isIntraState  = (inv.tenantState ?? '').toLowerCase() === FEROS.state.toLowerCase()
  const cgst          = isIntraState ? gstAmt / 2 : 0
  const sgst          = isIntraState ? gstAmt / 2 : 0
  const igst          = isIntraState ? 0 : gstAmt

  // Per-line tax amounts (for display on each row)
  const GST_RATE = 0.18
  const line1Tax  = subtotal * GST_RATE
  const line2Tax  = installation * GST_RATE

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
              <div style={{
                background: '#1e3a5f', color: '#fff',
                padding: '8px 12px', borderRadius: 4, marginBottom: 6,
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {FEROS.name}
                </div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>FEROS Fleet Management Platform</div>
              </div>
              <div style={{ fontSize: 11, color: '#333', lineHeight: 1.7, paddingLeft: 2 }}>
                <div>{FEROS.address}</div>
                <div><strong>PAN:</strong> {FEROS.pan}</div>
                <div><strong>GSTIN/UIN:</strong> {FEROS.gstin}</div>
                <div><strong>State:</strong> {FEROS.state}</div>
              </div>
            </td>
            {/* Right: invoice meta */}
            <td style={{ width: '45%', verticalAlign: 'top' }}>
              <div style={{
                textAlign: 'center', fontSize: 16, fontWeight: 700,
                marginBottom: 8, letterSpacing: 2, textTransform: 'uppercase',
                color: '#1e3a5f', borderBottom: '2px solid #1e3a5f', paddingBottom: 6,
              }}>
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
      <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={thStyle({ width: 28, textAlign: 'center' })}>#</th>
            <th style={thStyle()}>Description of Service</th>
            <th style={thStyle({ width: 58, textAlign: 'center' })}>HSN/SAC</th>
            <th style={thStyle({ width: 30, textAlign: 'center' })}>Qty</th>
            <th style={thStyle({ width: 90, textAlign: 'right' })}>Taxable (₹)</th>
            {isIntraState ? (
              <>
                <th style={thStyle({ width: 72, textAlign: 'right' })}>CGST @9%</th>
                <th style={thStyle({ width: 72, textAlign: 'right' })}>SGST @9%</th>
              </>
            ) : (
              <th style={thStyle({ width: 90, textAlign: 'right' })}>IGST @18%</th>
            )}
            <th style={thStyle({ width: 90, textAlign: 'right', borderRight: 'none' })}>Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {/* Line 1 — Subscription */}
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
            {isIntraState ? (
              <>
                <td style={tdStyle({ textAlign: 'right' })}>{fmt(line1Tax / 2)}</td>
                <td style={tdStyle({ textAlign: 'right' })}>{fmt(line1Tax / 2)}</td>
              </>
            ) : (
              <td style={tdStyle({ textAlign: 'right' })}>{fmt(line1Tax)}</td>
            )}
            <td style={tdStyle({ textAlign: 'right', borderRight: 'none' })}>{fmt(subtotal + line1Tax)}</td>
          </tr>
          {/* Line 2 — Installation (optional) */}
          {installation > 0 && (
            <tr>
              <td style={tdStyle({ textAlign: 'center' })}>2</td>
              <td style={tdStyle()}>
                <div style={{ fontWeight: 600 }}>Installation / Onboarding Charges</div>
                <div style={{ color: '#555', marginTop: 2 }}>One-time setup fee</div>
              </td>
              <td style={tdStyle({ textAlign: 'center' })}>{FEROS.hsn}</td>
              <td style={tdStyle({ textAlign: 'center' })}>1</td>
              <td style={tdStyle({ textAlign: 'right' })}>{fmt(installation)}</td>
              {isIntraState ? (
                <>
                  <td style={tdStyle({ textAlign: 'right' })}>{fmt(line2Tax / 2)}</td>
                  <td style={tdStyle({ textAlign: 'right' })}>{fmt(line2Tax / 2)}</td>
                </>
              ) : (
                <td style={tdStyle({ textAlign: 'right' })}>{fmt(line2Tax)}</td>
              )}
              <td style={tdStyle({ textAlign: 'right', borderRight: 'none' })}>{fmt(installation + line2Tax)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
            <td colSpan={4} style={{ padding: '5px 8px', textAlign: 'right', borderTop: '1px solid #ccc', fontSize: 11 }}>
              Total
            </td>
            <td style={{ padding: '5px 8px', textAlign: 'right', borderTop: '1px solid #ccc', borderLeft: '1px solid #e5e7eb' }}>{fmt(taxableTotal)}</td>
            {isIntraState ? (
              <>
                <td style={{ padding: '5px 8px', textAlign: 'right', borderTop: '1px solid #ccc', borderLeft: '1px solid #e5e7eb' }}>{fmt(cgst)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', borderTop: '1px solid #ccc', borderLeft: '1px solid #e5e7eb' }}>{fmt(sgst)}</td>
              </>
            ) : (
              <td style={{ padding: '5px 8px', textAlign: 'right', borderTop: '1px solid #ccc', borderLeft: '1px solid #e5e7eb' }}>{fmt(igst)}</td>
            )}
            <td style={{ padding: '5px 8px', textAlign: 'right', borderTop: '1px solid #ccc', borderLeft: '1px solid #e5e7eb' }}>{fmt(totalAmt)}</td>
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
