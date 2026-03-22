import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ordersApi } from '@/api/orders'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import { lrsApi } from '@/api/lrs'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft, Truck, Plus, Package, MapPin,
  Scale, Receipt, User, ChevronDown, ChevronUp,
  Pencil, X, RefreshCw, FileText, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge, PaymentStatusBadge, OrderForm } from './OrdersPage'
import { cn } from '@/lib/utils'
import type { OrderPaymentStatus, VehicleAllocation } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(date?: string) {
  if (!date) return '—'
  try { return format(parseISO(date.split('T')[0]), 'dd MMM yyyy') } catch { return date }
}

const ALLOC_STATUS_COLORS: Record<string, string> = {
  ALLOCATED:   'bg-blue-50 text-blue-700',
  LOADED:      'bg-orange-50 text-orange-700',
  IN_TRANSIT:  'bg-purple-50 text-purple-700',
  DELIVERED:   'bg-green-50 text-green-700',
  CANCELLED:   'bg-red-50 text-red-700',
}

// ── assign vehicle dialog ─────────────────────────────────────────────────────
const assignVehicleSchema = z.object({
  vehicleId:            z.coerce.number().min(1, 'Select a vehicle'),
  allocatedWeight:      z.coerce.number().positive('Enter weight'),
  expectedLoadDate:     z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  remarks:              z.string().optional(),
})
type AssignVehicleForm = z.infer<typeof assignVehicleSchema>

function AssignVehicleDialog({ orderId, remainingWeight, open, onClose }: {
  orderId: number; remainingWeight?: number; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: vehiclesApi.getAll })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<AssignVehicleForm>({
    resolver: zodResolver(assignVehicleSchema) as Resolver<AssignVehicleForm>,
    defaultValues: { allocatedWeight: remainingWeight },
  })

  const mutation = useMutation({
    mutationFn: (data: AssignVehicleForm) => ordersApi.assignVehicle(orderId, data),
    onSuccess: () => {
      toast.success('Vehicle assigned successfully')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to assign vehicle')
    },
  })

  const activeVehicles = (vehiclesRes?.data ?? []).filter(v => v.isActive)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Vehicle</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Vehicle *</Label>
            <select {...register('vehicleId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select vehicle</option>
              {activeVehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber}
                  {v.vehicleTypeName ? ` · ${v.vehicleTypeName}` : ''}
                  {v.capacityInTons  ? ` · ${v.capacityInTons}T` : ''}
                </option>
              ))}
            </select>
            {errors.vehicleId && <p className="text-red-500 text-xs">{errors.vehicleId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>
              Allocated Weight (tons) *
              {remainingWeight !== undefined && (
                <span className="ml-2 text-xs text-gray-400 font-normal">Remaining: {remainingWeight}T</span>
              )}
            </Label>
            <Input type="number" step="0.01" placeholder="25.00" {...register('allocatedWeight')} />
            {errors.allocatedWeight && <p className="text-red-500 text-xs">{errors.allocatedWeight.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expected Load Date</Label>
              <Input type="date" {...register('expectedLoadDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Expected Delivery Date</Label>
              <Input type="date" {...register('expectedDeliveryDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input placeholder="Optional notes…" {...register('remarks')} />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Assigning…' : 'Assign Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── assign staff dialog ───────────────────────────────────────────────────────
const assignStaffSchema = z.object({
  userId:            z.coerce.number().min(1, 'Select a person'),
  expectedStartDate: z.string().optional(),
  expectedEndDate:   z.string().optional(),
  remarks:           z.string().optional(),
})
type AssignStaffForm = z.infer<typeof assignStaffSchema>

function AssignStaffDialog({ orderId, allocation, slotRole, open, onClose }: {
  orderId: number
  allocation: VehicleAllocation
  slotRole: 'DRIVER' | 'CLEANER'
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: staffRes } = useQuery({ queryKey: ['users'], queryFn: staffApi.getUsers })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<AssignStaffForm>({
    resolver: zodResolver(assignStaffSchema) as Resolver<AssignStaffForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: AssignStaffForm) =>
      ordersApi.assignStaff(orderId, { ...data, vehicleAllocationId: allocation.id }),
    onSuccess: () => {
      toast.success(`${slotRole === 'DRIVER' ? 'Driver' : 'Cleaner'} assigned successfully`)
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to assign')
    },
  })

  const eligible = (staffRes?.data ?? []).filter(u => {
    if (!u.isActive) return false
    return slotRole === 'DRIVER' ? u.role === 'DRIVER' : u.role !== 'DRIVER'
  })

  const regNo = allocation.vehicleRegistrationNumber ?? allocation.registrationNumber

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{slotRole === 'DRIVER' ? 'Assign Driver' : 'Assign Cleaner'}</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Vehicle: <span className="font-semibold text-gray-800 font-mono">{regNo}</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{slotRole === 'DRIVER' ? 'Driver' : 'Cleaner'} *</Label>
            <select {...register('userId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select {slotRole === 'DRIVER' ? 'driver' : 'cleaner'}</option>
              {eligible.map(u => (
                <option key={u.id} value={u.id}>{u.name} · {u.phone}</option>
              ))}
            </select>
            {errors.userId && <p className="text-red-500 text-xs">{errors.userId.message}</p>}
            {eligible.length === 0 && (
              <p className="text-xs text-orange-500">
                No active {slotRole === 'DRIVER' ? 'drivers' : 'cleaners'} found.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" {...register('expectedStartDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" {...register('expectedEndDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input placeholder="Optional notes…" {...register('remarks')} />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Assigning…' : `Assign ${slotRole === 'DRIVER' ? 'Driver' : 'Cleaner'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── create LR from allocation dialog ──────────────────────────────────────────
const lrFromAllocSchema = z.object({
  lrDate:       z.string().min(1, 'LR date is required'),
  loadedWeight: z.string().optional(),
  remarks:      z.string().optional(),
})
type LrFromAllocForm = z.infer<typeof lrFromAllocSchema>

function CreateLrFromAllocationDialog({
  allocation, orderId, onClose,
}: {
  allocation: VehicleAllocation; orderId: number; onClose: () => void
}) {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const regNo    = allocation.vehicleRegistrationNumber ?? allocation.registrationNumber

  const { register, handleSubmit, formState: { errors } } = useForm<LrFromAllocForm>({
    resolver: zodResolver(lrFromAllocSchema) as Resolver<LrFromAllocForm>,
    defaultValues: { lrDate: new Date().toISOString().split('T')[0] },
  })

  const mutation = useMutation({
    mutationFn: (data: LrFromAllocForm) => lrsApi.create({
      vehicleAllocationId: allocation.id,
      lrDate:       data.lrDate,
      loadedWeight: data.loadedWeight ? parseFloat(data.loadedWeight) : undefined,
      remarks:      data.remarks || undefined,
    }),
    onSuccess: (res) => {
      toast.success('LR created successfully')
      qc.invalidateQueries({ queryKey: ['order-lrs', orderId] })
      qc.invalidateQueries({ queryKey: ['lrs'] })
      navigate(`/lrs/${res.data.id}`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create LR')
    },
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create LR</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Vehicle: <span className="font-semibold text-gray-800 font-mono">{regNo}</span>
            <span className="ml-2 text-gray-400">· {allocation.allocatedWeight}T allocated</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>LR Date *</Label>
            <Input type="date" {...register('lrDate')} />
            {errors.lrDate && <p className="text-red-500 text-xs">{errors.lrDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Loaded Weight (tons)</Label>
            <Input
              type="number" step="0.01" min="0"
              {...register('loadedWeight')}
              placeholder="Optional — record now or after loading"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input placeholder="Optional notes…" {...register('remarks')} />
          </div>
          {mutation.isError && <p className="text-sm text-red-600">Failed to create LR. Please try again.</p>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Creating…' : 'Create LR'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── vehicle allocation card ───────────────────────────────────────────────────
function VehicleAllocationCard({
  allocation, orderId, canAssign, existingLrId,
}: {
  allocation: VehicleAllocation; orderId: number; canAssign: boolean; existingLrId?: number
}) {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const [expanded, setExpanded]     = useState(true)
  const [slotDialog, setSlotDialog] = useState<'DRIVER' | 'CLEANER' | null>(null)
  const [lrDialog, setLrDialog]     = useState(false)

  const unassignMutation = useMutation({
    mutationFn: () => ordersApi.unassignVehicle(orderId, allocation.id),
    onSuccess: () => {
      toast.success('Vehicle unassigned')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to unassign vehicle')
    },
  })

  const canUnassign = canAssign && allocation.allocationStatus === 'ALLOCATED' && !existingLrId

  const regNo     = allocation.vehicleRegistrationNumber ?? allocation.registrationNumber
  const staff     = allocation.staffAllocations ?? []
  const statusCls = ALLOC_STATUS_COLORS[allocation.allocationStatus] ?? 'bg-gray-50 text-gray-600'

  // Exactly one driver, one cleaner — pick the active one
  const activeDriver  = staff.find(s => s.roleName === 'DRIVER'  && s.allocationStatus !== 'CANCELLED')
  const activeCleaner = staff.find(s => s.roleName === 'CLEANER' && s.allocationStatus !== 'CANCELLED')

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Vehicle header row */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-gray-50">
        <div className="w-9 h-9 rounded-lg bg-feros-navy/10 flex items-center justify-center shrink-0">
          <Truck size={16} className="text-feros-navy" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 font-mono">{regNo}</span>
            {allocation.vehicleTypeName && (
              <span className="text-xs text-gray-500">{allocation.vehicleTypeName}</span>
            )}
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusCls)}>
              {allocation.allocationStatus}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span><Scale size={10} className="inline mr-0.5" />{allocation.allocatedWeight}T allocated</span>
            {allocation.expectedLoadDate      && <span>Load: {fmt(allocation.expectedLoadDate)}</span>}
            {allocation.expectedDeliveryDate  && <span>Del: {fmt(allocation.expectedDeliveryDate)}</span>}
          </div>
        </div>

        {/* LR button */}
        {existingLrId ? (
          <button
            onClick={() => navigate(`/lrs/${existingLrId}`)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-green-700 border-green-200 hover:bg-green-50 transition-colors shrink-0"
          >
            <ExternalLink size={11} /> View LR
          </button>
        ) : canAssign ? (
          <button
            onClick={() => setLrDialog(true)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-blue-700 border-blue-200 hover:bg-blue-50 transition-colors shrink-0"
          >
            <FileText size={11} /> Create LR
          </button>
        ) : null}

        {/* Unassign button */}
        {canUnassign && (
          <button
            onClick={() => confirm(`Unassign ${regNo} from this order?`) && unassignMutation.mutate()}
            disabled={unassignMutation.isPending}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-red-600 border-red-200 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
          >
            <X size={11} /> Unassign
          </button>
        )}

        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Driver + Cleaner slots */}
      {expanded && (
        <div className="divide-y divide-gray-50">
          {/* Driver slot */}
          <StaffSlot
            label="Driver"
            person={activeDriver}
            canAssign={canAssign}
            onAssign={() => setSlotDialog('DRIVER')}
          />
          {/* Cleaner slot */}
          <StaffSlot
            label="Cleaner"
            person={activeCleaner}
            canAssign={canAssign}
            onAssign={() => setSlotDialog('CLEANER')}
          />
        </div>
      )}

      {slotDialog && (
        <AssignStaffDialog
          orderId={orderId}
          allocation={allocation}
          slotRole={slotDialog}
          open={!!slotDialog}
          onClose={() => setSlotDialog(null)}
        />
      )}
      {lrDialog && (
        <CreateLrFromAllocationDialog
          allocation={allocation}
          orderId={orderId}
          onClose={() => setLrDialog(false)}
        />
      )}
    </div>
  )
}

// ── staff slot row ────────────────────────────────────────────────────────────
function StaffSlot({ label, person, canAssign, onAssign }: {
  label: string
  person: { userName: string; expectedStartDate?: string; expectedEndDate?: string; allocationStatus: string } | undefined
  canAssign: boolean
  onAssign: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
        person ? 'bg-blue-50' : 'bg-gray-100'
      )}>
        <User size={13} className={person ? 'text-feros-navy' : 'text-gray-400'} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        {person ? (
          <p className="text-sm font-medium text-gray-800">
            {person.userName}
            {person.expectedStartDate && (
              <span className="text-xs font-normal text-gray-400 ml-1.5">
                {fmt(person.expectedStartDate)}{person.expectedEndDate ? ` → ${fmt(person.expectedEndDate)}` : ''}
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">Not assigned</p>
        )}
      </div>

      {canAssign && (
        <button
          onClick={onAssign}
          className={cn(
            'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors shrink-0',
            person
              ? 'text-orange-600 border-orange-200 hover:bg-orange-50'
              : 'text-feros-navy border-blue-200 hover:bg-blue-50'
          )}
        >
          {person ? <RefreshCw size={11} /> : <Plus size={11} />}
          {person ? 'Change' : 'Assign'}
        </button>
      )}
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate    = useNavigate()
  const qc          = useQueryClient()

  const [assignVehicleOpen, setAssignVehicleOpen]   = useState(false)
  const [editOpen, setEditOpen]                     = useState(false)
  const [paymentStatusOpen, setPaymentStatusOpen]   = useState(false)

  const { data: res, isLoading } = useQuery({
    queryKey: ['order', Number(orderId)],
    queryFn:  () => ordersApi.getById(Number(orderId)),
    enabled:  !!orderId,
  })

  const { data: orderLrs = [] } = useQuery({
    queryKey: ['order-lrs', Number(orderId)],
    queryFn:  () => lrsApi.getByOrder(Number(orderId)).then(r => r.data),
    enabled:  !!orderId,
  })

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(Number(orderId)),
    onSuccess: () => {
      toast.success('Order cancelled')
      qc.invalidateQueries({ queryKey: ['order', Number(orderId)] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => toast.error('Failed to cancel order'),
  })

  const order = res?.data

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading order…</div>
  if (!order)    return <div className="p-12 text-center text-gray-500">Order not found.</div>

  const canAssign   = !['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(order.orderStatus)
  const canCancel   = ['PENDING', 'PARTIALLY_ASSIGNED'].includes(order.orderStatus)
  const canUpdatePayment = !['CANCELLED', 'COMPLETED'].includes(order.orderStatus)
  const allocations = order.vehicleAllocations ?? []
  const totalAssigned = allocations.reduce((s, a) => s + Number(a.allocatedWeight), 0)
  const remaining   = Number(order.totalWeight) - totalAssigned

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/orders')}
              className="mt-0.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
                <StatusBadge status={order.orderStatus} />
                <PaymentStatusBadge status={order.orderPaymentStatus} />
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {order.clientName} · Created by {order.createdByName} on {fmt(order.orderDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => confirm(`Cancel order ${order.orderNumber}?`) && cancelMutation.mutate()}
                className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
              >
                <X size={14} /> Cancel
              </Button>
            )}
            {canUpdatePayment && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentStatusOpen(true)}
                className="text-green-700 border-green-200 hover:bg-green-50 gap-1.5"
              >
                <Receipt size={14} /> Payment
              </Button>
            )}
            {order.orderStatus === 'PENDING' && (
              <Button
                size="sm"
                onClick={() => setEditOpen(true)}
                className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5"
              >
                <Pencil size={14} /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Package size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Material</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{order.materialTypeName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{order.freightRateType.replace(/_/g, ' ')}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Scale size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Weight</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{order.totalWeight} T total</p>
          <p className="text-xs mt-0.5">
            <span className="text-green-600">{totalAssigned}T assigned</span>
            {remaining > 0 && <span className="text-orange-500 ml-1">· {remaining}T remaining</span>}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <MapPin size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Route</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {order.sourceCityName} → {order.destinationCityName}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{order.sourceStateName} → {order.destinationStateName}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Receipt size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Freight</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">
            ₹{Number(order.freightRate).toLocaleString('en-IN')}
            <span className="text-xs font-normal text-gray-400 ml-1">/ {order.freightRateType.replace('PER_', '')}</span>
          </p>
          {order.totalFreightAmount && (
            <p className="text-xs text-gray-400 mt-0.5">Total: ₹{Number(order.totalFreightAmount).toLocaleString('en-IN')}</p>
          )}
        </div>
      </div>

      {/* ── Vehicle Allocations ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Truck size={15} className="text-gray-400" />
              Vehicle & Driver Assignments
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {allocations.length} vehicle{allocations.length !== 1 ? 's' : ''} assigned
              {allocations.length > 0 && ` · ${allocations.reduce((s, a) => s + (a.staffAllocations?.length ?? 0), 0)} staff`}
            </p>
          </div>
          {canAssign && (
            <Button
              size="sm"
              onClick={() => setAssignVehicleOpen(true)}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5"
            >
              <Plus size={14} /> Assign Vehicle
            </Button>
          )}
        </div>

        <div className="p-4 space-y-3">
          {allocations.length === 0 ? (
            <div className="py-10 text-center text-gray-400 flex flex-col items-center gap-2">
              <Truck size={32} className="text-gray-200" />
              <p className="text-sm">No vehicles assigned yet</p>
              {canAssign && (
                <Button
                  size="sm"
                  onClick={() => setAssignVehicleOpen(true)}
                  className="mt-2 bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5"
                >
                  <Plus size={13} /> Assign First Vehicle
                </Button>
              )}
            </div>
          ) : (
            allocations.map(a => (
              <VehicleAllocationCard
                key={a.id}
                allocation={a}
                orderId={order.id}
                canAssign={canAssign}
                existingLrId={orderLrs.find(lr => lr.vehicleAllocationId === a.id)?.id}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Extra details ── */}
      {(order.specialInstructions || order.remarks || order.expectedDeliveryDate) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Additional Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Expected Delivery</p>
              <p className="font-medium text-gray-800">{fmt(order.expectedDeliveryDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bill On</p>
              <p className="font-medium text-gray-800">{order.billingOn?.replace(/_/g, ' ') ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Route</p>
              <p className="font-medium text-gray-800">{order.routeName ?? '—'}</p>
            </div>
            {order.specialInstructions && (
              <div className="sm:col-span-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Special Instructions</p>
                <p className="text-gray-700">{order.specialInstructions}</p>
              </div>
            )}
            {order.remarks && (
              <div className="sm:col-span-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Remarks</p>
                <p className="text-gray-700">{order.remarks}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <AssignVehicleDialog
        orderId={order.id}
        remainingWeight={remaining > 0 ? remaining : undefined}
        open={assignVehicleOpen}
        onClose={() => setAssignVehicleOpen(false)}
      />
      <OrderForm open={editOpen} onClose={() => setEditOpen(false)} order={order} />
      <UpdatePaymentStatusDialog
        orderId={order.id}
        current={order.orderPaymentStatus}
        orderStatus={order.orderStatus}
        open={paymentStatusOpen}
        onClose={() => setPaymentStatusOpen(false)}
      />
    </div>
  )
}

// ── update payment status dialog ──────────────────────────────────────────────
const DELIVERY_STATUSES = ['PARTIALLY_DELIVERED', 'DELIVERED']

const ALL_PAYMENT_OPTIONS: { value: OrderPaymentStatus; label: string }[] = [
  { value: 'UNPAID',         label: 'Unpaid' },
  { value: 'ADVANCE_PAID',   label: 'Advance Paid' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID',           label: 'Paid (will mark order Completed)' },
]

function UpdatePaymentStatusDialog({ orderId, current, orderStatus, open, onClose }: {
  orderId: number; current: OrderPaymentStatus; orderStatus: string; open: boolean; onClose: () => void
}) {
  const isDelivered = DELIVERY_STATUSES.includes(orderStatus)
  const options = isDelivered
    ? ALL_PAYMENT_OPTIONS
    : ALL_PAYMENT_OPTIONS.filter(o => o.value === 'UNPAID' || o.value === 'ADVANCE_PAID')
  const qc = useQueryClient()
  const [selected, setSelected] = useState<OrderPaymentStatus>(current)

  const mutation = useMutation({
    mutationFn: () => ordersApi.updatePaymentStatus(orderId, selected),
    onSuccess: () => {
      toast.success('Payment status updated')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to update payment status')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Update Payment Status</DialogTitle></DialogHeader>
        {!isDelivered && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2">
            Partially Paid / Paid options are available only after delivery.
          </p>
        )}
        <div className="space-y-3 pt-2">
          {options.map(opt => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors',
                selected === opt.value
                  ? 'border-feros-navy bg-blue-50'
                  : 'border-gray-100 hover:bg-gray-50'
              )}
            >
              <input
                type="radio"
                name="paymentStatus"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="accent-feros-navy"
              />
              <span className="text-sm font-medium text-gray-800">{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t mt-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || selected === current}
            className="bg-feros-navy hover:bg-feros-navy/90 text-white"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
