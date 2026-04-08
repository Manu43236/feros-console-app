import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { invoicesApi } from '@/api/invoices'
import { clientsApi } from '@/api/clients'
import { lrsApi } from '@/api/lrs'
import { toast } from 'sonner'
import {
  Plus, Search, Eye, FileText,
  Receipt, TrendingUp, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { InvoiceStatus } from '@/types'
import { cn } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── Status config ─────────────────────────────────────────────────────────
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT:          'Draft',
  SENT:           'Sent',
  PARTIALLY_PAID: 'Partially Paid',
  PAID:           'Paid',
  OVERDUE:        'Overdue',
  CANCELLED:      'Cancelled',
}
const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT:          'bg-gray-100 text-gray-600 hover:bg-gray-100',
  SENT:           'bg-blue-50 text-blue-700 hover:bg-blue-50',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 hover:bg-amber-50',
  PAID:           'bg-green-50 text-green-700 hover:bg-green-50',
  OVERDUE:        'bg-red-50 text-red-700 hover:bg-red-50',
  CANCELLED:      'bg-slate-100 text-slate-500 hover:bg-slate-100',
}
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge className={cn('text-xs font-medium', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

// ── Create Invoice Dialog ─────────────────────────────────────────────────
const createSchema = z.object({
  clientId:    z.coerce.number().min(1, 'Select a client'),
  invoiceDate: z.string().optional(),
  dueDate:     z.string().optional(),
  remarks:     z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

function CreateInvoiceDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [selectedLrIds, setSelectedLrIds] = useState<Set<number>>(new Set())

  const { data: clientsRes } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.getAll })
  const { data: lrsRes } = useQuery({
    queryKey: ['lrs'],
    queryFn: lrsApi.getAll,
  })
  const allLrs = lrsRes?.data ?? []

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema) as Resolver<CreateForm>,
    defaultValues: { invoiceDate: new Date().toISOString().split('T')[0] },
  })

  const watchedClientId = watch('clientId')
  const clientId = Number(watchedClientId)

  const eligibleLrs = allLrs.filter(
    lr => lr.clientId === clientId && lr.lrStatus === 'DELIVERED'
  )

  function toggleLr(id: number) {
    setSelectedLrIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => invoicesApi.create({
      clientId,
      lrIds:       Array.from(selectedLrIds),
      invoiceDate: data.invoiceDate || undefined,
      dueDate:     data.dueDate || undefined,
      remarks:     data.remarks || undefined,
    }),
    onSuccess: (res) => {
      toast.success('Invoice created successfully')
      qc.invalidateQueries({ queryKey: ['invoices'] })
      onClose()
      navigate(`/invoices/${res.data.id}`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create invoice')
    },
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(d => {
            if (selectedLrIds.size === 0) { toast.error('Select at least one LR'); return }
            mutation.mutate(d)
          })}
          className="space-y-5 pt-2"
        >
          {/* Client + Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Client *</Label>
              <select
                {...register('clientId')}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Select client…</option>
                {clientsRes?.data?.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id}>{c.clientName}</option>
                ))}
              </select>
              {errors.clientId && <p className="text-red-500 text-xs">{errors.clientId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Invoice Date</Label>
              <Input type="date" {...register('invoiceDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" {...register('dueDate')} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Remarks</Label>
              <Input placeholder="Optional note…" {...register('remarks')} />
            </div>
          </div>

          {/* LR Selection */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">
                Select Delivered LRs
                {selectedLrIds.size > 0 && (
                  <span className="ml-2 text-blue-600 font-normal">({selectedLrIds.size} selected)</span>
                )}
              </p>
              {eligibleLrs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLrIds.size === eligibleLrs.length) {
                      setSelectedLrIds(new Set())
                    } else {
                      setSelectedLrIds(new Set(eligibleLrs.map(lr => lr.id)))
                    }
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selectedLrIds.size === eligibleLrs.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {!clientId ? (
              <p className="text-sm text-gray-400 py-6 text-center">Select a client to see delivered LRs</p>
            ) : eligibleLrs.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No delivered LRs found for this client</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-10 py-2 px-3" />
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">LR #</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Order #</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">LR Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleLrs.map(lr => (
                      <tr
                        key={lr.id}
                        onClick={() => toggleLr(lr.id)}
                        className={cn(
                          'border-b last:border-0 cursor-pointer transition-colors',
                          selectedLrIds.has(lr.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                        )}
                      >
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            readOnly
                            checked={selectedLrIds.has(lr.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="py-2 px-3 font-medium text-feros-navy">{lr.lrNumber}</td>
                        <td className="py-2 px-3 text-gray-600">{lr.vehicleRegistrationNumber}</td>
                        <td className="py-2 px-3 text-gray-600">{lr.orderNumber}</td>
                        <td className="py-2 px-3 text-gray-500">
                          {lr.lrDate
                            ? new Date(lr.lrDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={mutation.isPending || selectedLrIds.size === 0}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white"
            >
              {mutation.isPending
                ? 'Creating…'
                : `Create Invoice (${selectedLrIds.size} LR${selectedLrIds.size !== 1 ? 's' : ''})`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
const ALL_STATUSES: InvoiceStatus[] = ['DRAFT','SENT','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED']

export function InvoicesPage() {
  const navigate = useNavigate()
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState<InvoiceStatus | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)

  const { data: invoicesRes, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesApi.getAll,
  })

  const invoices = [...(invoicesRes?.data ?? [])].sort((a, b) => b.id - a.id).filter(inv => {
    const q = search.toLowerCase()
    const matchSearch = inv.invoiceNumber.toLowerCase().includes(q) || inv.clientName.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'ALL' || inv.invoiceStatus === statusFilter
    return matchSearch && matchStatus
  })

  const all              = invoicesRes?.data ?? []
  const outstanding      = all.filter(i => ['SENT','PARTIALLY_PAID','OVERDUE'].includes(i.invoiceStatus))
  const overdue          = all.filter(i => i.invoiceStatus === 'OVERDUE')
  const totalOutstanding = outstanding.reduce((s, i) => s + Number(i.balanceDue), 0)
  const totalCollected   = all.reduce((s, i) => s + Number(i.amountPaid), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-0.5">{all.length} total invoices</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
          <Plus size={16} /> New Invoice
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Receipt size={16} className="text-gray-400" />,   label: 'Total Invoices', value: all.length, sub: undefined },
          { icon: <TrendingUp size={16} className="text-amber-400" />,label: 'Outstanding',   value: `₹${totalOutstanding.toLocaleString('en-IN')}`, sub: `${outstanding.length} invoices` },
          { icon: <AlertCircle size={16} className="text-red-400" />, label: 'Overdue',        value: overdue.length, sub: 'past due date', accent: true },
          { icon: <CheckCircle2 size={16} className="text-green-400" />, label: 'Collected',  value: `₹${totalCollected.toLocaleString('en-IN')}`, sub: undefined },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              {card.icon}
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', card.accent && Number(card.value) > 0 ? 'text-red-600' : 'text-gray-900')}>
              {card.value}
            </p>
            {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by invoice # or client…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-72"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value as InvoiceStatus | 'ALL')}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="ALL">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <FileText size={36} className="text-gray-200" />
            <p className="text-sm">
              {search || statusFilter !== 'ALL' ? 'No invoices match your filters' : 'No invoices yet. Create your first invoice.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Balance</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr
                    key={inv.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                  >
                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-feros-navy">{inv.invoiceNumber}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800">{inv.clientName}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {inv.dueDate
                        ? <span className={inv.invoiceStatus === 'OVERDUE' ? 'text-red-600 font-medium' : 'text-gray-500'}>
                            {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-right font-medium">
                      ₹{Number(inv.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-sm text-green-600 text-right">
                      ₹{Number(inv.amountPaid).toLocaleString('en-IN')}
                    </td>
                    <td className={cn('py-3 px-4 text-sm text-right font-medium', Number(inv.balanceDue) > 0 ? 'text-red-600' : 'text-gray-400')}>
                      ₹{Number(inv.balanceDue).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <InvoiceStatusBadge status={inv.invoiceStatus} />
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/invoices/${inv.id}`) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
                        title="View invoice"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && <CreateInvoiceDialog onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
