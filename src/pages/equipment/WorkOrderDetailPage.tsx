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
  CheckCircle2, XCircle, AlertTriangle, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WorkOrderStatus, DailyLogStatus, AssignmentEndReason, MachineAssignment } from '@/types'
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
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ id: number; label: string } | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: equipRes } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.getAll(),
    enabled: open,
  })
  const allEquipment = equipRes?.data ?? []
  const q = search.toLowerCase()
  const filtered = allEquipment.filter(e =>
    (e.registrationNumber ?? '').toLowerCase().includes(q) ||
    (e.serialNumber ?? '').toLowerCase().includes(q) ||
    (e.equipmentTypeName ?? '').toLowerCase().includes(q)
  )

  const mutation = useMutation({
    mutationFn: () => workOrdersApi.addMachine(woId, { equipmentId: selected!.id, startDate }),
    onSuccess: () => {
      toast.success('Machine assigned')
      qc.invalidateQueries({ queryKey: ['work-order', woId] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
      setSelected(null); setSearch(''); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to assign machine')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setSelected(null); setSearch(''); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Machine</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Machine</Label>
            {selected ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-gray-50 text-sm">
                <span className="flex-1 text-gray-800">{selected.label}</span>
                <button onClick={() => { setSelected(null); setSearch('') }} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input placeholder="Search by reg. number, serial…" value={search} onChange={e => setSearch(e.target.value)} />
                {search && (
                  <div className="border rounded-md max-h-44 overflow-y-auto bg-white shadow-sm">
                    {filtered.length === 0 ? (
                      <p className="text-xs text-gray-400 p-3">No machines found</p>
                    ) : filtered.map(e => (
                      <button key={e.id} onClick={() => { setSelected({ id: e.id, label: eqLabel(e) }); setSearch('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0">
                        {eqLabel(e)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!selected || mutation.isPending} onClick={() => mutation.mutate()} className={btnPrimary}>
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

// ── Main Detail Page ──────────────────────────────────────────────────────────
export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white' : 'bg-feros-navy hover:bg-feros-navy/90 text-white'

  const [tab, setTab] = useState<'machines' | 'logs' | 'billing'>('machines')
  const [addMachineOpen, setAddMachineOpen] = useState(false)
  const [closingAssignment, setClosingAssignment] = useState<MachineAssignment | null>(null)
  const [addLogOpen, setAddLogOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)

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
      {/* Back */}
      <button onClick={() => navigate('/equipment/work-orders')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={15} /> Work Orders
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-400">{wo.woNumber}</span>
              <Badge className={cn('text-xs', STATUS_COLORS[woStatus])}>{STATUS_LABELS[woStatus]}</Badge>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{wo.clientName}</h1>
            {wo.site && <p className="text-sm text-gray-500 mt-0.5">{wo.site}</p>}
          </div>
          {/* Status actions */}
          <div className="flex gap-2 flex-wrap justify-end">
            {(woStatus === 'CONFIRMED' || woStatus === 'IN_PROGRESS') && (
              <Button size="sm" variant="outline" onClick={() => setExtendOpen(true)}>
                Extend
              </Button>
            )}
            {nextStatuses.map((s: WorkOrderStatus) => (
              <Button key={s} size="sm" variant={s === 'CANCELLED' ? 'outline' : 'default'}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
                className={s !== 'CANCELLED' ? btnPrimary : 'text-red-600 border-red-200 hover:bg-red-50'}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Rate</p>
            <p className="font-medium text-gray-800">₹{wo.rateAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400">
              {wo.rateType === 'HOURLY' ? '/hr' : wo.rateType === 'DAILY_SHIFT' ? '/shift' : '/month'}
              {wo.rateType === 'DAILY_SHIFT' && wo.shiftHours && ` (${wo.shiftHours}h shift)`}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Period</p>
            <p className="font-medium text-gray-800">{wo.startDate}</p>
            {wo.endDate && <p className="text-xs text-gray-400">→ {wo.endDate}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Machines</p>
            <p className="font-medium text-gray-800">{wo.machineCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Operator</p>
            <p className="font-medium text-gray-800">
              {wo.operatorType
                ? wo.operatorType === 'OWN_STAFF' ? (wo.operatorStaffName ?? 'Own Staff')
                  : wo.operatorType === 'HIRED' ? (wo.hiredOperatorName ?? 'Hired')
                  : 'Client Provided'
                : '—'}
            </p>
            {wo.operatorBilling === 'BILLED_SEPARATELY' && wo.operatorRatePerDay &&
              <p className="text-xs text-gray-400">₹{wo.operatorRatePerDay}/day</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'machines', label: 'Machines', icon: <Wrench size={14} /> },
          { key: 'logs',     label: 'Daily Logs', icon: <Activity size={14} /> },
          { key: 'billing',  label: 'Billing', icon: <ReceiptText size={14} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
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
                <div key={a.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between">
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
      <AddLogDialog woId={Number(id)} assignments={activeAssignments} open={addLogOpen} onClose={() => setAddLogOpen(false)} />
      <ExtendDialog woId={Number(id)} currentEndDate={res?.data?.workOrder.endDate} open={extendOpen} onClose={() => setExtendOpen(false)} />
    </div>
  )
}
