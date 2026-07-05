import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Info, TrendingUp, Gauge, Droplets,
  ClipboardList, FileText, AlertTriangle, ChevronRight,
  Plus, Pencil, Trash2, Wrench, ChevronDown, Search, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { equipmentApi } from '@/api/equipment'
import { globalMastersApi } from '@/api/masters'
import { machinesApi } from '@/api/machines'
import type { Equipment, EquipmentWorkStatus, EquipmentFuelLog, EquipmentFuelLogRequest, EquipmentMeterReading, EquipmentMeterReadingRequest, EquipmentServiceRecord, EquipmentServiceRequest, ServiceTriggeredBy, EquipmentServiceType, ServicePayerType } from '@/api/equipment'
import type { MasterItem } from '@/types'
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
  IN_REPAIR:          { label: 'In Repair',         cls: 'bg-yellow-100 text-yellow-700' },
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ['Basic Info', 'Utilization', 'HMR', 'Fuel', 'Service', 'WO History', 'Billings'] as const
type Tab = typeof TABS[number]

function tabIcon(t: Tab) {
  if (t === 'Basic Info')  return <Info size={14} />
  if (t === 'Utilization') return <TrendingUp size={14} />
  if (t === 'HMR')         return <Gauge size={14} />
  if (t === 'Fuel')        return <Droplets size={14} />
  if (t === 'WO History')  return <ClipboardList size={14} />
  if (t === 'Billings')    return <FileText size={14} />
  if (t === 'Service')     return <Wrench size={14} />
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


// ── Service Tab ───────────────────────────────────────────────────────────────
const TRIGGER_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled', BREAKDOWN: 'Breakdown', ACCIDENT: 'Accident',
  COMPLIANCE: 'Compliance', WARRANTY: 'Warranty',
}
const SERVICE_STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-600', IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
}
const PAYER_LABELS: Record<string, string> = {
  OWN_EXPENSE: 'Own', WARRANTY_OEM: 'OEM Warranty', WARRANTY_ANC: 'ANC Warranty',
  INSURANCE: 'Insurance', AMC: 'AMC',
}
const SVC_TYPE_LABELS: Record<string, string> = {
  INTERNAL: 'Internal', THIRD_PARTY: '3rd Party', OEM_CENTER: 'OEM Center',
}

interface ServiceDraft {
  triggeredBy: ServiceTriggeredBy
  serviceType: EquipmentServiceType
  payerType: ServicePayerType
  vendorName: string
  location: string
  serviceDate: string
  hmrAtService: string
  dueAtHmr: string
  notes: string
  insuranceClaimNo: string
  insuranceClaimAmt: string
  certificateNumber: string
  certificateValidUntil: string
  isEscalated: boolean
}

interface TaskDraft {
  taskTypeId?: number
  customName?: string
  isRecurring: boolean
  frequencyHmr?: string
  cost?: string
}

function todayStr() { return new Date().toISOString().split('T')[0] }

function defaultDraft(currentHmr?: number | null): ServiceDraft {
  return {
    triggeredBy: 'SCHEDULED', serviceType: 'INTERNAL', payerType: 'OWN_EXPENSE',
    vendorName: '', location: '', serviceDate: todayStr(),
    hmrAtService: currentHmr != null ? String(currentHmr) : '', dueAtHmr: '',
    notes: '', insuranceClaimNo: '', insuranceClaimAmt: '',
    certificateNumber: '', certificateValidUntil: '', isEscalated: false,
  }
}

function ServiceDialog({
  open, onClose, equipmentId, editing, currentHmr,
}: { open: boolean; onClose: () => void; equipmentId: number; editing: EquipmentServiceRecord | null; currentHmr?: number | null }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ServiceDraft>(defaultDraft(editing ? null : currentHmr))
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [taskDrafts, setTaskDrafts] = useState<Record<number, TaskDraft>>({})
  const [customTasks, setCustomTasks] = useState<TaskDraft[]>([])
  const [customName, setCustomName] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const { data: taskTypesRes } = useQuery({
    queryKey: ['equipment-service-task-types'],
    queryFn: globalMastersApi.getEquipmentServiceTaskTypes,
    enabled: open,
  })
  const taskTypes: MasterItem[] = taskTypesRes?.data ?? []

  // Populate form when editing
  useState(() => {
    if (editing) {
      setForm({
        triggeredBy: editing.triggeredBy, serviceType: editing.serviceType,
        payerType: editing.payerType, vendorName: editing.vendorName ?? '',
        location: editing.location ?? '', serviceDate: editing.serviceDate ?? '',
        hmrAtService: editing.hmrAtService != null ? String(editing.hmrAtService) : '',
        dueAtHmr: editing.dueAtHmr != null ? String(editing.dueAtHmr) : '',
        notes: editing.notes ?? '', insuranceClaimNo: editing.insuranceClaimNo ?? '',
        insuranceClaimAmt: editing.insuranceClaimAmt != null ? String(editing.insuranceClaimAmt) : '',
        certificateNumber: editing.certificateNumber ?? '',
        certificateValidUntil: editing.certificateValidUntil ?? '',
        isEscalated: editing.isEscalated ?? false,
      })
      // Rebuild tasks
      const ids = new Set<number>()
      const drafts: Record<number, TaskDraft> = {}
      const customs: TaskDraft[] = []
      for (const t of editing.tasks) {
        if (t.taskTypeId != null) {
          ids.add(t.taskTypeId)
          drafts[t.taskTypeId] = { taskTypeId: t.taskTypeId, isRecurring: t.isRecurring, frequencyHmr: t.frequencyHmr != null ? String(t.frequencyHmr) : undefined, cost: t.cost != null ? String(t.cost) : undefined }
        } else {
          customs.push({ customName: t.customName ?? '', isRecurring: t.isRecurring, frequencyHmr: t.frequencyHmr != null ? String(t.frequencyHmr) : undefined, cost: t.cost != null ? String(t.cost) : undefined })
        }
      }
      setSelectedTaskIds(ids)
      setTaskDrafts(drafts)
      setCustomTasks(customs)
    }
  })

  const mut = useMutation({
    mutationFn: (data: EquipmentServiceRequest) =>
      editing
        ? equipmentApi.updateService(equipmentId, editing.id, data)
        : equipmentApi.createService(equipmentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-services', equipmentId] })
      toast.success(editing ? 'Service updated' : 'Service created')
      handleClose()
    },
    onError: () => toast.error('Failed to save service'),
  })

  function handleClose() {
    setForm(defaultDraft(currentHmr))
    setSelectedTaskIds(new Set()); setTaskDrafts({}); setCustomTasks([])
    setCustomName(''); setShowCustom(false)
    onClose()
  }

  function set<K extends keyof ServiceDraft>(k: K, v: ServiceDraft[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleTask(id: number) {
    setSelectedTaskIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id); setTaskDrafts(d => { const n = { ...d }; delete n[id]; return n }) }
      else { s.add(id); setTaskDrafts(d => ({ ...d, [id]: { taskTypeId: id, isRecurring: false } })) }
      return s
    })
  }

  function updateDraft(id: number, patch: Partial<TaskDraft>) {
    setTaskDrafts(d => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } as TaskDraft }))
  }

  function handleSubmit() {
    const tasks = [
      ...Array.from(selectedTaskIds).map(id => {
        const d = taskDrafts[id] ?? { isRecurring: false }
        return { taskTypeId: id, customName: null, isRecurring: d.isRecurring, frequencyHmr: d.isRecurring && d.frequencyHmr ? Number(d.frequencyHmr) : null, cost: d.cost ? Number(d.cost) : null }
      }),
      ...customTasks.map(ct => ({ taskTypeId: null, customName: ct.customName ?? null, isRecurring: ct.isRecurring, frequencyHmr: ct.isRecurring && ct.frequencyHmr ? Number(ct.frequencyHmr) : null, cost: ct.cost ? Number(ct.cost) : null })),
    ]
    if (tasks.length === 0) { toast.error('Add at least one task'); return }
    const hmrBase = form.hmrAtService ? Number(form.hmrAtService) : null
    const recurringFreqs = Array.from(selectedTaskIds)
      .map(id => taskDrafts[id])
      .filter(d => d?.isRecurring && d.frequencyHmr)
      .map(d => Number(d!.frequencyHmr))
    const minFreq = recurringFreqs.length > 0 ? Math.min(...recurringFreqs) : null
    const autoDueAtHmr = hmrBase != null && minFreq != null ? hmrBase + minFreq : null
    mut.mutate({
      triggeredBy: form.triggeredBy, serviceType: form.serviceType, payerType: form.payerType,
      vendorName: form.vendorName || null, location: form.location || null,
      serviceDate: form.serviceDate || null,
      hmrAtService: hmrBase,
      dueAtHmr: autoDueAtHmr,
      notes: form.notes || null,
      insuranceClaimNo: form.payerType === 'INSURANCE' ? form.insuranceClaimNo || null : null,
      insuranceClaimAmt: form.payerType === 'INSURANCE' && form.insuranceClaimAmt ? Number(form.insuranceClaimAmt) : null,
      certificateNumber: form.triggeredBy === 'COMPLIANCE' ? form.certificateNumber || null : null,
      certificateValidUntil: form.triggeredBy === 'COMPLIANCE' ? form.certificateValidUntil || null : null,
      isEscalated: form.isEscalated,
      tasks,
    })
  }

  const btnCls = (active: boolean) => cn('py-2 rounded-lg border-2 text-xs font-medium transition-colors',
    active ? 'border-[#1C1400] bg-[#1C1400]/5 text-[#1C1400]' : 'border-gray-200 text-gray-500 hover:border-gray-300')

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={16} className="text-[#1C1400]" />
            {editing ? 'Edit Service' : 'New Service Record'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">

          {/* Trigger */}
          <div className="space-y-1.5">
            <Label>Reason / Trigger <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {(['SCHEDULED', 'BREAKDOWN', 'ACCIDENT', 'COMPLIANCE', 'WARRANTY'] as ServiceTriggeredBy[]).map(v => (
                <button key={v} type="button" onClick={() => set('triggeredBy', v)} className={btnCls(form.triggeredBy === v)}>
                  {TRIGGER_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Service Type */}
          <div className="space-y-1.5">
            <Label>Service Location <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {(['INTERNAL', 'THIRD_PARTY', 'OEM_CENTER'] as EquipmentServiceType[]).map(v => (
                <button key={v} type="button" onClick={() => set('serviceType', v)} className={btnCls(form.serviceType === v)}>
                  {SVC_TYPE_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Payer */}
          <div className="space-y-1.5">
            <Label>Who Pays?</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['OWN_EXPENSE', 'WARRANTY_OEM', 'WARRANTY_ANC', 'INSURANCE', 'AMC'] as ServicePayerType[]).map(v => (
                <button key={v} type="button" onClick={() => set('payerType', v)} className={btnCls(form.payerType === v)}>
                  {PAYER_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor */}
          {form.serviceType !== 'INTERNAL' && (
            <div className="space-y-1.5">
              <Label>{form.serviceType === 'OEM_CENTER' ? 'OEM Service Center' : 'Vendor / Workshop'}</Label>
              <Input value={form.vendorName} onChange={e => set('vendorName', e.target.value)} placeholder="e.g. Atlas Copco Service Center" />
            </div>
          )}

          {/* Insurance */}
          {form.payerType === 'INSURANCE' && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-lg p-3">
              <div className="space-y-1.5">
                <Label>Claim Number <span className="text-red-500">*</span></Label>
                <Input value={form.insuranceClaimNo} onChange={e => set('insuranceClaimNo', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Claim Amount (₹)</Label>
                <Input type="number" value={form.insuranceClaimAmt} onChange={e => set('insuranceClaimAmt', e.target.value)} />
              </div>
            </div>
          )}

          {/* Compliance */}
          {form.triggeredBy === 'COMPLIANCE' && (
            <div className="grid grid-cols-2 gap-3 bg-purple-50 rounded-lg p-3">
              <div className="space-y-1.5">
                <Label>Certificate Number <span className="text-red-500">*</span></Label>
                <Input value={form.certificateNumber} onChange={e => set('certificateNumber', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Until</Label>
                <Input type="date" value={form.certificateValidUntil} onChange={e => set('certificateValidUntil', e.target.value)} />
              </div>
            </div>
          )}

          {/* Escalated */}
          {form.serviceType === 'THIRD_PARTY' && form.triggeredBy === 'BREAKDOWN' && (
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.isEscalated} onChange={e => set('isEscalated', e.target.checked)} className="w-4 h-4 accent-[#1C1400]" />
              Internal mechanic could not fix — escalated to 3rd party
            </label>
          )}

          <div className="space-y-1.5">
            <Label>Location <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Site yard, Vizag" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Service Date</Label>
              <Input type="date" value={form.serviceDate} onChange={e => set('serviceDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>HMR at Service</Label>
              <Input type="number" placeholder="e.g. 1240" value={form.hmrAtService} onChange={e => set('hmrAtService', e.target.value)} />
            </div>
          </div>


          <div className="space-y-1.5">
            <Label>Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            <Label>Tasks <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <select value="" onChange={e => { if (e.target.value) toggleTask(Number(e.target.value)) }}
                className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none">
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

            {showCustom && (
              <div className="flex gap-2">
                <Input placeholder="Custom task name…" className="h-8 text-sm flex-1" value={customName} onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (customName.trim()) { setCustomTasks(c => [...c, { customName: customName.trim(), isRecurring: false }]); setCustomName('') } } }} />
                <Button type="button" size="sm" className="h-8 bg-[#1C1400] text-white shrink-0" onClick={() => { if (customName.trim()) { setCustomTasks(c => [...c, { customName: customName.trim(), isRecurring: false }]); setCustomName('') } }}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowCustom(false); setCustomName('') }} className="h-8 shrink-0">✕</Button>
              </div>
            )}

            {(selectedTaskIds.size > 0 || customTasks.length > 0) && (
              <div className="space-y-2 pt-1">
                {Array.from(selectedTaskIds).map(id => {
                  const t = taskTypes.find(x => x.id === id)
                  const d = taskDrafts[id]
                  return (
                    <div key={id} className="rounded-lg border border-[#1C1400]/20 bg-[#1C1400]/[0.03] px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#1C1400]">{t?.name}</span>
                        <button type="button" onClick={() => toggleTask(id)} className="text-gray-300 hover:text-red-500 transition-colors ml-2">✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-xs text-gray-400 mb-1">Cost (₹)</p>
                          <Input type="number" placeholder="0" className="h-7 text-xs" value={d?.cost ?? ''} onChange={e => updateDraft(id, { cost: e.target.value || undefined })} /></div>
                        <div><p className="text-xs text-gray-400 mb-1">Recurring?</p>
                          <button type="button" onClick={() => updateDraft(id, { isRecurring: !d?.isRecurring })}
                            className={cn('h-7 w-full rounded-md border text-xs font-medium transition-colors', d?.isRecurring ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500')}>
                            {d?.isRecurring ? '🔄 Recurring' : 'One-time'}</button></div>
                      </div>
                      {d?.isRecurring && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Every (hrs)</p>
                          <Input type="number" placeholder="250" className="h-7 text-xs" value={d?.frequencyHmr ?? ''} onChange={e => updateDraft(id, { frequencyHmr: e.target.value || undefined })} />
                          {d?.frequencyHmr && form.hmrAtService && (
                            <p className="text-xs text-[#1C1400] mt-1 font-medium">
                              → Next due at {Number(form.hmrAtService) + Number(d.frequencyHmr)} hrs
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {customTasks.map((ct, i) => (
                  <div key={`ct-${i}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{ct.customName}</span>
                      <button type="button" onClick={() => setCustomTasks(c => c.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 ml-2">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={mut.isPending}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={mut.isPending}
              className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white">
              {mut.isPending ? 'Saving…' : editing ? 'Update Service' : 'Create Service'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const SVC_STATUS_CHIP: Record<string, string> = {
  OPEN:        'bg-blue-50 text-blue-600 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-600 border-amber-200',
  COMPLETED:   'bg-green-50 text-green-700 border-green-200',
}
const SVC_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed',
}

function ServiceTab({ equipmentId, currentHmr }: { equipmentId: number; currentHmr?: number | null }) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentServiceRecord | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['eq-services', equipmentId],
    queryFn: () => equipmentApi.getServices(equipmentId),
  })
  const services = (data?.data ?? []) as EquipmentServiceRecord[]

  const startMut = useMutation({
    mutationFn: (id: number) => equipmentApi.startService(equipmentId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-services', equipmentId] })
      qc.invalidateQueries({ queryKey: ['equipment', equipmentId] })
      toast.success('Service started — machine is now In Repair')
    },
    onError: () => toast.error('Failed to start service'),
  })

  const completeMut = useMutation({
    mutationFn: (id: number) => equipmentApi.completeService(equipmentId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-services', equipmentId] })
      qc.invalidateQueries({ queryKey: ['equipment', equipmentId] })
      toast.success('Service completed')
    },
    onError: () => toast.error('Failed to complete service'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => equipmentApi.deleteService(equipmentId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-services', equipmentId] }); toast.success('Deleted'); setDeleteId(null) },
    onError: () => toast.error('Failed to delete'),
  })

  const filtered = services.filter(s => {
    if (filter === 'open'        && s.status !== 'OPEN')        return false
    if (filter === 'in_progress' && s.status !== 'IN_PROGRESS') return false
    if (filter === 'completed'   && s.status !== 'COMPLETED')   return false
    if (search && !s.serviceNumber?.toLowerCase().includes(search.toLowerCase()) &&
        !s.notes?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Search + New Service */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search services…" className="pl-8 h-9"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}
          className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1.5 h-9 text-xs">
          <Plus size={13} /> New Service
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all',         label: 'All',         count: services.length },
          { key: 'open',        label: 'Open',        count: services.filter(s => s.status === 'OPEN').length },
          { key: 'in_progress', label: 'In Progress', count: services.filter(s => s.status === 'IN_PROGRESS').length },
          { key: 'completed',   label: 'Completed',   count: services.filter(s => s.status === 'COMPLETED').length },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === f.key
                ? 'bg-[#1C1400] text-white border-[#1C1400]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}>
            {f.label}
            <span className={cn('px-1.5 py-0.5 rounded-full text-xs',
              filter === f.key ? 'bg-white/20' : 'bg-gray-100'
            )}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Service list */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Wrench size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">
            {services.length === 0 ? 'No services yet' : 'No services match filter'}
          </p>
          {services.length === 0 && (
            <p className="text-xs mt-1 text-gray-400">Create the first service to start tracking.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors">
              <div className="p-4 cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">{s.serviceNumber}</span>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', SVC_STATUS_CHIP[s.status])}>
                        {SVC_STATUS_LABEL[s.status]}
                      </span>
                      <span className="text-xs text-gray-400">
                        {s.triggeredBy === 'BREAKDOWN'  ? '⚡ Breakdown'  :
                         s.triggeredBy === 'ACCIDENT'   ? '💥 Accident'   :
                         s.triggeredBy === 'COMPLIANCE' ? '📋 Compliance' :
                         s.triggeredBy === 'WARRANTY'   ? '🔒 Warranty'   : '📅 Scheduled'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {s.serviceType === 'INTERNAL'   ? '🏭 Internal' :
                         s.serviceType === 'OEM_CENTER'  ? `🏢 ${s.vendorName ?? 'OEM Center'}` :
                         `🔧 ${s.vendorName ?? '3rd Party'}`}
                      </span>
                    </div>

                    {/* Task chips */}
                    {s.tasks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.tasks.map(t => (
                          <span key={t.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {t.displayName ?? t.customName ?? t.taskTypeName ?? '—'}
                            {t.isRecurring ? ` 🔄 ${t.frequencyHmr}hrs` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                      {s.hmrAtService != null && <span>⏱ {s.hmrAtService} hrs</span>}
                      {s.dueAtHmr != null && <span>Due at {s.dueAtHmr} hrs</span>}
                      {s.serviceDate && <span>📅 {fmtDate(s.serviceDate)}</span>}
                      {s.location && <span>📍 {s.location}</span>}
                      {(s.totalCost ?? 0) > 0 && (
                        <span className="text-green-600 font-medium">
                          ₹{Number(s.totalCost).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {s.status === 'OPEN' && (
                      <Button size="sm" onClick={() => startMut.mutate(s.id)}
                        disabled={startMut.isPending}
                        className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1">
                        <Wrench size={12} /> Start
                      </Button>
                    )}
                    {s.status === 'IN_PROGRESS' && (
                      <Button size="sm" onClick={() => completeMut.mutate(s.id)}
                        disabled={completeMut.isPending}
                        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1">
                        <Check size={12} /> Done
                      </Button>
                    )}
                    {s.status === 'OPEN' && (
                      <>
                        <button onClick={() => { setEditing(s); setDialogOpen(true) }}
                          className="p-1.5 text-gray-300 hover:text-[#1C1400] rounded transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteId(s.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <ChevronDown size={13} className={cn('text-gray-400 transition-transform', expanded === s.id ? 'rotate-180' : '')} />
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === s.id && (
                <div className="border-t bg-gray-50/50 px-4 py-3 space-y-3">
                  {s.tasks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tasks</p>
                      <div className="space-y-1.5">
                        {s.tasks.map(t => (
                          <div key={t.id} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-gray-100">
                            <span className="text-xs text-gray-700">{t.displayName ?? t.customName ?? t.taskTypeName ?? '—'}</span>
                            <div className="flex items-center gap-3">
                              {t.cost != null && <span className="text-xs text-gray-500">{fmtMoney(t.cost)}</span>}
                              {t.isRecurring && <span className="text-xs text-blue-600">Every {t.frequencyHmr} hrs</span>}
                              <span className={cn('text-xs px-1.5 py-0.5 rounded-full', SERVICE_STATUS_CLS[t.status] ?? 'bg-gray-100 text-gray-500')}>
                                {t.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(s.vendorName || s.location || s.payerType || s.notes) && (
                    <div className="space-y-1">
                      {s.vendorName && <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Vendor:</span> {s.vendorName}</p>}
                      {s.location && <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Location:</span> {s.location}</p>}
                      {s.payerType && <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Payer:</span> {PAYER_LABELS[s.payerType]}</p>}
                      {s.notes && <p className="text-xs text-gray-500"><span className="font-medium text-gray-700">Notes:</span> {s.notes}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ServiceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} equipmentId={equipmentId} editing={editing} currentHmr={currentHmr} />

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Service</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Delete this service record? This cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMut.isPending}
              onClick={() => deleteId && deleteMut.mutate(deleteId)}>
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
          {activeTab === 'Service'      && <ServiceTab equipmentId={id} currentHmr={machine.currentMeterReading != null ? Number(machine.currentMeterReading) : null} />}
          {activeTab === 'WO History'  && <WoHistoryTab history={history} navigate={navigate} />}
          {activeTab === 'Billings'    && <BillingsTab items={invItems} navigate={navigate} />}
        </div>
      </div>

    </div>
  )
}
