import { getApiError } from '@/lib/apiError'
import { useAuthStore } from '@/store/authStore'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehiclesApi, vehicleServicesApi } from '@/api/vehicles'
import { ordersApi } from '@/api/orders'
import { staffApi } from '@/api/staff'
import { servicePartsApi, sparePartsApi } from '@/api/inventory'
import { tenantMastersApi, globalMastersApi } from '@/api/masters'
import { breakdownsApi } from '@/api/breakdowns'
import { fuelLogsApi } from '@/api/fuelLogs'
import { tyresApi } from '@/api/tyres'
import { meterReadingsApi } from '@/api/meterReadings'
import { compressIfNeeded } from '@/lib/imageCompressor'
import type { VehicleAssignmentHistory, FuelLog, FuelPaymentMode, Tyre, TyrePosition, TyreFitting, TyreRotationLog, TyreRemovalReason, TyrePositionType, MeterReading, Order, VehicleAllocation, StaffAllocation } from '@/types'
import { toast } from 'sonner'
import { format, parseISO, differenceInDays, isValid } from 'date-fns'
import {
  ArrowLeft, Truck, Shield, MapPin, Fuel,
  AlertTriangle, Pencil, Power, Camera,
  ClipboardList, Route, FileText, Plus, Wrench, Droplets, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ExternalLink, Paperclip, Trash2,
  Calendar, IndianRupee, RotateCcw, Check, Search, X, Package, Info, CircleDot, Gauge, Users,
  Clock, Wifi,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { BreakdownDuration, BreakdownType, VehicleDocument, VehicleStatusType, VehicleServiceRecord, Breakdown, MasterItem, ServicePart } from '@/types'
import { VehicleForm } from './VehiclesPage'
import { ServiceDetailModal } from '@/components/shared/ServiceDetailModal'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── helpers ───────────────────────────────────────────────────────────────────
type ExpiryLevel = 'expired' | 'critical' | 'warning' | 'ok' | 'none'

function expiryLevel(dateStr?: string): ExpiryLevel {
  if (!dateStr) return 'none'
  const d = parseISO(dateStr)
  if (!isValid(d)) return 'none'
  const days = differenceInDays(d, new Date())
  if (days < 0)   return 'expired'
  if (days <= 7)  return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}


// ── info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

// ── tabs ─────────────────────────────────────────────────────────────────────
const TABS = ['Basic Info', 'Compliance', 'Documents', 'Service', 'Fuel', 'Tyres', 'Meter Readings', 'GPS & Notes', 'Assignments', 'Order History', 'Trip History'] as const
type Tab = typeof TABS[number]

// ── edit document dialog ───────────────────────────────────────────────────────
function EditDocumentDialog({ vehicleId, doc, open, onClose }: { vehicleId: number; doc: VehicleDocument; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const showIssuerName = (doc.documentTypeName ?? '').toLowerCase().includes('insurance')

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      documentNumber: doc.documentNumber ?? '',
      issuerName:     doc.issuerName ?? '',
      issueDate:      doc.issueDate ?? '',
      expiryDate:     doc.expiryDate ?? '',
      remarks:        doc.remarks ?? '',
      cost:           doc.cost != null ? String(doc.cost) : '',
      paidOn:         doc.paidOn ?? '',
    },
  })

  useEffect(() => {
    if (open) reset({
      documentNumber: doc.documentNumber ?? '',
      issuerName:     doc.issuerName ?? '',
      issueDate:      doc.issueDate ?? '',
      expiryDate:     doc.expiryDate ?? '',
      remarks:        doc.remarks ?? '',
      cost:           doc.cost != null ? String(doc.cost) : '',
      paidOn:         doc.paidOn ?? '',
    })
  }, [open, doc.id])

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => vehiclesApi.updateDocument(doc.id, data),
    onSuccess: () => {
      toast.success('Document updated')
      qc.invalidateQueries({ queryKey: ['vehicle-docs', vehicleId] })
      setFile(null); onClose()
    },
    onError: () => toast.error('Failed to update document'),
  })

  async function handleSave(data: Record<string, unknown>) {
    let fileUrl: string | undefined
    if (file) {
      setUploading(true)
      try {
        const res = await vehiclesApi.uploadDocFile(vehicleId, file)
        fileUrl = res.data?.publicUrl
      } catch {
        toast.error('File upload failed')
        setUploading(false)
        return
      }
      setUploading(false)
    }
    const cost = data.cost ? Number(data.cost) : undefined
    mutation.mutate({ ...data, ...(fileUrl ? { fileUrl } : {}), cost })
  }

  const busy = uploading || mutation.isPending

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Document — {doc.documentTypeName}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(handleSave)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Document Number</Label>
            <Input placeholder="DOC123456" {...register('documentNumber')} />
          </div>
          {showIssuerName && (
            <div className="space-y-1.5">
              <Label>Insurance Company</Label>
              <Input placeholder="New India Assurance" {...register('issuerName')} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Issue Date</Label>
              <Input type="date" {...register('issueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" {...register('expiryDate')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input placeholder="Optional remarks" {...register('remarks')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost (₹)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" {...register('cost')} />
            </div>
            <div className="space-y-1.5">
              <Label>Paid On</Label>
              <Input type="date" {...register('paidOn')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Replace File</Label>
            <label className={cn(
              'flex items-center gap-3 w-full border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors',
              file ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}>
              <Paperclip size={16} className={file ? 'text-blue-500' : 'text-gray-400'} />
              <span className={cn('text-sm truncate', file ? 'text-blue-700 font-medium' : 'text-gray-400')}>
                {file ? file.name : doc.fileUrl ? 'Click to replace existing file' : 'Click to attach a file'}
              </span>
              {file && (
                <button type="button" onClick={e => { e.preventDefault(); setFile(null) }}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500">✕</button>
              )}
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {uploading ? 'Uploading…' : mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── add document form ─────────────────────────────────────────────────────────
const docSchema = z.object({
  documentTypeId: z.coerce.number().min(1, 'Select document type'),
  documentNumber: z.string().optional(),
  issuerName:     z.string().optional(),
  permitType:     z.string().optional(),
  issueDate:      z.string().optional(),
  expiryDate:     z.string().optional(),
  remarks:        z.string().optional(),
  cost:           z.string().optional(),
  paidOn:         z.string().optional(),
})
type DocForm = z.infer<typeof docSchema>

function AddDocumentDialog({ vehicleId, open, onClose, existingDocs }: { vehicleId: number; open: boolean; onClose: () => void; existingDocs: VehicleDocument[] }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: docTypesRes } = useQuery({ queryKey: ['document-types'], queryFn: globalMastersApi.getDocumentTypes })

  const existingTypeIds = new Set(existingDocs.map(d => d.documentTypeId))

  const vehicleDocTypes = (docTypesRes?.data ?? []).filter(d =>
    d.applicableFor === 'VEHICLE' || d.applicableFor === 'BOTH'
  )

  const { register, handleSubmit, control, watch, formState: { errors }, reset } = useForm<DocForm>({
    resolver: zodResolver(docSchema) as Resolver<DocForm>,
  })

  const selectedDocTypeId  = watch('documentTypeId')
  const selectedDocTypeName = vehicleDocTypes.find(d => d.id === selectedDocTypeId)?.name?.toLowerCase() ?? ''
  const showIssuerName = selectedDocTypeName.includes('insurance')
  const showPermitType = false

  const mutation = useMutation({
    mutationFn: (data: Omit<DocForm, 'cost'> & { fileUrl?: string; cost?: number }) => vehiclesApi.addDocument(vehicleId, data),
    onSuccess: () => {
      toast.success('Document added')
      qc.invalidateQueries({ queryKey: ['vehicle-docs', vehicleId] })
      reset(); setFile(null); onClose()
    },
    onError: () => toast.error('Failed to add document'),
  })

  async function handleSave(data: DocForm) {
    let fileUrl: string | undefined
    if (file) {
      setUploading(true)
      try {
        const res = await vehiclesApi.uploadDocFile(vehicleId, file)
        fileUrl = res.data?.publicUrl
      } catch {
        toast.error('File upload failed')
        setUploading(false)
        return
      }
      setUploading(false)
    }
    const { cost: costStr, ...docData } = data
    mutation.mutate({ ...docData, fileUrl, cost: costStr ? Number(costStr) : undefined })
  }

  function handleClose() { reset(); setFile(null); onClose() }

  const busy = uploading || mutation.isPending

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(handleSave)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Document Type *</Label>
            <Controller
              name="documentTypeId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ? String(field.value) : ''}
                  onValueChange={v => field.onChange(v ? Number(v) : undefined)}
                  options={vehicleDocTypes.map(t => {
                    const blocked = !t.allowMultiple && existingTypeIds.has(t.id)
                    return {
                      value: String(t.id),
                      label: blocked ? `${t.name} (already uploaded)` : t.name,
                      disabled: blocked,
                    }
                  })}
                  placeholder="Select type"
                  className="mt-1"
                />
              )}
            />
            {errors.documentTypeId && <p className="text-red-500 text-xs">{errors.documentTypeId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Document Number</Label>
            <Input placeholder="DOC123456" {...register('documentNumber')} />
          </div>
          {showIssuerName && (
            <div className="space-y-1.5">
              <Label>Insurance Company</Label>
              <Input placeholder="New India Assurance" {...register('issuerName')} />
            </div>
          )}
          {showPermitType && (
            <div className="space-y-1.5">
              <Label>Permit Type</Label>
              <Controller name="permitType" control={control} render={({ field }) => (
                <div className="flex gap-2 mt-1">
                  {(['NATIONAL', 'STATE'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => field.onChange(field.value === t ? '' : t)}
                      className={cn('flex-1 py-2 text-sm rounded-lg border font-medium transition-colors',
                        field.value === t
                          ? 'bg-feros-navy text-white border-feros-navy'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      )}>
                      {t === 'NATIONAL' ? 'National' : 'State'}
                    </button>
                  ))}
                </div>
              )} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Issue Date</Label>
              <Input type="date" {...register('issueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" {...register('expiryDate')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input placeholder="Optional remarks" {...register('remarks')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost (₹)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" {...register('cost')} />
            </div>
            <div className="space-y-1.5">
              <Label>Paid On</Label>
              <Input type="date" {...register('paidOn')} />
            </div>
          </div>

          {/* File attachment */}
          <div className="space-y-1.5">
            <Label>Attach File</Label>
            <label className={cn(
              'flex items-center gap-3 w-full border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors',
              file ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}>
              <Paperclip size={16} className={file ? 'text-blue-500' : 'text-gray-400'} />
              <span className={cn('text-sm truncate', file ? 'text-blue-700 font-medium' : 'text-gray-400')}>
                {file ? file.name : 'Click to attach PDF, image or any file'}
              </span>
              {file && (
                <button type="button" onClick={e => { e.preventDefault(); setFile(null) }}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500">✕</button>
              )}
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {uploading ? 'Uploading…' : mutation.isPending ? 'Saving…' : 'Add Document'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


const vehicleStatusOptionColor: Partial<Record<VehicleStatusType, string>> = {
  AVAILABLE: 'text-green-600 font-medium',
  ASSIGNED:  'text-blue-600 font-medium',
  ON_TRIP:   'text-orange-600 font-medium',
  IN_REPAIR: 'text-yellow-600 font-medium',
  BREAKDOWN: 'text-red-600 font-medium',
  ON_LEASE:  'text-purple-400 font-medium',
}

// ── service display status helpers ────────────────────────────────────────────
const statusChip: Record<string, string> = {
  OPEN:        'bg-blue-50 text-blue-600 border-blue-200',
  IN_PROGRESS: 'bg-orange-50 text-orange-600 border-orange-200',
  DUE_SOON:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  OVERDUE:     'bg-red-50 text-red-600 border-red-200',
  COMPLETED:   'bg-green-50 text-green-700 border-green-200',
}
const statusLabel: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In Progress', DUE_SOON: 'Due Soon', OVERDUE: 'Overdue', COMPLETED: 'Completed',
}

// ── CreateServiceDialog is now a shared component ─────────────────────────────
// (kept here for legacy reference — imported below)
interface TaskDraft {
  taskTypeId?: number
  customName?: string
  isRecurring: boolean
  frequencyKm?: number
  cost?: number
}

// ── create service dialog ─────────────────────────────────────────────────────
function CreateServiceDialog({
  vehicleId, vehicleReg, breakdownId, currentOdometer, open, onClose,
}: {
  vehicleId: number; vehicleReg: string; breakdownId?: number; currentOdometer?: number; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [triggeredBy, setTriggeredBy] = useState<string>(breakdownId ? 'BREAKDOWN' : 'SCHEDULED')
  const [serviceType, setServiceType] = useState<'INTERNAL' | 'THIRD_PARTY' | 'OEM_CENTER'>('INTERNAL')
  const [payerType, setPayerType]     = useState<string>('OWN_EXPENSE')
  const [vendorName, setVendorName]   = useState('')
  const [location, setLocation]       = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [odometer, setOdometer]       = useState(currentOdometer ? String(currentOdometer) : '')
  const [notes, setNotes]             = useState('')
  const [dueAtOdometer, setDueAtOdometer] = useState('')
  const [insuranceClaimNo, setInsuranceClaimNo]   = useState('')
  const [insuranceClaimAmt, setInsuranceClaimAmt] = useState('')
  const [certificateNumber, setCertificateNumber] = useState('')
  const [certificateValidUntil, setCertificateValidUntil] = useState('')
  const [isEscalated, setIsEscalated] = useState(false)
  // tasks state: selected master tasks + custom
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [taskDrafts, setTaskDrafts]           = useState<Record<string | number, TaskDraft>>({})
  const [customTasks, setCustomTasks]         = useState<TaskDraft[]>([])
  const [showCustom, setShowCustom]           = useState(false)
  const [customTaskName, setCustomTaskName]   = useState('')

  const { data: taskTypesRes } = useQuery({ queryKey: ['service-task-types'], queryFn: globalMastersApi.getServiceTaskTypes })
  const taskTypes: MasterItem[] = taskTypesRes?.data ?? []

  const mutation = useMutation({
    mutationFn: (data: unknown) => vehicleServicesApi.create(data),
    onSuccess: () => {
      toast.success('Service created')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      qc.invalidateQueries({ queryKey: ['vehicle-breakdowns-history', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      handleClose()
    },
    onError: (e: unknown) => toast.error(
      getApiError(e, 'Failed to create service') ?? 'Failed to create service'
    ),
  })

  function handleClose() {
    setTriggeredBy(breakdownId ? 'BREAKDOWN' : 'SCHEDULED')
    setServiceType('INTERNAL'); setPayerType('OWN_EXPENSE')
    setVendorName(''); setLocation('')
    setServiceDate(''); setOdometer(currentOdometer ? String(currentOdometer) : ''); setNotes(''); setDueAtOdometer('')
    setInsuranceClaimNo(''); setInsuranceClaimAmt('')
    setCertificateNumber(''); setCertificateValidUntil('')
    setIsEscalated(false)
    setSelectedTaskIds(new Set()); setTaskDrafts({}); setCustomTasks([])
    setShowCustom(false); setCustomTaskName('')
    onClose()
  }

  function toggleTask(id: number) {
    setSelectedTaskIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id); setTaskDrafts(d => { const n = { ...d }; delete n[id]; return n }) }
      else { s.add(id); setTaskDrafts(d => ({ ...d, [id]: { taskTypeId: id, isRecurring: false } })) }
      return s
    })
  }

  function updateDraft(id: number | string, patch: Partial<TaskDraft>) {
    setTaskDrafts(d => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } as TaskDraft }))
  }

  function addCustomTask() {
    if (!customTaskName.trim()) return
    setCustomTasks(c => [...c, { customName: customTaskName.trim(), isRecurring: false }])
    setCustomTaskName('')
  }

  function removeCustomTask(i: number) {
    setCustomTasks(c => c.filter((_, j) => j !== i))
  }

  function buildTasks() {
    const masterTasks = Array.from(selectedTaskIds).map(id => taskDrafts[id] ?? { taskTypeId: id, isRecurring: false })
    return [...masterTasks, ...customTasks]
  }

  function handleSubmit() {
    const tasks = buildTasks()
    if (tasks.length === 0) { toast.error('Add at least one task'); return }
    if (payerType === 'INSURANCE' && !insuranceClaimNo.trim()) {
      toast.error('Insurance claim number is required'); return
    }
    if (triggeredBy === 'COMPLIANCE' && !certificateNumber.trim()) {
      toast.error('Certificate number is required for compliance service'); return
    }
    const payload = {
      vehicleId,
      triggeredBy,
      breakdownId: breakdownId ?? null,
      serviceType,
      payerType,
      vendorName: serviceType === 'INTERNAL' ? (vendorName || 'Self') : vendorName,
      location: location || null,
      serviceDate: serviceDate || null,
      odometer: odometer ? Number(odometer) : null,
      dueAtOdometer: dueAtOdometer ? Number(dueAtOdometer) : null,
      notes: notes || null,
      insuranceClaimNo: payerType === 'INSURANCE' ? insuranceClaimNo || null : null,
      insuranceClaimAmt: payerType === 'INSURANCE' && insuranceClaimAmt ? Number(insuranceClaimAmt) : null,
      certificateNumber: triggeredBy === 'COMPLIANCE' ? certificateNumber || null : null,
      certificateValidUntil: triggeredBy === 'COMPLIANCE' ? certificateValidUntil || null : null,
      isEscalated,
      tasks: tasks.map(t => ({
        taskTypeId: t.taskTypeId ?? null,
        customName: t.customName ?? null,
        isRecurring: t.isRecurring,
        frequencyKm: t.isRecurring && t.frequencyKm ? Number(t.frequencyKm) : null,
        cost: t.cost ? Number(t.cost) : null,
      })),
    }
    mutation.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={16} className="text-feros-navy" /> New Service
          </DialogTitle>
          <p className="text-xs text-gray-400 font-mono">{vehicleReg}</p>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Triggered By */}
          {!breakdownId && (
            <div className="space-y-1.5">
              <Label>Reason / Trigger <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'SCHEDULED',  label: '📅 Scheduled' },
                  { v: 'BREAKDOWN',  label: '⚡ Breakdown' },
                  { v: 'ACCIDENT',   label: '💥 Accident' },
                  { v: 'COMPLIANCE', label: '📋 Compliance' },
                  { v: 'WARRANTY',   label: '🔒 Warranty' },
                ] as const).map(({ v, label }) => (
                  <button key={v} type="button"
                    onClick={() => {
                      setTriggeredBy(v)
                      // Auto-suggest service type + payer
                      if (v === 'WARRANTY')   { setServiceType('OEM_CENTER');  setPayerType('WARRANTY_OEM') }
                      if (v === 'COMPLIANCE') { setServiceType('THIRD_PARTY'); setPayerType('OWN_EXPENSE') }
                      if (v === 'ACCIDENT')   { setServiceType('THIRD_PARTY'); setPayerType('OWN_EXPENSE') }
                      if (v === 'SCHEDULED')  { setServiceType('INTERNAL');    setPayerType('OWN_EXPENSE') }
                      if (v === 'BREAKDOWN')  { setServiceType('INTERNAL');    setPayerType('OWN_EXPENSE') }
                    }}
                    className={cn('py-2 rounded-lg border-2 text-xs font-medium transition-colors',
                      triggeredBy === v ? 'border-feros-navy bg-feros-navy/5 text-feros-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Service Location Type */}
          <div className="space-y-1.5">
            <Label>Service Location <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'INTERNAL',   label: '🏭 Internal' },
                { v: 'THIRD_PARTY', label: '🔧 3rd Party' },
                { v: 'OEM_CENTER', label: '🏢 OEM Center' },
              ] as const).map(({ v, label }) => (
                <button key={v} type="button"
                  onClick={() => setServiceType(v)}
                  className={cn('py-2 rounded-lg border-2 text-xs font-medium transition-colors',
                    serviceType === v ? 'border-feros-navy bg-feros-navy/5 text-feros-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Payer Type */}
          <div className="space-y-1.5">
            <Label>Who Pays? <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'OWN_EXPENSE',  label: '💰 Own Expense' },
                { v: 'WARRANTY_OEM', label: '🔒 OEM Warranty' },
                { v: 'WARRANTY_ANC', label: '🔐 ANC Warranty' },
                { v: 'INSURANCE',    label: '🏦 Insurance' },
                { v: 'AMC',          label: '📄 AMC' },
              ] as const).map(({ v, label }) => (
                <button key={v} type="button"
                  onClick={() => setPayerType(v)}
                  className={cn('py-2 rounded-lg border-2 text-xs font-medium transition-colors',
                    payerType === v ? 'border-feros-navy bg-feros-navy/5 text-feros-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Vendor Name — shown for non-internal */}
          {serviceType !== 'INTERNAL' && (
            <div className="space-y-1.5">
              <Label>{serviceType === 'OEM_CENTER' ? 'OEM Service Center Name' : 'Vendor / Workshop Name'}</Label>
              <Input
                placeholder={serviceType === 'OEM_CENTER' ? 'e.g. TATA Motors Service, Vizag' : 'e.g. Raju Tyre Works'}
                value={vendorName} onChange={e => setVendorName(e.target.value)}
              />
            </div>
          )}

          {/* Insurance fields */}
          {payerType === 'INSURANCE' && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-lg p-3">
              <div className="space-y-1.5">
                <Label>Claim Number <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. CLM/2026/001234" value={insuranceClaimNo} onChange={e => setInsuranceClaimNo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Claim Amount (₹)</Label>
                <Input type="number" placeholder="0" value={insuranceClaimAmt} onChange={e => setInsuranceClaimAmt(e.target.value)} />
              </div>
            </div>
          )}

          {/* Compliance fields */}
          {triggeredBy === 'COMPLIANCE' && (
            <div className="grid grid-cols-2 gap-3 bg-purple-50 rounded-lg p-3">
              <div className="space-y-1.5">
                <Label>Certificate Number <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. FC/AP/2026/00123" value={certificateNumber} onChange={e => setCertificateNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Until</Label>
                <Input type="date" value={certificateValidUntil} onChange={e => setCertificateValidUntil(e.target.value)} />
              </div>
            </div>
          )}

          {/* Escalation flag — for breakdown → 3rd party */}
          {serviceType === 'THIRD_PARTY' && triggeredBy === 'BREAKDOWN' && (
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isEscalated} onChange={e => setIsEscalated(e.target.checked)}
                className="w-4 h-4 accent-feros-navy" />
              Internal mechanic could not fix — escalated to 3rd party
            </label>
          )}

          <div className="space-y-1.5">
            <Label>Location <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="e.g. Vizag highway, Depot yard" value={location} onChange={e => setLocation(e.target.value)} />
          </div>

          {/* Date & Odometer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Service Date</Label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Odometer (km)</Label>
              <Input type="number" placeholder="42300" value={odometer} onChange={e => setOdometer(e.target.value)} />
            </div>
          </div>

          {/* Due At Odometer (for scheduled services) */}
          {!breakdownId && triggeredBy === 'SCHEDULED' && (
            <div className="space-y-1.5">
              <Label>Due At Odometer <span className="text-gray-400 font-normal">(km)</span></Label>
              <Input type="number" placeholder="45000" value={dueAtOdometer} onChange={e => setDueAtOdometer(e.target.value)} />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="Any additional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            <Label>Tasks <span className="text-red-500">*</span></Label>

            {/* Dropdown + custom button */}
            <div className="flex gap-2">
              <select
                value=""
                onChange={e => { if (e.target.value) toggleTask(Number(e.target.value)) }}
                className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-feros-navy/20 focus:border-feros-navy"
              >
                <option value="">+ Select a task…</option>
                {taskTypes.filter(t => !selectedTaskIds.has(t.id)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs px-3 shrink-0"
                onClick={() => setShowCustom(v => !v)}>
                <Plus size={13} className="mr-1" /> Custom
              </Button>
            </div>

            {/* Custom task input */}
            {showCustom && (
              <div className="flex gap-2">
                <Input placeholder="Custom task name…" className="h-8 text-sm flex-1"
                  value={customTaskName} onChange={e => setCustomTaskName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTask())} />
                <Button type="button" size="sm" onClick={addCustomTask} className="h-8 bg-feros-navy text-white shrink-0">Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowCustom(false); setCustomTaskName('') }} className="h-8 shrink-0">✕</Button>
              </div>
            )}

            {/* Selected task chips */}
            {(selectedTaskIds.size > 0 || customTasks.length > 0) && (
              <div className="space-y-2 pt-1">
                {Array.from(selectedTaskIds).map(id => {
                  const t = taskTypes.find(x => x.id === id)
                  const draft = taskDrafts[id]
                  return (
                    <div key={id} className="rounded-lg border border-feros-navy/20 bg-feros-navy/3 px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-feros-navy">{t?.name}</span>
                        <button type="button" onClick={() => toggleTask(id)}
                          className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                          <X size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Cost (₹)</p>
                          <Input type="number" placeholder="0" className="h-7 text-xs"
                            value={draft?.cost ?? ''}
                            onChange={e => updateDraft(id, { cost: e.target.value ? Number(e.target.value) : undefined })} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Recurring?</p>
                          <button type="button"
                            onClick={() => updateDraft(id, { isRecurring: !draft?.isRecurring })}
                            className={cn('h-7 w-full rounded-md border text-xs font-medium transition-colors',
                              draft?.isRecurring ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'
                            )}>
                            {draft?.isRecurring ? '🔄 Recurring' : 'One-time'}
                          </button>
                        </div>
                      </div>
                      {draft?.isRecurring && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Every (km)</p>
                          <Input type="number" placeholder="10000" className="h-7 text-xs"
                            value={draft?.frequencyKm ?? ''}
                            onChange={e => updateDraft(id, { frequencyKm: e.target.value ? Number(e.target.value) : undefined })} />
                        </div>
                      )}
                    </div>
                  )
                })}

                {customTasks.map((ct, i) => (
                  <div key={`custom-${i}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{ct.customName}</span>
                      <button type="button" onClick={() => removeCustomTask(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Cost (₹)</p>
                        <Input type="number" placeholder="0" className="h-7 text-xs"
                          value={ct.cost ?? ''}
                          onChange={e => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, cost: e.target.value ? Number(e.target.value) : undefined } : x))} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Recurring?</p>
                        <button type="button"
                          onClick={() => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, isRecurring: !x.isRecurring } : x))}
                          className={cn('h-7 w-full rounded-md border text-xs font-medium transition-colors',
                            ct.isRecurring ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'
                          )}>
                          {ct.isRecurring ? '🔄 Recurring' : 'One-time'}
                        </button>
                      </div>
                    </div>
                    {ct.isRecurring && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Every (km)</p>
                        <Input type="number" placeholder="10000" className="h-7 text-xs"
                          value={ct.frequencyKm ?? ''}
                          onChange={e => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, frequencyKm: e.target.value ? Number(e.target.value) : undefined } : x))} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Creating…' : 'Create Service'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── complete service dialog ────────────────────────────────────────────────────
function CompleteServiceDialog({ service, currentOdometer, open, onClose }: { service: VehicleServiceRecord | null; currentOdometer?: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [completedDate, setCompletedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [odometer, setOdometer]           = useState(currentOdometer ? String(currentOdometer) : (service?.odometer?.toString() ?? ''))

  const mutation = useMutation({
    mutationFn: () => vehicleServicesApi.complete(service!.id, {
      completedDate,
      odometer: odometer ? Number(odometer) : undefined,
    }),
    onSuccess: () => {
      toast.success('Service marked complete!')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      qc.invalidateQueries({ queryKey: ['vehicle-breakdowns-history', service!.vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle', service!.vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      handleClose()
    },
    onError: (e: unknown) => toast.error(
      getApiError(e, 'Failed') ?? 'Failed'
    ),
  })

  function handleClose() { setCompletedDate(format(new Date(), 'yyyy-MM-dd')); setOdometer(currentOdometer ? String(currentOdometer) : (service?.odometer?.toString() ?? '')); onClose() }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Complete Service</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500">{service?.serviceNumber}</p>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Completed Date *</Label>
            <Input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Odometer at Completion (km)</Label>
            <Input type="number" placeholder={service?.odometer?.toString() ?? '0'} value={odometer} onChange={e => setOdometer(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !completedDate}
            className="bg-green-600 hover:bg-green-700 text-white">
            {mutation.isPending ? 'Saving…' : 'Mark Complete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── add part dialog ────────────────────────────────────────────────────────────
function AddPartDialog({ serviceId, onClose }: { serviceId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ sparePartId: 0, quantityRequested: 1 })

  const { data: partsData } = useQuery({ queryKey: ['spare-parts'], queryFn: sparePartsApi.getAll })
  const parts = partsData?.data ?? []

  const mutation = useMutation({
    mutationFn: () => servicePartsApi.request(serviceId, {
      sparePartId: form.sparePartId,
      quantityRequested: form.quantityRequested,
    }),
    onSuccess: () => {
      toast.success('Part request submitted for approval')
      qc.invalidateQueries({ queryKey: ['service-parts', serviceId] })
      qc.invalidateQueries({ queryKey: ['part-requests'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to request part')
    },
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Request Spare Part</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Spare Part *</Label>
            <SearchableSelect
              value={form.sparePartId ? String(form.sparePartId) : ''}
              onValueChange={v => setForm(f => ({ ...f, sparePartId: Number(v) }))}
              options={parts.map(p => ({ value: String(p.id), label: `${p.name} — ${p.partNumber}` }))}
              placeholder="Select part…"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input
              className="mt-1" type="number" min={1}
              value={form.quantityRequested}
              onChange={e => setForm(f => ({ ...f, quantityRequested: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || form.sparePartId === 0 || form.quantityRequested < 1}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Requesting…' : 'Request Part'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── service parts section ──────────────────────────────────────────────────────
function ServicePartsSection({ record }: { record: VehicleServiceRecord }) {
  const qc = useQueryClient()
  const [showAddPart, setShowAddPart] = useState(false)
  const [listOpen, setListOpen]       = useState(true)
  const isInProgress = record.status === 'IN_PROGRESS'

  const { data } = useQuery({
    queryKey: ['service-parts', record.id],
    queryFn: () => servicePartsApi.getByService(record.id),
  })
  const parts: ServicePart[] = data?.data ?? []

  const removeMutation = useMutation({
    mutationFn: (id: number) => servicePartsApi.remove(id),
    onSuccess: () => {
      toast.success('Part request removed')
      qc.invalidateQueries({ queryKey: ['service-parts', record.id] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to remove')
    },
  })

  function partStatusChip(s: ServicePart['status']) {
    const map = {
      REQUESTED: 'bg-yellow-50 text-yellow-700',
      APPROVED:  'bg-green-50 text-green-700',
      REJECTED:  'bg-red-50 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s]}`}>{s}</span>
  }

  return (
    <div className="border-t bg-gray-50/50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => parts.length > 0 && setListOpen(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide"
        >
          <Package size={13} />
          Parts Used
          {parts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold normal-case tracking-normal">
              {parts.length}
            </span>
          )}
          {parts.length > 0 && (
            listOpen ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />
          )}
        </button>
        {isInProgress && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAddPart(true)}>
            <Plus size={12} /> Add Part
          </Button>
        )}
      </div>

      {listOpen && (
        parts.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">No parts requested yet</p>
        ) : (
          <div className="space-y-1.5">
            {parts.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">{p.partName}</span>
                  <span className="text-xs text-gray-400">{p.quantityRequested} {p.unit}</span>
                  {partStatusChip(p.status)}
                  {p.status === 'REJECTED' && p.rejectionReason && (
                    <span className="text-xs text-red-500">({p.rejectionReason})</span>
                  )}
                </div>
                {p.status === 'REQUESTED' && isInProgress && (
                  <button
                    onClick={() => removeMutation.mutate(p.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
      {showAddPart && <AddPartDialog serviceId={record.id} onClose={() => setShowAddPart(false)} />}
    </div>
  )
}

// ── in-progress notes section ─────────────────────────────────────────────────
function InProgressNotesSection({ service, onSave, saving }: { service: VehicleServiceRecord; onSave: (notes: string) => void; saving: boolean }) {
  const [notes, setNotes] = useState(service.notes ?? '')
  return (
    <div className="border-t px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Repair Notes</p>
      <textarea
        className="w-full text-sm border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-feros-navy"
        rows={2}
        placeholder="Add notes about the repair progress…"
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <div className="flex justify-end mt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={saving} onClick={() => onSave(notes)}>
          {saving ? 'Saving…' : 'Save Notes'}
        </Button>
      </div>
    </div>
  )
}

// ── service tab content ────────────────────────────────────────────────────────
function ServiceTabContent({ vehicleId, vehicleReg, currentOdometer }: { vehicleId: number; vehicleReg: string; currentOdometer?: number }) {
  const isSupervisor = useAuthStore(s => s.role) === 'SUPERVISOR'
  const qc = useQueryClient()
  const [subTab, setSubTab]         = useState<'general' | 'breakdown'>('general')
  const [filter, setFilter]         = useState<'all' | 'open' | 'in_progress' | 'due_soon' | 'overdue' | 'completed'>('all')
  const [search, setSearch]         = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createBreakdownId, setCreateBreakdownId] = useState<number | undefined>()
  const [completeService, setCompleteService]     = useState<VehicleServiceRecord | null>(null)
  const [deleteId, setDeleteId]                   = useState<number | null>(null)
  const [detailService, setDetailService]         = useState<VehicleServiceRecord | null>(null)

  const { data: servicesRes, isLoading: servicesLoading } = useQuery({
    queryKey: ['vehicle-services', vehicleId],
    queryFn:  () => vehicleServicesApi.getByVehicle(vehicleId),
  })
  const { data: breakdownsRes, isLoading: breakdownsLoading } = useQuery({
    queryKey: ['vehicle-breakdowns-history', vehicleId],
    queryFn:  () => breakdownsApi.vehicleHistory(vehicleId),
  })

  const startMutation = useMutation({
    mutationFn: (id: number) => vehicleServicesApi.start(id),
    onSuccess: () => {
      toast.success('Service started')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
    },
    onError: () => toast.error('Failed to start service'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => vehicleServicesApi.cancel(id),
    onSuccess: () => {
      toast.success('Service reverted to Open')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
    },
    onError: () => toast.error('Failed to undo service'),
  })

  const notesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => vehicleServicesApi.updateNotes(id, notes),
    onSuccess: () => {
      toast.success('Notes saved')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
    },
    onError: () => toast.error('Failed to save notes'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vehicleServicesApi.delete(id),
    onSuccess: () => {
      toast.success('Service deleted')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete'),
  })

  const allServices: VehicleServiceRecord[] = servicesRes?.data ?? []
  const allBreakdowns: Breakdown[] = breakdownsRes?.data ?? []

  // Filter services
  const filtered = allServices.filter(s => {
    if (filter === 'open'        && s.status !== 'OPEN')              return false
    if (filter === 'in_progress' && s.status !== 'IN_PROGRESS')       return false
    if (filter === 'due_soon'    && s.displayStatus !== 'DUE_SOON')   return false
    if (filter === 'overdue'     && s.displayStatus !== 'OVERDUE')    return false
    if (filter === 'completed'   && s.displayStatus !== 'COMPLETED')  return false
    if (search && !s.serviceNumber?.toLowerCase().includes(search.toLowerCase()) &&
        !s.notes?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const dueSoonCount = allServices.filter(s => s.displayStatus === 'DUE_SOON').length
  const overdueCount = allServices.filter(s => s.displayStatus === 'OVERDUE').length
  const openBreakdowns = allBreakdowns.filter(b => b.status !== 'RESOLVED')

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['general', 'breakdown'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize relative',
              subTab === t ? 'bg-white text-feros-navy shadow-sm' : 'text-gray-500 hover:text-gray-800'
            )}>
            {t === 'breakdown' && openBreakdowns.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {openBreakdowns.length}
              </span>
            )}
            {t === 'general' ? 'General' : 'Breakdowns'}
          </button>
        ))}
      </div>

      {/* ── General tab ── */}
      {subTab === 'general' && (
        <div className="space-y-4">
          {/* Search + Create */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search services…" className="pl-8 h-9"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {!isSupervisor && (
              <Button size="sm" onClick={() => { setCreateBreakdownId(undefined); setCreateOpen(true) }}
                className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-9 text-xs">
                <Plus size={13} /> New Service
              </Button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all',         label: 'All',         count: allServices.length },
              { key: 'open',        label: 'Open',        count: allServices.filter(s => s.status === 'OPEN').length },
              { key: 'in_progress', label: 'In Progress', count: allServices.filter(s => s.status === 'IN_PROGRESS').length },
              { key: 'due_soon',    label: 'Due Soon',    count: dueSoonCount },
              { key: 'overdue',     label: 'Overdue',     count: overdueCount },
              { key: 'completed',   label: 'Completed',   count: allServices.filter(s => s.displayStatus === 'COMPLETED').length },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filter === f.key ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                )}>
                {f.label}
                <span className={cn('px-1.5 py-0.5 rounded-full text-xs',
                  filter === f.key ? 'bg-white/20' : 'bg-gray-100'
                )}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Service list */}
          {servicesLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Wrench size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">
                {allServices.length === 0 ? 'No services yet' : 'No services match filter'}
              </p>
              {allServices.length === 0 && (
                <p className="text-xs mt-1 text-gray-400">Create the first service to start tracking.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => (
                <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-gray-400">{s.serviceNumber}</span>
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', statusChip[s.displayStatus])}>
                            {statusLabel[s.displayStatus]}
                          </span>
                          <span className="text-xs text-gray-400">
                            {s.triggeredBy === 'BREAKDOWN' ? '⚡ Breakdown' :
                             s.triggeredBy === 'ACCIDENT'  ? '💥 Accident' :
                             s.triggeredBy === 'COMPLIANCE'? '📋 Compliance' :
                             s.triggeredBy === 'WARRANTY'  ? '🔒 Warranty' : '📅 Scheduled'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {s.serviceType === 'INTERNAL'    ? '🏭 Internal' :
                             s.serviceType === 'OEM_CENTER'   ? `🏢 ${s.vendorName ?? 'OEM Center'}` :
                             `🔧 ${s.vendorName ?? '3rd Party'}`}
                          </span>
                        </div>

                        {/* Tasks */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {s.tasks.map(t => (
                            <span key={t.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {t.displayName}{t.isRecurring ? ` 🔄${t.frequencyKm?.toLocaleString('en-IN')}km` : ''}
                            </span>
                          ))}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                          {s.dueAtOdometer && (
                            <span className="flex items-center gap-1">
                              <RotateCcw size={11} />Due at {s.dueAtOdometer.toLocaleString('en-IN')} km
                            </span>
                          )}
                          {s.odometer && (
                            <span>{s.odometer.toLocaleString('en-IN')} km</span>
                          )}
                          {s.serviceDate && (
                            <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(s.serviceDate)}</span>
                          )}
                          {s.location && <span>📍 {s.location}</span>}
                          {(s.totalCost ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <IndianRupee size={11} />{s.totalCost?.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!isSupervisor && s.status === 'OPEN' && (
                          <Button size="sm" onClick={() => startMutation.mutate(s.id)}
                            disabled={startMutation.isPending}
                            className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1">
                            <Wrench size={12} /> Start
                          </Button>
                        )}
                        {!isSupervisor && s.status === 'IN_PROGRESS' && (
                          <>
                            <Button size="sm" onClick={() => cancelMutation.mutate(s.id)}
                              disabled={cancelMutation.isPending}
                              variant="outline"
                              className="h-7 text-xs gap-1 text-orange-600 border-orange-200 hover:bg-orange-50">
                              Undo
                            </Button>
                            <Button size="sm" onClick={() => setCompleteService(s)}
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1">
                              <Check size={12} /> Done
                            </Button>
                          </>
                        )}
                        <button onClick={() => setDetailService(s)}
                          className="p-1.5 text-gray-300 hover:text-feros-navy rounded transition-colors"
                          title="View details">
                          <Info size={14} />
                        </button>
                        {!isSupervisor && s.status === 'OPEN' && (
                          <button onClick={() => setDeleteId(s.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <ServicePartsSection record={s} />
                  {s.status === 'IN_PROGRESS' && (
                    <InProgressNotesSection service={s} onSave={(notes) => notesMutation.mutate({ id: s.id, notes })} saving={notesMutation.isPending} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Breakdown tab ── */}
      {subTab === 'breakdown' && (
        <div className="space-y-2">
          {breakdownsLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : allBreakdowns.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <AlertTriangle size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">No breakdowns recorded</p>
            </div>
          ) : (
            allBreakdowns.map(b => {
              const isResolved = b.status === 'RESOLVED'
              const isReplaced = b.status === 'VEHICLE_REPLACED'
              const isInRepair = b.status === 'IN_REPAIR'
              const isOpen     = b.status === 'REPORTED'
              return (
                <div key={b.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border',
                          isInRepair  ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          isOpen      ? 'bg-red-50 text-red-600 border-red-200' :
                          isReplaced  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          isResolved  ? 'bg-green-50 text-green-700 border-green-200' :
                                        'bg-gray-50 text-gray-600 border-gray-200'
                        )}>
                          {isInRepair ? '🔧 In Repair' : isOpen ? '⚠ Open' : isReplaced ? '🔄 Vehicle Replaced — Pending Repair' : '✓ Resolved'}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{b.breakdownType.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-400">{b.breakdownDuration === 'SHORT' ? 'Minor' : 'Major'}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1.5">{b.reason}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        <span><Calendar size={11} className="inline mr-1" />
                          {b.breakdownDate ? format(parseISO(b.breakdownDate), 'dd MMM yyyy HH:mm') : '—'}
                        </span>
                        {b.location && <span>📍 {b.location}</span>}
                        {b.orderNumber && <span>Order: {b.orderNumber}</span>}
                      </div>
                    </div>
                    {!isSupervisor && (isOpen || isReplaced) && !isInRepair && (
                      <Button size="sm" onClick={() => { setCreateBreakdownId(b.id); setCreateOpen(true) }}
                        className="h-7 text-xs bg-feros-navy hover:bg-feros-navy/90 text-white gap-1 shrink-0">
                        <Wrench size={12} /> Log Service
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Dialogs */}
      <ServiceDetailModal
        service={detailService}
        open={!!detailService}
        onClose={() => setDetailService(null)}
      />
      <CreateServiceDialog
        vehicleId={vehicleId}
        vehicleReg={vehicleReg}
        breakdownId={createBreakdownId}
        currentOdometer={currentOdometer}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <CompleteServiceDialog
        service={completeService}
        currentOdometer={currentOdometer}
        open={!!completeService}
        onClose={() => setCompleteService(null)}
      />
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Service</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Delete this service record? This cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── fuel tab ─────────────────────────────────────────────────────────────────
const fuelLogSchema = z.object({
  fillDate:         z.string().min(1, 'Required'),
  litresFilled:     z.coerce.number().positive('Required'),
  odometerReading:  z.coerce.number().positive('Required'),
  costPerLitre:     z.coerce.number().positive('Required'),
  totalCost:        z.coerce.number().optional(),
  isFullTank:       z.boolean().default(false),
  paymentMode:      z.enum(['CASH', 'COMPANY_ACCOUNT', 'REIMBURSEMENT']),
  fuelStationName:  z.string().optional(),
  fuelStationCity:  z.string().optional(),
  receiptUrl:       z.string().optional(),
  notes:            z.string().optional(),
})
type FuelLogForm = z.infer<typeof fuelLogSchema>

const PAYMENT_MODE_LABELS: Record<FuelPaymentMode, string> = {
  CASH:            'Cash',
  COMPANY_ACCOUNT: 'Company Account',
  REIMBURSEMENT:   'Reimbursement',
}

// ── Meter Readings tab ────────────────────────────────────────────────────────
function MeterReadingsTabContent({ vehicleId, latestOdometer }: { vehicleId: number; latestOdometer?: number }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [km, setKm] = useState('')
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['meter-readings', vehicleId],
    queryFn: () => meterReadingsApi.getAll(vehicleId),
  })
  const readings: MeterReading[] = (data?.data ?? []).sort((a, b) => b.readingKm - a.readingKm)
  const lastKm = Math.max(readings.length > 0 ? readings[0].readingKm : 0, latestOdometer ?? 0)

  const mutation = useMutation({
    mutationFn: () => meterReadingsApi.create({ vehicleId, readingKm: Number(km), readingType: 'GENERAL', recordedAt: date ? `${date}:00` : undefined, notes: notes || undefined }),
    onSuccess: () => {
      toast.success('Reading added')
      qc.invalidateQueries({ queryKey: ['meter-readings', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      setAddOpen(false)
      setKm('')
      setNotes('')
      setDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed to add reading'); if (_m) toast.error(_m) },
  })

  const handleSubmit = () => {
    if (!km || Number(km) <= 0) return toast.error('Enter a valid KM reading')
    if (Number(km) <= lastKm) return toast.error(`Reading must be greater than last reading (${lastKm.toLocaleString('en-IN')} km)`)
    mutation.mutate()
  }

  const fmtD = (d?: string) => { if (!d) return '—'; try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d } }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 rounded-lg p-2"><Gauge size={16} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-400">Current Odometer</p>
            <p className="text-lg font-bold text-gray-800">{lastKm.toLocaleString('en-IN')} km</p>
          </div>
        </div>
        <Button size="sm" className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs" onClick={() => setAddOpen(true)}>
          <Plus size={13} /> Add Reading
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : readings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No readings recorded</p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Odometer (km)</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Recorded By</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {readings.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{fmtD(r.recordedAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{Number(r.readingKm).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded capitalize">
                      {r.readingType.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.recordedByName}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Meter Reading</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Odometer Reading (km) *</Label>
              <Input type="number" value={km} onChange={e => setKm(e.target.value)}
                placeholder={`Must be > ${lastKm.toLocaleString('en-IN')}`} className="mt-1" />
            </div>
            <div>
              <Label>Date & Time *</Label>
              <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className="mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-feros-navy hover:bg-feros-navy/90" onClick={handleSubmit} disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tyre tab ──────────────────────────────────────────────────────────────────
const POSITION_TYPE_ORDER: TyrePositionType[] = ['STEER', 'DRIVE', 'TRAILER', 'SPARE']
const REMOVAL_REASONS: { value: TyreRemovalReason; label: string }[] = [
  { value: 'WORN',     label: 'Worn Out' },
  { value: 'PUNCTURE', label: 'Puncture' },
  { value: 'DAMAGE',   label: 'Damage' },
  { value: 'RETREAD',  label: 'Send for Retread' },
  { value: 'SCRAP',    label: 'Scrap' },
  { value: 'OTHER',    label: 'Other' },
]

function FitTyreDialog({ open, onClose, vehicleId, positionId, availableTyres, currentKm }: {
  open: boolean; onClose: () => void; vehicleId: number; positionId: number; availableTyres: Tyre[]; currentKm?: number
}) {
  const qc = useQueryClient()
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedTyreId, setSelectedTyreId] = useState<number | undefined>(undefined)
  const [km, setKm] = useState(currentKm?.toString() ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  // Group available tyres by brand + size
  const groupedTyres = availableTyres.reduce<Record<string, Tyre[]>>((acc, t) => {
    const key = `${t.brand} ${t.size}`
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const groupOptions = Object.entries(groupedTyres).map(([key, tyres]) => ({
    value: key,
    label: `${key} (${tyres.length} available)`,
  }))

  const serialOptions = selectedGroup
    ? (groupedTyres[selectedGroup] ?? []).map(t => ({
        value: String(t.id),
        label: t.serialNumber,
      }))
    : []

  const handleGroupChange = (val: string) => {
    setSelectedGroup(val)
    setSelectedTyreId(undefined)
  }

  const mutation = useMutation({
    mutationFn: () => tyresApi.fitTyre({ vehicleId, tyreId: selectedTyreId!, positionId, fittedAtKm: Number(km), fittedDate: date }),
    onSuccess: () => {
      toast.success('Tyre fitted')
      qc.invalidateQueries({ queryKey: ['tyre-positions-current', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tyre-fittings', vehicleId] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Fit Tyre</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Brand & Size *</Label>
            <SearchableSelect
              value={selectedGroup}
              onValueChange={handleGroupChange}
              options={groupOptions}
              placeholder="Choose brand & size…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Serial Number *</Label>
            <SearchableSelect
              value={selectedTyreId ? String(selectedTyreId) : ''}
              onValueChange={val => setSelectedTyreId(Number(val))}
              options={serialOptions}
              placeholder={selectedGroup ? 'Select serial number…' : 'Select brand & size first'}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Odometer at Fitting (km) *</Label>
            <Input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="e.g. 45000" />
          </div>
          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!selectedTyreId || !km || mutation.isPending} onClick={() => mutation.mutate()} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Fitting…' : 'Fit Tyre'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RemoveTyreDialog({ open, onClose, fitting, currentKm }: {
  open: boolean; onClose: () => void; fitting: TyreFitting; currentKm?: number
}) {
  const qc = useQueryClient()
  const [km, setKm]     = useState(currentKm?.toString() ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason]               = useState<TyreRemovalReason | ''>('')
  const [retreaderName, setRetreaderName] = useState('')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [notes, setNotes] = useState('')

  const isRetread = reason === 'RETREAD'
  const isScrap   = reason === 'SCRAP'

  const mutation = useMutation({
    mutationFn: () => tyresApi.removeTyre(fitting.id, {
      removedAtKm:        Number(km),
      removedDate:        date || undefined,
      removalReason:      reason as TyreRemovalReason,
      retreaderName:      retreaderName || undefined,
      expectedReturnDate: expectedReturnDate || undefined,
      notes:              notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Tyre removed')
      qc.invalidateQueries({ queryKey: ['tyre-positions-current', fitting.vehicleId] })
      qc.invalidateQueries({ queryKey: ['tyre-fittings', fitting.vehicleId] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Remove Tyre</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium">{fitting.tyreSerialNumber}</p>
            <p className="text-gray-500">{fitting.tyreBrand} · {fitting.tyreSize}</p>
          </div>
          {(isRetread || isScrap) && (
            <div className={`rounded-lg px-3 py-2 text-sm border ${isRetread ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {isRetread
                ? 'Tyre will be sent for retreading. Status will change to Retreading.'
                : 'Tyre will be permanently scrapped. This cannot be undone.'}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Removal Reason *</Label>
            <SearchableSelect
              value={reason}
              onValueChange={val => { setReason(val as TyreRemovalReason); setRetreaderName(''); setExpectedReturnDate('') }}
              options={REMOVAL_REASONS.map(r => ({ value: r.value, label: r.label }))}
              placeholder="Select reason…"
              showSearch={false}
            />
          </div>
          {isRetread && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Retreader Name</Label>
                <Input value={retreaderName} onChange={e => setRetreaderName(e.target.value)} placeholder="e.g. MRF Retread Centre" />
              </div>
              <div className="space-y-1.5">
                <Label>Expected Return Date</Label>
                <Input type="date" value={expectedReturnDate} onChange={e => setExpectedReturnDate(e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Odometer at Removal (km) *</Label>
              <Input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="e.g. 87000" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!km || !reason || mutation.isPending}
              onClick={() => mutation.mutate()}
              className={`${isScrap ? 'bg-red-600 hover:bg-red-700' : 'bg-feros-navy hover:bg-feros-navy/90'} text-white`}
            >
              {mutation.isPending ? 'Removing…' : 'Remove Tyre'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ManagePositionsDialog({ open, onClose, vehicleId }: { open: boolean; onClose: () => void; vehicleId: number }) {
  const qc = useQueryClient()
  const [newCode, setNewCode] = useState('')
  const [newType, setNewType] = useState<TyrePositionType>('DRIVE')
  const [newOrder, setNewOrder] = useState('')

  const { data } = useQuery({
    queryKey: ['tyre-positions', vehicleId],
    queryFn: () => tyresApi.getPositions(vehicleId),
    enabled: open,
  })
  const positions: TyrePosition[] = data?.data ?? []

  const addMutation = useMutation({
    mutationFn: () => tyresApi.addPosition({ vehicleId, positionCode: newCode, positionType: newType, displayOrder: newOrder ? Number(newOrder) : 0 }),
    onSuccess: () => {
      toast.success('Position added')
      qc.invalidateQueries({ queryKey: ['tyre-positions', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tyre-positions-current', vehicleId] })
      setNewCode(''); setNewOrder('')
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  const delMutation = useMutation({
    mutationFn: (id: number) => tyresApi.deletePosition(id),
    onSuccess: () => {
      toast.success('Position removed')
      qc.invalidateQueries({ queryKey: ['tyre-positions', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tyre-positions-current', vehicleId] })
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manage Tyre Positions</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase">Add Position</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Code *</Label>
                <Input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="FL" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type *</Label>
                <select className="w-full border rounded-md px-2 py-1.5 text-xs h-8" value={newType} onChange={e => setNewType(e.target.value as TyrePositionType)}>
                  {POSITION_TYPE_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Order</Label>
                <Input type="number" value={newOrder} onChange={e => setNewOrder(e.target.value)} placeholder="0" className="h-8 text-xs" />
              </div>
            </div>
            <Button size="sm" disabled={!newCode || addMutation.isPending} onClick={() => addMutation.mutate()} className="bg-feros-navy hover:bg-feros-navy/90 text-white text-xs h-7">
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {positions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No positions defined yet</p>
            ) : positions.map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <span className="font-mono font-medium text-sm">{p.positionCode}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.positionType} · order {p.displayOrder}</span>
                </div>
                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 h-7 text-xs"
                  onClick={() => delMutation.mutate(p.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RotationDialog({ open, onClose, vehicleId, positions, currentKm }: {
  open: boolean; onClose: () => void; vehicleId: number; positions: TyrePosition[]; currentKm?: number
}) {
  const qc = useQueryClient()
  const fittedPositions = positions.filter(p => p.currentFitting)
  const [moves, setMoves] = useState<Record<number, string>>({})
  const [km, setKm] = useState(currentKm?.toString() ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const selectedTargets = Object.values(moves).filter(Boolean)
  const hasConflict = selectedTargets.length !== new Set(selectedTargets).size

  const mutation = useMutation({
    mutationFn: () => {
      const moveList = fittedPositions
        .filter(p => moves[p.id])
        .map(p => ({
          tyreId: p.currentFitting!.tyreId,
          fromPositionId: p.id,
          toPositionId: Number(moves[p.id]),
        }))
      return tyresApi.performRotation({ vehicleId, rotationDate: date, odometerKm: Number(km), notes, moves: moveList })
    },
    onSuccess: () => {
      toast.success('Rotation performed')
      qc.invalidateQueries({ queryKey: ['tyre-positions-current', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tyre-fittings', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tyre-rotations', vehicleId] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Perform Tyre Rotation</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Odometer (km) *</Label>
              <Input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="e.g. 87000" />
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          {hasConflict && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              Conflict: two tyres are targeting the same destination position
            </div>
          )}

          {fittedPositions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tyres currently fitted</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Move each tyre to a new position</p>
              {fittedPositions.map(p => {
                const f = p.currentFitting!
                const target = moves[p.id]
                const isConflicted = !!target && selectedTargets.filter(t => t === target).length > 1
                return (
                  <div key={p.id} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2', isConflicted && 'border-red-300 bg-red-50')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.positionCode}</p>
                      <p className="text-xs text-gray-500 truncate">{f.tyreSerialNumber} — {f.tyreBrand}</p>
                    </div>
                    <span className="text-gray-400 text-xs">→</span>
                    <select
                      className={cn('border rounded-md px-2 py-1.5 text-sm w-36', isConflicted && 'border-red-400')}
                      value={target ?? ''}
                      onChange={e => setMoves(m => ({ ...m, [p.id]: e.target.value }))}
                    >
                      <option value="">Stay / Skip</option>
                      {positions.map(pos => (
                        <option key={pos.id} value={pos.id}>{pos.positionCode}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!km || hasConflict || Object.values(moves).every(v => !v) || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white"
            >
              {mutation.isPending ? 'Performing…' : 'Perform Rotation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type TyresSubTab = 'Current' | 'Rotation History' | 'Fitting History'

function TyresTabContent({ vehicle }: { vehicle: { id: number; currentOdometerReading?: number; tyreRotationIntervalKm?: number; vehicleTypeName?: string } }) {
  const [subTab, setSubTab] = useState<TyresSubTab>('Current')
  const [fitDialog, setFitDialog] = useState<{ positionId: number } | null>(null)
  const [removeDialog, setRemoveDialog] = useState<TyreFitting | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const qc = useQueryClient()

  const generateMutation = useMutation({
    mutationFn: () => tyresApi.generatePositions(vehicle.id),
    onSuccess: () => {
      toast.success('Tyre positions generated')
      qc.invalidateQueries({ queryKey: ['tyre-positions-current', vehicle.id] })
    },
    onError: () => toast.error('Failed to generate positions'),
  })

  const { data: posRes } = useQuery({
    queryKey: ['tyre-positions-current', vehicle.id],
    queryFn: () => tyresApi.getCurrentPositions(vehicle.id),
  })
  const { data: availRes } = useQuery({ queryKey: ['tyres-available'], queryFn: tyresApi.getAvailable })
  const { data: fittingRes } = useQuery({
    queryKey: ['tyre-fittings', vehicle.id],
    queryFn: () => tyresApi.getFittingHistory(vehicle.id),
    enabled: subTab === 'Fitting History',
  })
  const { data: rotRes } = useQuery({
    queryKey: ['tyre-rotations', vehicle.id],
    queryFn: () => tyresApi.getRotationHistory(vehicle.id),
    enabled: subTab === 'Rotation History',
  })

  const positions: TyrePosition[] = posRes?.data ?? []
  const availableTyres: Tyre[] = availRes?.data ?? []
  const fittingHistory: TyreFitting[] = fittingRes?.data ?? []
  const rotationHistory: TyreRotationLog[] = rotRes?.data ?? []
  const currentKm = vehicle.currentOdometerReading ? Number(vehicle.currentOdometerReading) : undefined

  const grouped = POSITION_TYPE_ORDER.reduce((acc, type) => {
    acc[type] = positions.filter(p => p.positionType === type)
    return acc
  }, {} as Record<TyrePositionType, TyrePosition[]>)

  const fmtD = (d?: string) => { if (!d) return '—'; try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d } }

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 border-b border-gray-100">
        {(['Current', 'Rotation History', 'Fitting History'] as TyresSubTab[]).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              subTab === t ? 'border-feros-orange text-feros-orange' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Current */}
      {subTab === 'Current' && (
        <div className="space-y-4">
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>Manage Positions</Button>
            <Button size="sm" variant="outline" onClick={() => setRotateOpen(true)}>Rotate</Button>
          </div>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm space-y-3">
              <p>No positions configured.</p>
              {vehicle.vehicleTypeName ? (
                <Button
                  size="sm"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? 'Generating…' : 'Generate Positions'}
                </Button>
              ) : (
                <p className="text-xs">Set a vehicle type to enable auto-generation, or <button className="text-feros-navy underline" onClick={() => setManageOpen(true)}>add positions manually</button>.</p>
              )}
            </div>
          ) : (
            POSITION_TYPE_ORDER.map(type => {
              const group = grouped[type]
              if (group.length === 0) return null
              return (
                <div key={type}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{type}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {group.map(pos => {
                      const f = pos.currentFitting
                      const kmSinceFitted = (currentKm != null && f) ? currentKm - f.fittedAtKm : null
                      const rotInterval = vehicle.tyreRotationIntervalKm
                      const rotationBadge = (() => {
                        if (kmSinceFitted == null || !rotInterval) return null
                        if (kmSinceFitted >= rotInterval) return <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Rotation Due</span>
                        if (kmSinceFitted >= rotInterval * 0.9) return <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Rotation Soon</span>
                        return null
                      })()
                      const maxKm = f?.tyreMaxLifetimeKm
                      const totalKm = f ? (f.tyreTotalLifetimeKm ?? 0) + (kmSinceFitted ?? 0) : 0
                      const replaceBadge = (maxKm && totalKm >= maxKm * 0.85)
                        ? <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Replace Soon</span>
                        : null
                      return (
                        <div key={pos.id} className={cn('border rounded-xl p-3 text-sm relative', f ? 'bg-white border-gray-200' : 'border-dashed border-gray-200 bg-gray-50')}>
                          <div className="flex items-start justify-between mb-1">
                            <p className="font-mono font-semibold text-xs text-gray-500">{pos.positionCode}</p>
                            <div className="flex flex-col items-end gap-0.5">
                              {rotationBadge}
                              {replaceBadge}
                            </div>
                          </div>
                          {f ? (
                            <>
                              <p className="font-medium text-gray-800 truncate">{f.tyreSerialNumber}</p>
                              <p className="text-xs text-gray-400 truncate">{f.tyreBrand} · {f.tyreSize}</p>
                              {kmSinceFitted != null && (
                                <p className="text-xs text-blue-600 mt-1">{kmSinceFitted.toLocaleString('en-IN')} km since fitted</p>
                              )}
                              <Button size="sm" variant="ghost" className="mt-2 h-6 text-xs text-red-500 hover:text-red-600 px-2 w-full" onClick={() => setRemoveDialog(f)}>
                                Remove
                              </Button>
                            </>
                          ) : (
                            <div className="text-center py-1">
                              <p className="text-xs text-gray-400 mb-1.5">Empty</p>
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2 w-full" onClick={() => setFitDialog({ positionId: pos.id })}>
                                Fit Tyre
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Rotation History */}
      {subTab === 'Rotation History' && (
        <div className="space-y-3">
          {rotationHistory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No rotations recorded</p>
          ) : rotationHistory.map(log => (
            <div key={log.id} className="border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{fmtD(log.rotationDate)}</p>
                  <p className="text-xs text-gray-400">Odometer: {Number(log.odometerKm).toLocaleString('en-IN')} km · By {log.performedByName}</p>
                </div>
                <span className="text-xs text-gray-400">{log.items.length} tyres moved</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {log.items.map(item => (
                  <div key={item.id} className="flex items-center gap-1 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                    <span className="font-mono font-medium">{item.fromPositionCode}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-mono font-medium">{item.toPositionCode}</span>
                    <span className="text-gray-400 truncate ml-1">{item.tyreSerialNumber}</span>
                  </div>
                ))}
              </div>
              {log.notes && <p className="text-xs text-gray-400 mt-2">{log.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Fitting History */}
      {subTab === 'Fitting History' && (
        <div>
          {fittingHistory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No fitting history</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Tyre</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Position</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Fitted</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Removed</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">km driven</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fittingHistory.map(f => (
                  <tr key={f.id}>
                    <td className="px-3 py-2"><p className="font-medium">{f.tyreSerialNumber}</p><p className="text-xs text-gray-400">{f.tyreBrand} {f.tyreSize}</p></td>
                    <td className="px-3 py-2 font-mono text-xs">{f.positionCode}</td>
                    <td className="px-3 py-2 text-xs">{fmtD(f.fittedDate)}</td>
                    <td className="px-3 py-2 text-xs">{f.removedDate ? fmtD(f.removedDate) : <span className="text-blue-600">Currently fitted</span>}</td>
                    <td className="px-3 py-2 text-xs">{f.kmDriven != null ? Number(f.kmDriven).toLocaleString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {fitDialog && (
        <FitTyreDialog open={!!fitDialog} onClose={() => setFitDialog(null)} vehicleId={vehicle.id} positionId={fitDialog.positionId} availableTyres={availableTyres} currentKm={currentKm} />
      )}
      {removeDialog && (
        <RemoveTyreDialog open={!!removeDialog} onClose={() => setRemoveDialog(null)} fitting={removeDialog} currentKm={currentKm} />
      )}
      {manageOpen && <ManagePositionsDialog open={manageOpen} onClose={() => setManageOpen(false)} vehicleId={vehicle.id} />}
      {rotateOpen && <RotationDialog open={rotateOpen} onClose={() => setRotateOpen(false)} vehicleId={vehicle.id} positions={positions} currentKm={currentKm} />}
    </div>
  )
}

function FuelTabContent({ vehicle }: { vehicle: { id: number; registrationNumber: string; fuelTankCapacity?: number; currentFuelLevel?: number; currentOdometerReading?: number } }) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editLog, setEditLog]       = useState<FuelLog | null>(null)
  const [uploading, setUploading]   = useState(false)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['fuel-logs', vehicle.id],
    queryFn:  () => fuelLogsApi.getAll({ vehicleId: vehicle.id, size: 1000 }).then(r => r.data?.content ?? []),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FuelLogForm>({
    resolver: zodResolver(fuelLogSchema) as Resolver<FuelLogForm>,
    defaultValues: { isFullTank: false, paymentMode: 'CASH' },
  })

  const litres      = watch('litresFilled')
  const costPerL    = watch('costPerLitre')

  // Auto-calculate total cost
  const autoTotal = litres && costPerL ? (Number(litres) * Number(costPerL)).toFixed(2) : ''

  const tankCapacity  = vehicle.fuelTankCapacity  ? Number(vehicle.fuelTankCapacity)  : null
  const currentFuel   = vehicle.currentFuelLevel  ? Number(vehicle.currentFuelLevel)  : 0
  const maxFillable   = tankCapacity != null ? tankCapacity - currentFuel : null

  function nowDTL() {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  function openAdd() {
    reset({
      isFullTank: false,
      paymentMode: 'CASH',
      fillDate: nowDTL(),
      odometerReading: vehicle.currentOdometerReading ?? undefined,
    })
    setEditLog(null)
    setDialogOpen(true)
  }

  function openEdit(log: FuelLog) {
    reset({
      fillDate:        log.fillDate ? String(log.fillDate).slice(0, 16) : nowDTL(),
      litresFilled:    log.litresFilled,
      odometerReading: log.odometerReading,
      costPerLitre:    log.costPerLitre,
      totalCost:       log.totalCost,
      isFullTank:      log.isFullTank,
      paymentMode:     log.paymentMode,
      fuelStationName: log.fuelStationName ?? '',
      fuelStationCity: log.fuelStationCity ?? '',
      receiptUrl:      log.receiptUrl ?? '',
      notes:           log.notes ?? '',
    })
    setEditLog(log)
    setDialogOpen(true)
  }

  // Litres validation
  const litresNum = Number(litres)
  const litresError = litres && !isNaN(litresNum)
    ? tankCapacity != null && litresNum > tankCapacity
      ? `Cannot exceed tank capacity (${tankCapacity} L)`
      : maxFillable != null && litresNum > maxFillable
        ? `Tank has ${currentFuel} L — max fillable is ${maxFillable.toFixed(1)} L`
        : null
    : null

  const saveMutation = useMutation({
    mutationFn: (data: FuelLogForm) => {
      const fillDate = data.fillDate ? `${data.fillDate}:00` : undefined
      const payload = { ...data, fillDate, vehicleId: vehicle.id, totalCost: (data.totalCost ?? Number(autoTotal)) || undefined }
      return editLog
        ? fuelLogsApi.update(editLog.id, payload)
        : fuelLogsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(editLog ? 'Fuel log updated' : 'Fuel log added')
      qc.invalidateQueries({ queryKey: ['fuel-logs', vehicle.id] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicle.id] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      setDialogOpen(false)
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fuelLogsApi.delete(id),
    onSuccess: () => {
      toast.success('Fuel log deleted')
      qc.invalidateQueries({ queryKey: ['fuel-logs', vehicle.id] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicle.id] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressIfNeeded(file)
      const res = await fuelLogsApi.uploadReceipt(vehicle.id, compressed)
      setValue('receiptUrl', res.data.publicUrl)
      toast.success('Receipt uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Summary calculations
  const fuelPct = vehicle.fuelTankCapacity && vehicle.currentFuelLevel
    ? Math.round((vehicle.currentFuelLevel / vehicle.fuelTankCapacity) * 100)
    : null

  const avgMileage = logs.filter(l => l.mileageKmPerLitre).length > 0
    ? (logs.filter(l => l.mileageKmPerLitre).reduce((s, l) => s + (l.mileageKmPerLitre ?? 0), 0) /
       logs.filter(l => l.mileageKmPerLitre).length).toFixed(2)
    : null

  const totalSpend = logs.reduce((s, l) => s + l.totalCost, 0)

  const receiptUrl = watch('receiptUrl')

  return (
    <div className="space-y-5">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Tank Capacity</p>
          <p className="text-lg font-bold text-blue-700">
            {vehicle.fuelTankCapacity ? `${vehicle.fuelTankCapacity} L` : '—'}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
          <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-1">Current Fuel</p>
          <p className="text-lg font-bold text-orange-700">
            {vehicle.currentFuelLevel ? `${vehicle.currentFuelLevel} L` : '—'}
          </p>
          {fuelPct !== null && (
            <div className="mt-1.5">
              <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${fuelPct}%` }} />
              </div>
              <p className="text-xs text-orange-400 mt-0.5">{fuelPct}% full</p>
            </div>
          )}
        </div>
        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
          <p className="text-xs text-green-500 font-semibold uppercase tracking-wide mb-1">Avg Mileage</p>
          <p className="text-lg font-bold text-green-700">
            {avgMileage ? `${avgMileage} km/L` : '—'}
          </p>
          <p className="text-xs text-green-400">from full tank fills</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
          <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide mb-1">Total Fuel Spend</p>
          <p className="text-lg font-bold text-purple-700">
            {totalSpend > 0 ? `₹${totalSpend.toLocaleString('en-IN')}` : '—'}
          </p>
          <p className="text-xs text-purple-400">{logs.length} fill-up{logs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fill-up History</p>
        <Button size="sm" onClick={openAdd} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
          <Plus size={13} /> Add Fill-up
        </Button>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <Droplets size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No fuel logs yet</p>
          <p className="text-xs mt-1">Add the first fill-up to start tracking mileage and costs.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Litres</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Odometer</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost/L</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mileage</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Station</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-800">{fmtDate(log.fillDate)}</div>
                    {log.isFullTank && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Full</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-blue-700">{log.litresFilled} L</td>
                  <td className="px-3 py-2.5 text-gray-600">{log.odometerReading?.toLocaleString('en-IN')} km</td>
                  <td className="px-3 py-2.5 text-gray-600">₹{log.costPerLitre}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-800">₹{log.totalCost?.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5">
                    {log.mileageKmPerLitre ? (
                      <span className="text-green-700 font-semibold">{log.mileageKmPerLitre} km/L</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{PAYMENT_MODE_LABELS[log.paymentMode]}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">
                    {[log.fuelStationName, log.fuelStationCity].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {log.receiptUrl && (
                        <a href={log.receiptUrl} target="_blank" rel="noreferrer"
                          className="text-blue-500 hover:text-blue-700 p-1 rounded" title="View receipt">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button onClick={() => openEdit(log)}
                        className="text-gray-400 hover:text-feros-navy p-1 rounded">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { if (confirm('Delete this fuel log?')) deleteMutation.mutate(log.id) }}
                        className="text-gray-400 hover:text-red-500 p-1 rounded">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLog ? 'Edit Fuel Log' : 'Add Fuel Fill-up'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => { if (litresError) { toast.error(litresError); return } saveMutation.mutate(d) })} className="space-y-4 pt-1">

            {tankCapacity != null && (
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                Tank: <strong>{tankCapacity} L</strong> · Current: <strong>{currentFuel} L</strong> · Max fillable: <strong>{maxFillable?.toFixed(1)} L</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date & Time *</Label>
                <Input type="datetime-local" {...register('fillDate')} />
                {errors.fillDate && <p className="text-xs text-red-500">{errors.fillDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Odometer (km) *</Label>
                <Input type="number" placeholder="48200" {...register('odometerReading')} />
                {errors.odometerReading && <p className="text-xs text-red-500">{errors.odometerReading.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Litres Filled *</Label>
                {maxFillable != null && (
                  <p className="text-xs text-gray-400">Max: {maxFillable.toFixed(1)} L</p>
                )}
                <Input type="number" step="0.01"
                  placeholder={maxFillable != null ? `Max ${maxFillable.toFixed(1)} L` : '150'}
                  {...register('litresFilled')} />
                {litresError
                  ? <p className="text-xs text-red-500">{litresError}</p>
                  : errors.litresFilled && <p className="text-xs text-red-500">{errors.litresFilled.message}</p>
                }
              </div>
              <div className="space-y-1.5">
                <Label>Cost per Litre (₹) *</Label>
                <Input type="number" step="0.01" placeholder="105.50" {...register('costPerLitre')} />
                {errors.costPerLitre && <p className="text-xs text-red-500">{errors.costPerLitre.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Total Cost (₹)</Label>
                <Input type="number" step="0.01" placeholder={autoTotal || 'Auto calculated'} {...register('totalCost')} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode *</Label>
                <select {...register('paymentMode')}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy/20">
                  <option value="CASH">Cash</option>
                  <option value="COMPANY_ACCOUNT">Company Account</option>
                  <option value="REIMBURSEMENT">Reimbursement</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Fuel Station Name</Label>
                <Input placeholder="Indian Oil, HP Petrol..." {...register('fuelStationName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Fuel Station City</Label>
                <Input placeholder="Vizianagaram" {...register('fuelStationCity')} />
              </div>
            </div>

            {/* Full Tank toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" {...register('isFullTank')}
                onChange={e => {
                  setValue('isFullTank', e.target.checked)
                  if (e.target.checked && maxFillable != null) {
                    setValue('litresFilled', maxFillable)
                    const c = Number(watch('costPerLitre'))
                    if (!isNaN(c) && c > 0) setValue('totalCost', Number((maxFillable * c).toFixed(2)))
                  }
                }}
                className="w-4 h-4 rounded accent-feros-navy" />
              <span className="text-sm font-medium text-gray-700">Full tank fill-up</span>
              <span className="text-xs text-gray-400">(enables accurate mileage calculation)</span>
            </label>

            {/* Receipt upload */}
            <div className="space-y-1.5">
              <Label>Receipt Photo</Label>
              <div className="flex items-center gap-2">
                <label className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-gray-300 cursor-pointer text-sm text-gray-500 hover:border-feros-navy hover:text-feros-navy transition-colors',
                  uploading && 'opacity-50 pointer-events-none'
                )}>
                  <Paperclip size={14} />
                  {uploading ? 'Uploading…' : 'Upload Receipt'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReceiptUpload} />
                </label>
                {receiptUrl && (
                  <a href={receiptUrl} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-500 underline flex items-center gap-1">
                    <ExternalLink size={12} /> View
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Any notes about this fill-up" {...register('notes')} />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending || uploading}
                className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                {saveMutation.isPending ? 'Saving…' : editLog ? 'Update' : 'Add Fill-up'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ── Vehicle Assignments Tab ────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 20

type HistoryEventType = 'ASSIGNED' | 'UNASSIGNED'

interface HistoryEvent {
  id: string
  type: HistoryEventType
  orderNumber: string
  actionByName?: string
  actionAt?: string
}

function expandToEvents(records: VehicleAssignmentHistory[]): HistoryEvent[] {
  const events: HistoryEvent[] = []
  for (const r of records) {
    events.push({ id: `${r.id}-a`, type: 'ASSIGNED', orderNumber: r.orderNumber, actionByName: r.assignedByName, actionAt: r.assignedAt })
    if (r.unassignedAt) {
      events.push({ id: `${r.id}-u`, type: 'UNASSIGNED', orderNumber: r.orderNumber, actionByName: r.unassignedByName, actionAt: r.unassignedAt })
    }
  }
  return events.sort((a, b) => (b.actionAt ?? '').localeCompare(a.actionAt ?? ''))
}

function EventIcon({ type }: { type: HistoryEventType }) {
  if (type === 'ASSIGNED') return <Truck size={14} className="text-green-600" />
  return <Truck size={14} className="text-red-500" />
}

function eventDotColor(type: HistoryEventType) {
  return type === 'ASSIGNED' ? 'bg-green-500' : 'bg-red-400'
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'dd MMM yyyy, hh:mm a') } catch { return iso }
}

function groupByDate(events: HistoryEvent[]): Array<{ date: string; label: string; items: HistoryEvent[] }> {
  const map = new Map<string, HistoryEvent[]>()
  for (const e of events) {
    const day = e.actionAt ? e.actionAt.substring(0, 10) : 'unknown'
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(e)
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label: (() => { try { return format(parseISO(date), 'dd MMM yyyy') } catch { return date } })(),
    items,
  }))
}

const ALLOC_COLORS: Record<string, string> = {
  PENDING:     'bg-gray-100 text-gray-700',
  ASSIGNED:    'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED:   'bg-green-100 text-green-700',
  CANCELLED:   'bg-red-100 text-red-700',
}

function AssignToOrderDialog({ vehicleId, eligibleOrders, open, onClose, onSuccess }: {
  vehicleId: number; eligibleOrders: Order[]
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [orderId, setOrderId]                       = useState('')
  const [allocatedWeight, setAllocatedWeight]       = useState('')
  const [expectedLoadDate, setExpectedLoadDate]     = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [remarks, setRemarks]                       = useState('')

  const mutation = useMutation({
    mutationFn: () => ordersApi.assignVehicle(Number(orderId), {
      vehicleId,
      allocatedWeight: Number(allocatedWeight),
      expectedLoadDate: expectedLoadDate || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      remarks: remarks || undefined,
    }),
    onSuccess: () => { toast.success('Vehicle assigned to order'); onSuccess(); handleClose() },
    onError:   (e: unknown) => toast.error(getApiError(e, 'Failed to assign') ?? 'Failed'),
  })

  function handleClose() {
    setOrderId(''); setAllocatedWeight(''); setExpectedLoadDate(''); setExpectedDeliveryDate(''); setRemarks('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign to Order</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Order <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={orderId} onValueChange={setOrderId}
              options={eligibleOrders.map(o => ({
                value: String(o.id),
                label: `${o.orderNumber} — ${o.clientName} · ${o.sourceCityName} → ${o.destinationCityName}`,
              }))}
              placeholder="Select a pending order"
              className="mt-1"
            />
            {eligibleOrders.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No pending or partially assigned orders found.</p>
            )}
          </div>
          <div>
            <Label>Allocated Weight (tons) <span className="text-red-500">*</span></Label>
            <Input type="number" step="0.01" min="0" placeholder="e.g. 20" value={allocatedWeight} onChange={e => setAllocatedWeight(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expected Load Date</Label>
              <Input type="date" value={expectedLoadDate} onChange={e => setExpectedLoadDate(e.target.value)} />
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Remarks</Label>
            <Input placeholder="Optional" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button
              className="flex-1"
              disabled={!orderId || !allocatedWeight || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AssignStaffDialog({ orderId, allocationId, users, open, onClose, onSuccess }: {
  orderId: number; allocationId: number
  users: { id: number; name: string; role: string }[]
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [userId, setUserId]   = useState('')
  const [slotRole, setSlotRole] = useState<'DRIVER' | 'CLEANER'>('DRIVER')

  const mutation = useMutation({
    mutationFn: () => ordersApi.assignStaff(orderId, { vehicleAllocationId: allocationId, userId: Number(userId), slotRole }),
    onSuccess: () => { toast.success('Staff assigned'); onSuccess(); onClose() },
    onError:   (e: unknown) => toast.error(getApiError(e, 'Failed to assign staff') ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Staff</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Role</Label>
            <div className="flex gap-2 mt-1">
              {(['DRIVER', 'CLEANER'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setSlotRole(r); setUserId('') }}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-colors', slotRole === r ? 'bg-feros-navy text-white border-feros-navy' : 'border-gray-200 text-gray-600 hover:border-gray-300')}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Staff Member <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={userId} onValueChange={setUserId}
              options={users.filter(u => u.role === slotRole).map(u => ({ value: String(u.id), label: u.name }))}
              placeholder={`Select ${slotRole.toLowerCase()}`}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" disabled={!userId || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function VehicleAssignmentsTab({ vehicleId }: { vehicleId: number }) {
  const qc = useQueryClient()
  const [view, setView]                         = useState<'active' | 'history'>('active')
  const [showAssignOrder, setShowAssignOrder]   = useState(false)
  const [showAssignStaff, setShowAssignStaff]   = useState<{ allocationId: number; orderId: number } | null>(null)

  // ── active assignments ────────────────────────────────────────────────────
  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ['vehicle-assignments', vehicleId],
    queryFn:  () => ordersApi.getAll({ size: 500 }),
  })
  const { data: usersRes } = useQuery({
    queryKey: ['vehicle-assign-users', { hasAttendanceToday: true }],
    queryFn:  () => staffApi.getUsers({ hasAttendanceToday: true }),
  })
  const allOrders = (ordersRes?.data?.content ?? []) as Order[]
  const allUsers  = (usersRes?.data ?? []) as { id: number; name: string; role: string }[]
  const myAllocations: Array<{ order: Order; allocation: VehicleAllocation }> = []
  allOrders.forEach(o => {
    ;(o.vehicleAllocations ?? []).forEach(va => {
      if (va.vehicleId === vehicleId) myAllocations.push({ order: o, allocation: va })
    })
  })
  const eligibleOrders = allOrders.filter(o =>
    ['PENDING', 'PARTIALLY_ASSIGNED'].includes(o.orderStatus) && o.isActive
  )

  // ── history ───────────────────────────────────────────────────────────────
  const [historySearch,    setHistorySearch]    = useState('')
  const [historyEventType, setHistoryEventType] = useState<HistoryEventType | ''>('')
  const [historyFrom,      setHistoryFrom]      = useState('')
  const [historyTo,        setHistoryTo]        = useState('')
  const [historyPage,      setHistoryPage]      = useState(0)

  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ['vehicle-assignment-history', vehicleId],
    queryFn:  () => ordersApi.getVehicleAllocationHistoryByVehicle(vehicleId),
    enabled:  view === 'history',
  })
  const allEvents = expandToEvents((historyRes?.data ?? []) as VehicleAssignmentHistory[])

  const filteredEvents = allEvents.filter(e => {
    if (historyEventType && e.type !== historyEventType) return false
    if (historySearch) {
      const q = historySearch.toLowerCase()
      if (!e.orderNumber.toLowerCase().includes(q) &&
          !(e.actionByName ?? '').toLowerCase().includes(q)) return false
    }
    if (historyFrom && (e.actionAt ?? '') < historyFrom) return false
    if (historyTo   && (e.actionAt ?? '') > historyTo + 'T23:59:59') return false
    return true
  })

  const historyTotalPages = Math.max(1, Math.ceil(filteredEvents.length / HISTORY_PAGE_SIZE))
  const historyPageEvents = filteredEvents.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE)
  const grouped = groupByDate(historyPageEvents)

  // ── mutations ─────────────────────────────────────────────────────────────
  const unassignVehicle = useMutation({
    mutationFn: ({ orderId, allocationId }: { orderId: number; allocationId: number }) =>
      ordersApi.unassignVehicle(orderId, allocationId),
    onSuccess: () => {
      toast.success('Vehicle unassigned')
      qc.invalidateQueries({ queryKey: ['vehicle-assignments', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle-assignment-history', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle', String(vehicleId)] })
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed to unassign') ?? 'Failed'),
  })
  const unassignStaff = useMutation({
    mutationFn: ({ orderId, staffAllocationId }: { orderId: number; staffAllocationId: number }) =>
      ordersApi.unassignStaff(orderId, staffAllocationId),
    onSuccess: () => {
      toast.success('Staff unassigned')
      qc.invalidateQueries({ queryKey: ['vehicle-assignments', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle-assignment-history', vehicleId] })
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed to unassign staff') ?? 'Failed'),
  })

  if (isLoading && view === 'active') return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      {/* sub-tab toggle */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          <button
            onClick={() => setView('active')}
            className={cn('px-4 py-1.5 transition-colors', view === 'active' ? 'bg-feros-navy text-white' : 'text-gray-500 hover:bg-gray-50')}
          >
            Active
          </button>
          <button
            onClick={() => setView('history')}
            className={cn('px-4 py-1.5 transition-colors flex items-center gap-1.5', view === 'history' ? 'bg-feros-navy text-white' : 'text-gray-500 hover:bg-gray-50')}
          >
            <Clock size={11} /> History
          </button>
        </div>
        {view === 'active' && (
          <Button size="sm" onClick={() => setShowAssignOrder(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
            <Plus size={13} /> Assign to Order
          </Button>
        )}
      </div>

      {/* ── active view ── */}
      {view === 'active' && (
        <>
          {myAllocations.length === 0 ? (
            <div className="py-12 text-center">
              <Truck size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No active order assignments</p>
              <p className="text-xs text-gray-400 mt-1">Assign this vehicle to a pending order to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myAllocations.map(({ order, allocation }) => (
                <div key={allocation.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-feros-navy">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">{order.clientName} · {order.sourceCityName} → {order.destinationCityName}</p>
                      {allocation.allocatedByName && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Assigned by <span className="font-medium text-gray-500">{allocation.allocatedByName}</span>
                          {allocation.createdAt && <span> · {fmtDateTime(allocation.createdAt)}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ALLOC_COLORS[allocation.allocationStatus] ?? 'bg-gray-100 text-gray-600')}>
                        {allocation.allocationStatus}
                      </span>
                      {!['COMPLETED', 'CANCELLED'].includes(allocation.allocationStatus) && (
                        <button
                          onClick={() => unassignVehicle.mutate({ orderId: order.id, allocationId: allocation.id })}
                          disabled={unassignVehicle.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Unassign from order"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div><span className="text-gray-500">Weight: </span><span className="font-medium">{allocation.allocatedWeight} T</span></div>
                      <div><span className="text-gray-500">Load: </span><span className="font-medium">{fmtDate(allocation.expectedLoadDate)}</span></div>
                      <div><span className="text-gray-500">Delivery: </span><span className="font-medium">{fmtDate(allocation.expectedDeliveryDate)}</span></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-gray-500">Staff</p>
                        {!['COMPLETED', 'CANCELLED'].includes(allocation.allocationStatus) && (
                          <button
                            onClick={() => setShowAssignStaff({ allocationId: allocation.id, orderId: order.id })}
                            className="text-xs text-feros-navy hover:text-feros-navy/80 flex items-center gap-0.5"
                          >
                            <Plus size={11} /> Add Staff
                          </button>
                        )}
                      </div>
                      {(allocation.staffAllocations ?? []).length === 0 ? (
                        <p className="text-xs text-amber-600">No staff assigned</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(allocation.staffAllocations ?? []).map((sa: StaffAllocation) => (
                            <div key={sa.id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                              <span className="text-xs font-medium text-blue-800">{sa.userName}</span>
                              <span className="text-xs text-blue-400">{sa.roleName}</span>
                              {!['COMPLETED', 'CANCELLED'].includes(allocation.allocationStatus) && (
                                <button
                                  onClick={() => unassignStaff.mutate({ orderId: order.id, staffAllocationId: sa.id })}
                                  className="text-blue-400 hover:text-red-500 ml-0.5"
                                  title="Remove"
                                >
                                  <X size={11} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── history view ── */}
      {view === 'history' && (
        <div className="space-y-3">
          {/* filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search order, person…"
                value={historySearch}
                onChange={e => { setHistorySearch(e.target.value); setHistoryPage(0) }}
                className="w-full pl-8 pr-3 h-8 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-feros-navy/30"
              />
            </div>
            <select
              value={historyEventType}
              onChange={e => { setHistoryEventType(e.target.value as HistoryEventType | ''); setHistoryPage(0) }}
              className="h-8 text-xs border border-gray-200 rounded-lg px-2 outline-none focus:ring-1 focus:ring-feros-navy/30 bg-white"
            >
              <option value="">All actions</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
            <input
              type="date"
              value={historyFrom}
              onChange={e => { setHistoryFrom(e.target.value); setHistoryPage(0) }}
              className="h-8 text-xs border border-gray-200 rounded-lg px-2 outline-none focus:ring-1 focus:ring-feros-navy/30"
            />
            <input
              type="date"
              value={historyTo}
              onChange={e => { setHistoryTo(e.target.value); setHistoryPage(0) }}
              className="h-8 text-xs border border-gray-200 rounded-lg px-2 outline-none focus:ring-1 focus:ring-feros-navy/30"
            />
            {(historySearch || historyEventType || historyFrom || historyTo) && (
              <button
                onClick={() => { setHistorySearch(''); setHistoryEventType(''); setHistoryFrom(''); setHistoryTo(''); setHistoryPage(0) }}
                className="h-8 px-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X size={12} /> Clear
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</span>
          </div>

          {/* pagination bar */}
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <button
                disabled={historyPage === 0}
                onClick={() => setHistoryPage(p => p - 1)}
                className="h-7 px-2.5 text-xs border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >Prev</button>
              <span className="text-xs text-gray-500">{historyPage + 1} / {historyTotalPages}</span>
              <button
                disabled={historyPage >= historyTotalPages - 1}
                onClick={() => setHistoryPage(p => p + 1)}
                className="h-7 px-2.5 text-xs border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >Next</button>
            </div>
          )}

          {/* timeline */}
          {historyLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading history…</div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center">
              <Clock size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-500">No events yet</p>
              <p className="text-xs text-gray-400 mt-1">Assignment and unassignment actions will appear here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ date, label, items }) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
                  <div className="relative pl-6 space-y-0">
                    {/* vertical line */}
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />
                    {items.map((e, idx) => (
                      <div key={e.id} className={cn('relative flex gap-3 pb-4', idx === items.length - 1 && 'pb-0')}>
                        {/* dot */}
                        <div className={cn('absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white', eventDotColor(e.type))} />
                        {/* content */}
                        <div className="flex-1 bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <EventIcon type={e.type} />
                              <span className="text-xs font-medium text-gray-800">
                                {e.type === 'ASSIGNED' ? 'Vehicle assigned to order' : 'Vehicle unassigned from order'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                              {e.actionAt ? format(parseISO(e.actionAt), 'hh:mm a') : '—'}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="text-xs text-gray-500">Order: <span className="font-medium text-feros-navy">{e.orderNumber}</span></span>
                            {e.actionByName && <span className="text-xs text-gray-400">by <span className="font-medium text-gray-600">{e.actionByName}</span></span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAssignOrder && (
        <AssignToOrderDialog
          vehicleId={vehicleId}
          eligibleOrders={eligibleOrders}
          open={showAssignOrder}
          onClose={() => setShowAssignOrder(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['vehicle-assignments', vehicleId] })
            qc.invalidateQueries({ queryKey: ['vehicle-assignment-history', vehicleId] })
            qc.invalidateQueries({ queryKey: ['vehicle', String(vehicleId)] })
          }}
        />
      )}
      {showAssignStaff && (
        <AssignStaffDialog
          orderId={showAssignStaff.orderId}
          allocationId={showAssignStaff.allocationId}
          users={allUsers}
          open={!!showAssignStaff}
          onClose={() => setShowAssignStaff(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['vehicle-assignments', vehicleId] })
            qc.invalidateQueries({ queryKey: ['vehicle-assignment-history', vehicleId] })
          }}
        />
      )}
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────
export function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate      = useNavigate()
  const qc            = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialTab = (TABS.includes(searchParams.get('tab') as Tab) ? searchParams.get('tab') : 'Basic Info') as Tab
  const [tab, setTab]                 = useState<Tab>(initialTab)
  const [editOpen, setEditOpen]       = useState(false)
  const [addDocOpen, setAddDocOpen]   = useState(false)
  const [docToEdit, setDocToEdit]     = useState<VehicleDocument | null>(null)
  const [docToDelete, setDocToDelete] = useState<VehicleDocument | null>(null)
  const [pendingStatusId, setPendingStatusId]         = useState<number | null>(null)
  const [confirmStatusId, setConfirmStatusId]         = useState<number | null>(null)
  const [confirmStatusName, setConfirmStatusName]     = useState('')
  const isSupervisor = useAuthStore(s => s.role) === 'SUPERVISOR'
  const canManageImages = !isSupervisor
  const [imgIdx, setImgIdx] = useState(0)
  const [imgUploading, setImgUploading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const imgFileRef = useRef<HTMLInputElement>(null)

  const { data: res, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn:  () => vehiclesApi.getById(Number(vehicleId)),
    enabled:  !!vehicleId,
  })
  const { data: statusRes } = useQuery({
    queryKey: ['vehicle-statuses'],
    queryFn:  tenantMastersApi.getVehicleStatuses,
  })
  const { data: docsRes } = useQuery({
    queryKey: ['vehicle-docs', Number(vehicleId)],
    queryFn:  () => vehiclesApi.getDocuments(Number(vehicleId)),
    enabled:  !!vehicleId,
  })
  const { data: imagesRes, refetch: refetchImages } = useQuery({
    queryKey: ['vehicle-images', vehicleId],
    queryFn:  () => vehiclesApi.getImages(Number(vehicleId)),
    enabled:  !!vehicleId,
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => vehiclesApi.deleteDocument(docId),
    onSuccess: () => {
      toast.success('Document deleted')
      qc.invalidateQueries({ queryKey: ['vehicle-docs', vehicleId] })
      setDocToDelete(null)
    },
    onError: () => toast.error('Failed to delete document'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: () => vehiclesApi.toggleActive(Number(vehicleId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Vehicle status updated')
    },
    onError: () => toast.error('Status update failed'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (payload: import('@/api/vehicles').UpdateStatusPayload) =>
      vehiclesApi.updateStatus(Number(vehicleId), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      setPendingStatusId(null)
      setConfirmStatusId(null)
      toast.success('Status updated')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Status update failed')
    },
  })

  const v = res?.data
  const bannerImages = imagesRes?.data ?? []

  useEffect(() => {
    if (bannerImages.length <= 1) return
    const timer = setInterval(() => setImgIdx(i => (i + 1) % bannerImages.length), 4000)
    return () => clearInterval(timer)
  }, [bannerImages.length])

  useEffect(() => {
    if (!lightboxOpen) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false) }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [lightboxOpen])

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading vehicle…</div>
  if (!v) return (
    <div className="p-12 text-center text-gray-400">
      <p>Vehicle not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/vehicles')}>Back to Fleet</Button>
    </div>
  )

  const complianceDocs = docsRes?.data ?? []
  const alertCount = complianceDocs.filter(d => ['expired', 'critical'].includes(expiryLevel(d.expiryDate))).length
  const isHired    = v.ownershipTypeName && !v.ownershipTypeName.toUpperCase().includes('OWN')

  async function handleImageUpload(file: File) {
    setImgUploading(true)
    try {
      const compressed = await compressIfNeeded(file)
      const uploadRes  = await vehiclesApi.uploadImageFile(Number(vehicleId), compressed)
      await vehiclesApi.addImage(Number(vehicleId), uploadRes.data.publicUrl)
      await refetchImages()
      toast.success('Image uploaded')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setImgUploading(false)
    }
  }

  async function handleImageDelete(imageId: number) {
    try {
      await vehiclesApi.deleteImage(imageId)
      setImgIdx(0)
      await refetchImages()
      toast.success('Image removed')
    } catch {
      toast.error('Failed to remove image')
    }
  }

  return (
    <div className="space-y-0">

      {/* ── Banner ── */}
      <div className="bg-gradient-to-br from-feros-navy via-feros-navy to-blue-900 rounded-xl overflow-hidden mb-5">
        <div className="flex">

          {/* ── Left: text ── */}
          <div className="flex-1 min-w-0 px-6 py-6">
            <button
              onClick={() => navigate('/vehicles')}
              className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={15} /> Fleet
            </button>

            <div className="mt-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-white font-mono tracking-wider">{v.registrationNumber}</h1>
                <div className="flex items-center gap-2">
                  {v.isAssigned && (
                    <span className="text-xs text-yellow-300 font-mono">{v.assignedOrderNumber}</span>
                  )}
                  <SearchableSelect
                    value={v.isAssigned ? 'assigned' : String(v.currentStatusId ?? '')}
                    onValueChange={v2 => {
                      const id = Number(v2)
                      if (!id || id === v.currentStatusId) return
                      const selected = statusRes?.data?.find(s => s.id === id)
                      if (selected?.statusType === 'BREAKDOWN') {
                        setPendingStatusId(id)
                      } else {
                        setConfirmStatusId(id)
                        setConfirmStatusName(selected?.name ?? '')
                      }
                    }}
                    disabled={updateStatusMutation.isPending || !!v.isAssigned || !v.isActive}
                    showSearch={false}
                    options={
                      v.isAssigned
                        ? [{ value: 'assigned', label: 'Assigned to Order', color: 'text-blue-400 font-medium' }]
                        : [
                            ...(!v.currentStatusId ? [{ value: '', label: '— Set Status —' }] : []),
                            ...(statusRes?.data ?? [])
                              .filter(s => {
                                const cur = v.currentStatusType
                                if (cur === 'BREAKDOWN') return isSupervisor ? s.statusType === 'BREAKDOWN' : s.statusType === 'BREAKDOWN' || s.statusType === 'IN_REPAIR'
                                if (cur === 'IN_REPAIR')  return isSupervisor ? s.statusType === 'IN_REPAIR' : s.statusType === 'IN_REPAIR' || s.statusType === 'AVAILABLE'
                                if (isSupervisor) return s.statusType === 'BREAKDOWN'
                                return s.statusType !== 'ASSIGNED' && s.statusType !== 'ON_TRIP' && s.statusType !== 'IN_REPAIR'
                              })
                              .map(s => ({
                                value: String(s.id),
                                label: s.name,
                                color: vehicleStatusOptionColor[s.statusType as VehicleStatusType],
                              })),
                          ]
                    }
                    className="h-8 w-44"
                    triggerClassName="h-8 text-xs"
                  />
                  <button
                    onClick={() => toggleActiveMutation.mutate()}
                    disabled={toggleActiveMutation.isPending || (!!v.isActive && !!v.isAssigned)}
                    title={v.isActive && v.isAssigned ? 'Unassign from order before deactivating' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
                      v.isActive && v.isAssigned
                        ? 'bg-green-500/10 border-green-400/20 text-green-400/50 cursor-not-allowed'
                        : v.isActive
                        ? 'bg-green-500/20 border-green-400/40 text-green-300 hover:bg-green-500/30'
                        : 'bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30'
                    )}
                  >
                    <Power size={12} />
                    {v.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
                {v.isIot && (
                  <span className="flex items-center gap-1 text-xs text-cyan-300 bg-cyan-500/20 border border-cyan-400/30 px-2 py-1 rounded-full">
                    <Wifi size={11} />
                    IoT
                  </span>
                )}
                {alertCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-300 bg-red-500/20 border border-red-400/30 px-2 py-1 rounded-full">
                    <AlertTriangle size={11} />
                    {alertCount} compliance alert{alertCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {(v.isAssigned || !v.isActive) && (
                <p className="text-xs text-blue-300/70 mt-1">
                  {v.isAssigned ? 'Unassign from order to change status' : 'Activate vehicle to change status'}
                </p>
              )}
              <p className="text-blue-200 text-sm mt-1.5">
                {[v.brandName, v.vehicleTypeName, v.capacityInTons ? `${v.capacityInTons}T` : null, v.fuelTypeName, v.color]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Type',      value: v.vehicleTypeName ?? '—' },
                { label: 'Capacity',  value: v.capacityInTons ? `${v.capacityInTons} tons` : '—' },
                { label: 'Ownership', value: v.ownershipTypeName ?? '—' },
                { label: 'Odometer',  value: v.currentOdometerReading ? `${v.currentOdometerReading.toLocaleString('en-IN')} km` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/10 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-blue-300">{label}</p>
                  <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: image carousel ── */}
          <div className="w-72 shrink-0 flex flex-col items-center justify-center gap-2 p-5">
            {bannerImages.length > 0 ? (
              <div className="relative w-full">
                <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <img
                    src={bannerImages[imgIdx].imageUrl}
                    alt={`Vehicle ${v.registrationNumber}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setLightboxOpen(true)}
                  />
                  {bannerImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setImgIdx(i => (i - 1 + bannerImages.length) % bannerImages.length)}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setImgIdx(i => (i + 1) % bannerImages.length)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </>
                  )}
                  {canManageImages && (
                    <button
                      onClick={() => handleImageDelete(bannerImages[imgIdx].id)}
                      className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-600/80 text-white rounded-full p-1 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                {bannerImages.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {bannerImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setImgIdx(i)}
                        className={cn('w-1.5 h-1.5 rounded-full transition-colors', i === imgIdx ? 'bg-white' : 'bg-white/30')}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex items-center justify-center opacity-5 pointer-events-none py-6">
                <Truck size={140} />
              </div>
            )}
            {canManageImages && bannerImages.length < 3 && (
              <button
                onClick={() => imgFileRef.current?.click()}
                disabled={imgUploading}
                className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-white transition-colors disabled:opacity-50"
              >
                <Camera size={13} />
                {imgUploading ? 'Uploading…' : bannerImages.length > 0 ? 'Add photo' : 'Upload photo'}
              </button>
            )}
            <input
              ref={imgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                await handleImageUpload(file)
              }}
            />
          </div>

        </div>
      </div>

      {/* ── Image lightbox ── */}
      {lightboxOpen && bannerImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={20} />
          </button>
          {bannerImages.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + bannerImages.length) % bannerImages.length) }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % bannerImages.length) }}
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <img
            src={bannerImages[imgIdx].imageUrl}
            alt={`Vehicle ${v.registrationNumber}`}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {bannerImages.length > 1 && (
            <div className="absolute bottom-6 flex gap-2">
              {bannerImages.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setImgIdx(i) }}
                  className={cn('w-2 h-2 rounded-full transition-colors', i === imgIdx ? 'bg-white' : 'bg-white/30')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t
                  ? 'border-feros-navy text-feros-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
              )}
            >
              {t === 'Basic Info'     && <Truck size={14} />}
              {t === 'Compliance'     && <Shield size={14} />}
              {t === 'Fuel'           && <Fuel size={14} />}
              {t === 'GPS & Notes'    && <MapPin size={14} />}
              {t === 'Documents'      && <FileText size={14} />}
              {t === 'Service'        && <Wrench size={14} />}
              {t === 'Tyres'          && <CircleDot size={14} />}
              {t === 'Meter Readings' && <Gauge size={14} />}
              {t === 'Assignments'    && <Users size={14} />}
              {t === 'Order History'  && <ClipboardList size={14} />}
              {t === 'Trip History'   && <Route size={14} />}
              {t}
              {t === 'Compliance' && alertCount > 0 && (
                <span className="ml-1 text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-semibold">
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">

          {/* ── Basic Info ── */}
          {tab === 'Basic Info' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic Information</p>
                {!isSupervisor && (
                  <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                    <Pencil size={13} /> Edit
                  </Button>
                )}
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle Details</p>
                <InfoRow label="Brand"           value={v.brandName} />
                <InfoRow label="Model"           value={v.model} />
                <InfoRow label="Vehicle Type"    value={v.vehicleTypeName} />
                <InfoRow label="Trip Scope"      value={v.tripScope === 'INTRA_STATE' ? 'Intra-State' : v.tripScope === 'INTER_STATE' ? 'Inter-State' : null} />
                <InfoRow label="Fuel Type"       value={v.fuelTypeName} />
                <InfoRow label="Ownership"       value={v.ownershipTypeName} />
                <InfoRow label="Capacity"        value={v.capacityInTons ? `${v.capacityInTons} tons` : null} />
                <InfoRow label="GVW"             value={v.grossVehicleWeight ? `${v.grossVehicleWeight} tons` : null} />
                <InfoRow label="Mfg. Year"       value={v.manufactureYear} />
                <InfoRow label="Color"           value={v.color} />
                <InfoRow label="Odometer"        value={v.currentOdometerReading ? `${Number(v.currentOdometerReading).toLocaleString('en-IN')} km` : null} />
                <InfoRow label="Tank Capacity"   value={v.fuelTankCapacity ? `${v.fuelTankCapacity} L` : null} />
                <InfoRow label="Current Fuel"    value={v.currentFuelLevel != null && v.fuelTankCapacity
                  ? `${v.currentFuelLevel} L (${Math.round((Number(v.currentFuelLevel) / Number(v.fuelTankCapacity)) * 100)}%)`
                  : v.currentFuelLevel ? `${v.currentFuelLevel} L` : null} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identification</p>
                <InfoRow label="Chassis No." value={v.chassisNumber} />
                <InfoRow label="Engine No."  value={v.engineNumber} />
              </div>
              {isHired && (
                <div className="sm:col-span-2 border-t pt-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Owner / Hired Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    <InfoRow label="Owner Name"       value={v.ownerName} />
                    <InfoRow label="Phone"            value={v.ownerPhone} />
                    <InfoRow label="PAN Number"       value={v.ownerPan} />
                    <InfoRow label="Address"          value={v.ownerAddress} />
                    <InfoRow label="Agreement Start"  value={fmtDate(v.agreementStartDate)} />
                    <InfoRow label="Agreement End"    value={fmtDate(v.agreementEndDate)} />
                    <InfoRow label="Agreement Amount" value={v.agreementAmount ? `₹${v.agreementAmount.toLocaleString('en-IN')}` : null} />
                  </div>
                </div>
              )}
            </div>
            {v.extraPayEnabled && (
              <div className="border-t pt-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Driver Extra Pay</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow label="Extra Pay / Day" value={v.extraPayPerDay != null ? `₹${v.extraPayPerDay.toLocaleString('en-IN')}` : '—'} />
                </div>
              </div>
            )}
            {v.isFinanced && (
              <div className="border-t pt-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Finance Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow label="Financer"       value={v.financerName} />
                  <InfoRow label="Finance From"   value={fmtDate(v.financeStartDate)} />
                  <InfoRow label="Finance To"     value={fmtDate(v.financeEndDate)} />
                  <InfoRow
                    label="Months Remaining"
                    value={
                      v.financeMonthsRemaining != null
                        ? v.financeMonthsRemaining === 0
                          ? 'Loan closed / overdue'
                          : `${v.financeMonthsRemaining} month${v.financeMonthsRemaining === 1 ? '' : 's'}`
                        : null
                    }
                  />
                </div>
              </div>
            )}
            <div className="border-t pt-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Assigned Staff</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div className="flex justify-between py-2.5 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Driver</span>
                  {v.currentDriverName
                    ? <span className="text-sm font-semibold text-blue-700">{v.currentDriverName}</span>
                    : <span className="text-sm text-gray-400">Not assigned</span>
                  }
                </div>
                <div className="flex justify-between py-2.5 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Cleaner</span>
                  {v.currentCleanerName
                    ? <span className="text-sm font-semibold text-purple-700">{v.currentCleanerName}</span>
                    : <span className="text-sm text-gray-400">Not assigned</span>
                  }
                </div>
              </div>
            </div>
            </div>
          )}

          {/* ── Compliance ── */}
          {tab === 'Compliance' && (() => {
            const COMPLIANCE_TYPES = [
              { label: 'Registration Certificate (RC)', key: 'registration' },
              { label: 'Insurance',                     key: 'insurance'    },
              { label: 'Permit',                        key: 'permit'       },
              { label: 'Fitness Certificate',           key: 'fitness'      },
              { label: 'PUC',                           key: 'puc'          },
              { label: 'Road Tax',                      key: 'road'         },
            ]
            const chipCls: Record<ExpiryLevel, string> = {
              expired:  'bg-red-50 text-red-600 border-red-200',
              critical: 'bg-orange-50 text-orange-600 border-orange-200',
              warning:  'bg-yellow-50 text-yellow-700 border-yellow-200',
              ok:       'bg-green-50 text-green-700 border-green-200',
              none:     'bg-gray-50 text-gray-400 border-gray-200',
            }
            return (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Document Status</p>
                <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                  {COMPLIANCE_TYPES.map(({ label, key }) => {
                    const doc = complianceDocs.find((d: VehicleDocument) =>
                      (d.documentTypeName ?? '').toLowerCase().includes(key)
                    )
                    const level = expiryLevel(doc?.expiryDate)
                    const days  = doc?.expiryDate && isValid(parseISO(doc.expiryDate))
                      ? differenceInDays(parseISO(doc.expiryDate), new Date()) : null
                    const chipText =
                      level === 'none'    ? 'Not recorded' :
                      level === 'expired' ? `Expired ${Math.abs(days!)}d ago` :
                      level === 'ok'      ? `Valid · ${days}d left` : `${days}d left`
                    return (
                      <div key={key} className="flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{label}</p>
                          {doc?.documentNumber && <p className="text-xs text-gray-400 mt-0.5">{doc.documentNumber}</p>}
                          {doc?.expiryDate && <p className="text-xs text-gray-400">Expires: {fmtDate(doc.expiryDate)}</p>}
                        </div>
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', chipCls[level])}>
                          {chipText}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── Documents ── */}
          {tab === 'Documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Uploaded Documents</p>
                {!isSupervisor && (
                  <Button size="sm" onClick={() => setAddDocOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                    <Plus size={13} /> Add Document
                  </Button>
                )}
              </div>
              {complianceDocs.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <FileText size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {complianceDocs.map((doc: VehicleDocument) => {
                    const level = expiryLevel(doc.expiryDate)
                    return (
                      <div key={doc.id} className="p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                              <FileText size={15} className="text-feros-navy" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{doc.documentTypeName ?? `Document #${doc.id}`}</p>
                              {doc.documentNumber && <p className="text-xs text-gray-500 mt-0.5">No: {doc.documentNumber}</p>}
                              {doc.issuerName     && <p className="text-xs text-gray-500">Issuer: {doc.issuerName}</p>}
                              {doc.permitType     && <p className="text-xs text-gray-500">Type: {doc.permitType}</p>}
                              <p className="text-xs text-gray-400 mt-1">
                                {doc.issueDate  && `Issued: ${fmtDate(doc.issueDate)}`}
                                {doc.issueDate && doc.expiryDate && ' · '}
                                {doc.expiryDate && `Expires: ${fmtDate(doc.expiryDate)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {level !== 'none' && (
                              <span className={cn('text-xs px-2 py-1 rounded-full font-medium', {
                                'bg-red-50 text-red-600 border border-red-200':          level === 'expired',
                                'bg-orange-50 text-orange-600 border border-orange-200': level === 'critical',
                                'bg-yellow-50 text-yellow-700 border border-yellow-200': level === 'warning',
                                'bg-green-50 text-green-700 border border-green-200':    level === 'ok',
                              })}>
                                {level === 'expired' ? 'Expired' : level === 'ok' ? 'Valid' : `${differenceInDays(parseISO(doc.expiryDate!), new Date())}d left`}
                              </span>
                            )}
                            {doc.fileUrl && (
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-gradient-to-r from-green-100 to-white border border-green-200 text-green-700 hover:from-green-200 transition-colors"
                                title="View document"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                            {!isSupervisor && (
                              <button
                                onClick={() => setDocToEdit(doc)}
                                className="p-1.5 rounded-lg bg-gradient-to-r from-amber-100 to-white border border-amber-200 text-amber-700 hover:from-amber-200 transition-colors"
                                title="Edit document"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => setDocToDelete(doc)}
                              className="p-1.5 rounded-lg bg-gradient-to-r from-red-100 to-white border border-red-200 text-red-600 hover:from-red-200 transition-colors"
                              title="Delete document"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Service ── */}
          {tab === 'Service' && v && (
            <ServiceTabContent vehicleId={v.id} vehicleReg={v.registrationNumber} currentOdometer={v.currentOdometerReading ? Number(v.currentOdometerReading) : undefined} />
          )}

          {/* ── Fuel ── */}
          {tab === 'Fuel' && v && (
            <FuelTabContent vehicle={v} />
          )}

          {/* ── Tyres ── */}
          {tab === 'Tyres' && v && (
            <TyresTabContent vehicle={v} />
          )}

          {/* ── Meter Readings ── */}
          {tab === 'Meter Readings' && v && (
            <MeterReadingsTabContent vehicleId={v.id} latestOdometer={v.currentOdometerReading ? Number(v.currentOdometerReading) : undefined} />
          )}

          {/* ── GPS & Notes ── */}
          {tab === 'GPS & Notes' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GPS & Notes</p>
                {!isSupervisor && (
                  <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                    <Pencil size={13} /> Edit
                  </Button>
                )}
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">GPS Tracking</p>
                <InfoRow label="Device No."   value={v.gpsDeviceNumber} />
                <InfoRow label="IMEI"         value={v.gpsDeviceImei} />
                <InfoRow label="Provider"     value={v.gpsProvider} />
                <InfoRow label="Odometer"     value={v.currentOdometerReading ? `${v.currentOdometerReading.toLocaleString('en-IN')} km` : null} />
              </div>
              {v.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">{v.notes}</p>
                </div>
              )}
            </div>
            </div>
          )}

          {/* ── Assignments ── */}
          {tab === 'Assignments' && <VehicleAssignmentsTab vehicleId={v.id} />}

          {/* ── Order History ── */}
          {tab === 'Order History' && (
            <div className="py-10 text-center text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Order History</p>
              <p className="text-xs mt-1">Orders assigned to this vehicle will appear here.</p>
            </div>
          )}

          {/* ── Trip History ── */}
          {tab === 'Trip History' && (
            <div className="py-10 text-center text-gray-400">
              <Route size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Trip History</p>
              <p className="text-xs mt-1">Completed trips and LRs for this vehicle will appear here.</p>
            </div>
          )}

        </div>
      </div>

      <VehicleForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        vehicle={v}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })}
      />

      {/* Breakdown form dialog — triggered when BREAKDOWN selected in dropdown */}
      <BreakdownFormDialog
        vehicleReg={v.registrationNumber}
        open={!!pendingStatusId}
        onClose={() => setPendingStatusId(null)}
        onSubmit={formData => updateStatusMutation.mutate({
          currentStatusId: pendingStatusId!,
          ...formData,
        })}
        isPending={updateStatusMutation.isPending}
      />

      {/* Confirm status change dialog */}
      <Dialog open={!!confirmStatusId} onOpenChange={val => !val && setConfirmStatusId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Vehicle Status</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Change status of <span className="font-semibold font-mono">{v.registrationNumber}</span> to{' '}
            <span className="font-semibold text-gray-800">{confirmStatusName}</span>?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmStatusId(null)}>Cancel</Button>
            <Button
              disabled={updateStatusMutation.isPending}
              onClick={() => {
                updateStatusMutation.mutate({ currentStatusId: confirmStatusId! })
                setConfirmStatusId(null)
              }}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white"
            >
              {updateStatusMutation.isPending ? 'Updating…' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddDocumentDialog vehicleId={v.id} open={addDocOpen} onClose={() => setAddDocOpen(false)} existingDocs={docsRes?.data ?? []} />
      {docToEdit && <EditDocumentDialog vehicleId={v.id} doc={docToEdit} open={!!docToEdit} onClose={() => setDocToEdit(null)} />}

      {/* Delete document confirm */}
      <Dialog open={!!docToDelete} onOpenChange={val => !val && setDocToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Document</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <strong>{docToDelete?.documentTypeName}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDocToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteDocMutation.isPending}
              onClick={() => docToDelete && deleteDocMutation.mutate(docToDelete.id)}
            >
              {deleteDocMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── breakdown form dialog ─────────────────────────────────────────────────────
const bdSchema = z.object({
  breakdownType:     z.enum(['MECHANICAL','TYRE','ENGINE','ELECTRICAL','ACCIDENT','OTHER'], { error: 'Breakdown type is required' }),
  breakdownDuration: z.enum(['SHORT','LONG'], { error: 'Select SHORT or LONG' }),
  breakdownDate:     z.string().min(1, 'Date/time is required'),
  location:          z.string().optional(),
  reason:            z.string().min(1, 'Reason is required'),
  notes:             z.string().optional(),
})
type BdForm = z.infer<typeof bdSchema>

const BD_TYPES: { value: BreakdownType; label: string }[] = [
  { value: 'MECHANICAL', label: 'Mechanical' },
  { value: 'TYRE',       label: 'Tyre'       },
  { value: 'ENGINE',     label: 'Engine'     },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'ACCIDENT',   label: 'Accident'   },
  { value: 'OTHER',      label: 'Other'      },
]

const BD_DURATIONS: { value: BreakdownDuration; label: string; sub: string }[] = [
  { value: 'SHORT', label: 'Short', sub: 'Minor — back within 1-2 days' },
  { value: 'LONG',  label: 'Long',  sub: 'Major — extended downtime'    },
]

function BreakdownFormDialog({ vehicleReg, open, onClose, onSubmit, isPending }: {
  vehicleReg: string
  open: boolean
  onClose: () => void
  onSubmit: (data: Omit<BdForm, 'breakdownDate'> & { breakdownDate: string }) => void
  isPending: boolean
}) {
  const { register, handleSubmit, watch, setValue, control, formState: { errors }, reset } = useForm<BdForm>({
    resolver: zodResolver(bdSchema) as Resolver<BdForm>,
    defaultValues: { breakdownDate: new Date().toISOString().slice(0, 16) },
  })
  const selectedDuration = watch('breakdownDuration')

  function handleClose() { reset(); onClose() }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={18} /> Breakdown Details
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Vehicle: <span className="font-semibold font-mono text-gray-800">{vehicleReg}</span>
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => {
          onSubmit({ ...d, breakdownDate: new Date(d.breakdownDate).toISOString() })
          reset()
        })} className="space-y-4 pt-2">
          {/* Duration */}
          <div className="space-y-1.5">
            <Label>Duration *</Label>
            <div className="grid grid-cols-2 gap-2">
              {BD_DURATIONS.map(d => (
                <button key={d.value} type="button"
                  onClick={() => setValue('breakdownDuration', d.value, { shouldValidate: true })}
                  className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-colors ${
                    selectedDuration === d.value
                      ? d.value === 'SHORT' ? 'border-amber-500 bg-amber-50' : 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`text-sm font-semibold ${selectedDuration === d.value ? (d.value === 'SHORT' ? 'text-amber-700' : 'text-red-700') : 'text-gray-700'}`}>{d.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{d.sub}</span>
                </button>
              ))}
            </div>
            {errors.breakdownDuration && <p className="text-red-500 text-xs">{errors.breakdownDuration.message}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Controller
              name="breakdownType"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? ''}
                  onValueChange={v => field.onChange(v)}
                  options={BD_TYPES.map(t => ({ value: t.value, label: t.label }))}
                  placeholder="Select type"
                  className="mt-1"
                />
              )}
            />
            {errors.breakdownType && <p className="text-red-500 text-xs">{errors.breakdownType.message}</p>}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label>Reason *</Label>
            <Input placeholder="What happened?" {...register('reason')} />
            {errors.reason && <p className="text-red-500 text-xs">{errors.reason.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Date & Time *</Label>
            <Input type="datetime-local" {...register('breakdownDate')} />
            {errors.breakdownDate && <p className="text-red-500 text-xs">{errors.breakdownDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input placeholder="e.g. Depot yard, Mumbai" {...register('location')} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Additional notes…" {...register('notes')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {isPending ? 'Saving…' : 'Confirm Breakdown'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
