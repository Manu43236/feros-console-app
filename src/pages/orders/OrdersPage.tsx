import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { ordersApi } from '@/api/orders'
import { clientsApi } from '@/api/clients'
import { globalMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import { Plus, Search, Eye, X, ArrowRight, Package, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Order, OrderStatus, OrderPaymentStatus } from '@/types'
import { cn } from '@/lib/utils'

// ── helpers ───────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:             'Pending',
  PARTIALLY_ASSIGNED:  'Partially Assigned',
  FULLY_ASSIGNED:      'Fully Assigned',
  IN_TRANSIT:          'In Transit',
  PARTIALLY_DELIVERED: 'Partially Delivered',
  DELIVERED:           'Delivered',
  CANCELLED:           'Cancelled',
  COMPLETED:           'Completed',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING:             'bg-yellow-50 text-yellow-700 hover:bg-yellow-50',
  PARTIALLY_ASSIGNED:  'bg-blue-50 text-blue-700 hover:bg-blue-50',
  FULLY_ASSIGNED:      'bg-indigo-50 text-indigo-700 hover:bg-indigo-50',
  IN_TRANSIT:          'bg-orange-50 text-orange-700 hover:bg-orange-50',
  PARTIALLY_DELIVERED: 'bg-purple-50 text-purple-700 hover:bg-purple-50',
  DELIVERED:           'bg-green-50 text-green-700 hover:bg-green-50',
  CANCELLED:           'bg-red-50 text-red-700 hover:bg-red-50',
  COMPLETED:           'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge className={cn('text-xs font-medium', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  UNPAID:         'Unpaid',
  ADVANCE_PAID:   'Advance Paid',
  PARTIALLY_PAID: 'Partially Paid',
  PAID:           'Paid',
}

const PAYMENT_STATUS_COLORS: Record<OrderPaymentStatus, string> = {
  UNPAID:         'bg-red-50 text-red-700 hover:bg-red-50',
  ADVANCE_PAID:   'bg-blue-50 text-blue-700 hover:bg-blue-50',
  PARTIALLY_PAID: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-50',
  PAID:           'bg-green-50 text-green-700 hover:bg-green-50',
}

export function PaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  return (
    <Badge className={cn('text-xs font-medium', PAYMENT_STATUS_COLORS[status])}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  )
}

// ── schema ────────────────────────────────────────────────────────────────────
const MATERIAL_OTHER_SENTINEL = 0   // synthetic "Other" value

const schema = z.object({
  clientId:             z.coerce.number().min(1, 'Select a client'),
  materialTypeId:       z.coerce.number().min(0, 'Select material type'),
  customMaterialName:   z.string().optional(),
  totalWeight:          z.coerce.number().positive('Weight must be positive'),
  orderDate:            z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  sourceAddress:        z.string().optional(),
  sourceStateId:        z.coerce.number().min(1, 'Select source state'),
  sourceCityId:         z.coerce.number().min(1, 'Select source city'),
  destinationAddress:   z.string().optional(),
  destinationStateId:   z.coerce.number().min(1, 'Select destination state'),
  destinationCityId:    z.coerce.number().min(1, 'Select destination city'),
  freightRateType:      z.enum(['PER_TON', 'PER_TRIP', 'PER_KM']),
  freightRate:          z.coerce.number().positive('Enter freight rate'),
  billingOn:            z.enum(['LOADED_WEIGHT', 'DELIVERED_WEIGHT']).optional(),
  specialInstructions:  z.string().optional(),
  remarks:              z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ── order form ────────────────────────────────────────────────────────────────
export function OrderForm({ open, onClose, order }: { open: boolean; onClose: () => void; order?: Order }) {
  const qc     = useQueryClient()
  const isEdit = !!order

  const { data: clientsRes }   = useQuery({ queryKey: ['clients'],        queryFn: clientsApi.getAll })
  const { data: materialsRes } = useQuery({ queryKey: ['material-types'], queryFn: globalMastersApi.getMaterialTypes })
  const { data: statesRes }    = useQuery({ queryKey: ['states'],         queryFn: globalMastersApi.getStates })

  const [srcState, setSrcState] = useState<number | undefined>(undefined)
  const [dstState, setDstState] = useState<number | undefined>(undefined)
  const [clientAutoFilled, setClientAutoFilled] = useState(false)

  const { data: srcCitiesRes } = useQuery({
    queryKey: ['cities', srcState],
    queryFn:  () => globalMastersApi.getCities(srcState),
    enabled:  !!srcState,
  })
  const { data: dstCitiesRes } = useQuery({
    queryKey: ['cities', dstState],
    queryFn:  () => globalMastersApi.getCities(dstState),
    enabled:  !!dstState,
  })

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { freightRateType: 'PER_TON', billingOn: 'LOADED_WEIGHT' },
  })

  // ── Watches for controlled selects ────────────────────────────────────────
  const watchedClientId    = watch('clientId')
  const watchedMaterialId  = watch('materialTypeId')
  const watchedSrcState    = watch('sourceStateId')
  const watchedSrcCity     = watch('sourceCityId')
  const watchedDstState    = watch('destinationStateId')
  const watchedDstCity     = watch('destinationCityId')
  const watchedFreightType = watch('freightRateType')
  const watchedBillingOn   = watch('billingOn')

  // ── Reset form whenever the dialog opens or the order changes ──────────────
  const prevClientId = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    prevClientId.current = order?.clientId
    setClientAutoFilled(false)

    if (order) {
      reset({
        clientId:             order.clientId,
        materialTypeId:       order.materialTypeId,
        customMaterialName:   '',
        totalWeight:          order.totalWeight,
        orderDate:            order.orderDate?.split('T')[0] ?? '',
        expectedDeliveryDate: order.expectedDeliveryDate?.split('T')[0] ?? '',
        sourceAddress:        order.sourceAddress ?? '',
        sourceStateId:        order.sourceStateId,
        sourceCityId:         order.sourceCityId,
        destinationAddress:   order.destinationAddress ?? '',
        destinationStateId:   order.destinationStateId,
        destinationCityId:    order.destinationCityId,
        freightRateType:      order.freightRateType,
        freightRate:          order.freightRate,
        billingOn:            order.billingOn,
        specialInstructions:  order.specialInstructions ?? '',
        remarks:              order.remarks ?? '',
      })
      setSrcState(order.sourceStateId)
      setDstState(order.destinationStateId)
    } else {
      reset({ freightRateType: 'PER_TON', billingOn: 'LOADED_WEIGHT' })
      setSrcState(undefined)
      setDstState(undefined)
    }
  }, [order?.id, open])

  // ── Auto-fill destination from client address ──────────────────────────────
  useEffect(() => {
    const id = Number(watchedClientId)
    if (!id || !clientsRes?.data) return
    // In edit mode skip auto-fill if client hasn't changed
    if (isEdit && id === prevClientId.current) return
    prevClientId.current = id

    const client = clientsRes.data.find(c => c.id === id)
    if (!client) return

    if (client.stateId) {
      setValue('destinationStateId', client.stateId)
      setDstState(client.stateId)
    }
    if (client.cityId) setValue('destinationCityId', client.cityId)
    setValue('destinationAddress', client.address ?? '')
    setClientAutoFilled(true)
  }, [watchedClientId, clientsRes?.data])

  // ── Detect "Other" synthetic option ────────────────────────────────────────
  const materials       = materialsRes?.data ?? []
  const isOtherMaterial = Number(watchedMaterialId) === MATERIAL_OTHER_SENTINEL

  // ── Submit ─────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload: Record<string, unknown> = { ...data }
      if (isOtherMaterial) {
        // Send customMaterialName, omit materialTypeId so backend resolves it
        delete payload.materialTypeId
      } else {
        delete payload.customMaterialName
      }
      return isEdit ? ordersApi.update(order!.id, payload) : ordersApi.create(payload)
    },
    onSuccess: () => {
      toast.success(`Order ${isEdit ? 'updated' : 'created'} successfully`)
      qc.invalidateQueries({ queryKey: ['orders'] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Something went wrong')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Order' : 'New Order'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 pt-2">

          {/* ── Client, Material, Weight, Dates ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <select
                {...register('clientId')}
                value={watchedClientId ?? ''}
                onChange={e => setValue('clientId', Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Select client</option>
                {clientsRes?.data?.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.id}>{c.clientName}</option>
                ))}
              </select>
              {errors.clientId && <p className="text-red-500 text-xs">{errors.clientId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Material Type *</Label>
              <select
                {...register('materialTypeId')}
                value={watchedMaterialId ?? ''}
                onChange={e => setValue('materialTypeId', Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Select material</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                <option value={MATERIAL_OTHER_SENTINEL}>Other (specify manually)</option>
              </select>
              {errors.materialTypeId && <p className="text-red-500 text-xs">{errors.materialTypeId.message}</p>}
              {isOtherMaterial && (
                <Input
                  {...register('customMaterialName')}
                  placeholder="Type material name…"
                  className="mt-1.5"
                  autoFocus
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Total Weight (tons) *</Label>
              <Input type="number" step="0.01" placeholder="25.00" {...register('totalWeight')} />
              {errors.totalWeight && <p className="text-red-500 text-xs">{errors.totalWeight.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Order Date</Label>
              <Input type="date" {...register('orderDate')} />
            </div>

            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label>Expected Delivery Date</Label>
              <Input type="date" {...register('expectedDeliveryDate')} />
            </div>
          </div>

          {/* ── Source ── */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Source (From)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>State *</Label>
                <select
                  {...register('sourceStateId')}
                  value={watchedSrcState ?? ''}
                  onChange={e => {
                    const val = Number(e.target.value) || undefined
                    setSrcState(val)
                    setValue('sourceStateId', Number(e.target.value))
                    setValue('sourceCityId', 0)
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select state</option>
                  {statesRes?.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {errors.sourceStateId && <p className="text-red-500 text-xs">{errors.sourceStateId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>City *</Label>
                <select
                  {...register('sourceCityId')}
                  value={watchedSrcCity ?? ''}
                  onChange={e => setValue('sourceCityId', Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select city</option>
                  {srcCitiesRes?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.sourceCityId && <p className="text-red-500 text-xs">{errors.sourceCityId.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input placeholder="Depot / Loading point" {...register('sourceAddress')} />
              </div>
            </div>
          </div>

          {/* ── Destination ── */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">Destination (To)</p>
              {clientAutoFilled && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Auto-filled from client
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>State *</Label>
                <select
                  {...register('destinationStateId')}
                  value={watchedDstState ?? ''}
                  onChange={e => {
                    const val = Number(e.target.value) || undefined
                    setDstState(val)
                    setValue('destinationStateId', Number(e.target.value))
                    setValue('destinationCityId', 0)
                  }}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select state</option>
                  {statesRes?.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {errors.destinationStateId && <p className="text-red-500 text-xs">{errors.destinationStateId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>City *</Label>
                <select
                  {...register('destinationCityId')}
                  value={watchedDstCity ?? ''}
                  onChange={e => setValue('destinationCityId', Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select city</option>
                  {dstCitiesRes?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.destinationCityId && <p className="text-red-500 text-xs">{errors.destinationCityId.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input placeholder="Delivery point" {...register('destinationAddress')} />
              </div>
            </div>
          </div>

          {/* ── Freight ── */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Freight</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Rate Type *</Label>
                <select
                  {...register('freightRateType')}
                  value={watchedFreightType ?? 'PER_TON'}
                  onChange={e => setValue('freightRateType', e.target.value as 'PER_TON' | 'PER_TRIP' | 'PER_KM')}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="PER_TON">Per Ton</option>
                  <option value="PER_TRIP">Per Trip</option>
                  <option value="PER_KM">Per KM</option>
                </select>
                {errors.freightRateType && <p className="text-red-500 text-xs">{errors.freightRateType.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Rate (₹) *</Label>
                <Input type="number" step="0.01" placeholder="1500.00" {...register('freightRate')} />
                {errors.freightRate && <p className="text-red-500 text-xs">{errors.freightRate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Bill On</Label>
                <select
                  {...register('billingOn')}
                  value={watchedBillingOn ?? 'LOADED_WEIGHT'}
                  onChange={e => setValue('billingOn', e.target.value as 'LOADED_WEIGHT' | 'DELIVERED_WEIGHT')}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="LOADED_WEIGHT">Loaded Weight</option>
                  <option value="DELIVERED_WEIGHT">Delivered Weight</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Remarks ── */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Special Instructions</Label>
                <Input placeholder="Handle with care…" {...register('specialInstructions')} />
              </div>
              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Input placeholder="Internal notes…" {...register('remarks')} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update Order' : 'Create Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
const ALL_STATUSES: OrderStatus[] = [
  'PENDING', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED',
  'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'COMPLETED',
]

export function OrdersPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState<Order | undefined>()

  const { data: res, isLoading } = useQuery({ queryKey: ['orders'], queryFn: ordersApi.getAll })

  const cancelMutation = useMutation({
    mutationFn: ordersApi.cancel,
    onSuccess: () => { toast.success('Order cancelled'); qc.invalidateQueries({ queryKey: ['orders'] }) },
    onError: () => toast.error('Failed to cancel order'),
  })

  const orders = (res?.data ?? []).filter(o => {
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.clientName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || o.orderStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  function handleCancel(o: Order, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Cancel order ${o.orderNumber}?`)) return
    cancelMutation.mutate(o.id)
  }

  function openEdit(o: Order, e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(o)
    setFormOpen(true)
  }

  function onClose() { setFormOpen(false); setEditing(undefined) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{res?.data?.length ?? 0} total orders</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
          <Plus size={16} /> New Order
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by order # or client…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-72"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value as OrderStatus | 'ALL')}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="ALL">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <Package size={36} className="text-gray-200" />
            <p className="text-sm">
              {search || statusFilter !== 'ALL'
                ? 'No orders match your filters'
                : 'No orders yet. Create your first order.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Order #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Route</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Material</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Weight</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Freight</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Payment</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr
                    key={o.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-feros-navy">{o.orderNumber}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-800">{o.clientName}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <span>{o.sourceCityName}</span>
                        <ArrowRight size={12} className="text-gray-400 flex-shrink-0" />
                        <span>{o.destinationCityName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{o.materialTypeName}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{o.totalWeight} T</td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-800">₹{Number(o.freightRate).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-400">{o.freightRateType.replace(/_/g, ' ')}</p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={o.orderStatus} />
                    </td>
                    <td className="py-3 px-4">
                      <PaymentStatusBadge status={o.orderPaymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {o.orderDate
                        ? new Date(o.orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/orders/${o.id}`) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        {o.orderStatus === 'PENDING' && (
                          <button
                            onClick={e => openEdit(o, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
                            title="Edit order"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {(o.orderStatus === 'PENDING' || o.orderStatus === 'PARTIALLY_ASSIGNED') && (
                          <button
                            onClick={e => handleCancel(o, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Cancel order"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OrderForm open={formOpen} onClose={onClose} order={editing} />
    </div>
  )
}
