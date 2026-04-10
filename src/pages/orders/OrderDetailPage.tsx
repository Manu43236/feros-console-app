import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ordersApi } from '@/api/orders'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import { lrsApi } from '@/api/lrs'
import { breakdownsApi } from '@/api/breakdowns'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft, Truck, Plus, Package, MapPin,
  Scale, Receipt, User, ChevronDown, ChevronUp,
  Pencil, X, RefreshCw, FileText, ExternalLink, ClipboardList,
  AlertTriangle, CheckCircle, WrenchIcon,
} from 'lucide-react'
import type { Breakdown, BreakdownDuration, BreakdownType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
  expectedLoadDate:     z.string().min(1, 'Load date is required'),
  expectedDeliveryDate: z.string().min(1, 'Delivery date is required'),
  remarks:              z.string().optional(),
})
type AssignVehicleForm = z.infer<typeof assignVehicleSchema>

function AssignVehicleDialog({ orderId, remainingWeight, open, onClose }: {
  orderId: number; remainingWeight?: number; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll() })

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<AssignVehicleForm>({
    resolver: zodResolver(assignVehicleSchema) as Resolver<AssignVehicleForm>,
  })
  const watchedVehicleId = watch('vehicleId')

  useEffect(() => {
    if (open) reset({ allocatedWeight: remainingWeight })
  }, [open])

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

  // Show all active vehicles; sort unassigned ones first so they're easy to find
  const activeVehicles = [...(vehiclesRes?.data ?? [])]
    .filter(v => v.isActive)
    .sort((a, b) => (a.isAssigned === b.isAssigned ? 0 : a.isAssigned ? 1 : -1))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Vehicle</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Vehicle *</Label>
            <SearchableSelect
              value={watchedVehicleId ? String(watchedVehicleId) : ''}
              onValueChange={v => setValue('vehicleId', Number(v), { shouldValidate: true })}
              options={activeVehicles.map(v => ({
                value: String(v.id),
                label: `${v.registrationNumber}${v.vehicleTypeName ? ` · ${v.vehicleTypeName}` : ''}${v.capacityInTons ? ` · ${v.capacityInTons}T` : ''}${v.isAssigned ? ` (On Trip: ${v.assignedOrderNumber ?? '—'})` : ''}`,
              }))}
              placeholder="Search vehicle…"
            />
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
              <Label>Expected Load Date *</Label>
              <Input type="date" {...register('expectedLoadDate')} />
              {errors.expectedLoadDate && <p className="text-red-500 text-xs">{errors.expectedLoadDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Expected Delivery Date *</Label>
              <Input type="date" {...register('expectedDeliveryDate')} />
              {errors.expectedDeliveryDate && <p className="text-red-500 text-xs">{errors.expectedDeliveryDate.message}</p>}
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
      qc.invalidateQueries({ queryKey: ['users'] })
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
  }).sort((a, b) => (a.isAssigned === b.isAssigned ? 0 : a.isAssigned ? 1 : -1))

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
                <option key={u.id} value={u.id}>
                  {u.name} · {u.phone}{u.isAssigned ? ` (On Trip: ${u.activeOrderNumber ?? '—'})` : ''}
                </option>
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

// ── report breakdown dialog ───────────────────────────────────────────────────
const breakdownSchema = z.object({
  breakdownType:     z.enum(['MECHANICAL','TYRE','ENGINE','ELECTRICAL','ACCIDENT','OTHER'], { error: 'Breakdown type is required' }),
  breakdownDuration: z.enum(['SHORT','LONG'], { error: 'Select SHORT or LONG breakdown' }),
  breakdownDate:     z.string().min(1, 'Date/time is required'),
  location:          z.string().optional(),
  reason:            z.string().min(1, 'Reason is required'),
  notes:             z.string().optional(),
})
type BreakdownForm = z.infer<typeof breakdownSchema>

const BREAKDOWN_TYPES: { value: BreakdownType; label: string }[] = [
  { value: 'MECHANICAL',  label: 'Mechanical' },
  { value: 'TYRE',        label: 'Tyre' },
  { value: 'ENGINE',      label: 'Engine' },
  { value: 'ELECTRICAL',  label: 'Electrical' },
  { value: 'ACCIDENT',    label: 'Accident' },
  { value: 'OTHER',       label: 'Other' },
]

const BREAKDOWN_DURATIONS: { value: BreakdownDuration; label: string; sub: string }[] = [
  { value: 'SHORT', label: 'Short',  sub: 'Minor — back within 1-2 days' },
  { value: 'LONG',  label: 'Long',   sub: 'Major — extended downtime'    },
]

function ReportBreakdownDialog({ orderId, allocationId, vehicleReg, open, onClose }: {
  orderId: number; allocationId: number; vehicleReg: string; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<BreakdownForm>({
    resolver: zodResolver(breakdownSchema) as Resolver<BreakdownForm>,
    defaultValues: { breakdownDate: new Date().toISOString().slice(0, 16) },
  })
  const selectedDuration = watch('breakdownDuration')

  const mutation = useMutation({
    mutationFn: (data: BreakdownForm) => breakdownsApi.report(orderId, allocationId, {
      ...data,
      breakdownDate: new Date(data.breakdownDate).toISOString(),
    }),
    onSuccess: () => {
      toast.success('Breakdown reported')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['breakdown', allocationId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to report breakdown')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle size={18} /> Report Breakdown
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Vehicle: <span className="font-semibold font-mono text-gray-800">{vehicleReg}</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          {/* Duration — SHORT / LONG */}
          <div className="space-y-1.5">
            <Label>Breakdown Duration *</Label>
            <div className="grid grid-cols-2 gap-2">
              {BREAKDOWN_DURATIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setValue('breakdownDuration', d.value, { shouldValidate: true })}
                  className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-colors ${
                    selectedDuration === d.value
                      ? d.value === 'SHORT'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`text-sm font-semibold ${selectedDuration === d.value ? (d.value === 'SHORT' ? 'text-amber-700' : 'text-red-700') : 'text-gray-700'}`}>
                    {d.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">{d.sub}</span>
                </button>
              ))}
            </div>
            {errors.breakdownDuration && <p className="text-red-500 text-xs">{errors.breakdownDuration.message}</p>}
          </div>

          {/* Cause type */}
          <div className="space-y-1.5">
            <Label>Breakdown Type *</Label>
            <select {...register('breakdownType')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select type</option>
              {BREAKDOWN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {errors.breakdownType && <p className="text-red-500 text-xs">{errors.breakdownType.message}</p>}
          </div>

          {/* Reason — required */}
          <div className="space-y-1.5">
            <Label>Reason *</Label>
            <Input placeholder="What happened? (required)" {...register('reason')} />
            {errors.reason && <p className="text-red-500 text-xs">{errors.reason.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Date & Time *</Label>
            <Input type="datetime-local" {...register('breakdownDate')} />
            {errors.breakdownDate && <p className="text-red-500 text-xs">{errors.breakdownDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input placeholder="e.g. Nashik Highway, km 145" {...register('location')} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Additional notes…" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
              {mutation.isPending ? 'Reporting…' : 'Report Breakdown'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── replace vehicle dialog ────────────────────────────────────────────────────
const replaceSchema = z.object({
  replacementVehicleId:  z.coerce.number().min(1, 'Select a vehicle'),
  expectedDeliveryDate:  z.string().optional(),
  transferStaff:         z.enum(['true','false']),
  notes:                 z.string().optional(),
})
type ReplaceForm = z.infer<typeof replaceSchema>

function ReplaceVehicleDialog({ orderId, breakdown, open, onClose }: {
  orderId: number; breakdown: Breakdown; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll() })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ReplaceForm>({
    resolver: zodResolver(replaceSchema) as Resolver<ReplaceForm>,
    defaultValues: { transferStaff: 'true' },
  })

  const mutation = useMutation({
    mutationFn: (data: ReplaceForm) => breakdownsApi.replace(orderId, breakdown.id, {
      replacementVehicleId: data.replacementVehicleId,
      expectedDeliveryDate:  data.expectedDeliveryDate || undefined,
      transferStaff:         data.transferStaff === 'true',
      notes:                 data.notes,
    }),
    onSuccess: () => {
      toast.success('Replacement vehicle assigned — LR transferred')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['breakdown', breakdown.vehicleAllocationId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to assign replacement vehicle')
    },
  })

  const availableVehicles = (vehiclesRes?.data ?? []).filter(v => v.isActive && !v.isAssigned)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck size={18} /> Assign Replacement Vehicle
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Broken vehicle: <span className="font-semibold font-mono text-red-600">{breakdown.vehicleRegistrationNumber}</span>
            <span className="ml-2 text-gray-400">· Same LR will travel with the goods</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Replacement Vehicle *</Label>
            <select {...register('replacementVehicleId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select vehicle</option>
              {availableVehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber}{v.vehicleTypeName ? ` · ${v.vehicleTypeName}` : ''}{v.capacityInTons ? ` · ${v.capacityInTons}T` : ''}
                </option>
              ))}
            </select>
            {errors.replacementVehicleId && <p className="text-red-500 text-xs">{errors.replacementVehicleId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Revised Delivery Date</Label>
            <Input type="date" {...register('expectedDeliveryDate')} />
          </div>
          <div className="space-y-1.5">
            <Label>Driver / Cleaner *</Label>
            <select {...register('transferStaff')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="true">Transfer existing driver & cleaner to replacement vehicle</option>
              <option value="false">Cancel staff — assign manually to new vehicle</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Reason for replacement…" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Assigning…' : 'Assign Replacement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── breakdown banner (shown on vehicle card when breakdown exists) ─────────────
function BreakdownBanner({ orderId, breakdown, onReplace, onResolve, onCancel }: {
  orderId: number
  breakdown: Breakdown
  onReplace: () => void
  onResolve: () => void
  onCancel:  () => void
}) {
  const qc = useQueryClient()
  const isActive = breakdown.status === 'REPORTED' || breakdown.status === 'IN_REPAIR'
  const [dlg, setDlg] = useState<{ title: string; desc: string; onOk: () => void } | null>(null)

  const resolveMutation = useMutation({
    mutationFn: () => breakdownsApi.resolve(orderId, breakdown.id),
    onSuccess: () => {
      toast.success('Breakdown resolved — trip continues')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['breakdown', breakdown.vehicleAllocationId] })
      onResolve()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to resolve breakdown')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => breakdownsApi.cancel(orderId, breakdown.id),
    onSuccess: () => {
      toast.success('Breakdown report cancelled')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['breakdown', breakdown.vehicleAllocationId] })
      onCancel()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to cancel breakdown report')
    },
  })

  if (breakdown.status === 'VEHICLE_REPLACED') {
    return (
      <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-gray-100 border border-gray-200 flex items-center gap-2 text-xs text-gray-500">
        <AlertTriangle size={13} className="text-gray-400 shrink-0" />
        <span>Breakdown — goods transferred to <span className="font-semibold font-mono text-gray-700">{breakdown.replacementVehicleRegistrationNumber}</span></span>
      </div>
    )
  }

  if (breakdown.status === 'RESOLVED') {
    return (
      <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2 text-xs text-green-700">
        <CheckCircle size={13} className="shrink-0" />
        <span>Breakdown resolved — trip continues</span>
      </div>
    )
  }

  return (
    <div className="mx-4 mb-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="text-orange-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-orange-700">
            Breakdown Reported · {breakdown.breakdownType.charAt(0) + breakdown.breakdownType.slice(1).toLowerCase()}
          </p>
          {breakdown.location && (
            <p className="text-xs text-orange-600 mt-0.5">{breakdown.location}</p>
          )}
          {breakdown.reason && (
            <p className="text-xs text-gray-500 mt-0.5">{breakdown.reason}</p>
          )}
        </div>
      </div>
      {isActive && (
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <button
            onClick={onReplace}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-feros-navy text-white hover:bg-feros-navy/90 transition-colors"
          >
            <Truck size={11} /> Assign Replacement
          </button>
          <button
            onClick={() => setDlg({ title: 'Resolve Breakdown', desc: 'Mark breakdown as resolved? Trip will continue with the same vehicle.', onOk: () => resolveMutation.mutate() })}
            disabled={resolveMutation.isPending}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-green-700 border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            <WrenchIcon size={11} /> Repaired — Continue Trip
          </button>
          {breakdown.status === 'REPORTED' && (
            <button
              onClick={() => setDlg({ title: 'Cancel Breakdown Report', desc: 'Cancel this breakdown report? Use only for false alarms.', onOk: () => cancelMutation.mutate() })}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-gray-500 border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <X size={11} /> False Alarm
            </button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!dlg}
        title={dlg?.title ?? ''}
        description={dlg?.desc ?? ''}
        confirmLabel="Confirm"
        variant="default"
        onConfirm={() => { dlg?.onOk(); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
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
  const [expanded, setExpanded]         = useState(true)
  const [slotDialog, setSlotDialog]     = useState<'DRIVER' | 'CLEANER' | null>(null)
  const [lrDialog, setLrDialog]         = useState(false)
  const [breakdownDialog, setBreakdownDialog] = useState(false)
  const [replaceDialog, setReplaceDialog]     = useState(false)
  const [dlg, setDlg]                         = useState<{ title: string; desc: string; onOk: () => void } | null>(null)

  const { data: breakdownRes } = useQuery({
    queryKey: ['breakdown', allocation.id],
    queryFn:  () => breakdownsApi.get(orderId, allocation.id),
    enabled:  allocation.allocationStatus === 'IN_TRANSIT' || allocation.allocationStatus === 'BREAKDOWN',
    retry: false,
  })
  const breakdown = breakdownRes?.data ?? null

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

  const unassignStaffMutation = useMutation({
    mutationFn: (staffAllocationId: number) => ordersApi.unassignStaff(orderId, staffAllocationId),
    onSuccess: () => {
      toast.success('Staff unassigned')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to unassign staff')
    },
  })

  const canUnassign        = canAssign && allocation.allocationStatus === 'ALLOCATED' && !existingLrId
  const canReportBreakdown = canAssign && allocation.allocationStatus === 'IN_TRANSIT' && !breakdown

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

        {/* Breakdown button */}
        {canReportBreakdown && (
          <button
            onClick={() => setBreakdownDialog(true)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-orange-600 border-orange-200 hover:bg-orange-50 transition-colors shrink-0"
          >
            <AlertTriangle size={11} /> Breakdown
          </button>
        )}

        {/* Unassign button */}
        {canUnassign && (
          <button
            onClick={() => setDlg({ title: 'Unassign Vehicle', desc: `Unassign ${regNo} from this order?`, onOk: () => unassignMutation.mutate() })}
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

      {/* Breakdown banner */}
      {breakdown && (
        <BreakdownBanner
          orderId={orderId}
          breakdown={breakdown}
          onReplace={() => setReplaceDialog(true)}
          onResolve={() => {}}
          onCancel={() => {}}
        />
      )}

      {/* Driver + Cleaner slots */}
      {expanded && (
        <div className="divide-y divide-gray-50">
          {/* Driver slot */}
          <StaffSlot
            label="Driver"
            person={activeDriver}
            canAssign={canAssign}
            onAssign={() => setSlotDialog('DRIVER')}
            onUnassign={canAssign ? (id) => unassignStaffMutation.mutate(id) : undefined}
          />
          {/* Cleaner slot */}
          <StaffSlot
            label="Cleaner"
            person={activeCleaner}
            canAssign={canAssign}
            onAssign={() => setSlotDialog('CLEANER')}
            onUnassign={canAssign ? (id) => unassignStaffMutation.mutate(id) : undefined}
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
      {breakdownDialog && (
        <ReportBreakdownDialog
          orderId={orderId}
          allocationId={allocation.id}
          vehicleReg={regNo ?? ''}
          open={breakdownDialog}
          onClose={() => setBreakdownDialog(false)}
        />
      )}
      {replaceDialog && breakdown && (
        <ReplaceVehicleDialog
          orderId={orderId}
          breakdown={breakdown}
          open={replaceDialog}
          onClose={() => setReplaceDialog(false)}
        />
      )}
      <ConfirmDialog
        open={!!dlg}
        title={dlg?.title ?? ''}
        description={dlg?.desc ?? ''}
        confirmLabel="Unassign"
        onConfirm={() => { dlg?.onOk(); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── staff slot row ────────────────────────────────────────────────────────────
function StaffSlot({ label, person, canAssign, onAssign, onUnassign }: {
  label: string
  person: { id: number; userName: string; expectedStartDate?: string; expectedEndDate?: string; allocationStatus: string } | undefined
  canAssign: boolean
  onAssign: () => void
  onUnassign?: (id: number) => void
}) {
  const canUnassignPerson = !!person && person.allocationStatus === 'ALLOCATED' && !!onUnassign
  const [dlg, setDlg] = useState<{ title: string; desc: string; onOk: () => void } | null>(null)

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
          <div>
            <p className="text-sm font-medium text-gray-800">
              {person.userName}
              {person.expectedStartDate && (
                <span className="text-xs font-normal text-gray-400 ml-1.5">
                  {fmt(person.expectedStartDate)}{person.expectedEndDate ? ` → ${fmt(person.expectedEndDate)}` : ''}
                </span>
              )}
            </p>
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full',
              person.allocationStatus === 'IN_TRANSIT' ? 'bg-orange-50 text-orange-600' :
              person.allocationStatus === 'COMPLETED'  ? 'bg-green-50 text-green-600' :
              'bg-blue-50 text-blue-600'
            )}>
              {person.allocationStatus}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Not assigned</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {canUnassignPerson && (
          <button
            onClick={() => setDlg({ title: 'Unassign Staff', desc: `Unassign ${person!.userName} from this vehicle?`, onOk: () => onUnassign!(person!.id) })}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-red-600 border-red-200 hover:bg-red-50 transition-colors"
          >
            <X size={11} /> Unassign
          </button>
        )}
        {canAssign && (
          <button
            onClick={onAssign}
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors',
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
      <ConfirmDialog
        open={!!dlg}
        title={dlg?.title ?? ''}
        description={dlg?.desc ?? ''}
        confirmLabel="Unassign"
        onConfirm={() => { dlg?.onOk(); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
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
  const [dlg, setDlg]                               = useState<{ title: string; desc: string; onOk: () => void } | null>(null)

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
  const hasBreakdown = (order.vehicleAllocations ?? []).some(a => a.allocationStatus === 'IN_TRANSIT')
  const canUpdatePayment = !['CANCELLED', 'COMPLETED'].includes(order.orderStatus)
  const allocations = order.vehicleAllocations ?? []
  const totalAssigned = allocations.reduce((s, a) => s + Number(a.allocatedWeight), 0)
  const remaining   = Number(order.totalWeight) - totalAssigned

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-blue-900 rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <ClipboardList size={180} />
        </div>
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mt-0.5"
            >
              <ArrowLeft size={15} /> Orders
            </button>
            <div className="flex items-center gap-2 shrink-0">
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                const desc = hasBreakdown
                  ? `Warning: This order has vehicles currently in transit. Cancel order ${order.orderNumber} anyway?`
                  : `Cancel order ${order.orderNumber}? This cannot be undone.`
                setDlg({ title: 'Cancel Order', desc, onOk: () => cancelMutation.mutate() })
              }}
                  className="text-red-300 border-red-400/40 hover:bg-red-500/20 bg-transparent gap-1.5"
                >
                  <X size={14} /> Cancel
                </Button>
              )}
              {canUpdatePayment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentStatusOpen(true)}
                  className="text-green-300 border-green-400/40 hover:bg-green-500/20 bg-transparent gap-1.5"
                >
                  <Receipt size={14} /> Payment
                </Button>
              )}
              {order.orderStatus === 'PENDING' && (
                <Button
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  className="bg-white/20 hover:bg-white/30 text-white gap-1.5"
                >
                  <Pencil size={14} /> Edit
                </Button>
              )}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white">{order.orderNumber}</h1>
              <StatusBadge status={order.orderStatus} />
              <PaymentStatusBadge status={order.orderPaymentStatus} />
            </div>
            <p className="text-blue-200 text-sm mt-1.5">
              {order.clientName} · Created by {order.createdByName} on {fmt(order.orderDate)}
            </p>
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

      {/* ── E-way Bill ── */}
      {(order.ewayBillNumber || order.ewayBillDate || order.ewayBillValidUpto) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">E-way Bill</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">E-way Bill No.</p>
              <p className="font-medium text-gray-800">{order.ewayBillNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bill Date</p>
              <p className="font-medium text-gray-800">{fmt(order.ewayBillDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Valid Upto</p>
              <p className="font-medium text-gray-800">{fmt(order.ewayBillValidUpto)}</p>
            </div>
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
      <ConfirmDialog
        open={!!dlg}
        title={dlg?.title ?? ''}
        description={dlg?.desc ?? ''}
        confirmLabel="Yes, Cancel"
        onConfirm={() => { dlg?.onOk(); setDlg(null) }}
        onCancel={() => setDlg(null)}
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
