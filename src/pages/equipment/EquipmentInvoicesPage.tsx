import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { equipmentInvoicesApi } from '@/api/equipmentInvoices'
import { CreateEquipmentInvoiceDialog } from './CreateEquipmentInvoiceDialog'
import type { EquipmentInvoice, EquipmentInvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── Status config ──────────────────────────────────────────────────────────────
const STATUSES: EquipmentInvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']
const STATUS_LABELS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIALLY_PAID: 'Partial', PAID: 'Paid', CANCELLED: 'Cancelled',
}
const STATUS_COLORS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
  SENT: 'bg-blue-50 text-blue-700 hover:bg-blue-50',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 hover:bg-amber-50',
  PAID: 'bg-green-50 text-green-700 hover:bg-green-50',
  CANCELLED: 'bg-red-50 text-red-600 hover:bg-red-50',
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ── Row ────────────────────────────────────────────────────────────────────────
function InvoiceRow({ inv }: { inv: EquipmentInvoice }) {
  const navigate = useNavigate()

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3">
        <button
          className="text-sm font-medium text-feros-equip-sidebar hover:underline"
          onClick={() => navigate(`/equipment/invoices/${inv.id}`)}
        >
          {inv.invoiceNumber}
        </button>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{inv.woNumber}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{inv.clientName}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{inv.invoiceDate}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {inv.billingPeriodStart
          ? `${inv.billingPeriodStart} → ${inv.billingPeriodEnd}`
          : '—'}
      </td>
      <td className="px-4 py-3">
        <Badge className={cn('text-xs font-medium', STATUS_COLORS[inv.status])}>
          {STATUS_LABELS[inv.status]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">
        ₹{fmt(inv.totalAmount ?? 0)}
      </td>
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function EquipmentInvoicesPage() {
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<EquipmentInvoiceStatus | ''>('')
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['equip-invoices-all', page, statusFilter],
    queryFn: () => equipmentInvoicesApi.getAll({
      page,
      size: 20,
      status: statusFilter || undefined,
    }),
  })

  const invoices = data?.data?.content ?? []
  const totalPages = data?.data?.totalPages ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Equipment Invoices</h1>
          <p className="text-sm text-gray-400 mt-0.5">All invoices across work orders</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white"
        >
          <Plus size={16} className="mr-1.5" /> New Invoice
        </Button>
      </div>

      <CreateEquipmentInvoiceDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setStatusFilter(''); setPage(0) }}
          className={cn('px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
            statusFilter === '' ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar' : 'border-gray-200 text-gray-600 hover:border-gray-400'
          )}
        >
          All
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(0) }}
            className={cn('px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              statusFilter === s ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar' : 'border-gray-200 text-gray-600 hover:border-gray-400'
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Invoice #</th>
              <th className="px-4 py-3 text-left">Work Order</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Billing Period</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 animate-pulse">Loading…</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Receipt size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">No invoices found</p>
                </td>
              </tr>
            ) : (
              invoices.map(inv => (
                <InvoiceRow key={inv.id} inv={inv} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-500 self-center">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
