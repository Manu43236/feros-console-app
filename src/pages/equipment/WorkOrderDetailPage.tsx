import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@/context/SubscriptionContext'
import { workOrdersApi } from '@/api/workOrders'
import { equipmentApi } from '@/api/equipment'
import type { Equipment } from '@/api/equipment'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Wrench, Activity,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Construction, CalendarDays, Gauge, User, Play, Square, MapPin, Timer, Pencil, Trash2, Receipt, Boxes,
  FileText, Camera, RefreshCw, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { staffApi } from '@/api/staff'
import { clientsApi } from '@/api/clients'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WorkOrderStatus, DailyLogStatus, AssignmentEndReason, MachineAssignment, OperatorType, WorkEntry, DailyLog, EquipmentInvoice, EquipmentInvoiceStatus, HireType, ProviderSide, IdleAttribution } from '@/types'
import { equipmentInvoicesApi } from '@/api/equipmentInvoices'
import { equipmentAttachmentsApi } from '@/api/machines'
import type { EquipmentAttachment } from '@/api/machines'
import { CreateEquipmentInvoiceDialog } from './CreateEquipmentInvoiceDialog'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', CONFIRMED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700', COMPLETED: 'bg-green-50 text-green-700',
  INVOICED: 'bg-purple-50 text-purple-700', CANCELLED: 'bg-red-50 text-red-700',
}
const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: 'Draft', CONFIRMED: 'Confirmed', IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed', INVOICED: 'Invoiced', CANCELLED: 'Cancelled',
}
const LOG_STATUS_COLORS: Record<DailyLogStatus, string> = {
  WORKING: 'bg-green-50 text-green-700', BREAKDOWN: 'bg-red-50 text-red-700',
  NO_MACHINE: 'bg-gray-100 text-gray-500', IDLE: 'bg-amber-50 text-amber-600',
}
const LOG_STATUS_ICONS: Record<DailyLogStatus, React.ReactNode> = {
  WORKING: <CheckCircle2 size={12} />, BREAKDOWN: <XCircle size={12} />,
  NO_MACHINE: <AlertTriangle size={12} />, IDLE: <Clock size={12} />,
}
const NEXT_STATUSES: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['INVOICED'],
}


// ── Add Machine Dialog ─────────────────────────────────────────────────────────
function eqLabel(e: Equipment) {
  const reg = e.registrationNumber ?? e.serialNumber ?? `#${e.id}`
  const cap = e.capacity != null ? ` ${e.capacity}${e.capacityUnit ?? ''}` : ''
  return `${reg} — ${e.makeName} ${e.modelName} (${e.equipmentTypeName}${cap})`
}

function AddMachineDialog({ woId, open, onClose }: { woId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [equipmentId, setEquipmentId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [rateType, setRateType] = useState<'HOURLY' | 'DAILY_SHIFT' | 'MONTHLY' | ''>('')
  const [rateAmount, setRateAmount] = useState('')

  function reset() { setEquipmentId(''); setRateType(''); setRateAmount('') }

  const { data: equipRes } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.getAll(),
    enabled: open,
  })
  const allEquip = equipRes?.data ?? []
  const options = allEquip.map(e => ({ value: String(e.id), label: eqLabel(e) }))
  const selectedEquip = equipmentId ? allEquip.find(e => String(e.id) === equipmentId) : null

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.addMachine(woId, {
      equipmentId: Number(equipmentId),
      startDate,
      rateType: rateType || undefined,
      rateAmount: rateAmount ? Number(rateAmount) : undefined,
    }),
    onSuccess: () => {
      toast.success('Machine assigned')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to assign machine')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Machine</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Machine</Label>
            <SearchableSelect
              value={equipmentId}
              onValueChange={setEquipmentId}
              options={options}
              placeholder="Search by reg. number, serial…"
            />
            {selectedEquip?.capacity != null && (
              <p className="text-xs text-gray-500 mt-1">Capacity: <span className="font-medium">{selectedEquip.capacity}{selectedEquip.capacityUnit}</span></p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Rate <span className="normal-case font-normal">(optional)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rate Type</Label>
                <select
                  value={rateType}
                  onChange={e => setRateType(e.target.value as typeof rateType)}
                  className="w-full h-9 border border-gray-200 rounded-md px-2 text-sm bg-white"
                >
                  <option value="">— select —</option>
                  <option value="HOURLY">Hourly</option>
                  <option value="DAILY_SHIFT">Daily Shift</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Rate Amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 500000"
                  value={rateAmount}
                  onChange={e => setRateAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button disabled={!equipmentId || mutation.isPending} onClick={() => mutation.mutate()} className={btnPrimary}>
              {mutation.isPending ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Close Machine Dialog ───────────────────────────────────────────────────────
function CloseMachineDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState<AssignmentEndReason>('COMPLETED')

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.closeMachine(woId, assignment!.id, { endDate, endReason: reason }),
    onSuccess: () => { toast.success('Machine removed'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); onClose() },
    onError: () => toast.error('Failed to close assignment'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Remove Machine</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600">Machine: <strong>{assignment?.serialNumber ?? `#${assignment?.equipmentId}`}</strong></p>
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <div className="flex flex-col gap-2">
              {(['COMPLETED', 'BREAKDOWN_REPLACED', 'BREAKDOWN_RETURNED'] as AssignmentEndReason[]).map(r => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  {r === 'COMPLETED' ? 'Job completed' : r === 'BREAKDOWN_REPLACED' ? 'Breakdown — replacement sent' : 'Breakdown — machine returned'}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
              {mutation.isPending ? 'Removing…' : 'Remove Machine'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Extend Dialog ─────────────────────────────────────────────────────────────
function ExtendDialog({ woId, currentEndDate, open, onClose }: {
  woId: number; currentEndDate?: string | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [newEndDate, setNewEndDate] = useState(currentEndDate ?? '')

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.extend(woId, newEndDate),
    onSuccess: () => { toast.success('Work order extended'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); onClose() },
    onError: () => toast.error('Failed to extend work order'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Extend Work Order</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          {currentEndDate && <p className="text-sm text-gray-500">Current end date: <strong>{currentEndDate}</strong></p>}
          <div className="space-y-1.5">
            <Label>New End Date</Label>
            <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} min={currentEndDate ?? undefined} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!newEndDate || mutation.isPending} onClick={() => mutation.mutate()} className={btnPrimary}>
              {mutation.isPending ? 'Extending…' : 'Extend'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Log Dialog ────────────────────────────────────────────────────────────
type DivLine = { divisionId: string; startHm: string; endHm: string; notes: string }
const emptyLine = (): DivLine => ({ divisionId: '', startHm: '', endHm: '', notes: '' })

function DivisionLinesEditor({ lines, onChange, clientDivisions }: {
  lines: DivLine[]
  onChange: (lines: DivLine[]) => void
  clientDivisions: { id: number; name: string }[]
}) {
  const set = (i: number, k: keyof DivLine, v: string) =>
    onChange(lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Division Lines</Label>
        <button type="button" onClick={() => onChange([...lines, emptyLine()])}
          className="text-xs text-feros-equip-sidebar hover:underline flex items-center gap-0.5">
          <Plus size={11} /> Add line
        </button>
      </div>
      {lines.length === 0 && (
        <p className="text-xs text-gray-400 italic">No division lines — click "+ Add line" to track per-division hours.</p>
      )}
      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_80px_1fr_20px] gap-2 items-center">
          <select className="border rounded-md px-2 py-1.5 text-sm"
            value={line.divisionId}
            onChange={e => set(i, 'divisionId', e.target.value)}>
            <option value="">— No division —</option>
            {clientDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Input type="number" step="0.01" placeholder="Start HM" className="text-sm"
            value={line.startHm} onChange={e => set(i, 'startHm', e.target.value)} />
          <Input type="number" step="0.01" placeholder="End HM" className="text-sm"
            value={line.endHm} onChange={e => set(i, 'endHm', e.target.value)} />
          <Input placeholder="Notes" className="text-sm"
            value={line.notes} onChange={e => set(i, 'notes', e.target.value)} />
          <button type="button" onClick={() => onChange(lines.filter((_, idx) => idx !== i))}
            className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
        </div>
      ))}
      {lines.length > 0 && (
        <p className="text-[11px] text-gray-400">
          Total: {lines.reduce((sum, l) => {
            const h = l.startHm && l.endHm ? Number(l.endHm) - Number(l.startHm) : 0
            return sum + (h > 0 ? h : 0)
          }, 0).toFixed(2)} hrs &nbsp;·&nbsp; HMR {
            Math.min(...lines.filter(l => l.startHm).map(l => Number(l.startHm))) || '—'
          } → {Math.max(...lines.filter(l => l.endHm).map(l => Number(l.endHm))) || '—'}
        </p>
      )}
    </div>
  )
}

function AddLogDialog({ woId, clientId, assignments, open, onClose }: {
  woId: number; clientId: number; assignments: MachineAssignment[]; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [form, setForm] = useState({
    machineAssignmentId: String(assignments[0]?.id ?? ''),
    logDate: new Date().toISOString().slice(0, 10),
    status: 'WORKING' as DailyLogStatus,
    fuelConsumed: '', notes: '',
    workingHours: '', idleHours: '', standbyHours: '', breakdownHours: '',
    idleAttribution: '' as IdleAttribution | '',
    idleReason: '',
    signedSlipPhotoUrl: '',
  })
  const [divLines, setDivLines] = useState<DivLine[]>([emptyLine()])
  const [slipUploading, setSlipUploading] = useState(false)

  const { data: divisionsRes } = useQuery({
    queryKey: ['client-divisions', clientId],
    queryFn: () => clientsApi.getDivisions(clientId),
    enabled: open && !!clientId,
  })
  const clientDivisions: { id: number; name: string }[] = divisionsRes?.data ?? []

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.addLog(woId, {
      machineAssignmentId: Number(form.machineAssignmentId),
      logDate: form.logDate,
      status: form.status,
      fuelConsumed: form.fuelConsumed ? Number(form.fuelConsumed) : undefined,
      notes: form.notes || undefined,
      divisions: form.status === 'WORKING' ? divLines.map(l => ({
        divisionId: l.divisionId ? Number(l.divisionId) : undefined,
        startHourMeter: l.startHm ? Number(l.startHm) : undefined,
        endHourMeter: l.endHm ? Number(l.endHm) : undefined,
        notes: l.notes || undefined,
      })) : [],
      workingHours: form.workingHours ? Number(form.workingHours) : undefined,
      idleHours: form.idleHours ? Number(form.idleHours) : undefined,
      standbyHours: form.standbyHours ? Number(form.standbyHours) : undefined,
      breakdownHours: form.breakdownHours ? Number(form.breakdownHours) : undefined,
      idleAttribution: form.idleAttribution || undefined,
      idleReason: form.idleReason || undefined,
      signedSlipPhotoUrl: form.signedSlipPhotoUrl || undefined,
    }),
    onSuccess: () => {
      toast.success('Log added')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      setDivLines([emptyLine()])
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to add log')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add Daily Log</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Machine</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.machineAssignmentId}
                onChange={e => setForm(f => ({ ...f, machineAssignmentId: e.target.value }))}>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>{a.serialNumber ?? `Machine #${a.equipmentId}`} ({a.equipmentTypeName})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.logDate} onChange={e => setForm(f => ({ ...f, logDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex gap-2 flex-wrap">
              {(['WORKING', 'BREAKDOWN', 'NO_MACHINE', 'IDLE'] as DailyLogStatus[]).map(s => (
                <button key={s} type="button"
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    form.status === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'
                  )}
                >{s.replace('_', ' ')}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fuel (L)</Label>
              <Input type="number" step="0.01" placeholder="45" value={form.fuelConsumed}
                onChange={e => setForm(f => ({ ...f, fuelConsumed: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Any remarks…" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {form.status === 'WORKING' && (
            <div className="border-t pt-3">
              <DivisionLinesEditor lines={divLines} onChange={setDivLines} clientDivisions={clientDivisions} />
            </div>
          )}
          {/* E4 — Hour Breakdown */}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Hour Breakdown (optional)</Label>
            <div className="grid grid-cols-4 gap-2">
              {([['Working', 'workingHours'], ['Idle', 'idleHours'], ['Standby', 'standbyHours'], ['Breakdown', 'breakdownHours']] as const).map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" step="0.5" min="0" placeholder="0"
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          {/* E4 — Idle Attribution (show when idleHours entered) */}
          {form.idleHours && Number(form.idleHours) > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wide">Idle Attribution</Label>
              <div className="flex gap-2">
                {(['CLIENT_FAULT', 'OUR_BREAKDOWN'] as IdleAttribution[]).map(v => (
                  <button key={v} type="button"
                    onClick={() => setForm(f => ({ ...f, idleAttribution: f.idleAttribution === v ? '' : v }))}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      form.idleAttribution === v
                        ? v === 'CLIENT_FAULT' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    )}>
                    {v === 'CLIENT_FAULT' ? 'Client Fault (billed)' : 'Our Breakdown (not billed)'}
                  </button>
                ))}
              </div>
              {form.idleAttribution && (
                <Input placeholder="Reason for idle time…" value={form.idleReason}
                  onChange={e => setForm(f => ({ ...f, idleReason: e.target.value }))} />
              )}
            </div>
          )}
          {/* E4 — Signed Slip Photo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Client-Signed Slip (optional)</Label>
            {form.signedSlipPhotoUrl ? (
              <div className="flex items-center gap-2">
                <a href={form.signedSlipPhotoUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                  <Camera size={13} /> View slip
                </a>
                <button type="button" onClick={() => setForm(f => ({ ...f, signedSlipPhotoUrl: '' }))}
                  className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ) : (
              <label className={cn('flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 w-fit', slipUploading && 'opacity-50 pointer-events-none')}>
                <Upload size={14} />
                {slipUploading ? 'Uploading…' : 'Upload signed slip'}
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setSlipUploading(true)
                  try {
                    const res = await workOrdersApi.uploadSlipPhoto(woId, form.logDate, file)
                    if (res.data?.publicUrl) setForm(f => ({ ...f, signedSlipPhotoUrl: res.data!.publicUrl }))
                  } catch { toast.error('Upload failed') }
                  finally { setSlipUploading(false) }
                }} />
              </label>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className={btnPrimary}>
              {mutation.isPending ? 'Saving…' : 'Add Log'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Log Dialog ───────────────────────────────────────────────────────────
function EditLogDialog({ woId, clientId, log, open, onClose }: {
  woId: number; clientId: number; log: DailyLog | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [form, setForm] = useState({
    status: 'WORKING' as DailyLogStatus, fuelConsumed: '', notes: '',
    workingHours: '', idleHours: '', standbyHours: '', breakdownHours: '',
    idleAttribution: '' as IdleAttribution | '',
    idleReason: '',
    signedSlipPhotoUrl: '',
  })
  const [divLines, setDivLines] = useState<DivLine[]>([])
  const [slipUploading, setSlipUploading] = useState(false)

  const { data: divisionsRes } = useQuery({
    queryKey: ['client-divisions', clientId],
    queryFn: () => clientsApi.getDivisions(clientId),
    enabled: open && !!clientId,
  })
  const clientDivisions: { id: number; name: string }[] = divisionsRes?.data ?? []

  useEffect(() => {
    if (!log) return
    setForm({
      status: log.status,
      fuelConsumed: log.fuelConsumed != null ? String(log.fuelConsumed) : '',
      notes: log.notes ?? '',
      workingHours: log.workingHours != null ? String(log.workingHours) : '',
      idleHours: log.idleHours != null ? String(log.idleHours) : '',
      standbyHours: log.standbyHours != null ? String(log.standbyHours) : '',
      breakdownHours: log.breakdownHours != null ? String(log.breakdownHours) : '',
      idleAttribution: log.idleAttribution ?? '',
      idleReason: log.idleReason ?? '',
      signedSlipPhotoUrl: log.signedSlipPhotoUrl ?? '',
    })
    // Pre-fill division lines — match name back to id where possible
    setDivLines((log.divisions ?? []).map(d => ({
      divisionId: String(clientDivisions.find(cd => cd.name === d.divisionName)?.id ?? ''),
      startHm: d.startHourMeter != null ? String(d.startHourMeter) : '',
      endHm: d.endHourMeter != null ? String(d.endHourMeter) : '',
      notes: d.notes ?? '',
    })))
  }, [log]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.updateLog(woId, log!.id, {
      machineAssignmentId: log!.machineAssignmentId,
      logDate: log!.logDate,
      status: form.status,
      fuelConsumed: form.fuelConsumed ? Number(form.fuelConsumed) : undefined,
      notes: form.notes || undefined,
      divisions: form.status === 'WORKING' ? divLines.map(l => ({
        divisionId: l.divisionId ? Number(l.divisionId) : undefined,
        startHourMeter: l.startHm ? Number(l.startHm) : undefined,
        endHourMeter: l.endHm ? Number(l.endHm) : undefined,
        notes: l.notes || undefined,
      })) : [],
      workingHours: form.workingHours ? Number(form.workingHours) : undefined,
      idleHours: form.idleHours ? Number(form.idleHours) : undefined,
      standbyHours: form.standbyHours ? Number(form.standbyHours) : undefined,
      breakdownHours: form.breakdownHours ? Number(form.breakdownHours) : undefined,
      idleAttribution: form.idleAttribution || undefined,
      idleReason: form.idleReason || undefined,
      signedSlipPhotoUrl: form.signedSlipPhotoUrl || undefined,
    }),
    onSuccess: () => { toast.success('Log updated'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); onClose() },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to update log')
    },
  })

  if (!log) return null
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit Daily Log — {log.logDate}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex gap-2 flex-wrap">
              {(['WORKING', 'BREAKDOWN', 'NO_MACHINE', 'IDLE'] as DailyLogStatus[]).map(s => (
                <button key={s} type="button"
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    form.status === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'
                  )}
                >{s.replace('_', ' ')}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fuel (L)</Label>
              <Input type="number" step="0.01" value={form.fuelConsumed}
                onChange={e => setForm(f => ({ ...f, fuelConsumed: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="Any remarks…" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {form.status === 'WORKING' && (
            <div className="border-t pt-3">
              <DivisionLinesEditor lines={divLines} onChange={setDivLines} clientDivisions={clientDivisions} />
            </div>
          )}
          {/* E4 — Hour Breakdown */}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Hour Breakdown (optional)</Label>
            <div className="grid grid-cols-4 gap-2">
              {([['Working', 'workingHours'], ['Idle', 'idleHours'], ['Standby', 'standbyHours'], ['Breakdown', 'breakdownHours']] as const).map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" step="0.5" min="0" placeholder="0"
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          {/* E4 — Idle Attribution */}
          {form.idleHours && Number(form.idleHours) > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 uppercase tracking-wide">Idle Attribution</Label>
              <div className="flex gap-2">
                {(['CLIENT_FAULT', 'OUR_BREAKDOWN'] as IdleAttribution[]).map(v => (
                  <button key={v} type="button"
                    onClick={() => setForm(f => ({ ...f, idleAttribution: f.idleAttribution === v ? '' : v }))}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      form.idleAttribution === v
                        ? v === 'CLIENT_FAULT' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    )}>
                    {v === 'CLIENT_FAULT' ? 'Client Fault (billed)' : 'Our Breakdown (not billed)'}
                  </button>
                ))}
              </div>
              {form.idleAttribution && (
                <Input placeholder="Reason for idle time…" value={form.idleReason}
                  onChange={e => setForm(f => ({ ...f, idleReason: e.target.value }))} />
              )}
            </div>
          )}
          {/* E4 — Signed Slip Photo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Client-Signed Slip (optional)</Label>
            {form.signedSlipPhotoUrl ? (
              <div className="flex items-center gap-2">
                <a href={form.signedSlipPhotoUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                  <Camera size={13} /> View slip
                </a>
                <button type="button" onClick={() => setForm(f => ({ ...f, signedSlipPhotoUrl: '' }))}
                  className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ) : (
              <label className={cn('flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 w-fit', slipUploading && 'opacity-50 pointer-events-none')}>
                <Upload size={14} />
                {slipUploading ? 'Uploading…' : 'Upload signed slip'}
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setSlipUploading(true)
                  try {
                    const res = await workOrdersApi.uploadSlipPhoto(woId, log!.logDate, file)
                    if (res.data?.publicUrl) setForm(f => ({ ...f, signedSlipPhotoUrl: res.data!.publicUrl }))
                  } catch { toast.error('Upload failed') }
                  finally { setSlipUploading(false) }
                }} />
              </label>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className={btnPrimary}>
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Assign Operator Dialog ────────────────────────────────────────────────────
function AssignOperatorDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [operatorType, setOperatorType] = useState<OperatorType | ''>('')
  const [staffId, setStaffId] = useState('')
  const [hiredName, setHiredName] = useState('')
  const [hiredPhone, setHiredPhone] = useState('')

  const { data: staffRes } = useQuery({
    queryKey: ['staff-equipment'],
    queryFn: () => staffApi.getAll({ equipmentOnly: true }),
    enabled: open,
  })
  const operators = (staffRes?.data ?? []).filter(s => s.roleName === 'OPERATOR')

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.assignOperator(woId, assignment!.id, {
      operatorType: operatorType || undefined,
      operatorStaffId: operatorType === 'OWN_STAFF' ? Number(staffId) : undefined,
      hiredOperatorName: operatorType === 'HIRED' ? hiredName : undefined,
      hiredOperatorPhone: operatorType === 'HIRED' ? hiredPhone : undefined,
    }),
    onSuccess: () => {
      toast.success('Operator assigned')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      onClose()
    },
    onError: () => toast.error('Failed to assign operator'),
  })

  const isValid = !operatorType ||
    (operatorType === 'OWN_STAFF' && !!staffId) ||
    (operatorType === 'HIRED' && !!hiredName)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Operator</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Operator Type</Label>
            <div className="flex gap-2">
              {(['OWN_STAFF', 'HIRED'] as OperatorType[]).map(t => (
                <button key={t} onClick={() => { setOperatorType(t); setStaffId(''); setHiredName(''); setHiredPhone('') }}
                  className={cn('flex-1 py-2 text-sm rounded-lg border transition-colors',
                    operatorType === t ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {t === 'OWN_STAFF' ? 'Own Staff' : 'Hired'}
                </button>
              ))}
            </div>
          </div>

          {operatorType === 'OWN_STAFF' && (
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Select Operator</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={staffId} onChange={e => setStaffId(e.target.value)}>
                <option value="">— Select operator —</option>
                {operators.map(s => <option key={s.userId} value={String(s.userId)}>{s.userName}</option>)}
              </select>
              {operators.length === 0 && <p className="text-xs text-amber-600 mt-1">No operators found. Add operators in Staff first.</p>}
            </div>
          )}

          {operatorType === 'HIRED' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Operator Name *</Label>
                <Input value={hiredName} onChange={e => setHiredName(e.target.value)} placeholder="Enter name" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Phone (optional)</Label>
                <Input value={hiredPhone} onChange={e => setHiredPhone(e.target.value)} placeholder="Enter phone" />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {assignment?.operatorType && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { setOperatorType(''); mutation.mutate() }}>
                Remove
              </Button>
            )}
            <Button className="flex-1 bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white"
              disabled={!isValid || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Saving…' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Start Work Dialog ─────────────────────────────────────────────────────────
function StartWorkDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [operatorType, setOperatorType] = useState<OperatorType>('OWN_STAFF')
  const [staffId, setStaffId] = useState('')
  const [hiredName, setHiredName] = useState('')
  const [startMeter, setStartMeter] = useState('')

  const { data: staffRes } = useQuery({
    queryKey: ['staff-equipment'],
    queryFn: () => staffApi.getAll({ equipmentOnly: true }),
    enabled: open,
  })
  const operators = (staffRes?.data ?? []).filter(s => s.roleName === 'OPERATOR')

  // Fetch work entries to find last completed session's end meter
  const { data: entriesRes } = useQuery({
    queryKey: ['work-entries', woId, assignment?.id],
    queryFn: () => workOrdersApi.getWorkEntries(woId, assignment!.id),
    enabled: open && !!assignment?.id,
  })
  const lastCompleted = (entriesRes?.data ?? []).find(e => e.status === 'COMPLETED')
  const lastEndMeter = lastCompleted?.endMeter ?? null

  // Pre-fill start meter from last session when dialog opens
  const [meterPrefilled, setMeterPrefilled] = useState(false)
  if (open && lastEndMeter != null && !meterPrefilled && !startMeter) {
    setStartMeter(String(lastEndMeter))
    setMeterPrefilled(true)
  }

  // Pre-fill from existing assignment operator
  const prefilled = assignment?.operatorType
  const preStaffId = assignment?.operatorStaffId ? String(assignment.operatorStaffId) : ''
  const preHiredName = assignment?.hiredOperatorName ?? ''

  function reset() { setOperatorType('OWN_STAFF'); setStaffId(''); setHiredName(''); setStartMeter(''); setMeterPrefilled(false) }

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.startWork(woId, assignment!.id, {
      operatorType,
      operatorStaffId: operatorType === 'OWN_STAFF' ? Number(staffId || preStaffId) : undefined,
      hiredOperatorName: operatorType === 'HIRED' ? (hiredName || preHiredName) : undefined,
      startMeter: Number(startMeter),
    }),
    onSuccess: () => { toast.success('Work started'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); reset(); onClose() },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to start work')
    },
  })

  const effectiveOpType = operatorType ?? prefilled ?? 'OWN_STAFF'
  const effectiveStaffId = staffId || preStaffId
  const effectiveHiredName = hiredName || preHiredName
  const isValid = !!startMeter && (
    (effectiveOpType === 'OWN_STAFF' && !!effectiveStaffId) ||
    (effectiveOpType === 'HIRED' && !!effectiveHiredName)
  )

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Start Work</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-gray-500">
            Machine: <strong>{assignment?.serialNumber ?? `#${assignment?.equipmentId}`}</strong>
          </p>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Operator Type</Label>
            <div className="flex gap-2">
              {(['OWN_STAFF', 'HIRED'] as OperatorType[]).map(t => (
                <button key={t} onClick={() => setOperatorType(t)}
                  className={cn('flex-1 py-2 text-sm rounded-lg border transition-colors',
                    effectiveOpType === t ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {t === 'OWN_STAFF' ? 'Own Staff' : 'Hired'}
                </button>
              ))}
            </div>
          </div>

          {effectiveOpType === 'OWN_STAFF' && (
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Operator *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={staffId || preStaffId} onChange={e => setStaffId(e.target.value)}>
                <option value="">— Select operator —</option>
                {operators.map(s => <option key={s.userId} value={String(s.userId)}>{s.userName}</option>)}
              </select>
              {operators.length === 0 && <p className="text-xs text-amber-600 mt-1">No operators found. Add operators in Staff first.</p>}
            </div>
          )}
          {effectiveOpType === 'HIRED' && (
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Operator Name *</Label>
              <Input value={hiredName || preHiredName} onChange={e => setHiredName(e.target.value)} placeholder="Enter name" />
            </div>
          )}

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Start Meter Reading *</Label>
            <Input type="number" step="0.01" placeholder="e.g. 1250.5" value={startMeter} onChange={e => setStartMeter(e.target.value)} />
            {lastEndMeter != null && (
              <p className="text-xs text-blue-600 mt-1">
                Last session ended at <strong>{lastEndMeter} HMR</strong> — start meter must be ≥ {lastEndMeter}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button disabled={!isValid || mutation.isPending} onClick={() => mutation.mutate()}
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
              <Play size={13} /> {mutation.isPending ? 'Starting…' : 'Start Work'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Stop Work Dialog ──────────────────────────────────────────────────────────
function StopWorkDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [endMeter, setEndMeter] = useState('')
  const [notes, setNotes] = useState('')

  const activeEntry: WorkEntry | null | undefined = assignment?.activeWorkEntry

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.stopWork(woId, assignment!.id, {
      endMeter: Number(endMeter),
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Work stopped')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      setEndMeter(''); setNotes(''); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to stop work')
    },
  })

  const operatorLabel = activeEntry?.operatorStaffName ?? activeEntry?.hiredOperatorName ?? 'Unknown operator'
  const startedAt = activeEntry?.startTime ? new Date(activeEntry.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setEndMeter(''); setNotes(''); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Stop Work</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-green-50 rounded-lg px-3 py-2.5 text-sm space-y-0.5">
            <p className="font-medium text-green-800">{operatorLabel} — running since {startedAt}</p>
            {activeEntry?.startMeter != null && <p className="text-xs text-green-600">Start meter: {activeEntry.startMeter}</p>}
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">End Meter Reading *</Label>
            <Input type="number" step="0.01" placeholder="e.g. 1264.0" value={endMeter} onChange={e => setEndMeter(e.target.value)} />
            {endMeter && activeEntry?.startMeter != null && (
              <p className="text-xs text-gray-400 mt-1">
                Hours worked: <strong>{(Number(endMeter) - activeEntry.startMeter).toFixed(2)}</strong>
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Notes (optional)</Label>
            <Input placeholder="Any remarks…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => { setEndMeter(''); setNotes(''); onClose() }}>Cancel</Button>
            <Button disabled={!endMeter || mutation.isPending} onClick={() => mutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
              <Square size={13} /> {mutation.isPending ? 'Stopping…' : 'Stop Work'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Assign Division Dialog ────────────────────────────────────────────────────
function AssignDivisionDialog({ woId, clientId, assignment, open, onClose }: {
  woId: number; clientId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [divisionId, setDivisionId] = useState('')

  const { data: divRes } = useQuery({
    queryKey: ['client-divisions', clientId],
    queryFn: () => clientsApi.getDivisions(clientId),
    enabled: open && !!clientId,
  })
  const options = (divRes?.data ?? []).map(d => ({ value: String(d.id), label: d.name }))

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.assignDivision(woId, assignment!.id, divisionId ? Number(divisionId) : null),
    onSuccess: () => {
      toast.success(divisionId ? 'Division assigned' : 'Division removed')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      qc.invalidateQueries({ queryKey: ['work-entries', woId] })
      setDivisionId(''); onClose()
    },
    onError: () => toast.error('Failed to assign division'),
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setDivisionId(''); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Division</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-gray-500">
            Machine: <strong>{assignment?.serialNumber ?? `#${assignment?.equipmentId}`}</strong>
          </p>
          {options.length === 0 ? (
            <p className="text-sm text-gray-400 italic">This client has no divisions set up.</p>
          ) : (
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Division</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={divisionId || (assignment?.divisionId ? String(assignment.divisionId) : '')}
                onChange={e => setDivisionId(e.target.value)}
              >
                <option value="">— Select division —</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {assignment?.divisionId && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { setDivisionId(''); mutation.mutate() }}
                disabled={mutation.isPending}>
                Remove
              </Button>
            )}
            <Button className="flex-1 bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white"
              disabled={!divisionId || mutation.isPending || options.length === 0}
              onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Saving…' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Invoice Status Config ──────────────────────────────────────────────────────
const INV_STATUS_LABELS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIALLY_PAID: 'Partial', PAID: 'Paid', CANCELLED: 'Cancelled',
}
const INV_STATUS_COLORS: Record<EquipmentInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SENT: 'bg-blue-50 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700', PAID: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}
const INV_NEXT_STATUS: Partial<Record<EquipmentInvoiceStatus, EquipmentInvoiceStatus[]>> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED'],
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ── Invoices Tab ───────────────────────────────────────────────────────────────
function InvoicesTab({
  invoices, onCreateOpen, onStatusChange, onDelete,
}: {
  invoices: EquipmentInvoice[]
  onCreateOpen: () => void
  onStatusChange: (invId: number, status: EquipmentInvoiceStatus) => void
  onDelete: (invId: number) => void
}) {
  const { isEquipmentMode } = useSubscription()
  const navigate = useNavigate()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        <Button size="sm" className={btnPrimary} onClick={onCreateOpen}>
          <Plus size={14} className="mr-1" /> New Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
          <Receipt size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No invoices yet. Create one to bill the client.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => {
            const expanded = expandedId === inv.id
            const next = INV_NEXT_STATUS[inv.status] ?? []
            return (
              <div key={inv.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expanded ? null : inv.id)}
                >
                  <Receipt size={16} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button
                      className="text-sm font-medium text-feros-equip-sidebar hover:underline"
                      onClick={e => { e.stopPropagation(); navigate(`/equipment/invoices/${inv.id}`) }}
                    >
                      {inv.invoiceNumber}
                    </button>
                    <p className="text-xs text-gray-400">
                      {inv.invoiceDate}
                      {inv.billingPeriodStart && ` • ${inv.billingPeriodStart} → ${inv.billingPeriodEnd}`}
                    </p>
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', INV_STATUS_COLORS[inv.status])}>
                    {INV_STATUS_LABELS[inv.status]}
                  </span>
                  <p className="text-sm font-semibold text-gray-800 shrink-0">₹{fmt(inv.totalAmount ?? 0)}</p>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 space-y-3">
                    {/* Items */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 border-b border-gray-200">
                          <th className="text-left pb-1.5">Description</th>
                          <th className="text-center pb-1.5">Billing</th>
                          <th className="text-right pb-1.5">Qty</th>
                          <th className="text-right pb-1.5">Rate</th>
                          <th className="text-right pb-1.5">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.items.map(item => (
                          <tr key={item.id} className="border-b border-gray-100 last:border-0">
                            <td className="py-1.5 text-gray-700">
                              {item.description}
                              {item.serialNumber && <span className="text-gray-400 ml-1">({item.serialNumber})</span>}
                            </td>
                            <td className="py-1.5 text-center text-gray-500 text-xs">{item.billingType ?? '—'}</td>
                            <td className="py-1.5 text-right text-gray-700">{item.quantity}</td>
                            <td className="py-1.5 text-right text-gray-700">₹{fmt(item.rate)}</td>
                            <td className="py-1.5 text-right font-medium text-gray-800">₹{fmt(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Totals */}
                    <div className="text-sm text-right space-y-1">
                      <div className="text-gray-500">Subtotal: ₹{fmt(inv.subtotal ?? 0)}</div>
                      <div className="text-gray-500">Tax ({inv.taxPercent ?? 0}%): ₹{fmt(inv.taxAmount ?? 0)}</div>
                      <div className="font-semibold text-gray-800">Total: ₹{fmt(inv.totalAmount ?? 0)}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {next.map(s => (
                        <Button key={s} size="sm" variant="outline"
                          onClick={() => onStatusChange(inv.id, s)}
                          className="text-xs"
                        >
                          Mark {INV_STATUS_LABELS[s]}
                        </Button>
                      ))}
                      {inv.status === 'DRAFT' && (
                        <Button size="sm" variant="ghost"
                          onClick={() => onDelete(inv.id)}
                          className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
                        >
                          <Trash2 size={12} className="mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Edit WO Terms Dialog (KAN-16) ────────────────────────────────────────────
function EditTermsDialog({ woId, wo, open, onClose }: {
  woId: number; wo: import('@/types').WorkOrder; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'

  const [form, setForm] = useState({
    gstPercent: wo.gstPercent?.toString() ?? '',
    tdsPercent: wo.tdsPercent?.toString() ?? '',
    retentionPercent: wo.retentionPercent?.toString() ?? '',
    paymentTermsDays: wo.paymentTermsDays?.toString() ?? '',
    billingCycleMonths: wo.billingCycleMonths?.toString() ?? '',
    operatorByWhom: wo.operatorByWhom ?? '' as ProviderSide | '',
    dieselByWhom: wo.dieselByWhom ?? '' as ProviderSide | '',
    workingHoursPerDay: wo.workingHoursPerDay?.toString() ?? '',
    overtimeRateMultiplier: wo.overtimeRateMultiplier?.toString() ?? '',
    escalationClause: wo.escalationClause ?? '',
    penaltyClause: wo.penaltyClause ?? '',
    mobilizationCharge: wo.mobilizationCharge?.toString() ?? '',
    demobilizationCharge: wo.demobilizationCharge?.toString() ?? '',
    breakdownPenaltyThresholdHours: wo.breakdownPenaltyThresholdHours?.toString() ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: () => workOrdersApi.update(woId, {
      clientId: wo.clientId,
      site: wo.site,
      startDate: wo.startDate,
      endDate: wo.endDate,
      notes: wo.notes,
      mobilizationCharge: form.mobilizationCharge ? Number(form.mobilizationCharge) : undefined,
      demobilizationCharge: form.demobilizationCharge ? Number(form.demobilizationCharge) : undefined,
      gstPercent: form.gstPercent ? Number(form.gstPercent) : undefined,
      tdsPercent: form.tdsPercent ? Number(form.tdsPercent) : undefined,
      retentionPercent: form.retentionPercent ? Number(form.retentionPercent) : undefined,
      paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : undefined,
      billingCycleMonths: form.billingCycleMonths ? Number(form.billingCycleMonths) : undefined,
      operatorByWhom: form.operatorByWhom || undefined,
      dieselByWhom: form.dieselByWhom || undefined,
      workingHoursPerDay: form.workingHoursPerDay ? Number(form.workingHoursPerDay) : undefined,
      overtimeRateMultiplier: form.overtimeRateMultiplier ? Number(form.overtimeRateMultiplier) : undefined,
      escalationClause: form.escalationClause || undefined,
      penaltyClause: form.penaltyClause || undefined,
      breakdownPenaltyThresholdHours: form.breakdownPenaltyThresholdHours ? Number(form.breakdownPenaltyThresholdHours) : undefined,
    }),
    onSuccess: () => { toast.success('Terms updated'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); onClose() },
    onError: () => toast.error('Failed to update'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Commercial Terms</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-3">
            {[['GST %', 'gstPercent', '18'], ['TDS %', 'tdsPercent', '2'], ['Retention %', 'retentionPercent', '5']].map(([label, key, ph]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input type="number" step="0.01" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => set(key as keyof typeof form, e.target.value)} />
              </div>
            ))}
            {[['Payment Terms (days)', 'paymentTermsDays', '30'], ['Billing Cycle (months)', 'billingCycleMonths', '1'], ['Shift Hours / Day', 'workingHoursPerDay', '8']].map(([label, key, ph]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input type="number" placeholder={ph} value={form[key as keyof typeof form]} onChange={e => set(key as keyof typeof form, e.target.value)} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Operator By</Label>
              <Select value={form.operatorByWhom} onValueChange={v => set('operatorByWhom', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUR">Our Side</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Diesel By</Label>
              <Select value={form.dieselByWhom} onValueChange={v => set('dieselByWhom', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUR">Our Side</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>OT Rate Multiplier</Label>
              <Input type="number" step="0.1" placeholder="1.5" value={form.overtimeRateMultiplier} onChange={e => set('overtimeRateMultiplier', e.target.value)} />
            </div>
          </div>
          <div className="border-t pt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mobilization (₹)</Label>
              <Input type="number" step="0.01" placeholder="0" value={form.mobilizationCharge} onChange={e => set('mobilizationCharge', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Demobilization (₹)</Label>
              <Input type="number" step="0.01" placeholder="0" value={form.demobilizationCharge} onChange={e => set('demobilizationCharge', e.target.value)} />
            </div>
          </div>
          <div className="border-t pt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Escalation Clause</Label>
              <Input placeholder="e.g. 10% p.a. after 12 months" value={form.escalationClause} onChange={e => set('escalationClause', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Penalty / LD Clause</Label>
              <Input placeholder="e.g. ₹500/hr beyond 8hr downtime" value={form.penaltyClause} onChange={e => set('penaltyClause', e.target.value)} />
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="space-y-1.5">
              <Label>Breakdown Penalty Threshold (hrs)</Label>
              <Input type="number" placeholder="e.g. 8" value={form.breakdownPenaltyThresholdHours} onChange={e => set('breakdownPenaltyThresholdHours', e.target.value)} />
              <p className="text-xs text-gray-400">Downtime beyond this threshold auto-flags the service record for penalty review.</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className={btnPrimary}>
            {mut.isPending ? 'Saving…' : 'Save Terms'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Machine Terms Dialog (KAN-17/18) ─────────────────────────────────────────
function MachineTermsDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'

  const [form, setForm] = useState({
    hireType: assignment?.hireType ?? '' as HireType | '',
    guaranteedHours: assignment?.guaranteedHours?.toString() ?? '',
    overtimeRate: assignment?.overtimeRate?.toString() ?? '',
    dieselByWhom: assignment?.dieselByWhom ?? '' as ProviderSide | '',
    onHireDate: assignment?.onHireDate ?? '',
    offHireDate: assignment?.offHireDate ?? '',
    rateType: assignment?.rateType ?? '' as import('@/types').RateType | '',
    rateAmount: assignment?.rateAmount?.toString() ?? '',
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: () => workOrdersApi.addMachine(woId, {
      equipmentId: assignment!.equipmentId,
      hireType: form.hireType || undefined,
      guaranteedHours: form.guaranteedHours ? Number(form.guaranteedHours) : undefined,
      overtimeRate: form.overtimeRate ? Number(form.overtimeRate) : undefined,
      dieselByWhom: form.dieselByWhom || undefined,
      onHireDate: form.onHireDate || undefined,
      offHireDate: form.offHireDate || undefined,
      rateType: form.rateType || undefined,
      rateAmount: form.rateAmount ? Number(form.rateAmount) : undefined,
    }),
    onSuccess: () => { toast.success('Machine terms updated'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); onClose() },
    onError: () => toast.error('Failed to update'),
  })

  if (!assignment) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Machine Terms — {assignment.serialNumber ?? `#${assignment.equipmentId}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hire Type</Label>
              <Select value={form.hireType} onValueChange={v => set('hireType', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WET">Wet Hire</SelectItem>
                  <SelectItem value="DRY">Dry Hire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Diesel By</Label>
              <Select value={form.dieselByWhom} onValueChange={v => set('dieselByWhom', v)}>
                <SelectTrigger><SelectValue placeholder="Inherit from WO" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUR">Our Side</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rate Type</Label>
              <Select value={form.rateType} onValueChange={v => set('rateType', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY_SHIFT">Daily Shift</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rate Amount (₹)</Label>
              <Input type="number" placeholder="0" value={form.rateAmount} onChange={e => set('rateAmount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Guaranteed Hours / mo</Label>
              <Input type="number" placeholder="200" value={form.guaranteedHours} onChange={e => set('guaranteedHours', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>OT Rate (₹/hr)</Label>
              <Input type="number" placeholder="0" value={form.overtimeRate} onChange={e => set('overtimeRate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>On-Hire Date</Label>
              <Input type="date" value={form.onHireDate} onChange={e => set('onHireDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Off-Hire Date</Label>
              <Input type="date" value={form.offHireDate} onChange={e => set('offHireDate', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className={btnPrimary}>
            {mut.isPending ? 'Saving…' : 'Update Terms'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Swap Machine Dialog (KAN-20) ───────────────────────────────────────────────
function SwapMachineDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [newEquipmentId, setNewEquipmentId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')

  const { data: equipRes } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.getAll(),
    enabled: open,
  })
  const allEquip = (equipRes?.data ?? []).filter(e => String(e.id) !== String(assignment?.equipmentId))
  const options = allEquip.map(e => ({ value: String(e.id), label: eqLabel(e) }))

  const mut = useMutation({
    mutationFn: () => workOrdersApi.swapMachine(woId, assignment!.id, {
      newEquipmentId: Number(newEquipmentId),
      effectiveDate,
      reason: reason || undefined,
    }),
    onSuccess: () => {
      toast.success('Machine swapped — new assignment created')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
      setNewEquipmentId(''); setReason(''); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to swap machine')
    },
  })

  if (!assignment) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Swap Machine</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-500">Closes <strong>{assignment.serialNumber ?? `#${assignment.equipmentId}`}</strong> and opens a new assignment with the same terms.</p>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Replacement Machine *</Label>
            <SearchableSelect value={newEquipmentId} onValueChange={setNewEquipmentId} options={options} placeholder="Search available machines…" />
          </div>
          <div className="space-y-1.5">
            <Label>Effective Date *</Label>
            <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input placeholder="e.g. Breakdown — hydraulic failure" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!newEquipmentId || mut.isPending} className={btnPrimary}>
            {mut.isPending ? 'Swapping…' : 'Swap Machine'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Condition Survey Dialog (KAN-21) ──────────────────────────────────────────
function ConditionSurveyDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [surveyType, setSurveyType] = useState<'IN_SURVEY' | 'OUT_SURVEY'>('IN_SURVEY')
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10))
  const [hmr, setHmr] = useState('')
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [surveyedBy, setSurveyedBy] = useState('')

  const mut = useMutation({
    mutationFn: () => workOrdersApi.createSurvey(woId, assignment!.id, {
      surveyType, surveyDate,
      hmrAtSurvey: hmr ? Number(hmr) : undefined,
      conditionNotes: notes || undefined,
      photos: photos.length > 0 ? photos : undefined,
      surveyedBy: surveyedBy || undefined,
    }),
    onSuccess: () => {
      toast.success('Survey saved')
      qc.invalidateQueries({ queryKey: ['surveys', woId, assignment?.id] })
      setSurveyType('IN_SURVEY'); setSurveyDate(new Date().toISOString().slice(0, 10))
      setHmr(''); setNotes(''); setPhotos([]); setPhotoUrl(''); setSurveyedBy(''); onClose()
    },
    onError: () => toast.error('Failed to save survey'),
  })

  if (!assignment) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Condition Survey — {assignment.serialNumber ?? `#${assignment.equipmentId}`}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Survey Type *</Label>
              <Select value={surveyType} onValueChange={v => setSurveyType(v as typeof surveyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN_SURVEY">In-Survey (On-hire)</SelectItem>
                  <SelectItem value="OUT_SURVEY">Out-Survey (Off-hire)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Survey Date *</Label>
              <Input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>HMR at Survey</Label>
              <Input type="number" step="0.1" placeholder="e.g. 5432.5" value={hmr} onChange={e => setHmr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Surveyed By</Label>
              <Input placeholder="Name" value={surveyedBy} onChange={e => setSurveyedBy(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Condition Notes</Label>
            <Input placeholder="Describe machine condition…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Photo URLs <span className="text-gray-400 text-xs font-normal">(one at a time)</span></Label>
            <div className="flex gap-2">
              <Input placeholder="Paste uploaded photo URL" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} className="flex-1" />
              <Button type="button" variant="outline" onClick={() => { if (photoUrl.trim()) { setPhotos(p => [...p, photoUrl.trim()]); setPhotoUrl('') } }}>Add</Button>
            </div>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {photos.map((p, i) => (
                  <div key={i} className="flex items-center gap-1 bg-gray-50 border rounded px-2 py-1 text-xs text-gray-600">
                    <Camera size={10} />
                    <span className="max-w-[120px] truncate">{p.split('/').pop()}</span>
                    <button onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 ml-1">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className={btnPrimary}>
            {mut.isPending ? 'Saving…' : 'Save Survey'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Assign Attachment Dialog (KAN-13) ─────────────────────────────────────────
function AssignAttachmentDialog({ woId, assignment, open, onClose }: {
  woId: number; assignment: MachineAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [attachmentId, setAttachmentId] = useState<string>('')

  const { data } = useQuery({
    queryKey: ['eq-attachments'],
    queryFn: () => equipmentAttachmentsApi.getAll(),
    enabled: open,
  })
  const attachments = ((data?.data ?? []) as EquipmentAttachment[]).filter(a => a.isActive)

  const mut = useMutation({
    mutationFn: () => workOrdersApi.setAttachment(woId, assignment!.id, attachmentId ? Number(attachmentId) : null),
    onSuccess: () => { toast.success('Attachment updated'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); onClose() },
    onError: () => toast.error('Failed to update attachment'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Link Attachment</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-xs text-gray-500">Select an attachment to link to this machine line, or clear to unlink.</p>
          <SearchableSelect
            value={attachmentId || (assignment?.attachmentId ? String(assignment.attachmentId) : '')}
            onValueChange={setAttachmentId}
            options={[
              { value: '', label: '— None —' },
              ...attachments.map(a => ({
                value: String(a.id),
                label: `${a.name} · ${a.type}`,
              })),
            ]}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button className="flex-1 bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white"
            onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Detail Page ──────────────────────────────────────────────────────────
export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'

  const [tab, setTab] = useState<'machines' | 'sessions' | 'logs' | 'invoices'>('machines')
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [addMachineOpen, setAddMachineOpen] = useState(false)
  const [closingAssignment, setClosingAssignment] = useState<MachineAssignment | null>(null)
  const [addLogOpen, setAddLogOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null)
  const [deletingLogId, setDeletingLogId] = useState<number | null>(null)
  const [extendOpen, setExtendOpen] = useState(false)
  const [assigningOperatorFor, setAssigningOperatorFor] = useState<MachineAssignment | null>(null)
  const [assigningAttachmentFor, setAssigningAttachmentFor] = useState<MachineAssignment | null>(null)
  const [startingWorkFor, setStartingWorkFor] = useState<MachineAssignment | null>(null)
  const [stoppingWorkFor, setStoppingWorkFor] = useState<MachineAssignment | null>(null)
  const [assigningDivisionFor, setAssigningDivisionFor] = useState<MachineAssignment | null>(null)
  const [logsFrom, setLogsFrom]         = useState('')
  const [logsTo, setLogsTo]             = useState('')
  const [sessionsFrom, setSessionsFrom] = useState('')
  const [sessionsTo, setSessionsTo]     = useState('')
  // E2 dialog state
  const [editTermsOpen, setEditTermsOpen] = useState(false)
  const [machineTermsFor, setMachineTermsFor] = useState<MachineAssignment | null>(null)
  const [swapMachineFor, setSwapMachineFor] = useState<MachineAssignment | null>(null)
  const [surveyFor, setSurveyFor] = useState<MachineAssignment | null>(null)

  const { data: res, isLoading } = useQuery({
    queryKey: ['work-order', Number(id)],
    queryFn: () => workOrdersApi.getById(Number(id)),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: (status: WorkOrderStatus) => workOrdersApi.updateStatus(Number(id), status),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['work-order', Number(id)] }) },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to update status')
    },
  })

  const { data: sessionsRes } = useQuery({
    queryKey: ['work-entries', Number(id), sessionsFrom, sessionsTo],
    queryFn: () => workOrdersApi.getAllWorkEntries(Number(id), {
      from: sessionsFrom || undefined,
      to:   sessionsTo   || undefined,
    }),
    enabled: !!id && tab === 'sessions',
  })

  const convertToLogsMutation = useMutation({
    mutationFn: () => workOrdersApi.convertEntriesToLogs(Number(id)),
    onSuccess: (res) => {
      const count = res.data ?? 0
      toast.success(count > 0 ? `${count} daily log${count !== 1 ? 's' : ''} created` : 'All sessions already synced')
      qc.invalidateQueries({ queryKey: ['work-order', Number(id)] })
    },
    onError: () => toast.error('Failed to convert sessions'),
  })

  const { data: invoicesRes } = useQuery({
    queryKey: ['equip-invoices-by-wo', Number(id)],
    queryFn: () => equipmentInvoicesApi.getByWorkOrder(Number(id)),
    enabled: !!id && tab === 'invoices',
  })

  const invoiceStatusMutation = useMutation({
    mutationFn: ({ invId, status }: { invId: number; status: EquipmentInvoiceStatus }) =>
      equipmentInvoicesApi.updateStatus(invId, status),
    onSuccess: () => { toast.success('Invoice updated'); qc.invalidateQueries({ queryKey: ['equip-invoices-by-wo', Number(id)] }) },
    onError: () => toast.error('Failed to update invoice'),
  })

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invId: number) => equipmentInvoicesApi.delete(invId),
    onSuccess: () => { toast.success('Invoice deleted'); qc.invalidateQueries({ queryKey: ['equip-invoices-by-wo', Number(id)] }) },
    onError: () => toast.error('Failed to delete invoice'),
  })

  const deleteLogMutation = useMutation({
    mutationFn: (logId: number) => workOrdersApi.deleteLog(Number(id), logId),
    onSuccess: () => { toast.success('Log deleted'); qc.invalidateQueries({ queryKey: ['work-order', Number(id)] }) },
    onError: () => toast.error('Failed to delete log'),
  })

  const { data: amendmentsRes } = useQuery({
    queryKey: ['amendments', Number(id)],
    queryFn: () => workOrdersApi.getAmendments(Number(id)),
    enabled: !!id && tab === 'machines',
  })

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading…</div>
  if (!res?.data) return <div className="p-12 text-center text-gray-400">Work order not found</div>

  const { workOrder: wo, assignments, logs } = res.data
  const woStatus = wo.status as WorkOrderStatus
  const nextStatuses = NEXT_STATUSES[woStatus] ?? []
  const activeAssignments = assignments.filter(a => a.isActive)

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-equip-sidebar via-feros-equip-sidebar to-[#2d2000] rounded-xl overflow-hidden">
        {/* Ghost icon */}
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Construction size={180} />
        </div>
        <div className="relative px-6 py-6">
          {/* Top row: back + actions */}
          <div className="flex items-start justify-between gap-4">
            <button
              onClick={() => navigate('/equipment/work-orders')}
              className="flex items-center gap-1.5 text-[#c8a96e] hover:text-white text-sm transition-colors mt-0.5"
            >
              <ArrowLeft size={15} /> Work Orders
            </button>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {(woStatus === 'CONFIRMED' || woStatus === 'IN_PROGRESS') && (
                <Button size="sm" variant="outline" onClick={() => setExtendOpen(true)}
                  className="text-[#c8a96e] border-[#c8a96e]/40 hover:bg-white/10 bg-transparent gap-1.5">
                  <CalendarDays size={14} /> Extend
                </Button>
              )}
              {nextStatuses.map((s: WorkOrderStatus) => (
                <Button key={s} size="sm" variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(s)}
                  className={s === 'CANCELLED'
                    ? 'text-red-300 border-red-400/40 hover:bg-red-500/20 bg-transparent gap-1.5'
                    : 'text-white border-white/30 hover:bg-white/20 bg-white/10 gap-1.5'
                  }
                >
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>

          {/* WO identity */}
          <div className="mt-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white">{wo.woNumber}</h1>
              <Badge className={cn('text-xs', STATUS_COLORS[woStatus])}>{STATUS_LABELS[woStatus]}</Badge>
            </div>
            <p className="text-[#c8a96e] text-sm mt-1.5">
              {wo.clientName}{wo.site ? ` · ${wo.site}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Gauge size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Mobilization</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {wo.mobilizationCharge ? `₹${wo.mobilizationCharge.toLocaleString('en-IN')}` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">one-time charge</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <CalendarDays size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Period</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{wo.startDate}</p>
          {wo.endDate
            ? <p className="text-xs text-gray-400 mt-0.5">→ {wo.endDate}</p>
            : <p className="text-xs text-gray-400 mt-0.5">Open-ended</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Construction size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Machines</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{wo.machineCount} assigned</p>
          <p className="text-xs text-gray-400 mt-0.5">{activeAssignments.length} active</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <User size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Site</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{wo.site ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">location</p>
        </div>
      </div>

      {/* ── Commercial Terms Panel (KAN-16) ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-600">
            <FileText size={14} />
            <span className="text-xs font-semibold uppercase tracking-wide">Commercial Terms</span>
          </div>
          {!['COMPLETED', 'CANCELLED'].includes(woStatus) && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-feros-equip-sidebar"
              onClick={() => setEditTermsOpen(true)}>
              Edit
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-2 text-xs">
          {[
            ['GST', wo.gstPercent != null ? `${wo.gstPercent}%` : '—'],
            ['TDS', wo.tdsPercent != null ? `${wo.tdsPercent}%` : '—'],
            ['Retention', wo.retentionPercent != null ? `${wo.retentionPercent}%` : '—'],
            ['Payment Terms', wo.paymentTermsDays != null ? `${wo.paymentTermsDays} days` : '—'],
            ['Billing Cycle', wo.billingCycleMonths != null ? `${wo.billingCycleMonths} mo` : '—'],
            ['Shift', wo.workingHoursPerDay != null ? `${wo.workingHoursPerDay} hr/day` : '—'],
            ['Operator', wo.operatorByWhom ?? '—'],
            ['Diesel', wo.dieselByWhom ?? '—'],
            ['OT Rate', wo.overtimeRateMultiplier != null ? `${wo.overtimeRateMultiplier}×` : '—'],
            ['Escalation', wo.escalationClause ?? '—'],
            ['Penalty / LD', wo.penaltyClause ?? '—'],
            ['BD Penalty Threshold', wo.breakdownPenaltyThresholdHours != null ? `${wo.breakdownPenaltyThresholdHours} hrs` : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="text-gray-400 block">{label}</span>
              <span className="font-medium text-gray-700 truncate block">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'machines',  label: 'Machines', icon: <Wrench size={14} /> },
          { key: 'sessions',  label: 'Work Hours History', icon: <Timer size={14} /> },
          { key: 'logs',      label: 'Daily Logs', icon: <Activity size={14} /> },
          { key: 'invoices',  label: 'Invoices', icon: <Receipt size={14} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key ? 'border-feros-equip-sidebar text-feros-equip-sidebar' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Machines */}
      {tab === 'machines' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{assignments.length} machine{assignments.length !== 1 ? 's' : ''} assigned</p>
            <Button size="sm" onClick={() => setAddMachineOpen(true)} className={`${btnPrimary} gap-1.5`}>
              <Plus size={13} /> Assign Machine
            </Button>
          </div>
          {assignments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              No machines assigned yet
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {a.serialNumber ?? `Machine #${a.equipmentId}`}
                        <span className="text-gray-400 font-normal ml-2">· {a.equipmentTypeName}</span>
                        {a.makeName && <span className="text-gray-400 font-normal"> · {a.makeName} {a.modelName}</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        From {a.startDate}{a.endDate ? ` → ${a.endDate}` : ''}
                        {a.endReason && <span className="ml-2">({a.endReason.replace(/_/g, ' ')})</span>}
                        {a.rateAmount != null && (
                          <span className="ml-2 text-feros-equip-sidebar font-medium">
                            ₹{a.rateAmount.toLocaleString('en-IN')}/{a.rateType === 'HOURLY' ? 'hr' : a.rateType === 'DAILY_SHIFT' ? 'day' : 'mo'}
                          </span>
                        )}
                      </p>
                      {(a.onHireDate || a.offHireDate || a.guaranteedHours || a.swappedFromAssignmentId) && (
                        <p className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                          {a.onHireDate && <span>On-hire: {a.onHireDate}</span>}
                          {a.offHireDate && <span>Off-hire: {a.offHireDate}</span>}
                          {a.guaranteedHours && <span>Gtd: {a.guaranteedHours} hrs</span>}
                          {a.overtimeRate && <span>OT: ₹{a.overtimeRate}/hr</span>}
                          {a.swappedFromAssignmentId && <span className="text-amber-600">↔ Swapped (#{a.swappedFromAssignmentId})</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {a.hireType && (
                        <Badge className={a.hireType === 'WET' ? 'bg-blue-50 text-blue-700 text-[10px]' : 'bg-amber-50 text-amber-700 text-[10px]'}>
                          {a.hireType} Hire
                        </Badge>
                      )}
                      <Badge className={a.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {a.isActive ? 'Active' : 'Closed'}
                      </Badge>
                      {a.isActive && (
                        <>
                          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-feros-equip-sidebar"
                            onClick={() => setMachineTermsFor(a)}>
                            Terms
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-feros-equip-sidebar"
                            onClick={() => setSwapMachineFor(a)}>
                            <RefreshCw size={10} className="mr-0.5" /> Swap
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-feros-equip-sidebar"
                            onClick={() => setSurveyFor(a)}>
                            <Camera size={10} className="mr-0.5" /> Survey
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setClosingAssignment(a)}>
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Division row */}
                  <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin size={12} />
                      {a.divisionName
                        ? <span className="font-medium text-feros-equip-sidebar">{a.divisionName}</span>
                        : <span className="text-gray-400 italic">No division assigned</span>
                      }
                    </div>
                    {a.isActive && (
                      <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-feros-equip-sidebar"
                        onClick={() => setAssigningDivisionFor(a)}>
                        {a.divisionName ? 'Change' : 'Assign Division'}
                      </Button>
                    )}
                  </div>

                  {/* Attachment row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Boxes size={12} />
                      {a.attachmentName
                        ? <span className="font-medium text-gray-700">{a.attachmentName}{a.attachmentType ? ` · ${a.attachmentType}` : ''}</span>
                        : <span className="text-gray-400 italic">No attachment</span>}
                    </div>
                    {a.isActive && (
                      <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-feros-equip-sidebar"
                        onClick={() => setAssigningAttachmentFor(a)}>
                        {a.attachmentName ? 'Change' : 'Link Attachment'}
                      </Button>
                    )}
                  </div>

                  {/* Operator + work status row */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <User size={12} />
                        {a.operatorType === 'OWN_STAFF' && a.operatorStaffName
                          ? <span className="font-medium text-gray-700">{a.operatorStaffName}</span>
                          : a.operatorType === 'HIRED' && a.hiredOperatorName
                            ? <span className="font-medium text-gray-700">{a.hiredOperatorName} <span className="text-gray-400">(Hired)</span></span>
                            : <span className="text-gray-400 italic">No operator assigned</span>
                        }
                      </div>
                      {a.isActive && (
                        <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-feros-equip-sidebar"
                          onClick={() => setAssigningOperatorFor(a)}>
                          {a.operatorType ? 'Change' : 'Assign Operator'}
                        </Button>
                      )}
                    </div>
                    {/* Work entry status */}
                    {a.isActive && (
                      <div className="flex items-center justify-between">
                        {a.activeWorkEntry ? (
                          // State 3: Running
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Running
                            </span>
                            <span className="text-xs text-gray-500">
                              Machine is busy and running
                              {a.divisionName ? <> at <strong>{a.divisionName}</strong></> : ''}
                              {' · since '}
                              {new Date(a.activeWorkEntry.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : a.divisionId ? (
                          // State 2: Division assigned but not running
                          <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                            Busy · allocated to {a.divisionName}
                          </span>
                        ) : (
                          // State 1: No division assigned
                          <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                            Available for work
                          </span>
                        )}
                        {a.activeWorkEntry ? (
                          <Button size="sm" variant="outline" className="text-xs h-6 px-2 text-red-600 border-red-200 hover:bg-red-50 gap-1"
                            onClick={() => setStoppingWorkFor(a)}>
                            <Square size={10} /> Stop
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs h-6 px-2 text-green-700 border-green-200 hover:bg-green-50 gap-1"
                            disabled={!a.operatorType}
                            onClick={() => setStartingWorkFor(a)}>
                            <Play size={10} /> Start
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Amendments list (KAN-19) */}
          {amendmentsRes?.data && amendmentsRes.data.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Amendment Log</p>
              <div className="space-y-1.5">
                {amendmentsRes.data.map(am => (
                  <div key={am.id} className="flex items-start gap-3 text-xs text-gray-600">
                    <span className="mt-0.5 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                      {am.amendmentType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-gray-400">{am.effectiveDate}</span>
                    <span className="flex-1">{am.reason ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Daily Logs */}
      {tab === 'logs' && (() => {
        const filteredLogs = logs.filter(l =>
          (!logsFrom || l.logDate >= logsFrom) &&
          (!logsTo   || l.logDate <= logsTo)
        )
        return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <p className="text-sm text-gray-500">{filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={logsFrom} onChange={e => setLogsFrom(e.target.value)}
                className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-600" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="date" value={logsTo} onChange={e => setLogsTo(e.target.value)}
                className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-600" />
              {(logsFrom || logsTo) && (
                <button onClick={() => { setLogsFrom(''); setLogsTo('') }}
                  className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
              )}
              <Button size="sm" onClick={() => setAddLogOpen(true)} disabled={activeAssignments.length === 0}
                className={`${btnPrimary} gap-1.5`}>
                <Plus size={13} /> Add Log
              </Button>
            </div>
          </div>
          {filteredLogs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              No daily logs yet
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Machine</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">HMR Range</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Total Hrs</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Fuel (L)</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(l => (
                    <>
                      {/* Log header row */}
                      <tr key={l.id} className="border-b border-gray-100 bg-gray-50/50">
                        <td className="py-2.5 px-4 text-sm text-gray-700 font-medium">
                          <div className="flex items-center gap-1.5">
                            {l.logDate}
                            {l.source === 'AUTO' && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">Auto</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-gray-500">{l.serialNumber ?? `#${l.machineAssignmentId}`}</td>
                        <td className="py-2.5 px-4">
                          <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit', LOG_STATUS_COLORS[l.status])}>
                            {LOG_STATUS_ICONS[l.status]} {l.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right text-sm text-gray-600">
                          {l.startHourMeter != null && l.endHourMeter != null
                            ? `${l.startHourMeter} → ${l.endHourMeter}`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right text-sm font-semibold text-gray-800">{l.hoursWorked ?? '—'}</td>
                        <td className="py-2.5 px-4 text-right text-sm text-gray-600">{l.fuelConsumed ?? '—'}</td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {l.idleAttribution && (
                              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                l.idleAttribution === 'CLIENT_FAULT'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              )}>
                                {l.idleAttribution === 'CLIENT_FAULT' ? 'Client Fault' : 'Our Breakdown'}
                              </span>
                            )}
                            {l.signedSlipPhotoUrl && (
                              <a href={l.signedSlipPhotoUrl} target="_blank" rel="noreferrer"
                                className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="View signed slip">
                                <Camera size={13} />
                              </a>
                            )}
                            <button onClick={() => setEditingLog(l)}
                              className="p-1 text-gray-400 hover:text-feros-equip-sidebar rounded transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeletingLogId(l.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Division sub-rows */}
                      {(l.divisions ?? []).map((d, di) => (
                        <tr key={`${l.id}-div-${di}`} className="border-b border-gray-50 last:border-gray-100">
                          <td className="py-1.5 pl-8 pr-4 text-xs text-gray-400">└</td>
                          <td className="py-1.5 px-4 text-xs font-medium text-gray-600" colSpan={1}>
                            {d.divisionName ?? <span className="italic text-gray-400">No division</span>}
                          </td>
                          <td className="py-1.5 px-4" />
                          <td className="py-1.5 px-4 text-right text-xs text-gray-500">
                            {d.startHourMeter != null && d.endHourMeter != null
                              ? `${d.startHourMeter} → ${d.endHourMeter}`
                              : '—'}
                          </td>
                          <td className="py-1.5 px-4 text-right text-xs text-gray-600">{d.hoursWorked ?? '—'}</td>
                          <td className="py-1.5 px-4 text-xs text-gray-400 text-right" colSpan={2}>{d.notes ?? ''}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )
      })()}

      {/* Tab: Sessions */}
      {tab === 'sessions' && (() => {
        const entries = sessionsRes?.data ?? []
        const totalHours = entries.reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0)
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <p className="text-sm text-gray-500">
                {entries.length} session{entries.length !== 1 ? 's' : ''}
                {totalHours > 0 && <span className="ml-2 font-medium text-gray-700">· {totalHours.toFixed(2)} hrs total</span>}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={sessionsFrom} onChange={e => setSessionsFrom(e.target.value)}
                  className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-600" />
                <span className="text-gray-400 text-xs">→</span>
                <input type="date" value={sessionsTo} onChange={e => setSessionsTo(e.target.value)}
                  className="h-8 text-xs border border-gray-200 rounded-lg px-2 text-gray-600" />
                {(sessionsFrom || sessionsTo) && (
                  <button onClick={() => { setSessionsFrom(''); setSessionsTo('') }}
                    className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                )}
                {(sessionsRes?.data?.length ?? 0) > 0 && (
                  <Button size="sm" variant="outline"
                    className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5"
                    disabled={convertToLogsMutation.isPending}
                    onClick={() => convertToLogsMutation.mutate()}
                  >
                    <Activity size={13} />
                    {convertToLogsMutation.isPending ? 'Syncing…' : 'Sync to Daily Logs'}
                  </Button>
                )}
              </div>
            </div>
            {entries.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                No sessions recorded yet
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Machine</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Division</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Operator</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Start</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">End</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Start HMR</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">End HMR</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => {
                      const operatorLabel = e.operatorStaffName ?? e.hiredOperatorName ?? '—'
                      const startStr = new Date(e.startTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      const endStr = e.endTime ? new Date(e.endTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
                      return (
                        <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="py-2.5 px-4 text-sm text-gray-700">
                            {e.serialNumber ?? `#${e.machineAssignmentId}`}
                            {e.equipmentTypeName && <span className="text-xs text-gray-400 ml-1">· {e.equipmentTypeName}</span>}
                          </td>
                          <td className="py-2.5 px-4 text-sm text-gray-600">{e.divisionName ?? <span className="text-gray-300">—</span>}</td>
                          <td className="py-2.5 px-4 text-sm text-gray-600">{operatorLabel}</td>
                          <td className="py-2.5 px-4 text-xs text-gray-500">{startStr}</td>
                          <td className="py-2.5 px-4 text-xs text-gray-500">{endStr}</td>
                          <td className="py-2.5 px-4 text-right text-sm text-gray-600">{e.startMeter ?? '—'}</td>
                          <td className="py-2.5 px-4 text-right text-sm text-gray-600">{e.endMeter ?? '—'}</td>
                          <td className="py-2.5 px-4 text-right text-sm font-semibold text-gray-800">{e.hoursWorked != null ? e.hoursWorked.toFixed(2) : '—'}</td>
                          <td className="py-2.5 px-4">
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', e.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                              {e.status === 'ACTIVE' ? 'Running' : 'Done'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* Tab: Invoices */}
      {tab === 'invoices' && (
        <InvoicesTab
          invoices={invoicesRes?.data ?? []}
          onCreateOpen={() => setCreateInvoiceOpen(true)}
          onStatusChange={(invId, status) => invoiceStatusMutation.mutate({ invId, status })}
          onDelete={invId => deleteInvoiceMutation.mutate(invId)}
        />
      )}

      {/* Dialogs */}
      <AddMachineDialog woId={Number(id)} open={addMachineOpen} onClose={() => setAddMachineOpen(false)} />
      <CloseMachineDialog woId={Number(id)} assignment={closingAssignment} open={!!closingAssignment} onClose={() => setClosingAssignment(null)} />
      <AssignOperatorDialog woId={Number(id)} assignment={assigningOperatorFor} open={!!assigningOperatorFor} onClose={() => setAssigningOperatorFor(null)} />
      <AssignAttachmentDialog woId={Number(id)} assignment={assigningAttachmentFor} open={!!assigningAttachmentFor} onClose={() => setAssigningAttachmentFor(null)} />
      <AssignDivisionDialog woId={Number(id)} clientId={wo.clientId} assignment={assigningDivisionFor} open={!!assigningDivisionFor} onClose={() => setAssigningDivisionFor(null)} />
      <StartWorkDialog woId={Number(id)} assignment={startingWorkFor} open={!!startingWorkFor} onClose={() => setStartingWorkFor(null)} />
      <StopWorkDialog woId={Number(id)} assignment={stoppingWorkFor} open={!!stoppingWorkFor} onClose={() => setStoppingWorkFor(null)} />
      <AddLogDialog woId={Number(id)} clientId={wo.clientId} assignments={activeAssignments} open={addLogOpen} onClose={() => setAddLogOpen(false)} />
      <EditLogDialog woId={Number(id)} clientId={wo.clientId} log={editingLog} open={!!editingLog} onClose={() => setEditingLog(null)} />
      <ExtendDialog woId={Number(id)} currentEndDate={res?.data?.workOrder.endDate} open={extendOpen} onClose={() => setExtendOpen(false)} />
      <CreateEquipmentInvoiceDialog defaultClientId={wo.clientId} defaultClientName={wo.clientName} open={createInvoiceOpen} onClose={() => setCreateInvoiceOpen(false)} />
      {/* E2 dialogs */}
      <EditTermsDialog woId={Number(id)} wo={wo} open={editTermsOpen} onClose={() => setEditTermsOpen(false)} />
      <MachineTermsDialog woId={Number(id)} assignment={machineTermsFor} open={!!machineTermsFor} onClose={() => setMachineTermsFor(null)} />
      <SwapMachineDialog woId={Number(id)} assignment={swapMachineFor} open={!!swapMachineFor} onClose={() => setSwapMachineFor(null)} />
      <ConditionSurveyDialog woId={Number(id)} assignment={surveyFor} open={!!surveyFor} onClose={() => setSurveyFor(null)} />

      <Dialog open={deletingLogId !== null} onOpenChange={(open: boolean) => !open && setDeletingLogId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this log?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeletingLogId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteLogMutation.isPending}
              onClick={() => { deleteLogMutation.mutate(deletingLogId!); setDeletingLogId(null) }}>
              {deleteLogMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
