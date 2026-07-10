import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, Wrench, IndianRupee, AlertTriangle, Trash2, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { equipmentApi } from '@/api/equipment'
import type { EquipmentServiceRecord, ServiceDisplayStatus } from '@/api/equipment'
import { EquipmentServiceDetailModal } from './EquipmentServiceDetailModal'

const EQUIP = '#1C1400'
const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

function fmtDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusChip(s: ServiceDisplayStatus) {
  const map: Record<string, { label: string; cls: string }> = {
    OPEN:        { label: 'Open',        cls: 'bg-blue-50 text-blue-700' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-orange-50 text-orange-700' },
    DUE_SOON:    { label: 'Due Soon',    cls: 'bg-yellow-50 text-yellow-700' },
    OVERDUE:     { label: 'Overdue',     cls: 'bg-red-50 text-red-700' },
    COMPLETED:   { label: 'Completed',   cls: 'bg-green-50 text-green-700' },
  }
  const { label, cls } = map[s] ?? map.OPEN
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

function triggeredByChip(t: string) {
  const map: Record<string, { label: string; cls: string }> = {
    SCHEDULED:  { label: 'Scheduled',  cls: 'bg-purple-50 text-purple-700' },
    BREAKDOWN:  { label: 'Breakdown',  cls: 'bg-orange-50 text-orange-700' },
    ACCIDENT:   { label: 'Accident',   cls: 'bg-red-50 text-red-700' },
    COMPLIANCE: { label: 'Compliance', cls: 'bg-blue-50 text-blue-700' },
    WARRANTY:   { label: 'Warranty',   cls: 'bg-green-50 text-green-700' },
  }
  const { label, cls } = map[t] ?? map.SCHEDULED
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

type FilterType = 'ALL' | ServiceDisplayStatus

function DeleteDialog({ record, onClose }: { record: EquipmentServiceRecord | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (r: EquipmentServiceRecord) => equipmentApi.deleteService(r.equipmentId, r.id),
    onSuccess: () => { toast.success('Service record deleted'); qc.invalidateQueries({ queryKey: ['eq-services'] }); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
  })
  return (
    <Dialog open={!!record} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete service record?</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">This will remove service <b>{record?.serviceNumber}</b>. This can't be undone.</p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={mut.isPending} onClick={() => record && mut.mutate(record)}
            className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EquipmentServicesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [toDelete, setToDelete] = useState<EquipmentServiceRecord | null>(null)
  const [detail, setDetail] = useState<EquipmentServiceRecord | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['eq-services', 'all'], queryFn: equipmentApi.getAllServices })
  const records = [...((data?.data ?? []) as EquipmentServiceRecord[])].sort((a, b) => b.id - a.id)

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    const matchSearch =
      (r.equipmentName ?? '').toLowerCase().includes(q) ||
      (r.equipmentIdentifier ?? '').toLowerCase().includes(q) ||
      (r.serviceNumber ?? '').toLowerCase().includes(q) ||
      (r.vendorName ?? '').toLowerCase().includes(q)
    const matchFilter = filter === 'ALL' || r.displayStatus === filter
    return matchSearch && matchFilter
  })

  const totalCost = records.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  const dueSoon   = records.filter(r => r.displayStatus === 'DUE_SOON').length
  const overdue   = records.filter(r => r.displayStatus === 'OVERDUE').length
  const inProgress = records.filter(r => r.displayStatus === 'IN_PROGRESS').length

  const filterPills: { label: string; value: FilterType; count?: number }[] = [
    { label: 'All',         value: 'ALL',         count: records.length },
    { label: 'Open',        value: 'OPEN' },
    { label: 'In Progress', value: 'IN_PROGRESS', count: inProgress },
    { label: 'Due Soon',    value: 'DUE_SOON',    count: dueSoon },
    { label: 'Overdue',     value: 'OVERDUE',     count: overdue },
    { label: 'Completed',   value: 'COMPLETED' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipment Services</h1>
        <p className="text-sm text-gray-500 mt-0.5">All service records across your machines</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 rounded-lg"><Wrench size={20} className="text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Total Records</p><p className="text-lg font-bold text-gray-900">{records.length}</p></div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-green-50 rounded-lg"><IndianRupee size={20} className="text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Total Service Cost</p><p className="text-lg font-bold text-gray-900">{fmt(totalCost)}</p></div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-red-50 rounded-lg"><AlertTriangle size={20} className="text-red-600" /></div>
          <div><p className="text-xs text-gray-500">Needs Attention</p><p className="text-lg font-bold text-gray-900">{dueSoon + overdue}</p></div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 max-w-sm">
        <Search size={14} className="text-gray-400" />
        <Input placeholder="Search machine, service no…" value={search} onChange={e => setSearch(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm w-52" />
      </div>

      <div className="flex gap-6 items-start">
        {/* Left filter */}
        <div className="w-44 shrink-0 bg-white border rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 pb-1">Status</p>
          {filterPills.map(p => (
            <button key={p.value} onClick={() => setFilter(p.value)}
              className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === p.value ? 'text-white' : 'text-gray-600 hover:bg-gray-50')}
              style={filter === p.value ? { background: EQUIP } : undefined}>
              <span>{p.label}</span>
              {p.count != null && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', filter === p.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>{p.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Records */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Wrench size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">{search || filter !== 'ALL' ? 'No records match your filters' : 'No service records yet'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
                <div key={r.id} className="bg-white rounded-xl border p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <button className="flex-1 min-w-0 text-left" onClick={() => setDetail(r)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{r.equipmentName ?? r.equipmentIdentifier ?? 'Machine'}</span>
                        {statusChip(r.displayStatus)}
                        {triggeredByChip(r.triggeredBy)}
                        {r.serviceNumber && <span className="text-xs text-gray-400 font-mono">{r.serviceNumber}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                        <span><Calendar size={11} className="inline mr-1" />{fmtDate(r.serviceDate)}</span>
                        {r.vendorName && <span>{r.vendorName}</span>}
                        {r.totalCost != null && <span className="font-medium text-gray-700">{fmt(r.totalCost)}</span>}
                      </div>
                    </button>
                    {r.status === 'OPEN' && (
                      <button onClick={() => setToDelete(r)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DeleteDialog record={toDelete} onClose={() => setToDelete(null)} />
      <EquipmentServiceDetailModal service={detail} open={!!detail} onClose={() => setDetail(null)} />

    </div>
  )
}
