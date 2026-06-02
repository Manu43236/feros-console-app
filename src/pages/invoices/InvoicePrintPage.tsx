import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices'
import type { InvoiceLrItem } from '@/types'

// ── Amount in words ───────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | undefined | null) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// Border style shorthand
const B = '1px solid #000'

// ── Shared Invoice Document ───────────────────────────────────────────────────
export function InvoiceDocument({ invoice }: { invoice: import('@/types').Invoice }) {
  const lrItems   = invoice.lrItems ?? []
  const subtotal  = Number(invoice.subtotal  ?? 0)
  const totalAmt  = Number(invoice.totalAmount ?? 0)
  const taxAmt    = Number(invoice.taxAmount ?? 0)
  const cgstPct   = Number(invoice.cgstPercentage ?? 0)
  const sgstPct   = Number(invoice.sgstPercentage ?? 0)
  const igstPct   = Number(invoice.igstPercentage ?? 0)
  const cgstAmt   = Number(invoice.cgstAmount ?? 0)
  const sgstAmt   = Number(invoice.sgstAmount ?? 0)
  const igstAmt   = Number(invoice.igstAmount ?? 0)
  const rawTotal  = subtotal + taxAmt
  const roundOff  = totalAmt - rawTotal
  const hsn       = invoice.transportHsnSac || '996511'

  const totalTrips = lrItems.length
  const totalQty   = lrItems.reduce((s, i) => s + Number(i.billingWeight ?? 0), 0)

  // Group summary rows by freight rate (one line per rate)
  const rateGroups = lrItems.reduce<Record<string, { trips: number; qty: number; amount: number; rate: number }>>((acc, item) => {
    const rate = Number(item.freightRate ?? 0)
    const key  = String(rate)
    if (!acc[key]) acc[key] = { trips: 0, qty: 0, amount: 0, rate }
    acc[key].trips  += 1
    acc[key].qty    += Number(item.billingWeight ?? 0)
    acc[key].amount += Number(item.freightAmount ?? 0)
    return acc
  }, {})
  const summaryRows = Object.values(rateGroups)

  // Group annexure rows by date
  const dateGroups: Record<string, InvoiceLrItem[]> = {}
  lrItems.forEach(item => {
    const d = item.lrDate ? new Date(item.lrDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
    if (!dateGroups[d]) dateGroups[d] = []
    dateGroups[d].push(item)
  })

  const cell = (style?: React.CSSProperties): React.CSSProperties => ({
    border: B, padding: '4px 6px', fontSize: 11, ...style,
  })

  const tenantAddr = [invoice.tenantAddress, invoice.tenantCity,
    [invoice.tenantState, invoice.tenantPincode].filter(Boolean).join(' - ')
  ].filter(Boolean).join(', ')

  const clientAddr = [invoice.clientAddress, invoice.clientCity,
    [invoice.clientState, invoice.clientPincode].filter(Boolean).join(' - ')
  ].filter(Boolean).join(', ')

  // Description: tenant master > remarks > fallback
  const description = invoice.tenantInvoiceDescription || invoice.remarks || 'Goods Transportation Services'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000' }}>

      {/* ══════════════════════════════════════════════════════════════════
          PAGE 1 — TAX INVOICE
      ══════════════════════════════════════════════════════════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: B }}>
        <tbody>

          {/* ── Company Header ── */}
          <tr>
            <td colSpan={2} style={{ ...cell(), textAlign: 'center', padding: '10px 8px', borderBottom: B }}>
              <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {invoice.tenantCompanyName || ''}
              </div>
              {tenantAddr && (
                <div style={{ fontSize: 11, marginTop: 3 }}>ADD: {tenantAddr}</div>
              )}
              <div style={{ fontSize: 11, marginTop: 2 }}>
                Mob No:- &nbsp;&nbsp; E-mail:-
              </div>
            </td>
          </tr>

          {/* ── TAX INVOICE title ── */}
          <tr>
            <td colSpan={2} style={{ ...cell(), textAlign: 'center', fontWeight: 700, fontSize: 14, padding: '5px 8px', borderBottom: B }}>
              TAX INVOICE
            </td>
          </tr>

          {/* ── TO (client) left + Bill details right ── */}
          <tr>
            {/* LEFT: client */}
            <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderRight: B, borderBottom: B, padding: '6px 8px' }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>TO,</div>
              <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>{invoice.clientName}</div>
              {clientAddr && <div style={{ marginTop: 2 }}>{clientAddr}</div>}
              {invoice.clientGstin && <div style={{ marginTop: 2 }}><strong>GST NO: </strong>{invoice.clientGstin}</div>}
            </td>
            {/* RIGHT: bill details */}
            <td style={{ ...cell(), width: '50%', verticalAlign: 'top', borderBottom: B, padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['BILL NO',     invoice.invoiceNumber],
                    ['DATE',        fmtDate(invoice.invoiceDate)],
                    ['GST NO',      invoice.tenantGstin ?? ''],
                    ['STATE',       invoice.tenantState ?? ''],
                    ['STATE CODE',  ''],
                    ['PAN NO',      invoice.tenantPan ?? ''],
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

          {/* ── Dispatch note ── */}
          {invoice.remarks && (
            <tr>
              <td colSpan={2} style={{ ...cell(), borderBottom: B, fontSize: 11 }}>
                {invoice.remarks}
              </td>
            </tr>
          )}

          {/* ── Line Items ── */}
          <tr>
            <td colSpan={2} style={{ padding: 0, border: B }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontWeight: 700 }}>
                    <th style={cell({ width: 36, textAlign: 'center' })}>S.No.</th>
                    <th style={cell()}>Description Of Goods/Service</th>
                    <th style={cell({ width: 52, textAlign: 'center' })}>Trips</th>
                    <th style={cell({ width: 64, textAlign: 'center' })}>HSN Code</th>
                    <th style={cell({ width: 90, textAlign: 'right' })}>Quantity(MT)</th>
                    <th style={cell({ width: 80, textAlign: 'right' })}>Rate/MT</th>
                    <th style={cell({ width: 90, textAlign: 'right' })}>Amount in Rs.</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, i) => (
                    <tr key={i} style={{ height: 80 }}>
                      <td style={cell({ textAlign: 'center', verticalAlign: 'middle' })}>{i + 1}</td>
                      <td style={cell({ verticalAlign: 'middle' })}>{description}</td>
                      <td style={cell({ textAlign: 'center', verticalAlign: 'middle' })}>{row.trips}</td>
                      <td style={cell({ textAlign: 'center', verticalAlign: 'middle' })}>{hsn}</td>
                      <td style={cell({ textAlign: 'right', verticalAlign: 'middle' })}>{row.qty.toFixed(3)}</td>
                      <td style={cell({ textAlign: 'right', verticalAlign: 'middle' })}>{fmt(row.rate)}</td>
                      <td style={cell({ textAlign: 'right', verticalAlign: 'middle' })}>{fmt(row.amount)}</td>
                    </tr>
                  ))}
                  {/* blank filler rows */}
                  {summaryRows.length < 2 && (
                    <tr style={{ height: 24 }}>
                      <td style={cell()} /><td style={cell()} /><td style={cell()} />
                      <td style={cell()} /><td style={cell()} /><td style={cell()} /><td style={cell()} />
                    </tr>
                  )}

                  {/* Sub Total */}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={2} style={cell({ textAlign: 'right' })}>Sub Total:</td>
                    <td style={cell({ textAlign: 'center' })}>{totalTrips}</td>
                    <td style={cell()} />
                    <td style={cell({ textAlign: 'right' })}>{totalQty.toFixed(3)}</td>
                    <td style={cell()} />
                    <td style={cell({ textAlign: 'right' })}>{fmt(subtotal)}</td>
                  </tr>

                  {/* Gross Total */}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={6} style={cell({ textAlign: 'right' })}>GROSS TOTAL</td>
                    <td style={cell({ textAlign: 'right' })}>{fmt(subtotal)}</td>
                  </tr>

                  {/* Tax — IGST (inter-state) */}
                  {igstPct > 0 && igstAmt > 0 && (
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={6} style={cell({ textAlign: 'right' })}>IGST {igstPct}%</td>
                      <td style={cell({ textAlign: 'right' })}>{fmt(igstAmt)}</td>
                    </tr>
                  )}
                  {/* Tax — CGST + SGST (intra-state) */}
                  {cgstPct > 0 && cgstAmt > 0 && (
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={6} style={cell({ textAlign: 'right' })}>CGST {cgstPct}%</td>
                      <td style={cell({ textAlign: 'right' })}>{fmt(cgstAmt)}</td>
                    </tr>
                  )}
                  {sgstPct > 0 && sgstAmt > 0 && (
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan={6} style={cell({ textAlign: 'right' })}>SGST {sgstPct}%</td>
                      <td style={cell({ textAlign: 'right' })}>{fmt(sgstAmt)}</td>
                    </tr>
                  )}

                  {/* Round Off */}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={6} style={cell({ textAlign: 'right' })}>ROUNDOFF({roundOff >= 0 ? '-/+' : '-/+'})</td>
                    <td style={cell({ textAlign: 'right' })}>{Math.abs(roundOff) < 0.01 ? '0.00' : fmt(Math.abs(roundOff))}</td>
                  </tr>

                  {/* Total Bill Amount */}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={6} style={cell({ textAlign: 'right' })}>TOTAL BILL AMOUNT</td>
                    <td style={cell({ textAlign: 'right', fontSize: 12 })}>{fmt(totalAmt)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ── Amount in words + Reverse charge ── */}
          <tr>
            <td colSpan={2} style={{ ...cell(), borderTop: B }}>
              <div style={{ fontWeight: 700 }}>
                {amountInWords(totalAmt)}
              </div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ ...cell(), borderTop: B, fontWeight: 600 }}>
              Whether the tax is payable on reverse charge basis: NO
            </td>
          </tr>

          {/* ── Bank Details + Signatory ── */}
          <tr>
            <td style={{ ...cell(), verticalAlign: 'top', borderRight: B, borderTop: B, padding: '8px' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Bank Details:</div>
              {invoice.tenantCompanyName && <div style={{ fontWeight: 700 }}>{invoice.tenantCompanyName}</div>}
              {invoice.tenantBankName     && <div>{invoice.tenantBankName}</div>}
              {invoice.tenantAccountNumber && <div>A/c No: {invoice.tenantAccountNumber}</div>}
              {invoice.tenantIfscCode     && <div>IFSC: {invoice.tenantIfscCode}</div>}
              {invoice.tenantBranchName   && <div>Branch: {invoice.tenantBranchName}</div>}
            </td>
            <td style={{ ...cell(), verticalAlign: 'top', borderTop: B, padding: '8px', textAlign: 'right' }}>
              <div style={{ fontSize: 11 }}>E &amp; OE</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>
                For {invoice.tenantCompanyName || ''}
              </div>
              <div style={{ marginTop: 40, fontWeight: 600 }}>Authorised Signatory</div>
            </td>
          </tr>

        </tbody>
      </table>

      {/* ══════════════════════════════════════════════════════════════════
          PAGE 2 — ANNEXURE
      ══════════════════════════════════════════════════════════════════ */}
      {lrItems.length > 0 && (
        <div className="annexure-page" style={{ marginTop: 32, pageBreakBefore: 'always', breakBefore: 'page' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: B }}>
            <tbody>

              {/* Title */}
              <tr>
                <td colSpan={7} style={{ ...cell(), textAlign: 'center', fontWeight: 700, fontSize: 15, padding: '8px' }}>
                  ANNEXURE
                </td>
              </tr>
              <tr>
                <td colSpan={7} style={{ ...cell(), textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
                  {invoice.tenantCompanyName || ''}
                </td>
              </tr>
              <tr>
                <td colSpan={7} style={{ ...cell(), textAlign: 'center', fontWeight: 700, fontSize: 12 }}>
                  {invoice.clientName}
                </td>
              </tr>

              {/* Header row */}
              <tr style={{ fontWeight: 700 }}>
                <th style={cell({ width: 36, textAlign: 'center' })}>S.No.</th>
                <th style={cell()}>Pass No</th>
                <th style={cell({ width: 90, textAlign: 'center' })}>Trip Date</th>
                <th style={cell({ width: 100, textAlign: 'center' })}>Vehicle No</th>
                <th style={cell({ width: 70, textAlign: 'right' })}>Rate</th>
                <th style={cell({ width: 90, textAlign: 'right' })}>Net Weight</th>
                <th style={cell({ width: 90, textAlign: 'right' })}>Bill Amount</th>
              </tr>

              {/* Rows grouped by date */}
              {(() => {
                let sno = 1
                const rows: React.ReactNode[] = []
                Object.entries(dateGroups).forEach(([date, items]) => {
                  items.forEach(item => {
                    rows.push(
                      <tr key={item.id}>
                        <td style={cell({ textAlign: 'center' })}>{sno++}</td>
                        <td style={cell()}>{item.lrNumber}</td>
                        <td style={cell({ textAlign: 'center' })}>{fmtDate(item.lrDate)}</td>
                        <td style={cell({ textAlign: 'center' })}>{item.vehicleRegistrationNumber}</td>
                        <td style={cell({ textAlign: 'right' })}>{fmt(item.freightRate)}</td>
                        <td style={cell({ textAlign: 'right' })}>{item.billingWeight != null ? Number(item.billingWeight).toFixed(3) : '—'}</td>
                        <td style={cell({ textAlign: 'right' })}>{fmt(item.freightAmount)}</td>
                      </tr>
                    )
                  })
                  // Date subtotal
                  const dateQty    = items.reduce((s, i) => s + Number(i.billingWeight ?? 0), 0)
                  const dateAmount = items.reduce((s, i) => s + Number(i.freightAmount  ?? 0), 0)
                  rows.push(
                    <tr key={`sub-${date}`} style={{ fontWeight: 700 }}>
                      <td colSpan={5} style={cell({ textAlign: 'right' })}>Total</td>
                      <td style={cell({ textAlign: 'right' })}>{dateQty.toFixed(3)}</td>
                      <td style={cell({ textAlign: 'right' })}>{fmt(dateAmount)}</td>
                    </tr>
                  )
                })
                return rows
              })()}

              {/* Grand Total */}
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={5} style={cell({ textAlign: 'right' })}>Grand Total</td>
                <td style={cell({ textAlign: 'right' })}>{totalQty.toFixed(3)}</td>
                <td style={cell({ textAlign: 'right' })}>{fmt(subtotal)}</td>
              </tr>

            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Print Page (standalone route) ─────────────────────────────────────────────
export function InvoicePrintPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const id = parseInt(invoiceId!)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn:  () => invoicesApi.getById(id).then(r => r.data),
    enabled:  !isNaN(id),
  })

  useEffect(() => {
    if (invoice) {
      document.title = `Invoice ${invoice.invoiceNumber}`
      setTimeout(() => window.print(), 500)
    }
  }, [invoice])

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial' }}>Loading…</div>
  if (!invoice)  return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial' }}>Invoice not found.</div>

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; background: #fff; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 8mm; size: A4; }
          .annexure-page { page-break-before: always !important; break-before: page !important; }
        }
      `}</style>
      <div className="no-print" style={{ padding: '10px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', gap: 10 }}>
        <button onClick={() => window.print()} style={{ background: '#1e3a5f', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Print / Save as PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#fff', color: '#555', border: '1px solid #d1d5db', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Close
        </button>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <InvoiceDocument invoice={invoice} />
      </div>
    </>
  )
}
