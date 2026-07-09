import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { leaseInvoicesApi } from '@/api/leaseInvoices'
import type { LeaseInvoice, LeaseInvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<LeaseInvoiceStatus, string> = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIALLY_PAID: 'Partially Paid', PAID: 'Paid', CANCELLED: 'Cancelled',
}
const STATUS_COLORS: Record<LeaseInvoiceStatus, string> = {
  DRAFT:          'bg-gray-100 text-gray-600',
  SENT:           'bg-blue-50 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700',
  PAID:           'bg-green-50 text-green-700',
  CANCELLED:      'bg-red-50 text-red-600',
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const fmt = (n: number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LeaseInvoicesPage() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['lease-invoices-all'],
    queryFn: () => leaseInvoicesApi.getAll(),
  })

  const invoices: LeaseInvoice[] = data?.data ?? []

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-feros-navy/80 rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-48 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Receipt size={140} />
        </div>
        <div className="relative px-6 py-5">
          <h1 className="text-2xl font-bold text-white">Lease Invoices</h1>
          <p className="text-blue-300 text-sm mt-1">All invoices across all vehicle leases</p>
        </div>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12 animate-pulse">Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          No lease invoices yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Lease #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: LeaseInvoice) => (
                <tr key={inv.id}
                  onClick={() => navigate(`/vehicles/leases/invoices/${inv.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-feros-navy whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{inv.leaseNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.clientName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {fmtDate(inv.billingPeriodStart)} → {fmtDate(inv.billingPeriodEnd)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[inv.status])}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{fmt(inv.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
