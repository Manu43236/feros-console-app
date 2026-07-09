import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Receipt, ExternalLink } from 'lucide-react'
import { serviceInvoicesApi } from '@/api/serviceInvoices'
import {
  ServiceInvoiceDetail, MarkPaidDialog, UpdateVendorDialog,
  TypeBadge, StatusBadge, fmtDate, openPdfInTab,
} from './ServiceInvoiceDetail'

export function ServiceInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [markPaidOpen, setMarkPaidOpen]   = useState(false)
  const [vendorOpen,   setVendorOpen]     = useState(false)
  const [downloading,  setDownloading]    = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['service-invoice', Number(id)],
    queryFn:  () => serviceInvoicesApi.getById(Number(id)),
    enabled:  !!id,
  })

  const invoice = data?.data

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading…</div>
  if (!invoice)  return <div className="p-12 text-center text-gray-400">Invoice not found</div>

  async function handleViewPdf() {
    setDownloading(true)
    try {
      const blob = await serviceInvoicesApi.downloadPdf(invoice!.id)
      openPdfInTab(blob)
    } catch {
      toast.error('Failed to load PDF')
    } finally {
      setDownloading(false)
    }
  }

  const isExternalPending = invoice.invoiceType === 'EXTERNAL' && invoice.paymentStatus === 'PENDING'
  const isPending         = invoice.paymentStatus === 'PENDING'

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-feros-navy/80 rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Receipt size={180} />
        </div>
        <div className="relative px-6 py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-wide">{invoice.invoiceNumber}</h1>
                <TypeBadge type={invoice.invoiceType} />
                <StatusBadge status={invoice.paymentStatus} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-blue-300">
                <span>Service: <span className="text-white font-medium">{invoice.serviceNumber}</span></span>
                <span>Vehicle: <span className="text-white font-medium">{invoice.vehicleRegistrationNumber}</span></span>
                {invoice.completedDate && (
                  <span>Completed: <span className="text-white font-medium">{fmtDate(invoice.completedDate)}</span></span>
                )}
                {invoice.vendorName && (
                  <span>Vendor: <span className="text-white font-medium">{invoice.vendorName}</span></span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              {isExternalPending && (
                <button
                  onClick={() => setVendorOpen(true)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Edit Amount
                </button>
              )}
              {isPending && (
                <button
                  onClick={() => setMarkPaidOpen(true)}
                  className="flex items-center gap-2 bg-green-600/90 hover:bg-green-600 text-white border border-green-500/40 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Mark Paid
                </button>
              )}
              <button
                onClick={handleViewPdf}
                disabled={downloading}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" /> {downloading ? 'Loading…' : 'View PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail body (reused) ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <ServiceInvoiceDetail invoice={invoice} />
      </div>

      {/* Dialogs */}
      {markPaidOpen && <MarkPaidDialog     invoice={invoice} onClose={() => setMarkPaidOpen(false)} />}
      {vendorOpen   && <UpdateVendorDialog invoice={invoice} onClose={() => setVendorOpen(false)} />}
    </div>
  )
}
