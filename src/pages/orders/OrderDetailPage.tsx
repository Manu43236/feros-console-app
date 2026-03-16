import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ordersApi } from '@/api/orders'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import { toast } from 'sonner'
import { ArrowLeft, Truck, Users, Plus, Package, MapPin, Calendar, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from './OrdersPage'
import type { VehicleAllocation } from '@/types'

// ── Assign Vehicle Dialog ─────────────────────────────────────────────────────
const assignVehicleSchema = z.object({
  vehicleId:            z.coerce.number().min(1, 'Select a vehicle'),
  allocatedWeight:      z.coerce.number().positive('Enter weight'),
  expectedLoadDate:     z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  remarks:              z.string().optional(),
})
type AssignVehicleForm = z.infer<typeof assignVehicleSchema>

function AssignVehicleDialog({ orderId, open, onClose }: { orderId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: vehiclesApi.getAll })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<AssignVehicleForm>({
    resolver: zodResolver(assignVehicleSchema) as Resolver<AssignVehicleForm>,
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Vehicle</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Vehicle *</Label>
            <select {...register('vehicleId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select vehicle</option>
              {vehiclesRes?.data?.filter(v => v.isActive).map(v => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber}{v.vehicleTypeName ? ` (${v.vehicleTypeName})` : ''}
                </option>
              ))}
            </select>
            {errors.vehicleId && <p className="text-red-500 text-xs">{errors.vehicleId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Allocated Weight (tons) *</Label>
            <Input type="number" step="0.01" placeholder="25.00" {...register('allocatedWeight')} />
            {errors.allocatedWeight && <p className="text-red-500 text-xs">{errors.allocatedWeight.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
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

// ── Assign Staff Dialog ───────────────────────────────────────────────────────
const assignStaffSchema = z.object({
  userId:            z.coerce.number().min(1, 'Select a staff member'),
  expectedStartDate: z.string().optional(),
  expectedEndDate:   z.string().optional(),
  remarks:           z.string().optional(),
})
type AssignStaffForm = z.infer<typeof assignStaffSchema>

function AssignStaffDialog({
  orderId, allocation, open, onClose,
}: {
  orderId: number; allocation: VehicleAllocation; open: boolean; onClose: () => void
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
      toast.success('Staff assigned successfully')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to assign staff')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Staff — {allocation.registrationNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Staff Member *</Label>
            <select {...register('userId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select staff</option>
              {staffRes?.data?.filter(u => u.isActive).map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
              ))}
            </select>
            {errors.userId && <p className="text-red-500 text-xs">{errors.userId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Expected Start Date</Label>
              <Input type="date" {...register('expectedStartDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Expected End Date</Label>
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
              {mutation.isPending ? 'Assigning…' : 'Assign Staff'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── main detail page ──────────────────────────────────────────────────────────
function fmt(date?: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const [assignVehicleOpen, setAssignVehicleOpen]     = useState(false)
  const [assignStaffAlloc, setAssignStaffAlloc]       = useState<VehicleAllocation | undefined>()

  const { data: res, isLoading } = useQuery({
    queryKey: ['order', Number(orderId)],
    queryFn: () => ordersApi.getById(Number(orderId)),
    enabled: !!orderId,
  })

  const order = res?.data

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading order…</div>
  if (!order)    return <div className="p-12 text-center text-gray-500">Order not found.</div>

  const canAssignVehicle = !['DELIVERED', 'CANCELLED'].includes(order.orderStatus)

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/orders')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            <StatusBadge status={order.orderStatus} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">{order.clientName} · Created by {order.createdByName}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Package size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Material</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{order.materialTypeName}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Scale size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Weight</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{order.totalWeight} T total</p>
          <p className="text-xs text-gray-400 mt-0.5">{order.totalWeightFulfilled} T fulfilled</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <MapPin size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Route</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{order.sourceCityName} → {order.destinationCityName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{order.sourceStateName} → {order.destinationStateName}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Calendar size={14} />
            <span className="text-xs font-medium uppercase tracking-wide">Dates</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{fmt(order.orderDate)}</p>
          {order.expectedDeliveryDate && (
            <p className="text-xs text-gray-400 mt-0.5">Due: {fmt(order.expectedDeliveryDate)}</p>
          )}
        </div>
      </div>

      {/* Freight details */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Freight Details</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Rate Type</p>
            <p className="font-medium text-gray-800">{order.freightRateType.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Rate</p>
            <p className="font-medium text-gray-800">₹{Number(order.freightRate).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Billed On</p>
            <p className="font-medium text-gray-800">{order.billingOn?.replace(/_/g, ' ') ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Freight</p>
            <p className="font-medium text-gray-800">
              {order.totalFreightAmount ? `₹${Number(order.totalFreightAmount).toLocaleString('en-IN')}` : '—'}
            </p>
          </div>
        </div>
        {order.specialInstructions && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Special Instructions</p>
            <p className="text-sm text-gray-700">{order.specialInstructions}</p>
          </div>
        )}
        {order.remarks && (
          <div className="mt-3">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Remarks</p>
            <p className="text-sm text-gray-700">{order.remarks}</p>
          </div>
        )}
      </div>

      {/* Vehicle Allocations */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Truck size={15} className="text-gray-400" />
            Vehicle Allocations
            <span className="text-xs font-normal text-gray-400">
              ({order.vehicleAllocations?.length ?? 0})
            </span>
          </h2>
          {canAssignVehicle && (
            <Button
              size="sm"
              onClick={() => setAssignVehicleOpen(true)}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5"
            >
              <Plus size={14} /> Assign Vehicle
            </Button>
          )}
        </div>

        {!order.vehicleAllocations?.length ? (
          <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
            <Truck size={28} className="text-gray-200" />
            <p className="text-sm">No vehicles assigned yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Allocated Weight</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Load Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Delivery Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {order.vehicleAllocations.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-gray-800">{a.registrationNumber}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{a.allocatedWeight} T</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {a.expectedLoadDate
                        ? new Date(a.expectedLoadDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {a.expectedDeliveryDate
                        ? new Date(a.expectedDeliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {a.allocationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setAssignStaffAlloc(a)}
                        className="flex items-center gap-1.5 text-xs text-feros-navy hover:underline"
                      >
                        <Users size={13} /> Assign Staff
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {assignVehicleOpen && (
        <AssignVehicleDialog
          orderId={order.id}
          open={assignVehicleOpen}
          onClose={() => setAssignVehicleOpen(false)}
        />
      )}
      {assignStaffAlloc && (
        <AssignStaffDialog
          orderId={order.id}
          allocation={assignStaffAlloc}
          open={!!assignStaffAlloc}
          onClose={() => setAssignStaffAlloc(undefined)}
        />
      )}
    </div>
  )
}
