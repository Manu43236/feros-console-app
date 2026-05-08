import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { invoicesApi } from '@/api/invoices'

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
      setTimeout(() => window.print(), 400)
    }
  }, [invoice])

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>
  if (!invoice)  return <div style={{ padding: 40, textAlign: 'center' }}>Invoice not found.</div>

  const lrItems = invoice.lrItems ?? []
  const fmt     = (n: unknown) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          @page { margin: 15mm; size: A4; }
        }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; }
      `}</style>

      {/* Print button — hidden during actual print */}
      <div className="no-print" style={{ padding: '12px 20px', borderBottom: '1px solid #eee', background: '#f9fafb' }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#1e3a5f', color: '#fff', border: 'none',
            padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{
            marginLeft: 10, background: '#fff', color: '#555', border: '1px solid #ddd',
            padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Close
        </button>
      </div>

      {/* Invoice */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a5f', letterSpacing: 1 }}>INVOICE</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{invoice.invoiceNumber}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#555', lineHeight: 1.8 }}>
            <div><strong>Invoice Date:</strong> {fmtDate(invoice.invoiceDate)}</div>
            <div><strong>Due Date:</strong> {fmtDate(invoice.dueDate)}</div>
            <div style={{ marginTop: 4 }}>
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: invoice.invoiceStatus === 'PAID' ? '#dcfce7' : invoice.invoiceStatus === 'OVERDUE' ? '#fee2e2' : '#dbeafe',
                color: invoice.invoiceStatus === 'PAID' ? '#166534' : invoice.invoiceStatus === 'OVERDUE' ? '#991b1b' : '#1e40af',
              }}>
                {invoice.invoiceStatus.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Bill To</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{invoice.clientName}</div>
        </div>

        {/* LR Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>LR #</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Vehicle</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Order #</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Freight</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Charges</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Fines</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lrItems.map((item, i) => (
              <tr key={item.id ?? i} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 10px' }}>{item.lrNumber}</td>
                <td style={{ padding: '7px 10px', color: '#555' }}>{item.vehicleRegistrationNumber}</td>
                <td style={{ padding: '7px 10px', color: '#555' }}>{item.orderNumber}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>₹{fmt(item.freightAmount)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#555' }}>
                  {Number(item.chargesAmount) > 0 ? `₹${fmt(item.chargesAmount)}` : '—'}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: '#b91c1c' }}>
                  {Number(item.checkpostFineAmount) > 0 ? `₹${fmt(item.checkpostFineAmount)}` : '—'}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>₹{fmt(item.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
          <table style={{ fontSize: 13, borderCollapse: 'collapse', minWidth: 260 }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 12px', color: '#555' }}>Subtotal</td>
                <td style={{ padding: '4px 12px', textAlign: 'right' }}>₹{fmt(invoice.subtotal)}</td>
              </tr>
              {Number(invoice.taxAmount) > 0 && (
                <tr>
                  <td style={{ padding: '4px 12px', color: '#555' }}>Tax</td>
                  <td style={{ padding: '4px 12px', textAlign: 'right' }}>₹{fmt(invoice.taxAmount)}</td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid #1e3a5f' }}>
                <td style={{ padding: '6px 12px', fontWeight: 700 }}>Total Amount</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700 }}>₹{fmt(invoice.totalAmount)}</td>
              </tr>
              {Number(invoice.amountPaid) > 0 && (
                <tr>
                  <td style={{ padding: '4px 12px', color: '#16a34a' }}>Amount Paid</td>
                  <td style={{ padding: '4px 12px', textAlign: 'right', color: '#16a34a' }}>— ₹{fmt(invoice.amountPaid)}</td>
                </tr>
              )}
              <tr style={{ background: Number(invoice.balanceDue) > 0 ? '#fee2e2' : '#dcfce7' }}>
                <td style={{ padding: '6px 12px', fontWeight: 700 }}>Balance Due</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: Number(invoice.balanceDue) > 0 ? '#b91c1c' : '#166534' }}>
                  ₹{fmt(invoice.balanceDue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Remarks */}
        {invoice.remarks && (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, color: '#555', fontSize: 12 }}>
            <strong>Remarks:</strong> {invoice.remarks}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, borderTop: '1px solid #e5e7eb', paddingTop: 12, fontSize: 11, color: '#999', textAlign: 'center' }}>
          Generated by FEROS · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </>
  )
}
