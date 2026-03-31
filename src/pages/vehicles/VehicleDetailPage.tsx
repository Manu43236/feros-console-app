import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehiclesApi, vehicleServicesApi } from '@/api/vehicles'
import { servicePartsApi, sparePartsApi } from '@/api/inventory'
import { tenantMastersApi, globalMastersApi } from '@/api/masters'
import { breakdownsApi } from '@/api/breakdowns'
import { toast } from 'sonner'
import { format, parseISO, differenceInDays, isValid } from 'date-fns'
import {
  ArrowLeft, Truck, Shield, MapPin, Fuel,
  AlertTriangle, CheckCircle, Clock, Pencil, Power,
  ClipboardList, Route, FileText, Plus, BadgeCheck, Wrench, Droplets, ChevronDown, ChevronUp, ExternalLink, Paperclip, Trash2,
  Calendar, IndianRupee, RotateCcw, Check, Search, X, Package, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { BreakdownDuration, BreakdownType, VehicleDocument, VehicleStatusType, VehicleServiceRecord, Breakdown, MasterItem, ServicePart } from '@/types'
import { VehicleForm } from './VehiclesPage'
import { ServiceDetailModal } from '@/components/shared/ServiceDetailModal'

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
const TABS = ['Basic Info', 'Compliance', 'Documents', 'Service', 'Fuel', 'GPS & Notes', 'Order History', 'Trip History'] as const
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

  const { register, handleSubmit, formState: { errors }, reset } = useForm<DocForm>({
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
            <select {...register('documentTypeId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select type</option>
              {vehicleDocTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
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

const vehicleStatusBadge: Record<VehicleStatusType, string> = {
  AVAILABLE:  'bg-green-500/20 border-green-400/40 text-green-300',
  ASSIGNED:   'bg-blue-500/20 border-blue-400/40 text-blue-300',
  ON_TRIP:    'bg-orange-500/20 border-orange-400/40 text-orange-300',
  IN_REPAIR:  'bg-yellow-500/20 border-yellow-400/40 text-yellow-300',
  BREAKDOWN:  'bg-red-500/20 border-red-400/40 text-red-300',
  OTHER:      'bg-white/10 border-white/20 text-white',
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
  vehicleId, vehicleReg, breakdownId, open, onClose,
}: {
  vehicleId: number; vehicleReg: string; breakdownId?: number; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [serviceType, setServiceType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
  const [vendorName, setVendorName]   = useState('')
  const [location, setLocation]       = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [odometer, setOdometer]       = useState('')
  const [notes, setNotes]             = useState('')
  const [dueAtOdometer, setDueAtOdometer] = useState('')
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
      qc.invalidateQueries({ queryKey: ['vehicle-services', vehicleId] })
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
    setServiceType('INTERNAL'); setVendorName(''); setLocation('')
    setServiceDate(''); setOdometer(''); setNotes(''); setDueAtOdometer('')
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
    const payload = {
      vehicleId,
      triggeredBy: breakdownId ? 'BREAKDOWN' : 'SCHEDULED',
      breakdownId: breakdownId ?? null,
      serviceType,
      vendorName: serviceType === 'INTERNAL' ? 'Self' : vendorName,
      location: location || null,
      serviceDate: serviceDate || null,
      odometer: odometer ? Number(odometer) : null,
      dueAtOdometer: dueAtOdometer ? Number(dueAtOdometer) : null,
      notes: notes || null,
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
          {/* Service Type */}
          <div className="space-y-1.5">
            <Label>Service Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['INTERNAL', 'EXTERNAL'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setServiceType(t)}
                  className={cn('py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                    serviceType === t ? 'border-feros-navy bg-feros-navy/5 text-feros-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {t === 'INTERNAL' ? '🏭 Internal (Self)' : '🔧 External'}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor & Location */}
          {serviceType === 'EXTERNAL' && (
            <div className="space-y-1.5">
              <Label>Garage / Vendor Name</Label>
              <Input placeholder="e.g. Raju Tyre Works" value={vendorName} onChange={e => setVendorName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Location <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="e.g. Pune highway, Depot yard" value={location} onChange={e => setLocation(e.target.value)} />
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
          {!breakdownId && (
            <div className="space-y-1.5">
              <Label>Due At Odometer <span className="text-gray-400 font-normal">(km — for scheduled services)</span></Label>
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
            <div className="border rounded-lg divide-y divide-gray-100">
              {taskTypes.map(t => {
                const checked = selectedTaskIds.has(t.id)
                const draft = taskDrafts[t.id]
                return (
                  <div key={t.id} className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" id={`task-${t.id}`} checked={checked}
                        onChange={() => toggleTask(t.id)}
                        className="w-4 h-4 accent-feros-navy cursor-pointer" />
                      <label htmlFor={`task-${t.id}`} className="text-sm text-gray-700 flex-1 cursor-pointer">{t.name}</label>
                    </div>
                    {checked && (
                      <div className="mt-2 ml-6 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Cost (₹)</p>
                            <Input type="number" placeholder="0" className="h-8 text-sm"
                              value={draft?.cost ?? ''}
                              onChange={e => updateDraft(t.id, { cost: e.target.value ? Number(e.target.value) : undefined })} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Recurring?</p>
                            <button type="button"
                              onClick={() => updateDraft(t.id, { isRecurring: !draft?.isRecurring })}
                              className={cn('h-8 w-full rounded-md border text-xs font-medium transition-colors',
                                draft?.isRecurring ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'
                              )}>
                              {draft?.isRecurring ? '🔄 Yes' : 'One-time'}
                            </button>
                          </div>
                        </div>
                        {draft?.isRecurring && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Every (km)</p>
                            <Input type="number" placeholder="10000" className="h-8 text-sm"
                              value={draft?.frequencyKm ?? ''}
                              onChange={e => updateDraft(t.id, { frequencyKm: e.target.value ? Number(e.target.value) : undefined })} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Other / custom tasks */}
              {customTasks.map((ct, i) => (
                <div key={`custom-${i}`} className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Check size={14} className="text-feros-navy ml-0.5" />
                    <span className="text-sm text-gray-700 flex-1">{ct.customName}</span>
                    <button type="button" onClick={() => removeCustomTask(i)} className="text-gray-300 hover:text-red-500">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="mt-2 ml-6 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Cost (₹)</p>
                        <Input type="number" placeholder="0" className="h-8 text-sm"
                          value={ct.cost ?? ''}
                          onChange={e => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, cost: e.target.value ? Number(e.target.value) : undefined } : x))} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Recurring?</p>
                        <button type="button"
                          onClick={() => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, isRecurring: !x.isRecurring } : x))}
                          className={cn('h-8 w-full rounded-md border text-xs font-medium transition-colors',
                            ct.isRecurring ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'
                          )}>
                          {ct.isRecurring ? '🔄 Yes' : 'One-time'}
                        </button>
                      </div>
                    </div>
                    {ct.isRecurring && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Every (km)</p>
                        <Input type="number" placeholder="10000" className="h-8 text-sm"
                          value={ct.frequencyKm ?? ''}
                          onChange={e => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, frequencyKm: e.target.value ? Number(e.target.value) : undefined } : x))} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add custom task row */}
              <div className="px-3 py-2.5">
                {!showCustom ? (
                  <button type="button" onClick={() => setShowCustom(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-feros-navy transition-colors">
                    <Plus size={13} /> Add custom task
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder="Task name…" className="h-8 text-sm flex-1"
                      value={customTaskName} onChange={e => setCustomTaskName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTask())} />
                    <Button type="button" size="sm" onClick={addCustomTask} className="h-8 bg-feros-navy text-white">Add</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setShowCustom(false); setCustomTaskName('') }} className="h-8">✕</Button>
                  </div>
                )}
              </div>
            </div>
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
function CompleteServiceDialog({ service, open, onClose }: { service: VehicleServiceRecord | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [completedDate, setCompletedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [odometer, setOdometer]           = useState(service?.odometer?.toString() ?? '')

  const mutation = useMutation({
    mutationFn: () => vehicleServicesApi.complete(service!.id, {
      completedDate,
      odometer: odometer ? Number(odometer) : undefined,
    }),
    onSuccess: () => {
      toast.success('Service marked complete!')
      qc.invalidateQueries({ queryKey: ['vehicle-services', service!.vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle-breakdowns-history', service!.vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle', service!.vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      handleClose()
    },
    onError: (e: unknown) => toast.error(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'
    ),
  })

  function handleClose() { setCompletedDate(format(new Date(), 'yyyy-MM-dd')); setOdometer(service?.odometer?.toString() ?? ''); onClose() }

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
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              value={form.sparePartId}
              onChange={e => setForm(f => ({ ...f, sparePartId: Number(e.target.value) }))}
            >
              <option value={0}>Select part…</option>
              {parts.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.partNumber}</option>
              ))}
            </select>
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

// ── service tab content ────────────────────────────────────────────────────────
function ServiceTabContent({ vehicleId, vehicleReg }: { vehicleId: number; vehicleReg: string }) {
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
      qc.invalidateQueries({ queryKey: ['vehicle-services', vehicleId] })
    },
    onError: () => toast.error('Failed to start service'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vehicleServicesApi.delete(id),
    onSuccess: () => {
      toast.success('Service deleted')
      qc.invalidateQueries({ queryKey: ['vehicle-services', vehicleId] })
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
                          <span className="text-xs text-gray-400 capitalize">{s.triggeredBy === 'BREAKDOWN' ? '⚡ Breakdown' : '📅 Scheduled'}</span>
                          <span className="text-xs text-gray-400">{s.serviceType === 'INTERNAL' ? '🏭 Internal' : `🔧 ${s.vendorName}`}</span>
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
                          <Button size="sm" onClick={() => setCompleteService(s)}
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1">
                            <Check size={12} /> Done
                          </Button>
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <CompleteServiceDialog
        service={completeService}
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

            <div className="flex items-center gap-2">
              {/* Status select */}
              <div className="flex flex-col items-end gap-1">
                {v.isAssigned && (
                  <span className="text-xs text-yellow-300 font-mono">{v.assignedOrderNumber}</span>
                )}
                <div className="relative flex items-center">
                  <select
                    value={v.isAssigned ? 'assigned' : (v.currentStatusId ?? '')}
                    onChange={e => {
                      const id = Number(e.target.value)
                      if (!id || id === v.currentStatusId) return  // no change
                      const selected = statusRes?.data?.find(s => s.id === id)
                      if (selected?.statusType === 'BREAKDOWN') {
                        setPendingStatusId(id)
                      } else {
                        setConfirmStatusId(id)
                        setConfirmStatusName(selected?.name ?? '')
                      }
                    }}
                    disabled={updateStatusMutation.isPending || !!v.isAssigned}
                    className={cn(
                      'h-8 pl-2 pr-6 rounded-lg text-xs border appearance-none transition-colors',
                      v.isAssigned
                        ? 'bg-blue-500/20 border-blue-400/40 text-blue-200 cursor-not-allowed'
                        : cn('cursor-pointer', v.currentStatusType ? vehicleStatusBadge[v.currentStatusType] : 'bg-white/10 border-white/20 text-white hover:bg-white/20'),
                      updateStatusMutation.isPending && 'opacity-60 cursor-wait'
                    )}
                  >
                    {v.isAssigned
                      ? <option value="assigned" className="text-gray-800">Assigned to Order</option>
                      : <>
                          {!v.currentStatusId && <option value="" className="text-gray-400">— Set Status —</option>}
                          {statusRes?.data
                            ?.filter(s => {
                              const cur = v.currentStatusType
                              // Always include current + allowed next
                              if (cur === 'BREAKDOWN') return s.statusType === 'BREAKDOWN' || s.statusType === 'IN_REPAIR'
                              if (cur === 'IN_REPAIR')  return s.statusType === 'IN_REPAIR'  || s.statusType === 'AVAILABLE'
                              // AVAILABLE / null → show all except ASSIGNED/ON_TRIP (managed by orders) and IN_REPAIR (only reachable from Breakdown)
                              return s.statusType !== 'ASSIGNED' && s.statusType !== 'ON_TRIP' && s.statusType !== 'IN_REPAIR'
                            })
                            .map(s => (
                              <option key={s.id} value={s.id} className="text-gray-800">{s.name}</option>
                            ))}
                        </>
                    }
                  </select>
                  <ChevronDown size={12} className="absolute right-1.5 pointer-events-none text-current opacity-70" />
                </div>
                {v.isAssigned && (
                  <span className="text-xs text-blue-300/70">Unassign from order to change</span>
                )}
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
                <InfoRow label="Brand"         value={v.brandName} />
                <InfoRow label="Vehicle Type"  value={v.vehicleTypeName} />
                <InfoRow label="Fuel Type"     value={v.fuelTypeName} />
                <InfoRow label="Ownership"     value={v.ownershipTypeName} />
                <InfoRow label="Capacity"      value={v.capacityInTons ? `${v.capacityInTons} tons` : null} />
                <InfoRow label="Mfg. Year"     value={v.manufactureYear} />
                <InfoRow label="Color"         value={v.color} />
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
            <ServiceTabContent vehicleId={v.id} vehicleReg={v.registrationNumber} />
          )}

          {/* ── Fuel ── */}
          {tab === 'Fuel' && (
            <div className="py-10 text-center text-gray-400">
              <Droplets size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Fuel Log</p>
              <p className="text-xs mt-1">Fuel fill-ups, quantity, cost, and mileage tracking will appear here.</p>
            </div>
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
  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<BdForm>({
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
            <select {...register('breakdownType')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select type</option>
              {BD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
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
