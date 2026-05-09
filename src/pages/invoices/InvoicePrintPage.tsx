import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices'
import type { InvoiceLrItem } from '@/types'

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

  const inrParts: string[] = []
  const crore = Math.floor(rupees / 10000000)
  const lakh  = Math.floor((rupees % 10000000) / 100000)
  const thous = Math.floor((rupees % 100000) / 1000)
  const rem   = rupees % 1000

  if (crore) inrParts.push(wordsUnder1000(crore) + ' Crore')
  if (lakh)  inrParts.push(wordsUnder1000(lakh) + ' Lakh')
  if (thous) inrParts.push(wordsUnder1000(thous) + ' Thousand')
  if (rem)   inrParts.push(wordsUnder1000(rem))

  let result = 'INR ' + (inrParts.join(' ') || 'Zero')
  if (paise) result += ` and ${wordsUnder1000(paise)} Paise`
  return result + ' Only'
}

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt     = (n: number | undefined | null) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// cell style helpers
const th = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '6px 8px', background: '#1e3a5f', color: '#fff',
  fontSize: 11, fontWeight: 600, textAlign: 'left', borderRight: '1px solid #2d4f7a', ...extra,
})
const td = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '5px 8px', fontSize: 12, borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #e5e7eb', verticalAlign: 'top', ...extra,
})

// ── Print Page ────────────────────────────────────────────────────────────
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

  const lrItems      = invoice.lrItems ?? []
  const hasTax       = Number(invoice.taxAmount) > 0
  const cgstPct      = Number(invoice.cgstPercentage ?? 0)
  const sgstPct      = Number(invoice.sgstPercentage ?? 0)
  const cgstAmt      = Number(invoice.cgstAmount ?? 0)
  const sgstAmt      = Number(invoice.sgstAmount ?? 0)
  const totalAmt     = Number(invoice.totalAmount ?? 0)
  const subtotal     = Number(invoice.subtotal ?? 0)
  const hsn          = invoice.transportHsnSac || '996791'

  // Calculate round off: difference between displayed total and raw total
  const rawTotal    = subtotal + cgstAmt + sgstAmt
  const roundOff    = totalAmt - rawTotal

  // Group taxable value by HSN for the tax table
  const totalFreight = lrItems.reduce((s, i) => s + Number(i.freightAmount ?? 0), 0)
  const totalCharges = lrItems.reduce((s, i) => s + Number(i.chargesAmount ?? 0), 0)
  const totalFines   = lrItems.reduce((s, i) => s + Number(i.checkpostFineAmount ?? 0), 0)
  const taxableValue = totalFreight + totalCharges + totalFines // = subtotal

  // Client address block
  const clientAddrParts = [
    invoice.clientAddress,
    invoice.clientCity,
    [invoice.clientState, invoice.clientPincode].filter(Boolean).join(' - '),
  ].filter(Boolean).join(', ')

  // Tenant address block
  const tenantAddrParts = [
    invoice.tenantAddress,
    invoice.tenantCity,
    [invoice.tenantState, invoice.tenantPincode].filter(Boolean).join(' - '),
  ].filter(Boolean).join(', ')

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; background: #fff; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>

      {/* Print toolbar */}
      <div className="no-print" style={{ padding: '10px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', gap: 10 }}>
        <button onClick={() => window.print()} style={{ background: '#1e3a5f', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Print / Save as PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#fff', color: '#555', border: '1px solid #d1d5db', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          Close
        </button>
      </div>

      {/* ── Invoice ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 28px' }}>

        {/* ── Header ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
          <tbody>
            <tr>
              {/* Left: company */}
              <td style={{ width: '55%', verticalAlign: 'top', paddingRight: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  {invoice.tenantLogoUrl && (
                    <img
                      src={invoice.tenantLogoUrl}
                      alt="logo"
                      style={{ height: 56, maxWidth: 120, objectFit: 'contain' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {invoice.tenantCompanyName || ''}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#333', lineHeight: 1.6 }}>
                  {tenantAddrParts && <div>{tenantAddrParts}</div>}
                  {invoice.tenantGstin && <div><strong>GSTIN/UIN:</strong> {invoice.tenantGstin}</div>}
                  {invoice.tenantState && <div>State Name: {invoice.tenantState}</div>}
                </div>
              </td>
              {/* Right: title + invoice details */}
              <td style={{ width: '45%', verticalAlign: 'top' }}>
                <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                  Tax Invoice
                </div>
                {/* Invoice meta table */}
                <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600, width: '40%' }}>Invoice No.</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 700 }}>{invoice.invoiceNumber}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600 }}>Dated</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 700 }}>{fmtDate(invoice.invoiceDate)}</td>
                    </tr>
                    {invoice.dueDate && (
                      <tr>
                        <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600 }}>Due Date</td>
                        <td style={{ padding: '4px 6px', border: '1px solid #333' }}>{fmtDate(invoice.dueDate)}</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: '4px 6px', border: '1px solid #333', fontWeight: 600 }}>Mode of Payment</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #333' }}></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Consignee / Buyer ── */}
        <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', marginTop: 6, fontSize: 11 }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', width: '50%', verticalAlign: 'top', borderRight: '1px solid #333' }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Consignee (Ship to)</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{invoice.clientName}</div>
                {clientAddrParts && <div style={{ marginTop: 2 }}>{clientAddrParts}</div>}
                {invoice.clientGstin && <div><strong>GSTIN/UIN:</strong> {invoice.clientGstin}</div>}
                {invoice.clientState && <div>State Name: {invoice.clientState}</div>}
              </td>
              <td style={{ padding: '4px 8px', width: '50%', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Buyer (Bill to)</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{invoice.clientName}</div>
                {clientAddrParts && <div style={{ marginTop: 2 }}>{clientAddrParts}</div>}
                {invoice.clientGstin && <div><strong>GSTIN/UIN:</strong> {invoice.clientGstin}</div>}
                {invoice.clientState && <div>State Name: {invoice.clientState}</div>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Line Items ── */}
        <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', marginTop: 6 }}>
          <thead>
            <tr>
              <th style={th({ width: 28 })}>SI</th>
              <th style={th()}>Description of Services</th>
              <th style={th({ width: 70 })}>HSN/SAC</th>
              <th style={th({ width: 80, textAlign: 'right' })}>Quantity</th>
              <th style={th({ width: 80, textAlign: 'right' })}>Rate</th>
              <th style={th({ width: 50 })}>Per</th>
              <th style={th({ width: 100, textAlign: 'right' })}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {lrItems.map((item: InvoiceLrItem, i: number) => (
              <>
                {/* Freight row */}
                <tr key={`lr-${item.id}-freight`}>
                  <td style={td({ textAlign: 'center' })}>{i + 1}</td>
                  <td style={td()}>
                    <div style={{ fontWeight: 600 }}>GOODS TRANSPORTATION CHARGES</div>
                    <div style={{ fontSize: 11, color: '#555' }}>
                      LR: {item.lrNumber} · Vehicle: {item.vehicleRegistrationNumber}
                      {item.lrDate ? ` · ${fmtDate(item.lrDate)}` : ''}
                    </div>
                  </td>
                  <td style={td({ textAlign: 'center' })}>{hsn}</td>
                  <td style={td({ textAlign: 'right' })}>
                    {item.billingWeight != null ? `${Number(item.billingWeight).toFixed(3)} MT` : '—'}
                  </td>
                  <td style={td({ textAlign: 'right' })}>
                    {item.freightRateType === 'PER_TON' && item.freightRate != null
                      ? Number(item.freightRate).toFixed(2) : '—'}
                  </td>
                  <td style={td()}>
                    {item.freightRateType === 'PER_TON' ? 'MT'
                      : item.freightRateType === 'PER_KM' ? 'KM'
                      : item.freightRateType === 'PER_TRIP' ? 'Trip' : ''}
                  </td>
                  <td style={td({ textAlign: 'right', fontWeight: 600 })}>{fmt(item.freightAmount)}</td>
                </tr>
                {/* Charges row if any */}
                {Number(item.chargesAmount ?? 0) > 0 && (
                  <tr key={`lr-${item.id}-charges`}>
                    <td style={td({ textAlign: 'center' })}></td>
                    <td style={td({ paddingLeft: 20, fontStyle: 'italic', color: '#444' })}>Other Charges</td>
                    <td style={td({ textAlign: 'center' })}>997159</td>
                    <td style={td()} /><td style={td()} /><td style={td()} />
                    <td style={td({ textAlign: 'right' })}>{fmt(item.chargesAmount)}</td>
                  </tr>
                )}
                {/* Fines row if any */}
                {Number(item.checkpostFineAmount ?? 0) > 0 && (
                  <tr key={`lr-${item.id}-fines`}>
                    <td style={td({ textAlign: 'center' })}></td>
                    <td style={td({ paddingLeft: 20, fontStyle: 'italic', color: '#444' })}>Checkpost Fines</td>
                    <td style={td({ textAlign: 'center' })}>997159</td>
                    <td style={td()} /><td style={td()} /><td style={td()} />
                    <td style={td({ textAlign: 'right', color: '#b91c1c' })}>{fmt(item.checkpostFineAmount)}</td>
                  </tr>
                )}
              </>
            ))}

            {/* Blank rows for visual spacing */}
            {lrItems.length < 4 && Array.from({ length: 4 - lrItems.length }).map((_, i) => (
              <tr key={`blank-${i}`} style={{ height: 22 }}>
                <td style={td()} /><td style={td()} /><td style={td()} /><td style={td()} /><td style={td()} /><td style={td()} /><td style={td()} />
              </tr>
            ))}

            {/* Tax rows */}
            {hasTax && cgstPct > 0 && (
              <tr>
                <td style={td()} /><td style={{ ...td(), fontStyle: 'italic', fontWeight: 600 }}>CGST Output Tax @ {cgstPct}%</td>
                <td style={td()} /><td style={td()} />
                <td style={{ ...td(), textAlign: 'right' }}>{cgstPct}</td>
                <td style={td()}>%</td>
                <td style={{ ...td(), textAlign: 'right', fontWeight: 600 }}>{fmt(cgstAmt)}</td>
              </tr>
            )}
            {hasTax && sgstPct > 0 && (
              <tr>
                <td style={td()} /><td style={{ ...td(), fontStyle: 'italic', fontWeight: 600 }}>SGST Output Tax @ {sgstPct}%</td>
                <td style={td()} /><td style={td()} />
                <td style={{ ...td(), textAlign: 'right' }}>{sgstPct}</td>
                <td style={td()}>%</td>
                <td style={{ ...td(), textAlign: 'right', fontWeight: 600 }}>{fmt(sgstAmt)}</td>
              </tr>
            )}
            {Math.abs(roundOff) >= 0.01 && (
              <tr>
                <td style={td()} />
                <td style={{ ...td(), fontStyle: 'italic' }}>Round Off</td>
                <td style={td()} /><td style={td()} /><td style={td()} /><td style={td()} />
                <td style={{ ...td(), textAlign: 'right' }}>{roundOff > 0 ? '+' : ''}{fmt(Math.abs(roundOff))}</td>
              </tr>
            )}

            {/* Total row */}
            <tr style={{ background: '#f0f4ff' }}>
              <td style={{ ...td(), fontWeight: 700, borderTop: '2px solid #1e3a5f' }} colSpan={3}>Total</td>
              <td style={{ ...td(), textAlign: 'right', fontWeight: 700, borderTop: '2px solid #1e3a5f' }}>
                {lrItems.reduce((s, i) => s + Number(i.billingWeight ?? 0), 0).toFixed(3)} MT
              </td>
              <td style={{ borderTop: '2px solid #1e3a5f', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }} />
              <td style={{ borderTop: '2px solid #1e3a5f', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }} />
              <td style={{ ...td(), textAlign: 'right', fontWeight: 700, fontSize: 14, borderTop: '2px solid #1e3a5f' }}>
                ₹ {fmt(totalAmt)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', fontSize: 11 }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', width: '60%', borderRight: '1px solid #333' }}>
                <span style={{ fontWeight: 600 }}>Amount Chargeable (in words)</span>
                <span style={{ float: 'right', fontStyle: 'italic' }}>E. &amp; O.E</span>
              </td>
              <td style={{ padding: '4px 8px' }}></td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px', fontWeight: 700, borderRight: '1px solid #333' }} colSpan={2}>
                {amountInWords(totalAmt)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* HSN / Tax breakdown table */}
        {hasTax && (
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
                <td style={{ padding: '4px 8px', border: '1px solid #333' }}>{hsn}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(taxableValue)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{cgstPct}%</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(cgstAmt)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{sgstPct}%</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(sgstAmt)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right', fontWeight: 700 }}>{fmt(cgstAmt + sgstAmt)}</td>
              </tr>
              <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                <td style={{ padding: '4px 8px', border: '1px solid #333' }}>Total</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(taxableValue)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333' }}></td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(cgstAmt)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333' }}></td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(sgstAmt)}</td>
                <td style={{ padding: '4px 8px', border: '1px solid #333', textAlign: 'right' }}>{fmt(cgstAmt + sgstAmt)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} style={{ padding: '4px 8px', border: '1px solid #333', fontWeight: 600 }}>
                  Tax Amount (in words): {amountInWords(cgstAmt + sgstAmt)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* ── Footer: Remarks + Bank + Declaration ── */}
        <table style={{ width: '100%', border: '1px solid #333', borderCollapse: 'collapse', borderTop: 'none', fontSize: 11 }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', width: '50%', verticalAlign: 'top', borderRight: '1px solid #333' }}>
                {invoice.remarks && (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>Remarks:</div>
                    <div style={{ color: '#333' }}>{invoice.remarks}</div>
                  </>
                )}
                {invoice.tenantPan && (
                  <div style={{ marginTop: 6 }}>
                    <strong>Company's PAN</strong> : {invoice.tenantPan}
                  </div>
                )}
                <div style={{ marginTop: 8, color: '#555', fontSize: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Declaration</div>
                  We declare that this invoice shows the actual price of the
                  goods described and that all particulars are true and correct.
                </div>
              </td>
              <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>
                {(invoice.tenantBankName || invoice.tenantAccountNumber) && (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Company's Bank Details</div>
                    {invoice.tenantBankName && (
                      <div><strong>Bank Name</strong> : {invoice.tenantBankName}</div>
                    )}
                    {invoice.tenantAccountHolderName && (
                      <div><strong>Account Name</strong> : {invoice.tenantAccountHolderName}</div>
                    )}
                    {invoice.tenantAccountNumber && (
                      <div><strong>A/c No.</strong> : {invoice.tenantAccountNumber}</div>
                    )}
                    {invoice.tenantIfscCode && (
                      <div><strong>IFS Code</strong> : {invoice.tenantIfscCode}</div>
                    )}
                    {invoice.tenantBranchName && (
                      <div><strong>Branch</strong> : {invoice.tenantBranchName}</div>
                    )}
                  </>
                )}
                <div style={{ marginTop: 20, textAlign: 'right', fontSize: 11 }}>
                  <div style={{ fontWeight: 700 }}>Authorised Signatory</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer note */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 10, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
          This is a Computer Generated Invoice
        </div>
      </div>
    </>
  )
}
