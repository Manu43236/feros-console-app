import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HScroll } from '@/components/ui/h-scroll'
import { reportsApi } from '@/api/reports'
import { cn } from '@/lib/utils'

type Tab = 'assignments' | 'cost'

function money(n?: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0)
}

export function EquipmentCrewReportsPage() {
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  const [tab, setTab] = useState<Tab>('assignments')
  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(todayStr)
  const [applied, setApplied] = useState({ from: firstOfMonth, to: todayStr })

  const assignmentsQ = useQuery({
    queryKey: ['equip-operator-assignments', applied.from, applied.to],
    queryFn: () => reportsApi.getOperatorAssignments(applied.from, applied.to).then(r => r.data),
    enabled: tab === 'assignments',
  })
  const costQ = useQuery({
    queryKey: ['equip-machine-staff-cost', applied.from, applied.to],
    queryFn: () => reportsApi.getMachineStaffCost(applied.from, applied.to).then(r => r.data),
    enabled: tab === 'cost',
  })

  const btnPrimary = 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white'
  const exportFn = (format: 'csv' | 'pdf') =>
    tab === 'assignments'
      ? reportsApi.exportOperatorAssignments(applied.from, applied.to, format)
      : reportsApi.exportMachineStaffCost(applied.from, applied.to, format)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Users className="text-feros-equip-sidebar" size={20} />
        <h1 className="text-lg font-semibold text-gray-800">Equipment Crew Reports</h1>
      </div>

      <div className="flex gap-2">
        {([['assignments', 'Operator / Cleaner Assignments'], ['cost', 'Machine Staff Cost']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              tab === t ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs text-gray-500 mb-1 block">From</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" /></div>
        <div><Label className="text-xs text-gray-500 mb-1 block">To</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" /></div>
        <Button className={btnPrimary} onClick={() => setApplied({ from, to })}>Apply</Button>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" className="gap-1.5" onClick={() => exportFn('csv')}><Download size={14} /> CSV</Button>
          <Button variant="outline" className="gap-1.5" onClick={() => exportFn('pdf')}><Download size={14} /> PDF</Button>
        </div>
      </div>

      {tab === 'assignments' ? (
        <HScroll>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              {['Staff', 'Role', 'Machine', 'Type', 'Work Order', 'Client', 'Assignment', 'From', 'To', 'Pay'].map(h =>
                <th key={h} className="py-2 px-3 whitespace-nowrap font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {(assignmentsQ.data ?? []).map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 px-3 whitespace-nowrap font-medium text-gray-700">{r.staffName}</td>
                  <td className="py-2 px-3">{r.role}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.machine ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.equipmentType ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.workOrderNumber ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.clientName ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.assignmentType ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.fromDate ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.toDate ?? 'Active'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.pay != null ? money(r.pay) : '—'}</td>
                </tr>
              ))}
              {assignmentsQ.data?.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-gray-400">No assignments in range</td></tr>}
            </tbody>
          </table>
        </HScroll>
      ) : (
        <HScroll>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              {['Machine', 'Type', 'Work Order', 'Client', 'Operator Cost', 'Cleaner Cost', 'Total'].map(h =>
                <th key={h} className="py-2 px-3 whitespace-nowrap font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {(costQ.data ?? []).map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 px-3 whitespace-nowrap font-medium text-gray-700">{r.machine ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.equipmentType ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.workOrderNumber ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{r.clientName ?? '—'}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{money(r.operatorCost)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{money(r.cleanerCost)}</td>
                  <td className="py-2 px-3 whitespace-nowrap font-semibold text-gray-800">{money(r.totalCost)}</td>
                </tr>
              ))}
              {costQ.data?.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-400">No shift cost in range</td></tr>}
            </tbody>
          </table>
        </HScroll>
      )}
    </div>
  )
}
