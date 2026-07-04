import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Info, TrendingUp, Gauge, Droplets,
  ClipboardList, FileText, AlertTriangle, ChevronRight,
  Plus, Pencil, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { equipmentApi } from '@/api/equipment'
import { machinesApi } from '@/api/machines'
import type { Equipment, EquipmentWorkStatus, EquipmentFuelLog, EquipmentFuelLogRequest, EquipmentMeterReading, EquipmentMeterReadingRequest } from '@/api/equipment'
import type { MachineAssignmentHistory, MachineDailyLog, MachineInvoiceItem } from '@/api/machines'

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}
function fmtMoney(n?: number | null) {
  return n != null ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'
}
function fmtN(n?: number | null, decimals = 2) {
  return n != null ? Number(n).toFixed(decimals) : '—'
}

// ── InfoRow ───────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

// ── Work status badge ─────────────────────────────────────────────────────────
const WORK_STATUS: Record<EquipmentWorkStatus, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Available',  cls: 'bg-green-100 text-green-700' },
  ASSIGNED:  { label: 'Assigned',   cls: 'bg-blue-100 text-blue-700' },
  BUSY:      { label: 'Busy',       cls: 'bg-orange-100 text-orange-700' },
  BREAKDOWN: { label: 'Breakdown',  cls: 'bg-red-100 text-red-700' },
  IN_REPAIR: { label: 'In Repair',  cls: 'bg-yellow-100 text-yellow-700' },
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ['Basic Info', 'Utilization', 'HMR', 'Fuel', 'WO History', 'Billings'] as const
type Tab = typeof TABS[number]

function tabIcon(t: Tab) {
  if (t === 'Basic Info')  return <Info size={14} />
  if (t === 'Utilization') return <TrendingUp size={14} />
  if (t === 'HMR')         return <Gauge size={14} />
  if (t === 'Fuel')        return <Droplets size={14} />
  if (t === 'WO History')  return <ClipboardList size={14} />
  if (t === 'Billings')    return <FileText size={14} />
}

// ── Date filter bar ───────────────────────────────────────────────────────────
function DateFilter({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">From</span>
        <Input type="date" value={from} onChange={e => onFrom(e.target.value)} className="h-8 text-xs w-36" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">To</span>
        <Input type="date" value={to} onChange={e => onTo(e.target.value)} className="h-8 text-xs w-36" />
      </div>
      {(from || to) && (
        <button onClick={() => { onFrom(''); onTo('') }} className="text-xs text-gray-400 hover:text-gray-600 underline">
          Clear
        </button>
      )}
    </div>
  )
}

// ── Basic Info Tab ────────────────────────────────────────────────────────────
function BasicInfoTab({ m }: { m: Equipment }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Machine details */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Machine Details</p>
          <InfoRow label="Make"             value={m.makeName} />
          <InfoRow label="Model"            value={m.modelName} />
          <InfoRow label="Equipment Type"   value={m.equipmentTypeName} />
          <InfoRow label="Meter Type"       value={m.meterType} />
          <InfoRow label="Current Meter"    value={m.currentMeterReading != null ? `${m.currentMeterReading} hrs` : null} />
          <InfoRow label="Fuel Type"        value={m.fuelType} />
          <InfoRow label="Fuel Tank"        value={m.fuelTankCapacity != null ? `${m.fuelTankCapacity} L` : null} />
          {m.capacity != null && (
            <InfoRow label="Capacity" value={`${m.capacity}${m.capacityUnit ?? ''}`} />
          )}
          <InfoRow label="Work Status"      value={WORK_STATUS[m.workStatus]?.label ?? m.workStatus} />
          <InfoRow label="Active"           value={m.isActive ? 'Yes' : 'No'} />
        </div>

        {/* Identification */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identification</p>
          <InfoRow label="Serial Number"      value={m.serialNumber} />
          <InfoRow label="Reg. Number"        value={m.registrationNumber} />
          <InfoRow label="Chassis Number"     value={m.chassisNumber} />
          <InfoRow label="Engine Number"      value={m.engineNumber} />
          <InfoRow label="Manufacture Year"   value={m.manufactureYear} />
          <InfoRow label="Color"              value={m.color} />
          <InfoRow label="Ownership"          value={m.ownershipType === 'OWNED' ? 'Owned' : 'Hired In'} />
        </div>
      </div>

      {/* Finance / Hire details */}
      {m.ownershipType === 'OWNED' && m.isFinanced && (
        <div className="border-t pt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Finance Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <InfoRow label="Financer"        value={m.financerName} />
            <InfoRow label="Finance Start"   value={fmtDate(m.financeStartDate)} />
            <InfoRow label="Finance End"     value={fmtDate(m.financeEndDate)} />
          </div>
        </div>
      )}
      {m.ownershipType === 'HIRED_IN' && (
        <div className="border-t pt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Hire Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <InfoRow label="Hired From"   value={m.hiredFrom} />
            <InfoRow label="Hire Start"   value={fmtDate(m.hireStartDate)} />
            <InfoRow label="Hire End"     value={fmtDate(m.hireEndDate)} />
            <InfoRow label="Hire Rate"    value={m.hireRate != null ? fmtMoney(m.hireRate) : null} />
            <InfoRow label="Rate Unit"    value={m.hireRateUnit?.replace('PER_', 'Per ').toLowerCase().replace(/^\w/, c => c.toUpperCase())} />
          </div>
        </div>
      )}

      {m.notes && (
        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
          <p className="text-sm text-gray-700">{m.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Utilization Tab ───────────────────────────────────────────────────────────
function UtilizationTab({ logs, from, to, onFrom, onTo }: { logs: MachineDailyLog[]; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const workingDays = logs.length
  const totalHours  = logs.reduce((s, l) => s + (l.hoursWorked ?? 0), 0)
  const calendarDays = (from && to)
    ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)
    : workingDays
  const deploymentRate = calendarDays > 0 ? (workingDays / calendarDays) * 100 : 0
  const workIntensity  = workingDays > 0 ? totalHours / workingDays : 0

  return (
    <div className="space-y-5">
      <DateFilter from={from} to={to} onFrom={onFrom} onTo={onTo} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Deployment Rate</p>
          <p className="text-xl font-bold text-blue-700">{deploymentRate.toFixed(1)}%</p>
          <p className="text-xs text-blue-400 mt-0.5">{workingDays} / {calendarDays} days</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
          <p className="text-xs text-green-500 font-semibold uppercase tracking-wide mb-1">Work Intensity</p>
          <p className="text-xl font-bold text-green-700">{workIntensity.toFixed(1)} hrs</p>
          <p className="text-xs text-green-400 mt-0.5">avg per working day</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
          <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-1">Total Hours</p>
          <p className="text-xl font-bold text-orange-700">{totalHours.toFixed(1)} hrs</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Working Days</p>
          <p className="text-xl font-bold text-gray-700">{workingDays}</p>
          <p className="text-xs text-gray-400 mt-0.5">days with logs</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <TrendingUp size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No logs for this period</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'WO#', 'Start HMR', 'End HMR', 'Hours Worked', 'Fuel (L)'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-700">{fmtDate(l.logDate)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{l.woNumber ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtN(l.startHourMeter)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtN(l.endHourMeter)}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{fmtN(l.hoursWorked)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtN(l.fuelConsumed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── HMR Tab ───────────────────────────────────────────────────────────────────
function MeterReadingDialog({
  open, onClose, equipmentId, editing,
}: { open: boolean; onClose: () => void; equipmentId: number; editing: EquipmentMeterReading | null }) {
  const qc = useQueryClient()
  const blank: EquipmentMeterReadingRequest = { readingDate: '', readingValue: 0 }
  const [form, setForm] = useState<EquipmentMeterReadingRequest>(blank)

  useMemo(() => {
    if (open) setForm(editing
      ? { readingDate: editing.readingDate, readingValue: editing.readingValue, notes: editing.notes ?? undefined }
      : blank)
  }, [open, editing])

  const set = (k: keyof EquipmentMeterReadingRequest, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: () => editing
      ? equipmentApi.updateMeterReading(equipmentId, editing.id, form)
      : equipmentApi.addMeterReading(equipmentId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-meter-readings', equipmentId] }); toast.success(editing ? 'Reading updated' : 'Reading added'); onClose() },
    onError: () => toast.error('Failed to save reading'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{editing ? 'Edit Meter Reading' : 'Add Meter Reading'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Date *</Label>
            <Input type="date" className="mt-1" value={form.readingDate} onChange={e => set('readingDate', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">HMR Reading *</Label>
            <Input type="number" step="0.01" min={0} className="mt-1" value={form.readingValue || ''} onChange={e => set('readingValue', Number(e.target.value))} placeholder="e.g. 2450.5" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input className="mt-1" value={form.notes ?? ''} onChange={e => set('notes', e.target.value || undefined)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white" onClick={() => mut.mutate()} disabled={!form.readingDate || !form.readingValue || mut.isPending}>
            {mut.isPending ? 'Saving…' : editing ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HmrTab({ equipmentId, logs }: { equipmentId: number; logs: MachineDailyLog[] }) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentMeterReading | null>(null)

  const { data } = useQuery({
    queryKey: ['eq-meter-readings', equipmentId],
    queryFn: () => equipmentApi.getMeterReadings(equipmentId),
  })
  const readings = (data?.data ?? []) as EquipmentMeterReading[]

  const delMut = useMutation({
    mutationFn: (readingId: number) => equipmentApi.deleteMeterReading(equipmentId, readingId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-meter-readings', equipmentId] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  // Daily log HMR data (from work sessions) — read-only reference
  const sorted = [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate))

  return (
    <div className="space-y-6">
      {/* ── Manual Meter Readings (CRUD) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Manual Readings</p>
          <Button size="sm" className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1.5"
            onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus size={14} /> Add Reading
          </Button>
        </div>
        {readings.length === 0 ? (
          <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <Gauge size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No manual readings yet</p>
          </div>
        ) : (
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'HMR Reading', 'Notes', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {readings.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(r.readingDate)}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{fmtN(r.readingValue)} hrs</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.notes ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditing(r); setDialogOpen(true) }} className="text-gray-400 hover:text-gray-700"><Pencil size={13} /></button>
                        <button onClick={() => { if (confirm('Delete this reading?')) delMut.mutate(r.id) }} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── HMR from Daily Logs (read-only reference) ── */}
      {sorted.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">From Daily Work Logs</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'WO#', 'Start HMR', 'End HMR', 'Hours', 'Continuity'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((l, i) => {
                  const prev = sorted[i - 1]
                  const gap = prev?.endHourMeter != null && l.startHourMeter != null
                    ? Math.abs(l.startHourMeter - prev.endHourMeter) : null
                  const hasGap = gap != null && gap > 0.01
                  return (
                    <tr key={l.id} className={cn('hover:bg-gray-50 transition-colors', hasGap && 'bg-amber-50/40')}>
                      <td className="px-4 py-2.5 text-gray-700">{fmtDate(l.logDate)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{l.woNumber ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtN(l.startHourMeter)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmtN(l.endHourMeter)}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{fmtN(l.hoursWorked)}</td>
                      <td className="px-4 py-2.5">
                        {i === 0 ? <span className="text-xs text-gray-300">First entry</span>
                          : hasGap ? <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle size={11} /> Gap {fmtN(gap, 2)}</span>
                          : <span className="text-xs text-green-500 font-medium">✓ OK</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MeterReadingDialog open={dialogOpen} onClose={() => setDialogOpen(false)} equipmentId={equipmentId} editing={editing} />
    </div>
  )
}

// ── Fuel Tab ──────────────────────────────────────────────────────────────────
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', COMPANY_ACCOUNT: 'Company Account', REIMBURSEMENT: 'Reimbursement',
}

function FuelLogDialog({
  open, onClose, equipmentId, editing,
}: { open: boolean; onClose: () => void; equipmentId: number; editing: EquipmentFuelLog | null }) {
  const qc = useQueryClient()
  const blank: EquipmentFuelLogRequest = { fillDate: '', litresFilled: 0 }
  const [form, setForm] = useState<EquipmentFuelLogRequest>(blank)

  useMemo(() => {
    if (open) setForm(editing
      ? { fillDate: editing.fillDate, litresFilled: editing.litresFilled, hmrAtFill: editing.hmrAtFill ?? undefined, costPerLitre: editing.costPerLitre ?? undefined, totalCost: editing.totalCost ?? undefined, isFullTank: editing.isFullTank, paymentMode: editing.paymentMode ?? undefined, fuelStation: editing.fuelStation ?? undefined, notes: editing.notes ?? undefined }
      : blank)
  }, [open, editing])

  const set = (k: keyof EquipmentFuelLogRequest, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const mut = useMutation({
    mutationFn: () => editing
      ? equipmentApi.updateFuelLog(equipmentId, editing.id, form)
      : equipmentApi.addFuelLog(equipmentId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-fuel-logs', equipmentId] }); toast.success(editing ? 'Fuel log updated' : 'Fuel log added'); onClose() },
    onError: () => toast.error('Failed to save fuel log'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? 'Edit Fuel Log' : 'Add Fuel Log'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input type="date" className="mt-1" value={form.fillDate} onChange={e => set('fillDate', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Litres Filled *</Label>
              <Input type="number" step="0.01" min={0} className="mt-1" value={form.litresFilled || ''} onChange={e => {
                const l = Number(e.target.value)
                setForm(f => ({ ...f, litresFilled: l, totalCost: l && f.costPerLitre ? Math.round(l * f.costPerLitre * 100) / 100 : f.totalCost }))
              }} placeholder="e.g. 120" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">HMR at Fill</Label>
              <Input type="number" step="0.01" min={0} className="mt-1" value={form.hmrAtFill ?? ''} onChange={e => set('hmrAtFill', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1540" />
            </div>
            <div>
              <Label className="text-xs">Cost / Litre (₹)</Label>
              <Input type="number" step="0.01" min={0} className="mt-1" value={form.costPerLitre ?? ''} onChange={e => {
                const cpl = e.target.value ? Number(e.target.value) : undefined
                setForm(f => ({ ...f, costPerLitre: cpl, totalCost: cpl && f.litresFilled ? Math.round(cpl * f.litresFilled * 100) / 100 : f.totalCost }))
              }} placeholder="e.g. 95" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Total Cost (₹)</Label>
              <Input type="number" step="0.01" min={0} className="mt-1" value={form.totalCost ?? ''} onChange={e => set('totalCost', e.target.value ? Number(e.target.value) : undefined)} placeholder="auto or manual" />
            </div>
            <div>
              <Label className="text-xs">Payment Mode</Label>
              <Select value={form.paymentMode ?? ''} onValueChange={v => set('paymentMode', v || undefined)}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fuel Station</Label>
              <Input className="mt-1" value={form.fuelStation ?? ''} onChange={e => set('fuelStation', e.target.value || undefined)} placeholder="Optional" />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <input type="checkbox" id="fullTank" checked={!!form.isFullTank} onChange={e => set('isFullTank', e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="fullTank" className="text-sm cursor-pointer">Full Tank</Label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input className="mt-1" value={form.notes ?? ''} onChange={e => set('notes', e.target.value || undefined)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white" onClick={() => mut.mutate()} disabled={!form.fillDate || !form.litresFilled || mut.isPending}>
            {mut.isPending ? 'Saving…' : editing ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FuelTab({ equipmentId }: { equipmentId: number }) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentFuelLog | null>(null)

  const { data } = useQuery({
    queryKey: ['eq-fuel-logs', equipmentId],
    queryFn: () => equipmentApi.getFuelLogs(equipmentId),
  })
  const logs = (data?.data ?? []) as EquipmentFuelLog[]

  const delMut = useMutation({
    mutationFn: (logId: number) => equipmentApi.deleteFuelLog(equipmentId, logId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-fuel-logs', equipmentId] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const totalFuel = logs.reduce((s, l) => s + Number(l.litresFilled ?? 0), 0)
  const totalCost = logs.reduce((s, l) => s + Number(l.totalCost ?? 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="bg-blue-50 rounded-lg px-4 py-2.5 border border-blue-100">
            <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Total Filled</p>
            <p className="text-lg font-bold text-blue-700">{totalFuel.toFixed(1)} L</p>
          </div>
          <div className="bg-orange-50 rounded-lg px-4 py-2.5 border border-orange-100">
            <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Total Cost</p>
            <p className="text-lg font-bold text-orange-700">{totalCost > 0 ? fmtMoney(totalCost) : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Entries</p>
            <p className="text-lg font-bold text-gray-700">{logs.length}</p>
          </div>
        </div>
        <Button size="sm" className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1.5"
          onClick={() => { setEditing(null); setDialogOpen(true) }}>
          <Plus size={14} /> Add Fuel Log
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Droplets size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No fuel logs yet</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Litres', 'HMR at Fill', 'Cost/L', 'Total', 'Payment', 'Station', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(l.fillDate)}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{fmtN(l.litresFilled)} L{l.isFullTank && <span className="ml-1 text-xs text-green-600">Full</span>}</td>
                  <td className="px-4 py-2.5 text-gray-600">{l.hmrAtFill != null ? fmtN(l.hmrAtFill) : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{l.costPerLitre != null ? fmtMoney(l.costPerLitre) : '—'}</td>
                  <td className="px-4 py-2.5 text-gray-800">{l.totalCost != null ? fmtMoney(l.totalCost) : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.paymentMode ? PAYMENT_LABELS[l.paymentMode] : '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.fuelStation ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditing(l); setDialogOpen(true) }} className="text-gray-400 hover:text-gray-700"><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm('Delete this fuel log?')) delMut.mutate(l.id) }} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FuelLogDialog open={dialogOpen} onClose={() => setDialogOpen(false)} equipmentId={equipmentId} editing={editing} />
    </div>
  )
}

// ── WO History Tab ────────────────────────────────────────────────────────────
const WO_STATUS_CLS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700', COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600', DRAFT: 'bg-gray-50 text-gray-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
}

function WoHistoryTab({ history, navigate }: { history: MachineAssignmentHistory[]; navigate: (to: string) => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // Group assignments by workOrderId — preserve insertion order (already sorted by startDate DESC from API)
  const groups = useMemo(() => {
    const map = new Map<number, { meta: MachineAssignmentHistory; assignments: MachineAssignmentHistory[] }>()
    for (const a of history) {
      if (!map.has(a.workOrderId)) {
        map.set(a.workOrderId, { meta: a, assignments: [] })
      }
      map.get(a.workOrderId)!.assignments.push(a)
    }
    return [...map.values()]
  }, [history])

  const toggle = (woId: number) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(woId) ? next.delete(woId) : next.add(woId)
      return next
    })

  if (history.length === 0) return (
    <div className="py-12 text-center text-gray-400">
      <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
      <p className="text-sm">No work order history</p>
    </div>
  )

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {['WO#', 'Client', 'Site', 'Status', 'Total Hours', 'Assignments'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {groups.map(({ meta, assignments }) => {
            const isOpen = expanded.has(meta.workOrderId)
            const totalHrs = assignments.reduce((s, a) => s + Number(a.totalHoursWorked ?? 0), 0)
            const hasActive = assignments.some(a => a.isActive)
            return (
              <>
                {/* ── Group header row ── */}
                <tr
                  key={`wo-${meta.workOrderId}`}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => toggle(meta.workOrderId)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        size={14}
                        className={cn('text-gray-400 transition-transform shrink-0', isOpen && 'rotate-90')}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/equipment/work-orders/${meta.workOrderId}`) }}
                        className="text-feros-navy hover:underline font-semibold text-xs"
                      >
                        {meta.woNumber}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{meta.clientName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{meta.site ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', WO_STATUS_CLS[meta.workOrderStatus] ?? 'bg-gray-100 text-gray-500')}>
                        {meta.workOrderStatus.replace('_', ' ')}
                      </span>
                      {hasActive && <span className="text-xs text-green-600 font-medium">● Active</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {totalHrs > 0 ? `${totalHrs.toFixed(1)} hrs` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{assignments.length} period{assignments.length !== 1 ? 's' : ''}</td>
                </tr>

                {/* ── Expanded assignment rows ── */}
                {isOpen && assignments.map(a => (
                  <tr key={`assign-${a.id}`} className="bg-gray-50/70">
                    <td className="pl-10 pr-4 py-2 text-gray-400 text-xs">└</td>
                    <td colSpan={2} className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(a.startDate)} → {a.endDate
                        ? fmtDate(a.endDate)
                        : <span className="text-green-600 font-medium">Active</span>
                      }
                      {a.endReason && <span className="ml-2 text-gray-400">({a.endReason})</span>}
                    </td>
                    <td className="px-4 py-2">
                      {a.isActive
                        ? <span className="text-xs text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                        : <span className="text-xs text-gray-400">Ended</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-xs font-medium text-gray-700">
                      {Number(a.totalHoursWorked) > 0 ? `${Number(a.totalHoursWorked).toFixed(1)} hrs` : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {a.rateType && a.rateAmount ? `${fmtMoney(a.rateAmount)} / ${a.rateType.toLowerCase()}` : '—'}
                    </td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Billings Tab ──────────────────────────────────────────────────────────────
const INV_STATUS_CLS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700', DRAFT: 'bg-gray-100 text-gray-500',
  SENT: 'bg-blue-100 text-blue-700', PARTIALLY_PAID: 'bg-orange-100 text-orange-700',
  OVERDUE: 'bg-red-100 text-red-600', CANCELLED: 'bg-gray-100 text-gray-400',
}

function BillingsTab({ items, navigate }: { items: MachineInvoiceItem[]; navigate: (to: string) => void }) {
  return items.length === 0 ? (
    <div className="py-12 text-center text-gray-400">
      <FileText size={32} className="mx-auto mb-3 text-gray-200" />
      <p className="text-sm">No billing history</p>
    </div>
  ) : (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {['Invoice#', 'Date', 'Status', 'Client', 'Billing Period', 'Qty', 'Rate', 'Amount'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map(i => (
            <tr key={i.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5">
                <button
                  onClick={() => navigate(`/equipment/invoices/${i.invoiceId}`)}
                  className="text-feros-navy hover:underline font-semibold text-xs"
                >
                  {i.invoiceNumber ?? `INV-${i.invoiceId}`}
                </button>
              </td>
              <td className="px-4 py-2.5 text-gray-600 text-xs">{fmtDate(i.invoiceDate)}</td>
              <td className="px-4 py-2.5">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', INV_STATUS_CLS[i.invoiceStatus] ?? 'bg-gray-100 text-gray-500')}>
                  {i.invoiceStatus}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-600 text-xs">{i.clientName}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                {i.billingPeriodStart && i.billingPeriodEnd
                  ? `${fmtDate(i.billingPeriodStart)} – ${fmtDate(i.billingPeriodEnd)}`
                  : '—'}
              </td>
              <td className="px-4 py-2.5 text-gray-600">{i.quantity != null ? Number(i.quantity).toFixed(2) : '—'}</td>
              <td className="px-4 py-2.5 text-gray-600">{fmtMoney(i.rate)}</td>
              <td className="px-4 py-2.5 font-semibold text-gray-800">{fmtMoney(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function MachineDetailPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>()
  const navigate = useNavigate()
  const id = Number(equipmentId)

  const [activeTab, setActiveTab] = useState<Tab>('Basic Info')

  const { data: eqData, isLoading } = useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentApi.getById(id),
    enabled: !!id,
  })
  const { data: historyData } = useQuery({
    queryKey: ['machine-history', id],
    queryFn: () => machinesApi.getHistory(id),
    enabled: !!id,
  })
  const { data: logsData } = useQuery({
    queryKey: ['machine-logs', id],
    queryFn: () => machinesApi.getLogs(id),
    enabled: !!id,
  })
  const { data: invoiceItemsData } = useQuery({
    queryKey: ['machine-invoice-items', id],
    queryFn: () => machinesApi.getInvoiceItems(id),
    enabled: !!id,
  })

  const machine  = eqData?.data as Equipment | undefined
  const history  = (historyData?.data ?? []) as MachineAssignmentHistory[]
  const logs     = (logsData?.data ?? []) as MachineDailyLog[]
  const invItems = (invoiceItemsData?.data ?? []) as MachineInvoiceItem[]


  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading machine…</div>
  if (!machine) return (
    <div className="p-12 text-center text-gray-400">
      <p>Machine not found.</p>
      <button onClick={() => navigate('/equipment/machines')} className="mt-4 text-sm text-feros-navy hover:underline">← Back to Machines</button>
    </div>
  )

  const ws = WORK_STATUS[machine.workStatus] ?? { label: machine.workStatus, cls: 'bg-gray-100 text-gray-600' }

  return (
    <div className="space-y-0">

      {/* ── Banner ── */}
      <div className="bg-gradient-to-br from-[#1C1400] via-[#1C1400] to-[#2d2200] rounded-xl overflow-hidden mb-5">
        <div className="px-6 py-6">
          {/* Back link */}
          <button
            onClick={() => navigate('/equipment/machines')}
            className="flex items-center gap-1.5 text-[#c8a96e] hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={15} /> Machines
          </button>

          <div className="mt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                {machine.makeName} {machine.modelName}
              </h1>
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', ws.cls)}>{ws.label}</span>
              {!machine.isActive && (
                <span className="text-xs text-red-300 bg-red-500/20 border border-red-400/30 px-2 py-1 rounded-full">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-yellow-200/70 text-sm mt-1">
              {machine.equipmentTypeName}
              {machine.serialNumber && <span className="ml-2 font-mono">· S/N {machine.serialNumber}</span>}
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Meter Type',    value: machine.meterType },
              { label: 'Current Meter', value: machine.currentMeterReading != null ? `${machine.currentMeterReading} hrs` : '—' },
              { label: 'Ownership',     value: machine.ownershipType === 'OWNED' ? 'Owned' : 'Hired In' },
              { label: 'WO History',    value: `${history.length} assignment${history.length !== 1 ? 's' : ''}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-lg px-3 py-2.5">
                <p className="text-xs text-yellow-300/70">{label}</p>
                <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>
              </div>
            ))}
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
              onClick={() => setActiveTab(t)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === t
                  ? 'border-[#1C1400] text-[#1C1400]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
              )}
            >
              {tabIcon(t)}
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {activeTab === 'Basic Info'  && <BasicInfoTab m={machine} />}
          {activeTab === 'Utilization' && <UtilizationTab logs={logs} from="" to="" onFrom={() => {}} onTo={() => {}} />}
          {activeTab === 'HMR'         && <HmrTab equipmentId={id} logs={logs} />}
          {activeTab === 'Fuel'        && <FuelTab equipmentId={id} />}
          {activeTab === 'WO History'  && <WoHistoryTab history={history} navigate={navigate} />}
          {activeTab === 'Billings'    && <BillingsTab items={invItems} navigate={navigate} />}
        </div>
      </div>

    </div>
  )
}
