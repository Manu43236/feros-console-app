import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { equipmentApi } from '@/api/equipment'
import { machinesApi } from '@/api/machines'
import type { Equipment, EquipmentWorkStatus } from '@/api/equipment'
import type { MachineAssignmentHistory, MachineDailyLog, MachineInvoiceItem } from '@/api/machines'

// ── Status badges ────────────────────────────────────────────────────────────
const WORK_STATUS_BADGE: Record<EquipmentWorkStatus, { label: string; cls: string }> = {
  AVAILABLE:  { label: 'Available',  cls: 'bg-green-100 text-green-700 border-green-200' },
  ASSIGNED:   { label: 'Assigned',   cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  BUSY:       { label: 'Busy',       cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  BREAKDOWN:  { label: 'Breakdown',  cls: 'bg-red-100 text-red-700 border-red-200' },
  IN_REPAIR:  { label: 'In Repair',  cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
}
const WO_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-600', COMPLETED: 'text-gray-500', CANCELLED: 'text-red-500', DRAFT: 'text-gray-400',
}
function WorkStatusBadge({ status }: { status: EquipmentWorkStatus }) {
  const { label, cls } = WORK_STATUS_BADGE[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>{label}</span>
}

const fmt = (n: number | null | undefined) => n != null ? n.toFixed(2) : '—'
const fmtDate = (d: string | null | undefined) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtMoney = (n: number | null | undefined) => n != null ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'

const TABS = ['Basic Info', 'Utilization', 'HMR', 'Fuel', 'WO History', 'Billings'] as const
type Tab = typeof TABS[number]

// ── Date Filter Bar ──────────────────────────────────────────────────────────
function DateFilter({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs text-gray-500 font-medium">From</span>
      <Input type="date" value={from} onChange={e => onFrom(e.target.value)} className="h-7 text-xs w-36" />
      <span className="text-xs text-gray-500 font-medium">To</span>
      <Input type="date" value={to} onChange={e => onTo(e.target.value)} className="h-7 text-xs w-36" />
      {(from || to) && (
        <button onClick={() => { onFrom(''); onTo('') }} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
      )}
    </div>
  )
}

// ── Basic Info Tab ───────────────────────────────────────────────────────────
function BasicInfoTab({ m }: { m: Equipment }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">{children}</div>
    </div>
  )
  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
    </div>
  )
  return (
    <div className="space-y-6">
      <Section title="Identification">
        <Field label="Make"             value={m.makeName} />
        <Field label="Model"            value={m.modelName} />
        <Field label="Equipment Type"   value={m.equipmentTypeName} />
        <Field label="Serial Number"    value={m.serialNumber} />
        <Field label="Reg. Number"      value={m.registrationNumber} />
        <Field label="Chassis Number"   value={m.chassisNumber} />
        <Field label="Engine Number"    value={m.engineNumber} />
        <Field label="Manufacture Year" value={m.manufactureYear} />
        <Field label="Color"            value={m.color} />
      </Section>
      <Section title="Technical">
        <Field label="Meter Type"         value={m.meterType} />
        <Field label="Current Meter"      value={m.currentMeterReading != null ? `${m.currentMeterReading} hrs` : '—'} />
        <Field label="Fuel Type"          value={m.fuelType} />
        <Field label="Fuel Tank Capacity" value={m.fuelTankCapacity != null ? `${m.fuelTankCapacity} L` : '—'} />
        {m.capacity != null && <Field label="Capacity" value={`${m.capacity}${m.capacityUnit ?? ''}`} />}
      </Section>
      <Section title="Ownership">
        <Field label="Ownership Type" value={m.ownershipType === 'OWNED' ? 'Owned' : 'Hired In'} />
        {m.ownershipType === 'OWNED' && m.isFinanced && (
          <>
            <Field label="Financer"            value={m.financerName} />
            <Field label="Finance Start"       value={fmtDate(m.financeStartDate)} />
            <Field label="Finance End"         value={fmtDate(m.financeEndDate)} />
          </>
        )}
        {m.ownershipType === 'HIRED_IN' && (
          <>
            <Field label="Hired From"    value={m.hiredFrom} />
            <Field label="Hire Start"    value={fmtDate(m.hireStartDate)} />
            <Field label="Hire End"      value={fmtDate(m.hireEndDate)} />
            <Field label="Hire Rate"     value={m.hireRate != null ? fmtMoney(m.hireRate) : '—'} />
            <Field label="Rate Unit"     value={m.hireRateUnit?.replace('PER_', 'Per ').toLowerCase().replace(/^\w/, c => c.toUpperCase())} />
          </>
        )}
      </Section>
      {m.notes && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-700">{m.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Utilization Tab ──────────────────────────────────────────────────────────
function UtilizationTab({ logs, from, to, onFrom, onTo }: { logs: MachineDailyLog[]; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const workingDays = logs.length
  const totalHours = logs.reduce((s, l) => s + (l.hoursWorked ?? 0), 0)
  const calendarDays = (from && to)
    ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)
    : workingDays

  const deploymentRate = calendarDays > 0 ? (workingDays / calendarDays) * 100 : 0
  const workIntensity  = workingDays > 0 ? totalHours / workingDays : 0

  const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )

  return (
    <div>
      <DateFilter from={from} to={to} onFrom={onFrom} onTo={onTo} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Deployment Rate"     value={`${deploymentRate.toFixed(1)}%`}  sub={`${workingDays} / ${calendarDays} days`} />
        <Stat label="Work Intensity"      value={`${workIntensity.toFixed(1)} hrs`} sub="avg per working day" />
        <Stat label="Total Hours Worked"  value={`${totalHours.toFixed(1)} hrs`} />
        <Stat label="Working Days"        value={`${workingDays}`} sub="days with logs" />
      </div>
      {logs.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No logs for this period</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'WO#', 'Start HMR', 'End HMR', 'Hours Worked', 'Fuel (L)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{fmtDate(l.logDate)}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{l.woNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{fmt(l.startHourMeter)}</td>
                  <td className="px-3 py-2 text-gray-600">{fmt(l.endHourMeter)}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{fmt(l.hoursWorked)}</td>
                  <td className="px-3 py-2 text-gray-600">{fmt(l.fuelConsumed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── HMR Tab ──────────────────────────────────────────────────────────────────
function HmrTab({ logs, from, to, onFrom, onTo }: { logs: MachineDailyLog[]; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  // sorted ascending for continuity check
  const sorted = [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate))

  return (
    <div>
      <DateFilter from={from} to={to} onFrom={onFrom} onTo={onTo} />
      {sorted.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No logs for this period</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'WO#', 'Start HMR', 'End HMR', 'Hours', 'HMR Gap'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((l, i) => {
                const prev = sorted[i - 1]
                const gapFlag = prev?.endHourMeter != null && l.startHourMeter != null
                  && Math.abs(l.startHourMeter - prev.endHourMeter) > 0.01
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{fmtDate(l.logDate)}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{l.woNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{fmt(l.startHourMeter)}</td>
                    <td className="px-3 py-2 text-gray-600">{fmt(l.endHourMeter)}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{fmt(l.hoursWorked)}</td>
                    <td className="px-3 py-2">
                      {gapFlag ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <AlertTriangle size={12} />
                          Gap {fmt(l.startHourMeter! - prev.endHourMeter!)}
                        </span>
                      ) : i > 0 ? (
                        <span className="text-green-500 text-xs">✓ OK</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
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

// ── Fuel Tab ─────────────────────────────────────────────────────────────────
function FuelTab({ logs, from, to, onFrom, onTo }: { logs: MachineDailyLog[]; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const totalFuel = logs.reduce((s, l) => s + (l.fuelConsumed ?? 0), 0)
  const withFuel  = logs.filter(l => l.fuelConsumed != null && l.fuelConsumed > 0)
  return (
    <div>
      <DateFilter from={from} to={to} onFrom={onFrom} onTo={onTo} />
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Total Fuel Consumed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalFuel.toFixed(1)} L</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-gray-500">Days with Fuel Data</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{withFuel.length}</p>
        </div>
      </div>
      {withFuel.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No fuel data for this period</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'WO#', 'Fuel Consumed (L)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {withFuel.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{fmtDate(l.logDate)}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{l.woNumber ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{fmt(l.fuelConsumed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── WO History Tab ───────────────────────────────────────────────────────────
function WoHistoryTab({ history, navigate }: { history: MachineAssignmentHistory[]; navigate: (to: string) => void }) {
  return history.length === 0 ? (
    <p className="text-gray-400 text-sm text-center py-8">No work order history</p>
  ) : (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['WO#', 'Client', 'Site', 'Period', 'Status', 'Total Hours', 'Rate'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {history.map(a => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <button
                  onClick={() => navigate(`/equipment/work-orders/${a.workOrderId}`)}
                  className="text-blue-600 hover:underline font-medium text-xs"
                >
                  {a.woNumber}
                </button>
              </td>
              <td className="px-3 py-2 text-gray-600">{a.clientName}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{a.site ?? '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">
                {fmtDate(a.startDate)} – {a.endDate ? fmtDate(a.endDate) : 'Active'}
              </td>
              <td className="px-3 py-2">
                <span className={`text-xs font-medium ${WO_STATUS_COLORS[a.workOrderStatus] ?? 'text-gray-500'}`}>
                  {a.workOrderStatus}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-gray-800">{a.totalHoursWorked > 0 ? `${Number(a.totalHoursWorked).toFixed(1)} hrs` : '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">
                {a.rateType && a.rateAmount ? `${fmtMoney(a.rateAmount)} / ${a.rateType.toLowerCase()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Billings Tab ─────────────────────────────────────────────────────────────
const INV_STATUS_COLORS: Record<string, string> = {
  PAID: 'text-green-600', DRAFT: 'text-gray-400', SENT: 'text-blue-600',
  PARTIALLY_PAID: 'text-orange-500', OVERDUE: 'text-red-600', CANCELLED: 'text-gray-400',
}
function BillingsTab({ items, navigate }: { items: MachineInvoiceItem[]; navigate: (to: string) => void }) {
  return items.length === 0 ? (
    <p className="text-gray-400 text-sm text-center py-8">No billing history</p>
  ) : (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Invoice#', 'Date', 'Status', 'Client', 'Billing Period', 'Qty', 'Rate', 'Amount'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map(i => (
            <tr key={i.id} className="hover:bg-gray-50">
              <td className="px-3 py-2">
                <button
                  onClick={() => navigate(`/equipment/invoices/${i.invoiceId}`)}
                  className="text-blue-600 hover:underline font-medium text-xs"
                >
                  {i.invoiceNumber ?? `INV-${i.invoiceId}`}
                </button>
              </td>
              <td className="px-3 py-2 text-gray-600 text-xs">{fmtDate(i.invoiceDate)}</td>
              <td className="px-3 py-2">
                <span className={`text-xs font-medium ${INV_STATUS_COLORS[i.invoiceStatus] ?? 'text-gray-500'}`}>
                  {i.invoiceStatus}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600 text-xs">{i.clientName}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">
                {i.billingPeriodStart && i.billingPeriodEnd
                  ? `${fmtDate(i.billingPeriodStart)} – ${fmtDate(i.billingPeriodEnd)}`
                  : '—'}
              </td>
              <td className="px-3 py-2 text-gray-600">{i.quantity != null ? Number(i.quantity).toFixed(2) : '—'}</td>
              <td className="px-3 py-2 text-gray-600">{fmtMoney(i.rate)}</td>
              <td className="px-3 py-2 font-medium text-gray-800">{fmtMoney(i.amount)}</td>
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
  const [logsFrom, setLogsFrom] = useState('')
  const [logsTo,   setLogsTo]   = useState('')

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

  if (isLoading) return <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
  if (!machine)  return <div className="py-16 text-center text-gray-400 text-sm">Machine not found</div>

  const logTabProps = { logs, from: logsFrom, to: logsTo, onFrom: setLogsFrom, onTo: setLogsTo }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 p-1 text-gray-400 hover:text-gray-700 rounded">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">
            {machine.makeName} {machine.modelName} · {machine.equipmentTypeName}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            S/N: {machine.serialNumber ?? '—'}
            {machine.registrationNumber && <span className="ml-3">Reg: {machine.registrationNumber}</span>}
          </p>
        </div>
        <WorkStatusBadge status={machine.workStatus} />
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'border-[#1C1400] text-[#1C1400]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'Basic Info'   && <BasicInfoTab m={machine} />}
        {activeTab === 'Utilization'  && <UtilizationTab {...logTabProps} />}
        {activeTab === 'HMR'          && <HmrTab {...logTabProps} />}
        {activeTab === 'Fuel'         && <FuelTab {...logTabProps} />}
        {activeTab === 'WO History'   && <WoHistoryTab history={history} navigate={navigate} />}
        {activeTab === 'Billings'     && <BillingsTab items={invItems} navigate={navigate} />}
      </div>
    </div>
  )
}
