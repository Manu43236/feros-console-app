import { getApiError } from '@/lib/apiError'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import {
  ArrowLeft, Truck, Package, AlertTriangle, CheckCircle2,
  MapPin, DollarSign, Plus, Activity, Scale, FileText, Pencil, Trash2, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/api/client'
import { lrsApi } from '@/api/lrs'
import { breakdownsApi } from '@/api/breakdowns'
import { tenantMastersApi } from '@/api/masters'
import type { LrStatus, LrCheckpost, LrCharge } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ─── Status helpers ────────────────────────────────────────────────────────
const STATUS_CFG: Record<LrStatus, { label: string; bg: string; text: string; dot: string }> = {
  CREATED:       { label: 'Created',       bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  WEIGHT_LOADED: { label: 'Weight Loaded', bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  IN_TRANSIT:    { label: 'In Transit',    bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500'  },
  DELIVERED:     { label: 'Delivered',     bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  CANCELLED:     { label: 'Cancelled',     bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500'    },
}

function StatusBadge({ status }: { status: LrStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {status === 'IN_TRANSIT' ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      )}
      {cfg.label}
    </span>
  )
}

// ─── Record Loading Dialog ─────────────────────────────────────────────────
const loadSchema = z.object({
  loadedWeight: z.string().min(1, 'Required').refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
  remarks:      z.string().optional(),
})
type LoadForm = z.infer<typeof loadSchema>

function RecordLoadingDialog({ lrId, allocatedWeight, open, onClose }: { lrId: number; allocatedWeight?: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<LoadForm>({
    resolver: zodResolver(loadSchema) as Resolver<LoadForm>,
  })

  useEffect(() => {
    if (open && allocatedWeight != null) reset({ loadedWeight: String(allocatedWeight) })
  }, [open])

  const mutation = useMutation({
    mutationFn: (data: LoadForm) => lrsApi.update(lrId, {
      loadedWeight: parseFloat(data.loadedWeight),
      loadedAt:     new Date().toISOString().slice(0, 19),
      lrStatus:     'WEIGHT_LOADED',
      remarks:      data.remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lr', lrId] })
      qc.invalidateQueries({ queryKey: ['lrs'] })
      reset(); onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record Loading</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Loaded Weight (tons) *</Label>
            <Input type="number" step="0.01" min="0" {...register('loadedWeight')} placeholder="Actual weight loaded on vehicle" autoFocus />
            {errors.loadedWeight && <p className="text-red-500 text-xs">{errors.loadedWeight.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <textarea {...register('remarks')} rows={2} className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background" />
          </div>
          {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
          <p className="text-xs text-gray-500">LR status will move to <strong>Weight Loaded</strong>. Driver will start the trip from mobile.</p>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {mutation.isPending ? 'Saving…' : 'Record Loading'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Mark Delivered Dialog ─────────────────────────────────────────────────
const deliverSchema = z.object({
  deliveredWeight: z.string().min(1, 'Required').refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
  endOdometer:     z.string().min(1, 'Required').refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
  remarks:         z.string().optional(),
})
type DeliverForm = z.infer<typeof deliverSchema>

function MarkDeliveredDialog({ lrId, startOdometer, open, onClose }: { lrId: number; startOdometer?: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<DeliverForm>({
    resolver: zodResolver(deliverSchema) as Resolver<DeliverForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: DeliverForm) => lrsApi.update(lrId, {
      deliveredWeight: parseFloat(data.deliveredWeight),
      endOdometer:     parseFloat(data.endOdometer),
      deliveredAt:     new Date().toISOString().slice(0, 19),
      lrStatus:        'DELIVERED',
      remarks:         data.remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lr', lrId] })
      qc.invalidateQueries({ queryKey: ['lrs'] })
      reset(); onClose()
    },
  })

  const apiError = mutation.isError
    ? ((mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed. Please try again.')
    : null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark as Delivered</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Delivered Weight (tons) *</Label>
            <Input type="number" step="0.01" min="0" {...register('deliveredWeight')} placeholder="Actual weight delivered at destination" autoFocus />
            {errors.deliveredWeight && <p className="text-red-500 text-xs">{errors.deliveredWeight.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>End Odometer (km) *</Label>
            <Input type="number" step="0.1" min="0" {...register('endOdometer')} placeholder="Odometer reading at delivery point" />
            {errors.endOdometer && <p className="text-red-500 text-xs">{errors.endOdometer.message}</p>}
            {startOdometer != null && (
              <p className="text-xs text-gray-500">Start odometer was <strong>{startOdometer} km</strong> — end must be higher.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <textarea {...register('remarks')} rows={2} className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background" />
          </div>
          {apiError && <p className="text-sm text-red-600">{apiError}</p>}
          <p className="text-xs text-gray-500">LR status will move to <strong>Delivered</strong>.</p>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {mutation.isPending ? 'Saving…' : 'Mark Delivered'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Checkpost Dialog ──────────────────────────────────────────────────
const checkpostSchema = z.object({
  checkpostName:     z.string().min(1, 'Checkpost name is required'),
  location:          z.string().optional(),
  fineAmount:        z.string().optional(),
  fineReceiptNumber: z.string().optional(),
  remarks:           z.string().optional(),
})
type CheckpostForm = z.infer<typeof checkpostSchema>

function AddCheckpostDialog({ lrId, open, onClose }: { lrId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CheckpostForm>({
    resolver: zodResolver(checkpostSchema) as Resolver<CheckpostForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: CheckpostForm) => lrsApi.addCheckpost(lrId, {
      checkpostName:     data.checkpostName,
      location:          data.location || undefined,
      fineAmount:        data.fineAmount ? parseFloat(data.fineAmount) : undefined,
      fineReceiptNumber: data.fineReceiptNumber || undefined,
      remarks:           data.remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lr', lrId] })
      qc.invalidateQueries({ queryKey: ['lr-checkposts', lrId] })
      reset(); onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Checkpost</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Checkpost Name *</Label>
            <Input {...register('checkpostName')} placeholder="e.g. Nashik Toll, Border Checkpost…" autoFocus />
            {errors.checkpostName && <p className="text-red-500 text-xs">{errors.checkpostName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input {...register('location')} placeholder="City / Highway name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fine Amount (₹)</Label>
              <Input type="number" step="0.01" min="0" {...register('fineAmount')} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Fine Receipt #</Label>
              <Input {...register('fineReceiptNumber')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <textarea {...register('remarks')} rows={2} className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background" />
          </div>
          {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Adding…' : 'Add Checkpost'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Charge Dialog ─────────────────────────────────────────────────────
const chargeSchema = z.object({
  chargeTypeId: z.string().min(1, 'Select charge type'),
  amount:       z.string().min(1, 'Required').refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
  remarks:      z.string().optional(),
})
type ChargeForm = z.infer<typeof chargeSchema>

function AddChargeDialog({ lrId, open, onClose }: { lrId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()

  const { data: chargeTypes = [] } = useQuery({
    queryKey: ['charge-types'],
    queryFn: () => tenantMastersApi.getChargeTypes().then(r => r.data),
  })

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<ChargeForm>({
    resolver: zodResolver(chargeSchema) as Resolver<ChargeForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: ChargeForm) => lrsApi.addCharge(lrId, {
      chargeTypeId: parseInt(data.chargeTypeId),
      amount:       parseFloat(data.amount),
      remarks:      data.remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lr', lrId] })
      qc.invalidateQueries({ queryKey: ['lr-charges', lrId] })
      reset(); onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Charge</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Charge Type *</Label>
            <Controller
              name="chargeTypeId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onValueChange={v => field.onChange(v)}
                  options={chargeTypes.map(ct => ({ value: String(ct.id), label: ct.name }))}
                  placeholder="Select type…"
                  className="mt-1"
                />
              )}
            />
            {errors.chargeTypeId && <p className="text-red-500 text-xs">{errors.chargeTypeId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <Input type="number" step="0.01" min="0" {...register('amount')} placeholder="0.00" autoFocus />
            {errors.amount && <p className="text-red-500 text-xs">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <textarea {...register('remarks')} rows={2} className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background" />
          </div>
          {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Adding…' : 'Add Charge'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: boolean
}) {
  return (
    <div className={cn('bg-white rounded-xl border p-4', accent ? 'border-red-300 bg-red-50' : 'border-gray-100')}>
      <div className="flex items-center gap-2 mb-2">
        <span className={accent ? 'text-red-400' : 'text-gray-400'}>{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', accent ? 'text-red-700' : 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Checkposts Tab ────────────────────────────────────────────────────────
function CheckpostsTab({ lrId, checkposts, canDelete }: { lrId: number; checkposts: LrCheckpost[]; canDelete: boolean }) {
  const qc = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (checkpostId: number) => lrsApi.deleteCheckpost(lrId, checkpostId),
    onSuccess: () => { toast.success('Checkpost deleted'); qc.invalidateQueries({ queryKey: ['lr-checkposts', lrId] }) },
    onError: () => toast.error('Failed to delete checkpost'),
  })

  if (checkposts.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No checkposts recorded yet</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {checkposts.map((cp, i) => (
        <div key={cp.id ?? i} className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-900">{cp.checkpostName}</p>
              {cp.location && <span className="text-xs text-gray-500">— {cp.location}</span>}
            </div>
            {cp.fineAmount != null && cp.fineAmount > 0 && (
              <p className="text-sm text-red-600 mt-0.5 font-medium">
                Fine: ₹{cp.fineAmount.toLocaleString()}
                {cp.fineReceiptNumber && <span className="text-gray-500 font-normal"> (Receipt: {cp.fineReceiptNumber})</span>}
              </p>
            )}
            {cp.remarks && <p className="text-xs text-gray-500 mt-1">{cp.remarks}</p>}
          </div>
          {canDelete && cp.id && (
            <button
              onClick={() => deleteMutation.mutate(cp.id!)}
              className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
              title="Delete checkpost"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Charges Tab ───────────────────────────────────────────────────────────
function ChargesTab({ lrId, charges, canDelete }: { lrId: number; charges: LrCharge[]; canDelete: boolean }) {
  const qc = useQueryClient()
  const total = charges.reduce((s, c) => s + c.amount, 0)

  const deleteMutation = useMutation({
    mutationFn: (chargeId: number) => lrsApi.deleteCharge(lrId, chargeId),
    onSuccess: () => { toast.success('Charge deleted'); qc.invalidateQueries({ queryKey: ['lr-charges', lrId] }) },
    onError: () => toast.error('Failed to delete charge'),
  })

  if (charges.length === 0) {
    return (
      <div className="text-center py-12">
        <DollarSign className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No charges recorded yet</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {charges.map((ch, i) => (
        <div key={ch.id ?? i} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{ch.chargeTypeName}</p>
            {ch.remarks && <p className="text-xs text-gray-500 mt-0.5">{ch.remarks}</p>}
          </div>
          <p className="text-base font-bold text-gray-800">₹{ch.amount.toLocaleString()}</p>
          {canDelete && ch.id && (
            <button
              onClick={() => deleteMutation.mutate(ch.id!)}
              className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
              title="Delete charge"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {charges.length > 1 && (
        <div className="bg-gray-50 border-t-2 border-gray-200 rounded-xl p-4 flex items-center justify-between">
          <p className="font-semibold text-gray-700">Total Charges</p>
          <p className="text-lg font-bold text-gray-900">₹{total.toLocaleString()}</p>
        </div>
      )}
    </div>
  )
}

// ─── Edit LR Dialog ────────────────────────────────────────────────────────
function EditLrDialog({ lrId, lrStatus, currentRemarks, currentLoadedWeight, currentDeliveredWeight, open, onClose }: {
  lrId: number
  lrStatus: LrStatus
  currentRemarks?: string
  currentLoadedWeight?: number
  currentDeliveredWeight?: number
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [remarks, setRemarks]               = useState(currentRemarks ?? '')
  const [loadedWeight, setLoadedWeight]     = useState(currentLoadedWeight?.toString() ?? '')
  const [deliveredWeight, setDeliveredWeight] = useState(currentDeliveredWeight?.toString() ?? '')

  const canEditLoaded    = lrStatus === 'CREATED' || lrStatus === 'WEIGHT_LOADED' || lrStatus === 'IN_TRANSIT'
  const canEditDelivered = lrStatus === 'DELIVERED'

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { remarks: remarks || undefined }
      if (canEditLoaded && loadedWeight)    payload.loadedWeight    = parseFloat(loadedWeight)
      if (canEditDelivered && deliveredWeight) payload.deliveredWeight = parseFloat(deliveredWeight)
      return lrsApi.update(lrId, payload)
    },
    onSuccess: () => { toast.success('LR updated'); qc.invalidateQueries({ queryKey: ['lr', lrId] }); qc.invalidateQueries({ queryKey: ['lrs'] }); onClose() },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed to update LR'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit LR</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {canEditLoaded && (
            <div>
              <Label>Correct Loaded Weight (tons)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={loadedWeight}
                onChange={e => setLoadedWeight(e.target.value)}
                placeholder="e.g. 10"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Current: {currentLoadedWeight ?? '—'}T</p>
            </div>
          )}
          {canEditDelivered && (
            <div>
              <Label>Correct Delivered Weight (tons)</Label>
              <Input
                type="number" step="0.01" min="0"
                value={deliveredWeight}
                onChange={e => setDeliveredWeight(e.target.value)}
                placeholder="e.g. 9.5"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Current: {currentDeliveredWeight ?? '—'}T · Cannot exceed loaded weight</p>
            </div>
          )}
          <div>
            <Label>Remarks</Label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background"
              placeholder="Optional notes…"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 bg-feros-navy hover:bg-feros-navy/90" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cancel LR Dialog ──────────────────────────────────────────────────────
function CancelLrDialog({ lrId, open, onClose }: { lrId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: () => lrsApi.cancel(lrId),
    onSuccess: () => {
      toast.success('LR cancelled')
      qc.invalidateQueries({ queryKey: ['lr', lrId] })
      qc.invalidateQueries({ queryKey: ['lrs'] })
      onClose()
      navigate('/lrs')
    },
    onError: () => toast.error('Failed to cancel LR'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cancel LR</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600">Are you sure you want to cancel this LR? The vehicle allocation will revert to <strong>Allocated</strong> status.</p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Keep LR</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Cancelling…' : 'Yes, Cancel LR'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
type ActiveDialog = 'load' | 'deliver' | 'checkpost' | 'charge' | 'cancel' | 'edit' | null

export function LrDetailPage() {
  const { lrId } = useParams<{ lrId: string }>()
  const navigate = useNavigate()
  const id = parseInt(lrId!)

  const [tab, setTab]               = useState<'checkposts' | 'charges'>('checkposts')
  const [dialog, setDialog]         = useState<ActiveDialog>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const { data: lr, isLoading } = useQuery({
    queryKey: ['lr', id],
    queryFn: () => lrsApi.getById(id).then(r => r.data),
    enabled: !isNaN(id),
  })

  const { data: checkposts = [] } = useQuery({
    queryKey: ['lr-checkposts', id],
    queryFn: () => lrsApi.getCheckposts(id).then(r => r.data),
    enabled: !isNaN(id),
  })

  const { data: charges = [] } = useQuery({
    queryKey: ['lr-charges', id],
    queryFn: () => lrsApi.getCharges(id).then(r => r.data),
    enabled: !isNaN(id),
  })

  const { data: breakdown } = useQuery({
    queryKey: ['lr-breakdown', id],
    queryFn: () => breakdownsApi.get(lr!.orderId, lr!.vehicleAllocationId!).then(r => r.data).catch(() => null),
    enabled: !!lr && lr.lrStatus === 'IN_TRANSIT' && !!lr.vehicleAllocationId,
  })

  const hasActiveBreakdown = breakdown?.status === 'REPORTED'

  async function handlePdf() {
    if (!lr) return
    setPdfLoading(true)
    try {
      const response = await apiClient.get(`/lrs/${lr.id}/pdf`, {
        responseType: 'blob',
        headers: { Accept: 'application/pdf' },
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading…</div>
  if (!lr) return <div className="p-8 text-center text-gray-500">LR not found.</div>

  const isActive   = lr.lrStatus !== 'CANCELLED' && lr.lrStatus !== 'DELIVERED'
  const canAdd     = isActive
  const totalFines = checkposts.reduce((s, cp) => s + (cp.fineAmount ?? 0), 0)

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-blue-900 rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Truck size={180} />
        </div>
        <div className="relative px-6 py-6">
          {/* Back */}
          <button
            onClick={() => navigate('/lrs')}
            className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to LR Register
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-wide">{lr.lrNumber}</h1>
                <StatusBadge status={lr.lrStatus} />
                {lr.isOverloaded && (
                  <span className="flex items-center gap-1 bg-red-500/20 text-red-200 px-2.5 py-1 rounded-full text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Overloaded
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-blue-300">
                <span>Order: <span className="text-white font-medium">{lr.orderNumber}</span></span>
                {lr.clientName && <span>Client: <span className="text-white font-medium">{lr.clientName}</span></span>}
                <span>LR Date: <span className="text-white font-medium">{lr.lrDate}</span></span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-sm text-blue-300">
                <Truck className="h-4 w-4" />
                <span className="text-white font-medium">{lr.vehicleRegistrationNumber}</span>
                {lr.vehicleTypeName && <span className="text-blue-300/70">({lr.vehicleTypeName})</span>}
              </div>
            </div>

            {/* Action buttons */}
            <TooltipProvider delayDuration={300}>
            <div className="flex flex-shrink-0 items-center gap-2">
              {/* Icon-only buttons with tooltips */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handlePdf}
                    disabled={pdfLoading}
                    className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{pdfLoading ? 'Generating…' : 'Download PDF'}</TooltipContent>
              </Tooltip>

              {isActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setDialog('edit')}
                      className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-lg transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Edit remarks</TooltipContent>
                </Tooltip>
              )}

              {/* Primary actions — keep text for clarity */}
              {lr.lrStatus === 'CREATED' && (
                <button
                  onClick={() => setDialog('load')}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Package className="h-4 w-4" />
                  Record Loading
                </button>
              )}
              {lr.lrStatus === 'WEIGHT_LOADED' && (
                <div className="flex items-center gap-2 bg-purple-500/20 text-purple-200 px-3 py-2 rounded-lg text-sm font-medium">
                  <Package className="h-4 w-4" />
                  Awaiting Driver Start
                </div>
              )}
              {lr.lrStatus === 'IN_TRANSIT' && (
                hasActiveBreakdown ? (
                  <div className="flex items-center gap-2 bg-red-500/20 text-red-200 border border-red-400/30 px-3 py-2 rounded-lg text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Breakdown Reported
                  </div>
                ) : (
                  <button
                    onClick={() => setDialog('deliver')}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Delivered
                  </button>
                )
              )}
              {lr.lrStatus === 'DELIVERED' && (
                <div className="flex items-center gap-2 bg-green-500/20 text-green-300 px-3 py-2 rounded-lg text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Delivered
                </div>
              )}

              {isActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setDialog('cancel')}
                      className="w-9 h-9 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-400/30 rounded-lg transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel this LR</TooltipContent>
                </Tooltip>
              )}
            </div>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* ── Driver card ── */}
      {lr.driverName && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          {/* Avatar */}
          <div className="h-12 w-12 rounded-full bg-feros-navy/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-feros-navy">
              {lr.driverName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 truncate">{lr.driverName}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                </svg>
                Driver
              </span>
              {lr.driverPhone && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {lr.driverPhone}
                </span>
              )}
            </div>
          </div>
          {/* Call button */}
          {lr.driverPhone && (
            <a
              href={`tel:${lr.driverPhone}`}
              className="h-10 w-10 rounded-full bg-green-100 border border-green-200 flex items-center justify-center hover:bg-green-200 transition-colors shrink-0"
              title="Call driver"
            >
              <svg className="h-5 w-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
          )}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Scale className="h-4 w-4" />}
          label="Allocated"
          value={`${lr.allocatedWeight}T`}
          sub="Planned weight"
        />
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Loaded"
          value={lr.loadedWeight != null ? `${lr.loadedWeight}T` : '—'}
          sub={lr.loadedAt ? `At ${new Date(lr.loadedAt).toLocaleString()}` : 'Not yet loaded'}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Delivered"
          value={lr.deliveredWeight != null ? `${lr.deliveredWeight}T` : '—'}
          sub={lr.deliveredAt ? `At ${new Date(lr.deliveredAt).toLocaleString()}` : 'Not yet delivered'}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Variance"
          value={lr.weightVariance != null ? `${lr.weightVariance > 0 ? '+' : ''}${lr.weightVariance}T` : '—'}
          sub={lr.isOverloaded ? 'Overloaded' : 'Weight difference'}
          accent={!!lr.isOverloaded}
        />
      </div>

      {/* ── Remarks ── */}
      {lr.remarks && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Remarks</p>
          <p className="text-sm text-amber-900">{lr.remarks}</p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto px-0">
          {([
            { key: 'checkposts', label: 'Checkposts', icon: <MapPin className="h-4 w-4" />, count: checkposts.length },
            { key: 'charges',    label: 'Charges',    icon: <DollarSign className="h-4 w-4" />, count: charges.length },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t.key
                  ? 'border-feros-navy text-feros-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
              )}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{t.count}</span>
              )}
            </button>
          ))}

          {canAdd && (
            <div className="ml-auto flex items-center px-3">
              <button
                onClick={() => setDialog(tab === 'checkposts' ? 'checkpost' : 'charge')}
                className="flex items-center gap-1.5 text-sm text-feros-navy hover:text-feros-navy/80 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {tab === 'checkposts' ? 'Add Checkpost' : 'Add Charge'}
              </button>
            </div>
          )}
        </div>

        <div className="p-5">
          {tab === 'checkposts' && (
            <>
              <CheckpostsTab lrId={id} checkposts={checkposts} canDelete={canAdd} />
              {totalFines > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">Total Fines</span>
                  <span className="text-base font-bold text-red-700">₹{totalFines.toLocaleString()}</span>
                </div>
              )}
            </>
          )}
          {tab === 'charges' && <ChargesTab lrId={id} charges={charges} canDelete={canAdd} />}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-right">
        Created by {lr.createdByName} · {new Date(lr.createdAt).toLocaleString()}
      </p>

      {/* ── Dialogs ── */}
      <RecordLoadingDialog  lrId={id} allocatedWeight={lr?.allocatedWeight} open={dialog === 'load'}      onClose={() => setDialog(null)} />
      <MarkDeliveredDialog  lrId={id} startOdometer={lr?.startOdometer} open={dialog === 'deliver'}   onClose={() => setDialog(null)} />
      <AddCheckpostDialog   lrId={id} open={dialog === 'checkpost'} onClose={() => setDialog(null)} />
      <AddChargeDialog      lrId={id} open={dialog === 'charge'}    onClose={() => setDialog(null)} />
      <EditLrDialog         lrId={id} lrStatus={lr.lrStatus} currentRemarks={lr.remarks} currentLoadedWeight={lr.loadedWeight} currentDeliveredWeight={lr.deliveredWeight} open={dialog === 'edit'} onClose={() => setDialog(null)} />
      <CancelLrDialog       lrId={id} open={dialog === 'cancel'}    onClose={() => setDialog(null)} />
    </div>
  )
}
