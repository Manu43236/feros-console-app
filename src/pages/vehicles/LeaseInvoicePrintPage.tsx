import { useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { leaseInvoicesApi } from '@/api/leaseInvoices'

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Print Page ────────────────────────────────────────────────────────────────
export function LeaseInvoicePrintPage() {
  const { id } = useParams<{ id: string }>()
  const printRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['lease-invoice-print', Number(id)],
    queryFn: () => leaseInvoicesApi.getById(Number(id)),
    enabled: !!id,
  })

  const inv = data?.data

  async function handleDownloadPdf() {
    if (!printRef.current) return
    const html2pdf = (await import('html2pdf.js')).default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      margin: 10,
      filename: `${inv?.invoiceNumber ?? 'lease-invoice'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }
    await html2pdf().set(opts).from(printRef.current).save()
  }

  if (isLoading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'Arial' }}>Loading…</div>
  )
  if (!inv) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'Arial' }}>Invoice not found</div>
  )

  const subtotal   = Number(inv.subtotal   ?? 0)
  const cgstPct    = Number(inv.cgstPercentage ?? 0)
  const sgstPct    = Number(inv.sgstPercentage ?? 0)
  const igstPct    = Number(inv.igstPercentage ?? 0)
  const cgstAmt    = Number(inv.cgstAmount  ?? 0)
  const sgstAmt    = Number(inv.sgstAmount  ?? 0)
  const igstAmt    = Number(inv.igstAmount  ?? 0)
  const total      = Number(inv.totalAmount ?? 0)
  const isIntra    = cgstPct > 0 || sgstPct > 0

  const billingLabel = inv.billingPeriodStart
    ? `${fmtDate(inv.billingPeriodStart)} to ${fmtDate(inv.billingPeriodEnd)}`
    : '—'

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px 0' }}>
      {/* Print toolbar — hidden on print */}
      <div style={{ maxWidth: 860, margin: '0 auto 12px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}
        className="print:hidden">
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Print
        </button>
        <button
          onClick={handleDownloadPdf}
          style={{ padding: '6px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Download PDF
        </button>
      </div>

      {/* Invoice document */}
      <div ref={printRef}>
        <div style={{ maxWidth: 860, margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000', padding: '16px', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: B }}>
            <tbody>

              {/* Company header */}
              <tr>
                <td colSpan={2} style={{ ...cell(), textAlign: 'center', padding: '10px 8px', borderBottom: B }}>
                  <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {inv.tenantName ?? ''}
                  </div>
                  {inv.tenantAddress && (
                    <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{inv.tenantAddress}</div>
                  )}
                  {(inv.tenantState || inv.tenantGstin) && (
                    <div style={{ fontSize: 10, color: '#555' }}>
                      {[inv.tenantState, inv.tenantGstin ? `GSTIN: ${inv.tenantGstin}` : null].filter(Boolean).join(' | ')}
                    </div>
                  )}
                </td>
              </tr>

              {/* Title */}
              <tr>
                <td colSpan={2} style={{ ...cell(), textAlign: 'center', fontWeight: 700, fontSize: 14, padding: '5px 8px', borderBottom: B }}>
                  VEHICLE LEASE INVOICE
                </td>
              </tr>

              {/* Client + Invoice details */}
              <tr>
                <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderRight: B, borderBottom: B, padding: '6px 8px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>TO,</div>
                  <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{inv.clientName}</div>
                  {inv.clientAddress && <div style={{ color: '#555', marginTop: 2 }}>{inv.clientAddress}</div>}
                  {inv.clientStateName && <div style={{ color: '#555' }}>State: {inv.clientStateName}</div>}
                  {inv.clientGstin && <div style={{ color: '#555' }}>GSTIN: {inv.clientGstin}</div>}
                </td>
                <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderBottom: B, padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {([
                        ['INVOICE NO',     inv.invoiceNumber],
                        ['DATE',           fmtDate(inv.invoiceDate)],
                        ['DUE DATE',       fmtDate(inv.dueDate)],
                        ['BILLING PERIOD', billingLabel],
                        ['LEASE NO',       inv.leaseNumber],
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
                        <th style={{ ...cell(), width: 28, textAlign: 'center' }}>#</th>
                        <th style={{ ...cell(), textAlign: 'left' }}>Description</th>
                        <th style={{ ...cell(), textAlign: 'right', width: 60 }}>Days</th>
                        <th style={{ ...cell(), textAlign: 'right', width: 100 }}>Rate (₹)</th>
                        <th style={{ ...cell(), textAlign: 'right', width: 110 }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.items.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ ...cell(), textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ ...cell() }}>{item.description ?? item.registrationNumber ?? '—'}</td>
                          <td style={{ ...cell(), textAlign: 'right' }}>{item.days ?? '—'}</td>
                          <td style={{ ...cell(), textAlign: 'right' }}>{item.rate != null ? fmt(item.rate) : '—'}</td>
                          <td style={{ ...cell(), textAlign: 'right' }}>{fmt(item.amount)}</td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - inv.items.length) }).map((_, i) => (
                        <tr key={`pad-${i}`}>
                          {[0,1,2,3,4].map(c => <td key={c} style={{ ...cell() }}>&nbsp;</td>)}
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
                  {inv.notes && (
                    <div style={{ marginTop: 8, fontSize: 10, color: '#555' }}>
                      <span style={{ fontWeight: 600 }}>Notes: </span>{inv.notes}
                    </div>
                  )}
                </td>
                <td style={{ ...cell(), padding: 0, verticalAlign: 'top' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ border: B, padding: '4px 8px' }}>Subtotal</td>
                        <td style={{ border: B, padding: '4px 8px', textAlign: 'right' }}>₹{fmt(subtotal)}</td>
                      </tr>
                      {isIntra && (cgstPct > 0 || sgstPct > 0) && <>
                        <tr>
                          <td style={{ border: B, padding: '4px 8px' }}>CGST {cgstPct}%</td>
                          <td style={{ border: B, padding: '4px 8px', textAlign: 'right' }}>₹{fmt(cgstAmt)}</td>
                        </tr>
                        <tr>
                          <td style={{ border: B, padding: '4px 8px' }}>SGST {sgstPct}%</td>
                          <td style={{ border: B, padding: '4px 8px', textAlign: 'right' }}>₹{fmt(sgstAmt)}</td>
                        </tr>
                      </>}
                      {!isIntra && igstPct > 0 && (
                        <tr>
                          <td style={{ border: B, padding: '4px 8px' }}>IGST {igstPct}%</td>
                          <td style={{ border: B, padding: '4px 8px', textAlign: 'right' }}>₹{fmt(igstAmt)}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ border: B, padding: '4px 8px', fontWeight: 700 }}>Total</td>
                        <td style={{ border: B, padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>₹{fmt(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* Signature */}
              <tr>
                <td colSpan={2} style={{ ...cell(), textAlign: 'right', padding: '24px 8px 8px' }}>
                  <div>For <strong>{inv.tenantName}</strong></div>
                  <div style={{ marginTop: 40, fontSize: 10 }}>Authorised Signatory</div>
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
