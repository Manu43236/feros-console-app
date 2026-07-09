import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Search, ExternalLink, CheckCircle2, Clock, Wrench,
  Receipt, FileText, AlertCircle,
} from 'lucide-react'
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { serviceInvoicesApi } from '@/api/serviceInvoices'
import type { ServiceInvoice } from '@/types'
import { cn } from '@/lib/utils'
import {
  MarkPaidDialog, UpdateVendorDialog, TypeBadge, StatusBadge, fmt, fmtDate, openPdfInTab,
} from './ServiceInvoiceDetail'

// ── Main page ─────────────────────────────────────────────────────────────────
const TYPE_FILTERS   = ['ALL', 'INTERNAL', 'EXTERNAL'] as const
const STATUS_FILTERS = ['ALL', 'PENDING', 'PAID'] as const

export function ServiceInvoicesPage() {
  const navigate = useNavigate()
  const [search,        setSearch]        = useState('')
  const [typeFilter,    setTypeFilter]    = useState<typeof TYPE_FILTERS[number]>('ALL')
  const [statusFilter,  setStatusFilter]  = useState<typeof STATUS_FILTERS[number]>('ALL')
  const [markPaidInv,   setMarkPaidInv]   = useState<ServiceInvoice | null>(null)
  const [vendorInv,     setVendorInv]     = useState<ServiceInvoice | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data: res, isLoading } = useQuery({
    queryKey: ['service-invoices'],
    queryFn:  serviceInvoicesApi.getAll,
  })

  const all = [...(res?.data ?? [])].sort((a, b) => b.id - a.id)

  const filtered = all.filter(inv => {
    const q = search.toLowerCase()
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.serviceNumber.toLowerCase().includes(q) ||
      inv.vehicleRegistrationNumber.toLowerCase().includes(q) ||
      (inv.vendorName?.toLowerCase().includes(q) ?? false)
    const matchType   = typeFilter   === 'ALL' || inv.invoiceType   === typeFilter
    const matchStatus = statusFilter === 'ALL' || inv.paymentStatus === statusFilter
    return matchSearch && matchType && matchStatus
  })

  // Stats
  const total    = all.length
  const internal = all.filter(i => i.invoiceType   === 'INTERNAL').length
  const external = all.filter(i => i.invoiceType   === 'EXTERNAL').length
  const pending  = all.filter(i => i.paymentStatus === 'PENDING').length
  const paid     = all.filter(i => i.paymentStatus === 'PAID').length

  async function handleViewPdf(inv: ServiceInvoice) {
    setDownloadingId(inv.id)
    try {
      const blob = await serviceInvoicesApi.downloadPdf(inv.id)
      openPdfInTab(blob)
    } catch {
      toast.error('Failed to load PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service Invoices</h1>
        <p className="text-gray-500 text-sm mt-0.5">{total} total service invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { icon: <Receipt size={16} className="text-gray-400" />,      label: 'Total',    value: total    },
          { icon: <Wrench  size={16} className="text-blue-400" />,       label: 'Internal', value: internal },
          { icon: <FileText size={16} className="text-purple-400" />,    label: 'External', value: external },
          { icon: <Clock   size={16} className="text-amber-400" />,      label: 'Pending',  value: pending, accent: pending > 0 },
          { icon: <CheckCircle2 size={16} className="text-green-400" />, label: 'Paid',     value: paid     },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              {card.icon}
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', card.accent ? 'text-amber-600' : 'text-gray-900')}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by invoice #, service #, vehicle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-80"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as typeof TYPE_FILTERS[number])}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="ALL">All Types</option>
          <option value="INTERNAL">Internal</option>
          <option value="EXTERNAL">External</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof STATUS_FILTERS[number])}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading service invoices…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <AlertCircle size={36} className="text-gray-200" />
            <p className="text-sm">
              {search || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No invoices match your filters'
                : 'No service invoices yet. They are created automatically when a service is completed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Service #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const amount = inv.invoiceType === 'INTERNAL' ? inv.totalAmount : inv.vendorAmount
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/service-invoices/${inv.id}`)}
                    >
                      <td className="py-3 px-4">
                        <p className="text-sm font-semibold text-feros-navy">{inv.invoiceNumber}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">{inv.serviceNumber}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{inv.vehicleRegistrationNumber}</td>
                      <td className="py-3 px-4"><TypeBadge type={inv.invoiceType} /></td>
                      <td className="py-3 px-4 text-sm text-gray-500">{fmtDate(inv.completedDate)}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-right">
                        {amount != null ? fmt(amount) : <span className="text-gray-400 text-xs">Not set</span>}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={inv.paymentStatus} /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {/* Update vendor amount — EXTERNAL + PENDING */}
                          {inv.invoiceType === 'EXTERNAL' && inv.paymentStatus === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => setVendorInv(inv)}
                            >
                              Edit Amount
                            </Button>
                          )}
                          {/* Mark Paid — PENDING only */}
                          {inv.paymentStatus === 'PENDING' && (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => setMarkPaidInv(inv)}
                            >
                              Mark Paid
                            </Button>
                          )}
                          {/* View PDF */}
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
                            title="View PDF"
                            onClick={() => handleViewPdf(inv)}
                            disabled={downloadingId === inv.id}
                          >
                            {downloadingId === inv.id
                              ? <span className="text-xs">…</span>
                              : <ExternalLink size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {markPaidInv && <MarkPaidDialog     invoice={markPaidInv} onClose={() => setMarkPaidInv(null)} />}
      {vendorInv   && <UpdateVendorDialog invoice={vendorInv}   onClose={() => setVendorInv(null)}   />}
    </div>
  )
}
