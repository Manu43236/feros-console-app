import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Receipt, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { equipmentInvoicesApi } from '@/api/equipmentInvoices'
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
const NEXT_STATUS: Partial<Record<EquipmentInvoiceStatus, EquipmentInvoiceStatus[]>> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED'],
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ── Row ────────────────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onStatusChange }: {
  inv: EquipmentInvoice
  onStatusChange: (id: number, status: EquipmentInvoiceStatus) => void
}) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const next = NEXT_STATUS[inv.status] ?? []

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3">
        <button
          className="text-sm font-medium text-feros-equip-sidebar hover:underline"
          onClick={() => navigate(`/equipment/work-orders/${inv.workOrderId}`)}
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
      <td className="px-4 py-3 text-right">
        {next.length > 0 ? (
          <div className="relative inline-block">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => setMenuOpen(v => !v)}
            >
              Action <ChevronDown size={12} />
            </Button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 z-10 py-1"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {next.map(s => (
                  <button
                    key={s}
                    className="w-full text-left text-sm px-3 py-1.5 hover:bg-gray-50 text-gray-700"
                    onClick={() => { onStatusChange(inv.id, s); setMenuOpen(false) }}
                  >
                    Mark {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function EquipmentInvoicesPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<EquipmentInvoiceStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['equip-invoices-all', page, statusFilter],
    queryFn: () => equipmentInvoicesApi.getAll({
      page,
      size: 20,
      status: statusFilter || undefined,
    }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: EquipmentInvoiceStatus }) =>
      equipmentInvoicesApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Invoice updated')
      qc.invalidateQueries({ queryKey: ['equip-invoices-all'] })
    },
    onError: () => toast.error('Failed to update invoice'),
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
      </div>

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
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400 animate-pulse">Loading…</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <Receipt size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">No invoices found</p>
                </td>
              </tr>
            ) : (
              invoices.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                />
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
