import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Info, TrendingUp, Gauge, Droplets,
  ClipboardList, FileText, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { equipmentApi } from '@/api/equipment'
import { machinesApi } from '@/api/machines'
import type { Equipment, EquipmentWorkStatus } from '@/api/equipment'
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
function HmrTab({ logs, from, to, onFrom, onTo }: { logs: MachineDailyLog[]; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const sorted = [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate))

  return (
    <div className="space-y-5">
      <DateFilter from={from} to={to} onFrom={onFrom} onTo={onTo} />

      {sorted.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Gauge size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No HMR data for this period</p>
        </div>
      ) : (
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
                  ? Math.abs(l.startHourMeter - prev.endHourMeter)
                  : null
                const hasGap = gap != null && gap > 0.01
                return (
                  <tr key={l.id} className={cn('hover:bg-gray-50 transition-colors', hasGap && 'bg-amber-50/40')}>
                    <td className="px-4 py-2.5 text-gray-700">{fmtDate(l.logDate)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{l.woNumber ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{fmtN(l.startHourMeter)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{fmtN(l.endHourMeter)}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{fmtN(l.hoursWorked)}</td>
                    <td className="px-4 py-2.5">
                      {i === 0 ? (
                        <span className="text-xs text-gray-300">First entry</span>
                      ) : hasGap ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                          <AlertTriangle size={11} /> Gap {fmtN(gap, 2)}
                        </span>
                      ) : (
                        <span className="text-xs text-green-500 font-medium">✓ OK</span>
                      )}
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
}

// ── Fuel Tab ──────────────────────────────────────────────────────────────────
function FuelTab({ logs, from, to, onFrom, onTo }: { logs: MachineDailyLog[]; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const withFuel  = logs.filter(l => l.fuelConsumed != null && l.fuelConsumed > 0)
  const totalFuel = withFuel.reduce((s, l) => s + (l.fuelConsumed ?? 0), 0)
  const avgFuel   = withFuel.length > 0 ? totalFuel / withFuel.length : 0

  return (
    <div className="space-y-5">
      <DateFilter from={from} to={to} onFrom={onFrom} onTo={onTo} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">Total Consumed</p>
          <p className="text-xl font-bold text-blue-700">{totalFuel.toFixed(1)} L</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
          <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-1">Avg Per Day</p>
          <p className="text-xl font-bold text-orange-700">{avgFuel.toFixed(1)} L</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Days with Data</p>
          <p className="text-xl font-bold text-gray-700">{withFuel.length}</p>
        </div>
      </div>

      {withFuel.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <Droplets size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No fuel data for this period</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'WO#', 'Fuel Consumed (L)'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {withFuel.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-700">{fmtDate(l.logDate)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{l.woNumber ?? '—'}</td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{fmtN(l.fuelConsumed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  return history.length === 0 ? (
    <div className="py-12 text-center text-gray-400">
      <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
      <p className="text-sm">No work order history</p>
    </div>
  ) : (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {['WO#', 'Client', 'Site', 'Period', 'Status', 'Hours', 'Rate'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {history.map(a => (
            <tr key={a.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5">
                <button
                  onClick={() => navigate(`/equipment/work-orders/${a.workOrderId}`)}
                  className="text-feros-navy hover:underline font-semibold text-xs"
                >
                  {a.woNumber}
                </button>
              </td>
              <td className="px-4 py-2.5 text-gray-600 text-xs">{a.clientName}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">{a.site ?? '—'}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                {fmtDate(a.startDate)} – {a.endDate ? fmtDate(a.endDate) : <span className="text-green-600 font-medium">Active</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', WO_STATUS_CLS[a.workOrderStatus] ?? 'bg-gray-100 text-gray-500')}>
                  {a.workOrderStatus}
                </span>
              </td>
              <td className="px-4 py-2.5 font-semibold text-gray-800">
                {Number(a.totalHoursWorked) > 0 ? `${Number(a.totalHoursWorked).toFixed(1)} hrs` : '—'}
              </td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">
                {a.rateType && a.rateAmount ? `${fmtMoney(a.rateAmount)} / ${a.rateType.toLowerCase()}` : '—'}
              </td>
            </tr>
          ))}
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
  const [logsFrom, setLogsFrom]   = useState('')
  const [logsTo,   setLogsTo]     = useState('')

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
    queryKey: ['machine-logs', id, logsFrom, logsTo],
    queryFn: () => machinesApi.getLogs(id, logsFrom || undefined, logsTo || undefined),
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
  const logTabProps = { logs, from: logsFrom, to: logsTo, onFrom: setLogsFrom, onTo: setLogsTo }

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
          {activeTab === 'Utilization' && <UtilizationTab {...logTabProps} />}
          {activeTab === 'HMR'         && <HmrTab {...logTabProps} />}
          {activeTab === 'Fuel'        && <FuelTab {...logTabProps} />}
          {activeTab === 'WO History'  && <WoHistoryTab history={history} navigate={navigate} />}
          {activeTab === 'Billings'    && <BillingsTab items={invItems} navigate={navigate} />}
        </div>
      </div>

    </div>
  )
}
