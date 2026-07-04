import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSubscription } from '@/context/SubscriptionContext'
import { workOrdersApi } from '@/api/workOrders'
import { clientsApi } from '@/api/clients'
import { toast } from 'sonner'
import { Plus, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { WorkOrderStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  DRAFT:       'bg-gray-100 text-gray-600',
  CONFIRMED:   'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED:   'bg-green-50 text-green-700',
  INVOICED:    'bg-purple-50 text-purple-700',
  CANCELLED:   'bg-red-50 text-red-700',
}
const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: 'Draft', CONFIRMED: 'Confirmed', IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed', INVOICED: 'Invoiced', CANCELLED: 'Cancelled',
}
// ── WO Form schema ────────────────────────────────────────────────────────────
const schema = z.object({
  clientId:           z.coerce.number().min(1, 'Select client'),
  site:               z.string().optional(),
  mobilizationCharge: z.coerce.number().optional(),
  startDate:          z.string().min(1, 'Start date is required'),
  endDate:            z.string().optional(),
  notes:              z.string().optional(),
})
type FormData = z.infer<typeof schema>

function WorkOrderFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode
    ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white'
    : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const qc = useQueryClient()

  const { data: clientsRes } = useQuery({
    queryKey: ['clients', 0, ''],
    queryFn: () => clientsApi.getAll({ page: 0, size: 100 }),
  })

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => workOrdersApi.create({
      ...data,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
    }),
    onSuccess: () => {
      toast.success('Work order created')
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create work order')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 pt-2">
          {/* Client + Site */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Controller name="clientId" control={control} render={({ field }) => (
                <SearchableSelect
                  value={field.value ? String(field.value) : ''}
                  onValueChange={v => field.onChange(v ? Number(v) : undefined)}
                  options={(clientsRes?.data?.content ?? []).map(c => ({ value: String(c.id), label: c.clientName }))}
                  placeholder="Select client"
                />
              )} />
              {errors.clientId && <p className="text-red-500 text-xs">{errors.clientId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Site / Location</Label>
              <Input placeholder="NH-16 Road Project, Berth 4…" {...register('site')} />
            </div>
          </div>

          {/* Dates & Charges */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Dates & Charges</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" {...register('startDate')} />
                {errors.startDate && <p className="text-red-500 text-xs">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>End Date <span className="text-gray-400 font-normal">optional</span></Label>
                <Input type="date" {...register('endDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobilization Charge (₹)</Label>
                <Input type="number" step="0.01" placeholder="0" {...register('mobilizationCharge')} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Any remarks…" {...register('notes')} />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className={btnPrimary}>
              {mutation.isPending ? 'Creating…' : 'Create Work Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function WorkOrdersListPage() {
  const navigate = useNavigate()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode
    ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white'
    : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const pillActive = isEquipmentMode
    ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar'
    : 'bg-gray-800 text-white border-gray-800'

  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('')
  const [clientFilter, setClientFilter] = useState<number | ''>('')
  const [formOpen, setFormOpen] = useState(false)

  const { data: clientsRes } = useQuery({
    queryKey: ['clients', 0, ''],
    queryFn: () => clientsApi.getAll({ page: 0, size: 200 }),
  })
  const clients = clientsRes?.data?.content ?? []

  const { data: res, isLoading } = useQuery({
    queryKey: ['work-orders', page, statusFilter, clientFilter],
    queryFn: () => workOrdersApi.getAll({ page, size: 20, status: statusFilter || undefined, clientId: clientFilter || undefined }),
  })

  const workOrders = res?.data?.content ?? []
  const totalPages = res?.data?.totalPages ?? 1
  const totalElements = res?.data?.totalElements ?? 0

  const STATUSES: WorkOrderStatus[] = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{totalElements} total</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className={`${btnPrimary} gap-2`}>
          <Plus size={16} /> New Work Order
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setStatusFilter(''); setPage(0) }}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              statusFilter === '' ? pillActive : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            )}
          >All</button>
          {STATUSES.map(s => (
            <button key={s}
              onClick={() => { setStatusFilter(s); setPage(0) }}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                statusFilter === s ? pillActive : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
            >{STATUS_LABELS[s]}</button>
          ))}
        </div>
        {/* Client filter */}
        <SearchableSelect
          value={clientFilter === '' ? '' : String(clientFilter)}
          onValueChange={v => { setClientFilter(v ? Number(v) : ''); setPage(0) }}
          options={[
            { value: '', label: 'All Clients' },
            ...clients.map(c => ({ value: String(c.id), label: c.clientName })),
          ]}
          placeholder="All Clients"
          className="w-52"
          triggerClassName={isEquipmentMode ? 'border-feros-equip-sidebar/40 focus:ring-feros-equip-sidebar/50' : ''}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between text-sm text-gray-500">
          <span>{totalElements} work orders</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-xs">{page + 1} / {Math.max(1, totalPages)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading work orders…</div>
        ) : workOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <ClipboardList size={36} className="text-gray-200" />
            <p className="text-sm">No work orders yet. Create your first one.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">WO #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Site</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Machines</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Dates</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id}
                    onClick={() => navigate(`/equipment/work-orders/${wo.id}`)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 text-sm font-mono font-medium text-gray-800">{wo.woNumber}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{wo.clientName}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{wo.site ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{wo.machineCount}</td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-600">{wo.startDate}</div>
                      {wo.endDate && <div className="text-xs text-gray-400">→ {wo.endDate}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn('text-xs', STATUS_COLORS[wo.status])}>
                        {STATUS_LABELS[wo.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <WorkOrderFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
