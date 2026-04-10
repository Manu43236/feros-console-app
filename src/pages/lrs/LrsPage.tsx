import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import { Plus, Search, Truck, FileText, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { lrsApi } from '@/api/lrs'
import { ordersApi } from '@/api/orders'
import type { LrStatus } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ─── Status helpers ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<LrStatus, { label: string; bg: string; text: string }> = {
  CREATED:    { label: 'Created',    bg: 'bg-blue-100',  text: 'text-blue-800'  },
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-amber-100', text: 'text-amber-800' },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-green-100', text: 'text-green-800' },
  CANCELLED:  { label: 'Cancelled',  bg: 'bg-red-100',   text: 'text-red-800'   },
}

function LrStatusBadge({ status }: { status: LrStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ─── Create LR Dialog ────────────────────────────────────────────────────────
const createSchema = z.object({
  vehicleAllocationId: z.string().min(1, 'Select a vehicle allocation'),
  lrDate:              z.string().min(1, 'LR date is required'),
  loadedWeight:        z.string().optional(),
  remarks:             z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

function CreateLrDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const qc = useQueryClient()

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: ordersApi.getAll,
  })
  const orders = ordersRes?.data ?? []

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema) as Resolver<CreateForm>,
    defaultValues: { lrDate: new Date().toISOString().split('T')[0] },
  })

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => lrsApi.create({
      vehicleAllocationId: parseInt(data.vehicleAllocationId),
      lrDate:       data.lrDate,
      loadedWeight: data.loadedWeight ? parseFloat(data.loadedWeight) : undefined,
      remarks:      data.remarks || undefined,
    }),
    onSuccess: () => {
      toast.success('LR created successfully')
      qc.invalidateQueries({ queryKey: ['lrs'] })
      reset(); setSelectedOrderId(null); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create LR')
    },
  })

  const activeOrders = orders.filter(o => !['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(o.orderStatus))
  const selectedOrder = orders.find(o => o.id === selectedOrderId)
  // Only show allocations not yet LR'd (ALLOCATED status)
  const allocations = (selectedOrder?.vehicleAllocations ?? []).filter(a => a.allocationStatus === 'ALLOCATED')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create LR</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Order *</Label>
            <SearchableSelect
              value={selectedOrderId ? String(selectedOrderId) : ''}
              onValueChange={v => setSelectedOrderId(v ? parseInt(v) : null)}
              options={activeOrders.map(o => ({
                value: String(o.id),
                label: `${o.clientName} — ${o.sourceCityName} → ${o.destinationCityName}`,
              }))}
              placeholder={ordersLoading ? 'Loading orders…' : activeOrders.length === 0 ? 'No active orders available' : 'Select order…'}
              disabled={ordersLoading}
              className="mt-1"
            />
          </div>

          {selectedOrderId && (
            <div className="space-y-1.5">
              <Label>Vehicle Allocation *</Label>
              {allocations.length === 0 ? (
                <p className="text-sm text-amber-600 italic">
                  {(selectedOrder?.vehicleAllocations ?? []).length > 0
                    ? 'All vehicle allocations already have LRs created.'
                    : 'No vehicle allocations found. Assign a vehicle to this order first.'}
                </p>
              ) : (
                <>
                  <Controller
                    name="vehicleAllocationId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? ''}
                        onValueChange={v => field.onChange(v)}
                        options={allocations.map(a => ({
                          value: String(a.id),
                          label: `${a.registrationNumber || a.vehicleRegistrationNumber} — ${a.allocatedWeight}T allocated`,
                        }))}
                        placeholder="Select vehicle…"
                        className="mt-1"
                      />
                    )}
                  />
                  {errors.vehicleAllocationId && (
                    <p className="text-red-500 text-xs">{errors.vehicleAllocationId.message}</p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>LR Date *</Label>
            <Input type="date" {...register('lrDate')} />
            {errors.lrDate && <p className="text-red-500 text-xs">{errors.lrDate.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Loaded Weight (tons)</Label>
            <Input type="number" step="0.01" min="0" {...register('loadedWeight')} placeholder="Optional — record now or after loading" />
          </div>

          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <textarea {...register('remarks')} rows={2} className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !selectedOrderId}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white"
            >
              {mutation.isPending ? 'Creating…' : 'Create LR'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export function LrsPage() {
  const navigate    = useNavigate()
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)

  const { data: lrsRes, isLoading } = useQuery({
    queryKey: ['lrs'],
    queryFn: lrsApi.getAll,
  })
  const lrs = [...(lrsRes?.data ?? [])].sort((a, b) => b.id - a.id)

  const filtered = lrs.filter(lr => {
    if (statusFilter && lr.lrStatus !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        lr.lrNumber.toLowerCase().includes(q) ||
        lr.orderNumber.toLowerCase().includes(q) ||
        lr.vehicleRegistrationNumber.toLowerCase().includes(q) ||
        (lr.clientName ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LR Register</h1>
          <p className="text-sm text-gray-500 mt-1">Lorry Receipts — loading, transit & delivery tracking</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-feros-navy text-white px-4 py-2 rounded-lg hover:bg-feros-navy/90 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Create LR
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search LR#, Order#, Vehicle, Client…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <SearchableSelect
          value={statusFilter}
          onValueChange={setStatus}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'CREATED', label: 'Created' },
            { value: 'IN_TRANSIT', label: 'In Transit' },
            { value: 'DELIVERED', label: 'Delivered' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
          className="h-10 w-40"
        />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4">
        {(['CREATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as LrStatus[]).map(s => {
          const count = lrs.filter(l => l.lrStatus === s).length
          const cfg = STATUS_CFG[s]
          return (
            <button
              key={s}
              onClick={() => setStatus(statusFilter === s ? '' : s)}
              className={`rounded-xl border p-3 text-left transition-colors ${statusFilter === s ? `${cfg.bg} border-current` : 'bg-white hover:bg-gray-50'}`}
            >
              <p className={`text-2xl font-bold ${cfg.text}`}>{count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading LRs…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No LRs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['LR #', 'Order #', 'Client', 'Vehicle', 'Allocated', 'Loaded', 'Delivered', 'Status', 'LR Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(lr => (
                <tr
                  key={lr.id}
                  onClick={() => navigate(`/lrs/${lr.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-blue-700">{lr.lrNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{lr.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{lr.clientName || '—'}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-gray-400" />
                      {lr.vehicleRegistrationNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lr.allocatedWeight}T</td>
                  <td className="px-4 py-3 text-gray-600">{lr.loadedWeight != null ? `${lr.loadedWeight}T` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{lr.deliveredWeight != null ? `${lr.deliveredWeight}T` : '—'}</td>
                  <td className="px-4 py-3"><LrStatusBadge status={lr.lrStatus} /></td>
                  <td className="px-4 py-3 text-gray-500">{lr.lrDate}</td>
                  <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-gray-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <CreateLrDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
