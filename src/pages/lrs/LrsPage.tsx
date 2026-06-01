import { useState } from 'react'
import { useSubscription } from '@/context/SubscriptionContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import { Plus, Search, Truck, FileText } from 'lucide-react'
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
  CREATED:       { label: 'Created',       bg: 'bg-blue-100',   text: 'text-blue-800'   },
  WEIGHT_LOADED: { label: 'Weight Loaded', bg: 'bg-purple-100', text: 'text-purple-800' },
  IN_TRANSIT:    { label: 'In Transit',    bg: 'bg-amber-100',  text: 'text-amber-800'  },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-green-100', text: 'text-green-800' },
  CANCELLED:  { label: 'Cancelled',  bg: 'bg-red-100',   text: 'text-red-800'   },
}

function LrStatusBadge({ status }: { status: LrStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {status === 'IN_TRANSIT' ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
      ) : null}
      {cfg.label}
    </span>
  )
}

// ─── Create LR Dialog ────────────────────────────────────────────────────────
const createSchema = z.object({
  vehicleAllocationId: z.string().min(1, 'Select a vehicle allocation'),
  lrDate:              z.string().min(1, 'LR date is required'),
  loadedWeight:        z.string().optional(),
  ewayBillNumber:      z.string().optional(),
  ewayBillDate:        z.string().optional(),
  ewayBillValidUpto:   z.string().optional(),
  remarks:             z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

function CreateLrDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const qc = useQueryClient()

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.getAll(),
  })
  const orders = ordersRes?.data?.content ?? []

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema) as Resolver<CreateForm>,
    defaultValues: { lrDate: new Date().toISOString().split('T')[0] },
  })

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => lrsApi.create({
      vehicleAllocationId: parseInt(data.vehicleAllocationId),
      lrDate:            data.lrDate,
      loadedWeight:      data.loadedWeight ? parseFloat(data.loadedWeight) : undefined,
      ewayBillNumber:    data.ewayBillNumber || undefined,
      ewayBillDate:      data.ewayBillDate || undefined,
      ewayBillValidUpto: data.ewayBillValidUpto || undefined,
      remarks:           data.remarks || undefined,
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

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">E-way Bill (optional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>E-way Bill No.</Label>
                <Input placeholder="EWB123456789" {...register('ewayBillNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>Bill Date</Label>
                <Input type="date" {...register('ewayBillDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Upto</Label>
                <Input type="date" {...register('ewayBillValidUpto')} />
              </div>
            </div>
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
  const { locked } = useSubscription()
  const navigate    = useNavigate()
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState<string>('')
  const [page, setPage]             = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const PAGE_SIZE = 20

  const { data: lrsRes, isLoading } = useQuery({
    queryKey: ['lrs', page, search, statusFilter],
    queryFn: () => lrsApi.getAll({
      page,
      size: PAGE_SIZE,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
  })
  const pageData    = lrsRes?.data
  const lrs         = pageData?.content ?? []
  const totalPages  = pageData?.totalPages ?? 0
  const totalCount  = pageData?.totalElements ?? 0

  const handleStatusChange = (s: string) => { setStatus(s); setPage(0) }
  const handleSearch = (v: string) => { setSearch(v); setPage(0) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LR Register</h1>
          <p className="text-sm text-gray-500 mt-1">Lorry Receipts — loading, transit & delivery tracking</p>
        </div>
        {!locked && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-feros-navy text-white px-4 py-2 rounded-lg hover:bg-feros-navy/90 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Create LR
          </button>
        )}
      </div>

      {/* Filters + Pagination */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search LR#, Vehicle…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        <SearchableSelect
          value={statusFilter}
          onValueChange={handleStatusChange}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'CREATED', label: 'Created' },
            { value: 'IN_TRANSIT', label: 'In Transit' },
            { value: 'DELIVERED', label: 'Delivered' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
          className="h-10 w-40"
        />
        {totalPages > 0 && (
          <div className="flex items-center gap-2 text-sm ml-auto">
            <span className="text-gray-400 whitespace-nowrap">{totalCount} total</span>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
            >
              Prev
            </button>
            <span className="font-medium text-gray-700 whitespace-nowrap">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden flex flex-col max-h-[calc(100vh-16rem)]">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading LRs…</div>
        ) : lrs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No LRs found</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['LR #', 'Order #', 'Client', 'Vehicle', 'Allocated', 'Loaded', 'Delivered', 'Status', 'LR Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lrs.map(lr => (
                  <tr
                    key={lr.id}
                    onClick={() => navigate(`/lrs/${lr.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-blue-700">{lr.lrNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{lr.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                      <span className="line-clamp-2">{lr.clientName || '—'}</span>
                    </td>
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
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{lr.lrDate}</td>
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
