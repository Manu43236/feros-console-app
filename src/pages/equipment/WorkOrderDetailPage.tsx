import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSubscription } from '@/context/SubscriptionContext'
import { workOrdersApi } from '@/api/workOrders'
import { equipmentApi } from '@/api/equipment'
import type { Equipment } from '@/api/equipment'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Wrench, Activity, ReceiptText,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Construction, CalendarDays, Gauge, User, Play, Square, MapPin, Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { staffApi } from '@/api/staff'
import { clientsApi } from '@/api/clients'
import type { WorkOrderStatus, DailyLogStatus, AssignmentEndReason, MachineAssignment, OperatorType, WorkEntry } from '@/types'
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

function fmt(n?: number | null) {
  if (n == null) return '—'
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

// ── Add Machine Dialog ─────────────────────────────────────────────────────────
function eqLabel(e: Equipment) {
  const reg = e.registrationNumber ?? e.serialNumber ?? `#${e.id}`
  return `${reg} — ${e.makeName} ${e.modelName} (${e.equipmentTypeName})`
}

function AddMachineDialog({ woId, open, onClose }: { woId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [equipmentId, setEquipmentId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: equipRes } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.getAll(),
    enabled: open,
  })
  const options = (equipRes?.data ?? []).map(e => ({ value: String(e.id), label: eqLabel(e) }))

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.addMachine(woId, { equipmentId: Number(equipmentId), startDate }),
    onSuccess: () => {
      toast.success('Machine assigned')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
      setEquipmentId(''); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to assign machine')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setEquipmentId(''); onClose() } }}>
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
          </div>
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
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
function AddLogDialog({ woId, assignments, open, onClose }: {
  woId: number; assignments: MachineAssignment[]; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'
  const [form, setForm] = useState({
    machineAssignmentId: assignments[0]?.id ?? '',
    logDate: new Date().toISOString().slice(0, 10),
    status: 'WORKING' as DailyLogStatus,
    startHourMeter: '', endHourMeter: '', fuelConsumed: '', notes: '',
  })

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.addLog(woId, {
      machineAssignmentId: Number(form.machineAssignmentId),
      logDate: form.logDate,
      status: form.status,
      startHourMeter: form.startHourMeter ? Number(form.startHourMeter) : undefined,
      endHourMeter: form.endHourMeter ? Number(form.endHourMeter) : undefined,
      fuelConsumed: form.fuelConsumed ? Number(form.fuelConsumed) : undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => { toast.success('Log added'); qc.invalidateQueries({ queryKey: ['work-order', woId] }); onClose() },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to add log')
    },
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Daily Log</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Machine</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.machineAssignmentId} onChange={set('machineAssignmentId')}>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>{a.serialNumber ?? `Machine #${a.equipmentId}`} ({a.equipmentTypeName})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.logDate} onChange={set('logDate')} />
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
          {form.status === 'WORKING' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Start HM</Label>
                <Input type="number" step="0.01" placeholder="1200.5" value={form.startHourMeter} onChange={set('startHourMeter')} />
              </div>
              <div className="space-y-1.5">
                <Label>End HM</Label>
                <Input type="number" step="0.01" placeholder="1208.5" value={form.endHourMeter} onChange={set('endHourMeter')} />
              </div>
              <div className="space-y-1.5">
                <Label>Fuel (L)</Label>
                <Input type="number" step="0.01" placeholder="45" value={form.fuelConsumed} onChange={set('fuelConsumed')} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Any remarks…" value={form.notes} onChange={set('notes')} />
          </div>
          <div className="flex justify-end gap-3">
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

  // Pre-fill from existing assignment operator
  const prefilled = assignment?.operatorType
  const preStaffId = assignment?.operatorStaffId ? String(assignment.operatorStaffId) : ''
  const preHiredName = assignment?.hiredOperatorName ?? ''

  function reset() { setOperatorType('OWN_STAFF'); setStaffId(''); setHiredName(''); setStartMeter('') }

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

// ── Main Detail Page ──────────────────────────────────────────────────────────
export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'

  const [tab, setTab] = useState<'machines' | 'logs' | 'sessions' | 'billing'>('machines')
  const [addMachineOpen, setAddMachineOpen] = useState(false)
  const [closingAssignment, setClosingAssignment] = useState<MachineAssignment | null>(null)
  const [addLogOpen, setAddLogOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [assigningOperatorFor, setAssigningOperatorFor] = useState<MachineAssignment | null>(null)
  const [startingWorkFor, setStartingWorkFor] = useState<MachineAssignment | null>(null)
  const [stoppingWorkFor, setStoppingWorkFor] = useState<MachineAssignment | null>(null)
  const [assigningDivisionFor, setAssigningDivisionFor] = useState<MachineAssignment | null>(null)

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
    queryKey: ['work-entries', Number(id)],
    queryFn: () => workOrdersApi.getAllWorkEntries(Number(id)),
    enabled: !!id && tab === 'sessions',
  })

  const deleteLogMutation = useMutation({
    mutationFn: (logId: number) => workOrdersApi.deleteLog(Number(id), logId),
    onSuccess: () => { toast.success('Log deleted'); qc.invalidateQueries({ queryKey: ['work-order', Number(id)] }) },
    onError: () => toast.error('Failed to delete log'),
  })

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading…</div>
  if (!res?.data) return <div className="p-12 text-center text-gray-400">Work order not found</div>

  const { workOrder: wo, assignments, logs, billing } = res.data
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
            <span className="text-xs font-medium uppercase tracking-wide">Rate</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">₹{wo.rateAmount.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {wo.rateType === 'HOURLY' ? 'per hour' : wo.rateType === 'DAILY_SHIFT' ? `per shift${wo.shiftHours ? ` (${wo.shiftHours}h)` : ''}` : 'per month'}
          </p>
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
            <span className="text-xs font-medium uppercase tracking-wide">Operator</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {wo.operatorType
              ? wo.operatorType === 'OWN_STAFF' ? (wo.operatorStaffName ?? 'Own Staff')
                : wo.operatorType === 'HIRED' ? (wo.hiredOperatorName ?? 'Hired')
                : 'Client Provided'
              : '—'}
          </p>
          {wo.operatorBilling === 'BILLED_SEPARATELY' && wo.operatorRatePerDay &&
            <p className="text-xs text-gray-400 mt-0.5">₹{wo.operatorRatePerDay}/day</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'machines',  label: 'Machines', icon: <Wrench size={14} /> },
          { key: 'logs',      label: 'Daily Logs', icon: <Activity size={14} /> },
          { key: 'sessions',  label: 'Sessions', icon: <Timer size={14} /> },
          { key: 'billing',   label: 'Billing', icon: <ReceiptText size={14} /> },
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
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={a.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {a.isActive ? 'Active' : 'Closed'}
                      </Badge>
                      {a.isActive && (
                        <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setClosingAssignment(a)}>
                          Remove
                        </Button>
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
        </div>
      )}

      {/* Tab: Daily Logs */}
      {tab === 'logs' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{logs.length} log{logs.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setAddLogOpen(true)} disabled={activeAssignments.length === 0}
              className={`${btnPrimary} gap-1.5`}>
              <Plus size={13} /> Add Log
            </Button>
          </div>
          {logs.length === 0 ? (
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
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Start HM</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">End HM</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Hours</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Fuel (L)</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 px-4 text-sm text-gray-700">{l.logDate}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{l.serialNumber ?? `#${l.machineAssignmentId}`}</td>
                      <td className="py-2.5 px-4">
                        <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit', LOG_STATUS_COLORS[l.status])}>
                          {LOG_STATUS_ICONS[l.status]} {l.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-sm text-gray-600">{l.startHourMeter ?? '—'}</td>
                      <td className="py-2.5 px-4 text-right text-sm text-gray-600">{l.endHourMeter ?? '—'}</td>
                      <td className="py-2.5 px-4 text-right text-sm font-medium text-gray-800">{l.hoursWorked ?? '—'}</td>
                      <td className="py-2.5 px-4 text-right text-sm text-gray-600">{l.fuelConsumed ?? '—'}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button onClick={() => { if (confirm('Delete this log?')) deleteLogMutation.mutate(l.id) }}
                          className="text-xs text-gray-400 hover:text-red-500">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Sessions */}
      {tab === 'sessions' && (() => {
        const entries = sessionsRes?.data ?? []
        const totalHours = entries.reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0)
        return (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                {entries.length} session{entries.length !== 1 ? 's' : ''}
                {totalHours > 0 && <span className="ml-2 font-medium text-gray-700">· {totalHours.toFixed(2)} hrs total</span>}
              </p>
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

      {/* Tab: Billing */}
      {tab === 'billing' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 max-w-md space-y-4">
          <p className="text-sm font-semibold text-gray-700">Billing Preview</p>
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Preview only — actual invoice generated in Phase 5
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Machine Rental</span>
              <span className="font-medium">{fmt(billing.machineRentalAmount)}</span>
            </div>
            {billing.operatorAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Operator Charges</span>
                <span className="font-medium">{fmt(billing.operatorAmount)}</span>
              </div>
            )}
            {billing.mobilizationCharge > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Mobilization</span>
                <span className="font-medium">{fmt(billing.mobilizationCharge)}</span>
              </div>
            )}
            {billing.demobilizationCharge > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">De-mobilization</span>
                <span className="font-medium">{fmt(billing.demobilizationCharge)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-semibold text-gray-900">
              <span>Total</span>
              <span>{fmt(billing.totalAmount)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs text-gray-500">
            <div>Working Days: <strong className="text-gray-700">{billing.totalWorkingDays}</strong></div>
            {billing.totalHours != null && <div>Total Hours: <strong className="text-gray-700">{billing.totalHours}</strong></div>}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddMachineDialog woId={Number(id)} open={addMachineOpen} onClose={() => setAddMachineOpen(false)} />
      <CloseMachineDialog woId={Number(id)} assignment={closingAssignment} open={!!closingAssignment} onClose={() => setClosingAssignment(null)} />
      <AssignOperatorDialog woId={Number(id)} assignment={assigningOperatorFor} open={!!assigningOperatorFor} onClose={() => setAssigningOperatorFor(null)} />
      <AssignDivisionDialog woId={Number(id)} clientId={wo.clientId} assignment={assigningDivisionFor} open={!!assigningDivisionFor} onClose={() => setAssigningDivisionFor(null)} />
      <StartWorkDialog woId={Number(id)} assignment={startingWorkFor} open={!!startingWorkFor} onClose={() => setStartingWorkFor(null)} />
      <StopWorkDialog woId={Number(id)} assignment={stoppingWorkFor} open={!!stoppingWorkFor} onClose={() => setStoppingWorkFor(null)} />
      <AddLogDialog woId={Number(id)} assignments={activeAssignments} open={addLogOpen} onClose={() => setAddLogOpen(false)} />
      <ExtendDialog woId={Number(id)} currentEndDate={res?.data?.workOrder.endDate} open={extendOpen} onClose={() => setExtendOpen(false)} />
    </div>
  )
}
