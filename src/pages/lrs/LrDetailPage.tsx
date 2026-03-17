import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import {
  ArrowLeft, Truck, Package, AlertTriangle, CheckCircle2,
  MapPin, DollarSign, Plus, Activity, Scale, FileText,
} from 'lucide-react'
import { lrsApi } from '@/api/lrs'
import { ordersApi } from '@/api/orders'
import { tenantMastersApi } from '@/api/masters'
import { useAuthStore } from '@/store/authStore'
import { openLrPdf } from './LrPdf'
import type { LrStatus, LrCheckpost, LrCharge } from '@/types'

// ─── Status helpers ────────────────────────────────────────────────────────
const STATUS_CFG: Record<LrStatus, { label: string; bg: string; text: string; dot: string }> = {
  CREATED:    { label: 'Created',    bg: 'bg-blue-100',  text: 'text-blue-800',  dot: 'bg-blue-500'  },
  IN_TRANSIT: { label: 'In Transit', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  DELIVERED:  { label: 'Delivered',  bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  CANCELLED:  { label: 'Cancelled',  bg: 'bg-red-100',   text: 'text-red-800',   dot: 'bg-red-500'   },
}

function StatusBadge({ status }: { status: LrStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Small dialog wrapper ──────────────────────────────────────────────────
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Record Loading Dialog ─────────────────────────────────────────────────
const loadSchema = z.object({
  loadedWeight: z.string().min(1, 'Required').refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
  remarks:      z.string().optional(),
})
type LoadForm = z.infer<typeof loadSchema>

function RecordLoadingDialog({ lrId, onClose }: { lrId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<LoadForm>({
    resolver: zodResolver(loadSchema) as Resolver<LoadForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: LoadForm) => lrsApi.update(lrId, {
      loadedWeight: parseFloat(data.loadedWeight),
      loadedAt:     new Date().toISOString().slice(0, 19),
      lrStatus:     'IN_TRANSIT',
      remarks:      data.remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lr', lrId] })
      qc.invalidateQueries({ queryKey: ['lrs'] })
      onClose()
    },
  })

  return (
    <Dialog title="Record Loading" onClose={onClose}>
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loaded Weight (tons) *</label>
          <input
            type="number" step="0.01" min="0"
            {...register('loadedWeight')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Actual weight loaded on vehicle"
            autoFocus
          />
          {errors.loadedWeight && <p className="mt-1 text-xs text-red-600">{errors.loadedWeight.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea {...register('remarks')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
        <p className="text-xs text-gray-500">LR status will move to <strong>In Transit</strong>.</p>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : 'Record Loading'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// ─── Mark Delivered Dialog ─────────────────────────────────────────────────
const deliverSchema = z.object({
  deliveredWeight: z.string().min(1, 'Required').refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
  remarks:         z.string().optional(),
})
type DeliverForm = z.infer<typeof deliverSchema>

function MarkDeliveredDialog({ lrId, onClose }: { lrId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<DeliverForm>({
    resolver: zodResolver(deliverSchema) as Resolver<DeliverForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: DeliverForm) => lrsApi.update(lrId, {
      deliveredWeight: parseFloat(data.deliveredWeight),
      deliveredAt:     new Date().toISOString().slice(0, 19),
      lrStatus:        'DELIVERED',
      remarks:         data.remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lr', lrId] })
      qc.invalidateQueries({ queryKey: ['lrs'] })
      onClose()
    },
  })

  return (
    <Dialog title="Mark as Delivered" onClose={onClose}>
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Delivered Weight (tons) *</label>
          <input
            type="number" step="0.01" min="0"
            {...register('deliveredWeight')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Actual weight delivered at destination"
            autoFocus
          />
          {errors.deliveredWeight && <p className="mt-1 text-xs text-red-600">{errors.deliveredWeight.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea {...register('remarks')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
        <p className="text-xs text-gray-500">LR status will move to <strong>Delivered</strong>.</p>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : 'Mark Delivered'}
          </button>
        </div>
      </form>
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

function AddCheckpostDialog({ lrId, onClose }: { lrId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CheckpostForm>({
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
      onClose()
    },
  })

  return (
    <Dialog title="Add Checkpost" onClose={onClose}>
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Checkpost Name *</label>
          <input
            {...register('checkpostName')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Nashik Toll, Border Checkpost…"
            autoFocus
          />
          {errors.checkpostName && <p className="mt-1 text-xs text-red-600">{errors.checkpostName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input {...register('location')} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="City / Highway name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fine Amount (₹)</label>
            <input type="number" step="0.01" min="0" {...register('fineAmount')} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fine Receipt #</label>
            <input {...register('fineReceiptNumber')} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea {...register('remarks')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Adding…' : 'Add Checkpost'}
          </button>
        </div>
      </form>
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

function AddChargeDialog({ lrId, onClose }: { lrId: number; onClose: () => void }) {
  const qc = useQueryClient()

  const { data: chargeTypes = [] } = useQuery({
    queryKey: ['charge-types'],
    queryFn: () => tenantMastersApi.getChargeTypes().then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<ChargeForm>({
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
      onClose()
    },
  })

  return (
    <Dialog title="Add Charge" onClose={onClose}>
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Charge Type *</label>
          <select
            {...register('chargeTypeId')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue=""
          >
            <option value="">Select type…</option>
            {chargeTypes.map(ct => (
              <option key={ct.id} value={ct.id}>{ct.name}</option>
            ))}
          </select>
          {errors.chargeTypeId && <p className="mt-1 text-xs text-red-600">{errors.chargeTypeId.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
          <input
            type="number" step="0.01" min="0"
            {...register('amount')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
            autoFocus
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea {...register('remarks')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        {mutation.isError && <p className="text-sm text-red-600">Failed. Please try again.</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Adding…' : 'Add Charge'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${accent ? 'border-red-300 bg-red-50' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-${accent ? 'red' : 'gray'}-400`}>{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Checkposts Tab ────────────────────────────────────────────────────────
function CheckpostsTab({ checkposts }: { checkposts: LrCheckpost[] }) {
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
        <div key={cp.id ?? i} className="bg-white border rounded-xl p-4 flex items-start gap-4">
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
        </div>
      ))}
    </div>
  )
}

// ─── Charges Tab ───────────────────────────────────────────────────────────
function ChargesTab({ charges }: { charges: LrCharge[] }) {
  const total = charges.filter(c => c.isActive !== false).reduce((s, c) => s + c.amount, 0)

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
        <div key={ch.id ?? i} className="bg-white border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{ch.chargeTypeName}</p>
            {ch.remarks && <p className="text-xs text-gray-500 mt-0.5">{ch.remarks}</p>}
          </div>
          <p className="text-base font-bold text-gray-800">₹{ch.amount.toLocaleString()}</p>
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

// ─── Main Page ─────────────────────────────────────────────────────────────
type ActiveDialog = 'load' | 'deliver' | 'checkpost' | 'charge' | null

export function LrDetailPage() {
  const { lrId } = useParams<{ lrId: string }>()
  const navigate = useNavigate()
  const id = parseInt(lrId!)

  const [tab, setTab]           = useState<'checkposts' | 'charges'>('checkposts')
  const [dialog, setDialog]     = useState<ActiveDialog>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const companyName = useAuthStore(s => s.companyName) ?? 'FEROS'

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

  const { data: order } = useQuery({
    queryKey: ['order', lr?.orderId],
    queryFn: () => ordersApi.getById(lr!.orderId).then(r => r.data),
    enabled: !!lr?.orderId,
  })

  async function handlePdf() {
    if (!lr) return
    setPdfLoading(true)
    try {
      await openLrPdf(lr, order, checkposts, charges, companyName)
    } finally {
      setPdfLoading(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading…</div>
  if (!lr) return <div className="p-8 text-center text-gray-500">LR not found.</div>

  const isActive   = lr.lrStatus !== 'CANCELLED' && lr.lrStatus !== 'DELIVERED'
  const canAdd     = isActive
  const totalFines = checkposts.reduce((s, cp) => s + (cp.fineAmount ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div className="relative bg-gradient-to-r from-slate-800 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <Truck className="absolute right-8 top-1/2 -translate-y-1/2 h-40 w-40" />
        </div>
        <div className="relative px-6 py-6">
          {/* Back */}
          <button
            onClick={() => navigate('/lrs')}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to LR Register
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-wide">{lr.lrNumber}</h1>
                <StatusBadge status={lr.lrStatus} />
                {lr.isOverloaded && (
                  <span className="flex items-center gap-1 bg-red-500/20 text-red-200 px-2.5 py-1 rounded-full text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Overloaded
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-300">
                <span>Order: <span className="text-white font-medium">{lr.orderNumber}</span></span>
                {lr.clientName && <span>Client: <span className="text-white font-medium">{lr.clientName}</span></span>}
                <span>LR Date: <span className="text-white font-medium">{lr.lrDate}</span></span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-300">
                <Truck className="h-4 w-4" />
                <span className="text-white font-medium">{lr.vehicleRegistrationNumber}</span>
                {lr.vehicleTypeName && <span className="text-slate-400">({lr.vehicleTypeName})</span>}
              </div>
            </div>

            {/* Primary action button */}
            <div className="flex flex-shrink-0 gap-2">
              {/* PDF button — always visible */}
              <button
                onClick={handlePdf}
                disabled={pdfLoading}
                title="Download / View PDF"
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {pdfLoading ? 'Generating…' : 'PDF'}
              </button>

              {lr.lrStatus === 'CREATED' && (
                <button
                  onClick={() => setDialog('load')}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Package className="h-4 w-4" />
                  Record Loading
                </button>
              )}
              {lr.lrStatus === 'IN_TRANSIT' && (
                <button
                  onClick={() => setDialog('deliver')}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Delivered
                </button>
              )}
              {lr.lrStatus === 'DELIVERED' && (
                <div className="flex items-center gap-2 bg-green-500/20 text-green-300 px-4 py-2 rounded-lg text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Delivered
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Stat cards */}
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

        {/* Tabs */}
        <div className="bg-white rounded-xl border">
          {/* Tab header */}
          <div className="flex border-b px-4">
            {([
              { key: 'checkposts', label: 'Checkposts', icon: <MapPin className="h-4 w-4" />, count: checkposts.length },
              { key: 'charges',    label: 'Charges',    icon: <DollarSign className="h-4 w-4" />, count: charges.length },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon}
                {t.label}
                {t.count > 0 && (
                  <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-1.5 py-0.5">{t.count}</span>
                )}
              </button>
            ))}

            {/* Add button on right */}
            {canAdd && (
              <div className="ml-auto flex items-center py-2">
                <button
                  onClick={() => setDialog(tab === 'checkposts' ? 'checkpost' : 'charge')}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {tab === 'checkposts' ? 'Add Checkpost' : 'Add Charge'}
                </button>
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="p-4">
            {tab === 'checkposts' && (
              <>
                <CheckpostsTab checkposts={checkposts} />
                {totalFines > 0 && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-red-700">Total Fines</span>
                    <span className="text-base font-bold text-red-700">₹{totalFines.toLocaleString()}</span>
                  </div>
                )}
              </>
            )}
            {tab === 'charges' && <ChargesTab charges={charges} />}
          </div>
        </div>

        {/* Created by */}
        <p className="text-xs text-gray-400 text-right">
          Created by {lr.createdByName} · {new Date(lr.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Dialogs */}
      {dialog === 'load'       && <RecordLoadingDialog  lrId={id} onClose={() => setDialog(null)} />}
      {dialog === 'deliver'    && <MarkDeliveredDialog   lrId={id} onClose={() => setDialog(null)} />}
      {dialog === 'checkpost'  && <AddCheckpostDialog    lrId={id} onClose={() => setDialog(null)} />}
      {dialog === 'charge'     && <AddChargeDialog       lrId={id} onClose={() => setDialog(null)} />}
    </div>
  )
}
