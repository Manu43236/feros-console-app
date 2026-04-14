import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehiclesApi, vehicleServicesApi } from '@/api/vehicles'
import { servicePartsApi, sparePartsApi } from '@/api/inventory'
import { tenantMastersApi, globalMastersApi } from '@/api/masters'
import { breakdownsApi } from '@/api/breakdowns'
import { fuelLogsApi } from '@/api/fuelLogs'
import { tiresApi } from '@/api/tires'
import { compressIfNeeded } from '@/lib/imageCompressor'
import type { FuelLog, FuelPaymentMode, Tire, TirePosition, TireFitting, TireRotationLog, TireRemovalReason, TirePositionType } from '@/types'
import { toast } from 'sonner'
import { format, parseISO, differenceInDays, isValid } from 'date-fns'
import {
  ArrowLeft, Truck, Shield, MapPin, Fuel,
  AlertTriangle, CheckCircle, Clock, Pencil, Power,
  ClipboardList, Route, FileText, Plus, BadgeCheck, Wrench, Droplets, ChevronDown, ChevronUp, ExternalLink, Paperclip, Trash2,
  Calendar, IndianRupee, RotateCcw, Check, Search, X, Package, Info, CircleDot,
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

// ── compliance row ────────────────────────────────────────────────────────────
function ComplianceRow({ label, docNumber, expiryDate }: { label: string; docNumber?: string; expiryDate?: string }) {
  const level = expiryLevel(expiryDate)
  const days  = expiryDate && isValid(parseISO(expiryDate))
    ? differenceInDays(parseISO(expiryDate), new Date()) : null

  const chip: Record<ExpiryLevel, string> = {
    expired:  'text-red-600 bg-red-50 border-red-200',
    critical: 'text-orange-600 bg-orange-50 border-orange-200',
    warning:  'text-yellow-700 bg-yellow-50 border-yellow-200',
    ok:       'text-green-700 bg-green-50 border-green-200',
    none:     'text-gray-400 bg-gray-50 border-gray-200',
  }

  const icon = level === 'expired' || level === 'critical'
    ? <AlertTriangle size={13} />
    : level === 'ok' ? <CheckCircle size={13} />
    : level === 'warning' ? <Clock size={13} />
    : null

  const text =
    level === 'none'    ? 'Not recorded' :
    level === 'expired' ? `Expired ${Math.abs(days!)}d ago` :
    level === 'ok'      ? `Valid · ${days}d left` : `${days}d left`

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {docNumber && <p className="text-xs text-gray-400 mt-0.5">{docNumber}</p>}
        <p className="text-xs text-gray-400 mt-0.5">Expiry: {fmtDate(expiryDate)}</p>
      </div>
      <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border', chip[level])}>
        {icon}{text}
      </span>
    </div>
  )
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
const TABS = ['Basic Info', 'Compliance', 'Documents', 'Service', 'Fuel', 'Tires', 'GPS & Notes', 'Order History', 'Trip History'] as const
type Tab = typeof TABS[number]

// ── add document form ─────────────────────────────────────────────────────────
const docSchema = z.object({
  documentTypeId: z.coerce.number().min(1, 'Select document type'),
  documentNumber: z.string().optional(),
  issueDate:      z.string().optional(),
  expiryDate:     z.string().optional(),
  remarks:        z.string().optional(),
})
type DocForm = z.infer<typeof docSchema>

function AddDocumentDialog({ vehicleId, open, onClose }: { vehicleId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: docTypesRes } = useQuery({ queryKey: ['document-types'], queryFn: globalMastersApi.getDocumentTypes })

  const vehicleDocTypes = (docTypesRes?.data ?? []).filter(d =>
    d.applicableFor === 'VEHICLE' || d.applicableFor === 'BOTH'
  )

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<DocForm>({
    resolver: zodResolver(docSchema) as Resolver<DocForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: DocForm & { fileUrl?: string }) => vehiclesApi.addDocument(vehicleId, data),
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
    mutation.mutate({ ...data, fileUrl })
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
                  options={vehicleDocTypes.map(t => ({ value: String(t.id), label: t.name }))}
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

// ── task row inside create dialog ─────────────────────────────────────────────
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
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create service'
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
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'
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
  const openBreakdowns = allBreakdowns.filter(b => b.status !== 'RESOLVED' && b.status !== 'VEHICLE_REPLACED')

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
            <Button size="sm" onClick={() => { setCreateBreakdownId(undefined); setCreateOpen(true) }}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-9 text-xs">
              <Plus size={13} /> New Service
            </Button>
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
                        {s.status === 'OPEN' && (
                          <Button size="sm" onClick={() => startMutation.mutate(s.id)}
                            disabled={startMutation.isPending}
                            className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1">
                            <Wrench size={12} /> Start
                          </Button>
                        )}
                        {s.status === 'IN_PROGRESS' && (
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
                        <button onClick={() => setDeleteId(s.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
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
              const isOpen = b.status !== 'RESOLVED' && b.status !== 'VEHICLE_REPLACED'
              const isInRepair = b.status === 'IN_REPAIR'
              return (
                <div key={b.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border',
                          isInRepair ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          isOpen ? 'bg-red-50 text-red-600 border-red-200' :
                          'bg-green-50 text-green-700 border-green-200'
                        )}>
                          {isInRepair ? '🔧 In Repair' : isOpen ? '⚠ Open' : '✓ Resolved'}
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
                    {isOpen && !isInRepair && (
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

// ── Tire tab ──────────────────────────────────────────────────────────────────
const POSITION_TYPE_ORDER: TirePositionType[] = ['STEER', 'DRIVE', 'TRAILER', 'SPARE']
const REMOVAL_REASONS: TireRemovalReason[] = ['ROTATION', 'WORN', 'PUNCTURE', 'DAMAGE', 'RETREAD', 'SCRAP', 'OTHER']

function FitTireDialog({ open, onClose, vehicleId, positionId, availableTires, currentKm }: {
  open: boolean; onClose: () => void; vehicleId: number; positionId: number; availableTires: Tire[]; currentKm?: number
}) {
  const qc = useQueryClient()
  const [tireId, setTireId] = useState('')
  const [km, setKm] = useState(currentKm?.toString() ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const mutation = useMutation({
    mutationFn: () => tiresApi.fitTire({ vehicleId, tireId: Number(tireId), positionId, fittedAtKm: Number(km), fittedDate: date }),
    onSuccess: () => {
      toast.success('Tire fitted')
      qc.invalidateQueries({ queryKey: ['tire-positions-current', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tire-fittings', vehicleId] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Fit Tire</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Select Tire *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={tireId} onChange={e => setTireId(e.target.value)}>
              <option value="">-- Choose available tire --</option>
              {availableTires.map(t => (
                <option key={t.id} value={t.id}>{t.serialNumber} — {t.brand} {t.size}</option>
              ))}
            </select>
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
            <Button disabled={!tireId || !km || mutation.isPending} onClick={() => mutation.mutate()} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Fitting…' : 'Fit Tire'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RemoveTireDialog({ open, onClose, fitting, currentKm }: {
  open: boolean; onClose: () => void; fitting: TireFitting; currentKm?: number
}) {
  const qc = useQueryClient()
  const [km, setKm] = useState(currentKm?.toString() ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState<TireRemovalReason>('WORN')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => tiresApi.removeTire(fitting.id, { removedAtKm: Number(km), removedDate: date, removalReason: reason, notes }),
    onSuccess: () => {
      toast.success('Tire removed')
      qc.invalidateQueries({ queryKey: ['tire-positions-current', fitting.vehicleId] })
      qc.invalidateQueries({ queryKey: ['tire-fittings', fitting.vehicleId] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Remove Tire</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium">{fitting.tireSerialNumber}</p>
            <p className="text-gray-500">{fitting.tireBrand} · {fitting.tireSize}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Odometer at Removal (km) *</Label>
            <Input type="number" value={km} onChange={e => setKm(e.target.value)} placeholder="e.g. 87000" />
          </div>
          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Removal Reason *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm" value={reason} onChange={e => setReason(e.target.value as TireRemovalReason)}>
              {REMOVAL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!km || mutation.isPending} onClick={() => mutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
              {mutation.isPending ? 'Removing…' : 'Remove Tire'}
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
  const [newType, setNewType] = useState<TirePositionType>('DRIVE')
  const [newOrder, setNewOrder] = useState('')

  const { data } = useQuery({
    queryKey: ['tire-positions', vehicleId],
    queryFn: () => tiresApi.getPositions(vehicleId),
    enabled: open,
  })
  const positions: TirePosition[] = data?.data ?? []

  const addMutation = useMutation({
    mutationFn: () => tiresApi.addPosition({ vehicleId, positionCode: newCode, positionType: newType, displayOrder: newOrder ? Number(newOrder) : 0 }),
    onSuccess: () => {
      toast.success('Position added')
      qc.invalidateQueries({ queryKey: ['tire-positions', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tire-positions-current', vehicleId] })
      setNewCode(''); setNewOrder('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const delMutation = useMutation({
    mutationFn: (id: number) => tiresApi.deletePosition(id),
    onSuccess: () => {
      toast.success('Position removed')
      qc.invalidateQueries({ queryKey: ['tire-positions', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tire-positions-current', vehicleId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manage Tire Positions</DialogTitle></DialogHeader>
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
                <select className="w-full border rounded-md px-2 py-1.5 text-xs h-8" value={newType} onChange={e => setNewType(e.target.value as TirePositionType)}>
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
  open: boolean; onClose: () => void; vehicleId: number; positions: TirePosition[]; currentKm?: number
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
          tireId: p.currentFitting!.tireId,
          fromPositionId: p.id,
          toPositionId: Number(moves[p.id]),
        }))
      return tiresApi.performRotation({ vehicleId, rotationDate: date, odometerKm: Number(km), notes, moves: moveList })
    },
    onSuccess: () => {
      toast.success('Rotation performed')
      qc.invalidateQueries({ queryKey: ['tire-positions-current', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tire-fittings', vehicleId] })
      qc.invalidateQueries({ queryKey: ['tire-rotations', vehicleId] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Perform Tire Rotation</DialogTitle></DialogHeader>
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
              Conflict: two tires are targeting the same destination position
            </div>
          )}

          {fittedPositions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tires currently fitted</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Move each tire to a new position</p>
              {fittedPositions.map(p => {
                const f = p.currentFitting!
                const target = moves[p.id]
                const isConflicted = !!target && selectedTargets.filter(t => t === target).length > 1
                return (
                  <div key={p.id} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2', isConflicted && 'border-red-300 bg-red-50')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.positionCode}</p>
                      <p className="text-xs text-gray-500 truncate">{f.tireSerialNumber} — {f.tireBrand}</p>
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

type TiresSubTab = 'Current' | 'Rotation History' | 'Fitting History'

function TiresTabContent({ vehicle }: { vehicle: { id: number; currentOdometerReading?: number } }) {
  const [subTab, setSubTab] = useState<TiresSubTab>('Current')
  const [fitDialog, setFitDialog] = useState<{ positionId: number } | null>(null)
  const [removeDialog, setRemoveDialog] = useState<TireFitting | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)

  const { data: posRes } = useQuery({
    queryKey: ['tire-positions-current', vehicle.id],
    queryFn: () => tiresApi.getCurrentPositions(vehicle.id),
  })
  const { data: availRes } = useQuery({ queryKey: ['tires-available'], queryFn: tiresApi.getAvailable })
  const { data: fittingRes } = useQuery({
    queryKey: ['tire-fittings', vehicle.id],
    queryFn: () => tiresApi.getFittingHistory(vehicle.id),
    enabled: subTab === 'Fitting History',
  })
  const { data: rotRes } = useQuery({
    queryKey: ['tire-rotations', vehicle.id],
    queryFn: () => tiresApi.getRotationHistory(vehicle.id),
    enabled: subTab === 'Rotation History',
  })

  const positions: TirePosition[] = posRes?.data ?? []
  const availableTires: Tire[] = availRes?.data ?? []
  const fittingHistory: TireFitting[] = fittingRes?.data ?? []
  const rotationHistory: TireRotationLog[] = rotRes?.data ?? []
  const currentKm = vehicle.currentOdometerReading ? Number(vehicle.currentOdometerReading) : undefined

  const grouped = POSITION_TYPE_ORDER.reduce((acc, type) => {
    acc[type] = positions.filter(p => p.positionType === type)
    return acc
  }, {} as Record<TirePositionType, TirePosition[]>)

  const fmtD = (d?: string) => { if (!d) return '—'; try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d } }

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 border-b border-gray-100">
        {(['Current', 'Rotation History', 'Fitting History'] as TiresSubTab[]).map(t => (
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
            <div className="text-center py-8 text-gray-400 text-sm">
              No positions configured.
              <button className="ml-1 text-feros-navy underline" onClick={() => setManageOpen(true)}>Add positions</button>
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
                      return (
                        <div key={pos.id} className={cn('border rounded-xl p-3 text-sm', f ? 'bg-white border-gray-200' : 'border-dashed border-gray-200 bg-gray-50')}>
                          <p className="font-mono font-semibold text-xs text-gray-500 mb-1">{pos.positionCode}</p>
                          {f ? (
                            <>
                              <p className="font-medium text-gray-800 truncate">{f.tireSerialNumber}</p>
                              <p className="text-xs text-gray-400 truncate">{f.tireBrand} · {f.tireSize}</p>
                              {currentKm != null && (
                                <p className="text-xs text-blue-600 mt-1">{(currentKm - f.fittedAtKm).toLocaleString('en-IN')} km since fitted</p>
                              )}
                              <Button size="sm" variant="ghost" className="mt-2 h-6 text-xs text-red-500 hover:text-red-600 px-2 w-full" onClick={() => setRemoveDialog(f)}>
                                Remove
                              </Button>
                            </>
                          ) : (
                            <div className="text-center py-1">
                              <p className="text-xs text-gray-400 mb-1.5">Empty</p>
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2 w-full" onClick={() => setFitDialog({ positionId: pos.id })}>
                                Fit Tire
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
                <span className="text-xs text-gray-400">{log.items.length} tires moved</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {log.items.map(item => (
                  <div key={item.id} className="flex items-center gap-1 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                    <span className="font-mono font-medium">{item.fromPositionCode}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-mono font-medium">{item.toPositionCode}</span>
                    <span className="text-gray-400 truncate ml-1">{item.tireSerialNumber}</span>
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
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Tire</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Position</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Fitted</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Removed</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">km driven</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fittingHistory.map(f => (
                  <tr key={f.id}>
                    <td className="px-3 py-2"><p className="font-medium">{f.tireSerialNumber}</p><p className="text-xs text-gray-400">{f.tireBrand} {f.tireSize}</p></td>
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
        <FitTireDialog open={!!fitDialog} onClose={() => setFitDialog(null)} vehicleId={vehicle.id} positionId={fitDialog.positionId} availableTires={availableTires} currentKm={currentKm} />
      )}
      {removeDialog && (
        <RemoveTireDialog open={!!removeDialog} onClose={() => setRemoveDialog(null)} fitting={removeDialog} currentKm={currentKm} />
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
    queryFn:  () => fuelLogsApi.getAll(vehicle.id).then(r => r.data),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FuelLogForm>({
    resolver: zodResolver(fuelLogSchema) as Resolver<FuelLogForm>,
    defaultValues: { isFullTank: false, paymentMode: 'CASH' },
  })

  const litres      = watch('litresFilled')
  const costPerL    = watch('costPerLitre')

  // Auto-calculate total cost
  const autoTotal = litres && costPerL ? (Number(litres) * Number(costPerL)).toFixed(2) : ''

  function openAdd() {
    reset({
      isFullTank: false,
      paymentMode: 'CASH',
      fillDate: new Date().toISOString().split('T')[0],
      odometerReading: vehicle.currentOdometerReading ?? undefined,
    })
    setEditLog(null)
    setDialogOpen(true)
  }

  function openEdit(log: FuelLog) {
    reset({
      fillDate:        log.fillDate,
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

  const saveMutation = useMutation({
    mutationFn: (data: FuelLogForm) => {
      const payload = { ...data, vehicleId: vehicle.id, totalCost: (data.totalCost ?? Number(autoTotal)) || undefined }
      return editLog
        ? fuelLogsApi.update(editLog.id, payload)
        : fuelLogsApi.create(payload)
    },
    onSuccess: () => {
      toast.success(editLog ? 'Fuel log updated' : 'Fuel log added')
      qc.invalidateQueries({ queryKey: ['fuel-logs', vehicle.id] })
      setDialogOpen(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fuelLogsApi.delete(id),
    onSuccess: () => {
      toast.success('Fuel log deleted')
      qc.invalidateQueries({ queryKey: ['fuel-logs', vehicle.id] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
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
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4 pt-1">

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" {...register('fillDate')} />
                {errors.fillDate && <p className="text-xs text-red-500">{errors.fillDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Odometer (km) *</Label>
                <Input type="number" placeholder="48200" {...register('odometerReading')} />
                {errors.odometerReading && <p className="text-xs text-red-500">{errors.odometerReading.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Litres Filled *</Label>
                <Input type="number" step="0.01" placeholder="150" {...register('litresFilled')} />
                {errors.litresFilled && <p className="text-xs text-red-500">{errors.litresFilled.message}</p>}
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

// ── page ─────────────────────────────────────────────────────────────────────
export function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate      = useNavigate()
  const qc            = useQueryClient()
  const [tab, setTab]                 = useState<Tab>('Basic Info')
  const [editOpen, setEditOpen]       = useState(false)
  const [addDocOpen, setAddDocOpen]   = useState(false)
  const [docToDelete, setDocToDelete] = useState<VehicleDocument | null>(null)
  const [pendingStatusId, setPendingStatusId]         = useState<number | null>(null)
  const [confirmStatusId, setConfirmStatusId]         = useState<number | null>(null)
  const [confirmStatusName, setConfirmStatusName]     = useState('')

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

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading vehicle…</div>
  if (!v) return (
    <div className="p-12 text-center text-gray-400">
      <p>Vehicle not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/vehicles')}>Back to Fleet</Button>
    </div>
  )

  const complianceItems = [
    { label: 'Registration Certificate (RC)', docNumber: v.rcNumber,                                                  expiryDate: v.rcExpiryDate },
    { label: 'Insurance',                     docNumber: v.insurancePolicyNumber,                                     expiryDate: v.insuranceExpiryDate },
    { label: 'Permit',                        docNumber: v.permitNumber ? `${v.permitNumber} · ${v.permitType ?? ''}` : undefined, expiryDate: v.permitExpiryDate },
    { label: 'Fitness Certificate',           docNumber: v.fitnessCertificateNumber,                                  expiryDate: v.fitnessExpiryDate },
    { label: 'Pollution (PUC)',               docNumber: v.pucNumber,                                                 expiryDate: v.pollutionExpiryDate },
    { label: 'Road Tax',                      docNumber: v.roadTaxPaidDate ? `Paid: ${fmtDate(v.roadTaxPaidDate)}` : undefined, expiryDate: v.roadTaxExpiryDate },
  ]

  const alertCount = complianceItems.filter(c => ['expired', 'critical'].includes(expiryLevel(c.expiryDate))).length
  const isHired    = v.ownershipTypeName && !v.ownershipTypeName.toUpperCase().includes('OWN')

  return (
    <div className="space-y-0">

      {/* ── Banner ── */}
      <div className="bg-gradient-to-br from-feros-navy via-feros-navy to-blue-900 rounded-xl overflow-hidden mb-5">

        <div className="relative">
          {/* decorative truck silhouette */}
          <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
            <Truck size={180} />
          </div>

          <div className="relative px-6 py-6">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4">
            <button
              onClick={() => navigate('/vehicles')}
              className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mt-0.5"
            >
              <ArrowLeft size={15} /> Fleet
            </button>

            <div className="flex items-start gap-2">
              {/* Status select */}
              <div className="flex flex-col items-end gap-1">
                {v.isAssigned && (
                  <span className="text-xs text-yellow-300 font-mono">{v.assignedOrderNumber}</span>
                )}
                <div className="relative flex items-center">
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
                                if (cur === 'BREAKDOWN') return s.statusType === 'BREAKDOWN' || s.statusType === 'IN_REPAIR'
                                if (cur === 'IN_REPAIR')  return s.statusType === 'IN_REPAIR'  || s.statusType === 'AVAILABLE'
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
                </div>
                <span className={cn(
                  'text-xs',
                  v.isAssigned ? 'text-blue-300/70 visible' : !v.isActive ? 'text-gray-400/70 visible' : 'invisible'
                )}>
                  {v.isAssigned ? 'Unassign from order to change' : 'Activate vehicle to change status'}
                </span>
              </div>

              {/* Active toggle */}
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
          </div>

          {/* Vehicle identity */}
          <div className="mt-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white font-mono tracking-wider">{v.registrationNumber}</h1>
              {alertCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-300 bg-red-500/20 border border-red-400/30 px-2 py-1 rounded-full">
                  <AlertTriangle size={11} />
                  {alertCount} compliance alert{alertCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-blue-200 text-sm mt-1.5">
              {[v.brandName, v.vehicleTypeName, v.capacityInTons ? `${v.capacityInTons}T` : null, v.fuelTypeName, v.color]
                .filter(Boolean).join(' · ')}
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Type',       value: v.vehicleTypeName ?? '—' },
              { label: 'Capacity',   value: v.capacityInTons ? `${v.capacityInTons} tons` : '—' },
              { label: 'Ownership',  value: v.ownershipTypeName ?? '—' },
              { label: 'Odometer',   value: v.currentOdometerReading ? `${v.currentOdometerReading.toLocaleString('en-IN')} km` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-300">{label}</p>
                <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>
        </div>

      </div>

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
              {t === 'Fuel'           && <Droplets size={14} />}
              {t === 'Tires'          && <CircleDot size={14} />}
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
                <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Pencil size={13} /> Edit
                </Button>
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle Details</p>
                <InfoRow label="Brand"           value={v.brandName} />
                <InfoRow label="Vehicle Type"    value={v.vehicleTypeName} />
                <InfoRow label="Fuel Type"       value={v.fuelTypeName} />
                <InfoRow label="Ownership"       value={v.ownershipTypeName} />
                <InfoRow label="Capacity"        value={v.capacityInTons ? `${v.capacityInTons} tons` : null} />
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
                <InfoRow label="Chassis No."   value={v.chassisNumber} />
                <InfoRow label="Engine No."    value={v.engineNumber} />
                <InfoRow label="RC Number"     value={v.rcNumber} />
                <InfoRow label="Permit No."    value={v.permitNumber} />
                <InfoRow label="Permit Type"   value={v.permitType} />
                <InfoRow label="PUC No."       value={v.pucNumber} />
                <InfoRow label="Fitness Cert." value={v.fitnessCertificateNumber} />
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
            </div>
          )}

          {/* ── Compliance ── */}
          {tab === 'Compliance' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Compliance & Documents</p>
                <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Pencil size={13} /> Edit
                </Button>
              </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Document Status</p>
                {complianceItems.map(c => <ComplianceRow key={c.label} {...c} />)}
              </div>
              <div className="space-y-5">
                {/* Insurance detail */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Insurance Details</p>
                  <InfoRow label="Company"     value={v.insuranceCompanyName} />
                  <InfoRow label="Policy No."  value={v.insurancePolicyNumber} />
                  <InfoRow label="Start Date"  value={fmtDate(v.insuranceStartDate)} />
                  <InfoRow label="Expiry Date" value={fmtDate(v.insuranceExpiryDate)} />
                </div>
                {/* Permit detail */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Permit Details</p>
                  <InfoRow label="Permit No."  value={v.permitNumber} />
                  <InfoRow label="Type"        value={v.permitType} />
                  <InfoRow label="Start Date"  value={fmtDate(v.permitStartDate)} />
                  <InfoRow label="Expiry Date" value={fmtDate(v.permitExpiryDate)} />
                </div>
                {/* Road Tax */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Road Tax</p>
                  <InfoRow label="Paid Date"   value={fmtDate(v.roadTaxPaidDate)} />
                  <InfoRow label="Expiry Date" value={fmtDate(v.roadTaxExpiryDate)} />
                </div>
              </div>
            </div>
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

          {/* ── Tires ── */}
          {tab === 'Tires' && v && (
            <TiresTabContent vehicle={v} />
          )}

          {/* ── GPS & Notes ── */}
          {tab === 'GPS & Notes' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GPS & Notes</p>
                <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Pencil size={13} /> Edit
                </Button>
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

          {/* ── Documents ── */}
          {tab === 'Documents' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Uploaded Documents</p>
                <Button size="sm" onClick={() => setAddDocOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Plus size={13} /> Add Document
                </Button>
              </div>
              {(docsRes?.data ?? []).length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <FileText size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(docsRes?.data ?? []).map((doc: VehicleDocument) => {
                    const level = expiryLevel(doc.expiryDate)
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <FileText size={15} className="text-feros-navy" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{doc.documentTypeName ?? `Document #${doc.id}`}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {doc.documentNumber && `${doc.documentNumber} · `}
                              {doc.issueDate && `Issued: ${fmtDate(doc.issueDate)}`}
                              {doc.expiryDate && ` · Expires: ${fmtDate(doc.expiryDate)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.fileUrl && (
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors">
                              <ExternalLink size={11} /> View
                            </a>
                          )}
                          {level !== 'none' && (
                            <span className={cn('text-xs px-2 py-1 rounded-full', {
                              'bg-red-50 text-red-600':    level === 'expired',
                              'bg-orange-50 text-orange-600': level === 'critical',
                              'bg-yellow-50 text-yellow-700': level === 'warning',
                              'bg-green-50 text-green-700':   level === 'ok',
                            })}>
                              {level === 'expired' ? 'Expired' : level === 'ok' ? 'Valid' : `${differenceInDays(parseISO(doc.expiryDate!), new Date())}d left`}
                            </span>
                          )}
                          {doc.isVerified ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              <BadgeCheck size={12} /> Verified
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Pending</span>
                          )}
                          <button
                            onClick={() => setDocToDelete(doc)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"
                            title="Delete document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

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

      <AddDocumentDialog vehicleId={v.id} open={addDocOpen} onClose={() => setAddDocOpen(false)} />

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
