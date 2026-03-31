import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vehicleServicesApi } from '@/api/vehicles'
import type { VehicleServiceRecord, ServiceDisplayStatus } from '@/types'
import { toast } from 'sonner'
import { Search, Wrench, IndianRupee, AlertTriangle, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusChip(s: ServiceDisplayStatus) {
  const map: Record<ServiceDisplayStatus, { label: string; cls: string }> = {
    OPEN:      { label: 'Open',      cls: 'bg-blue-50 text-blue-700' },
    DUE_SOON:  { label: 'Due Soon',  cls: 'bg-yellow-50 text-yellow-700' },
    OVERDUE:   { label: 'Overdue',   cls: 'bg-red-50 text-red-700' },
    COMPLETED: { label: 'Completed', cls: 'bg-green-50 text-green-700' },
  }
  const { label, cls } = map[s] ?? map.OPEN
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

function triggeredByChip(t: string) {
  return t === 'BREAKDOWN'
    ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700">Breakdown</span>
    : <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">Scheduled</span>
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// ── Delete Dialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ record, onClose }: { record: VehicleServiceRecord | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: number) => vehicleServicesApi.delete(id),
    onSuccess: () => {
      toast.success('Service record deleted')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to delete')
    },
  })

  return (
    <Dialog open={!!record} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete Service Record</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          Delete service <strong>{record?.serviceNumber}</strong> for{' '}
          <strong>{record?.vehicleRegistrationNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={mutation.isPending}
            onClick={() => record && mutation.mutate(record.id)}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({ record, onDelete }: { record: VehicleServiceRecord; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border hover:border-gray-300 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{record.vehicleRegistrationNumber}</span>
              <span className="text-xs text-gray-400">{record.serviceNumber}</span>
              {statusChip(record.displayStatus)}
              {triggeredByChip(record.triggeredBy)}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              {record.serviceType === 'EXTERNAL' && record.vendorName && (
                <span>Vendor: <span className="text-gray-700">{record.vendorName}</span></span>
              )}
              {record.serviceType === 'INTERNAL' && (
                <span className="text-gray-700">Internal (Self)</span>
              )}
              {record.serviceDate && (
                <span>Date: <span className="text-gray-700">{record.serviceDate}</span></span>
              )}
              {record.dueAtOdometer && (
                <span>Due at: <span className="text-gray-700">{record.dueAtOdometer.toLocaleString('en-IN')} km</span></span>
              )}
              {record.odometer && (
                <span>Odometer: <span className="text-gray-700">{record.odometer.toLocaleString('en-IN')} km</span></span>
              )}
              {record.completedDate && (
                <span>Completed: <span className="text-gray-700">{record.completedDate}</span></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {record.totalCost != null && record.totalCost > 0 && (
              <span className="text-sm font-semibold text-gray-900">{fmt(record.totalCost)}</span>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title={expanded ? 'Collapse' : 'Expand tasks'}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {expanded && record.tasks && record.tasks.length > 0 && (
        <div className="border-t px-4 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tasks</p>
          <div className="space-y-1.5">
            {record.tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-700">{t.displayName}</span>
                  {t.isRecurring && t.frequencyKm && (
                    <span className="text-xs text-gray-400">every {t.frequencyKm.toLocaleString('en-IN')} km</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {t.cost != null && <span className="text-gray-500 text-xs">{fmt(t.cost)}</span>}
                  <span className={`text-xs ${t.status === 'COMPLETED' ? 'text-green-600' : 'text-gray-400'}`}>
                    {t.status === 'COMPLETED' ? 'Done' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {record.notes && (
            <p className="text-xs text-gray-500 mt-2 border-t pt-2">{record.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type FilterType = 'ALL' | ServiceDisplayStatus

export default function VehicleServicesPage() {
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<FilterType>('ALL')
  const [toDelete, setToDelete] = useState<VehicleServiceRecord | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-services'],
    queryFn:  vehicleServicesApi.getAll,
  })
  const records = [...(data?.data ?? [])].sort((a, b) => b.id - a.id)

  const filtered = records.filter(r => {
    const matchSearch =
      r.vehicleRegistrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.serviceNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.vendorName ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'ALL' || r.displayStatus === filter
    return matchSearch && matchFilter
  })

  const totalCost = records.reduce((s, r) => s + (r.totalCost ?? 0), 0)
  const dueSoon   = records.filter(r => r.displayStatus === 'DUE_SOON').length
  const overdue   = records.filter(r => r.displayStatus === 'OVERDUE').length

  const filterPills: { label: string; value: FilterType; count?: number }[] = [
    { label: 'All',       value: 'ALL',       count: records.length },
    { label: 'Open',      value: 'OPEN' },
    { label: 'Due Soon',  value: 'DUE_SOON',  count: dueSoon },
    { label: 'Overdue',   value: 'OVERDUE',   count: overdue },
    { label: 'Completed', value: 'COMPLETED' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Services</h1>
        <p className="text-sm text-gray-500 mt-0.5">All service records across your fleet</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 rounded-lg"><Wrench size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Records</p>
            <p className="text-lg font-bold text-gray-900">{records.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-green-50 rounded-lg"><IndianRupee size={20} className="text-green-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Service Cost</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalCost)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-red-50 rounded-lg"><AlertTriangle size={20} className="text-red-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Needs Attention</p>
            <p className="text-lg font-bold text-gray-900">{dueSoon + overdue}</p>
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {filterPills.map(p => (
            <button
              key={p.value}
              onClick={() => setFilter(p.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === p.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border text-gray-600 hover:border-gray-400'
              }`}
            >
              {p.label}
              {p.count != null && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  filter === p.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {p.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <Input
            placeholder="Search vehicle, service no…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm w-52"
          />
        </div>
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Wrench size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">
            {search || filter !== 'ALL' ? 'No records match your filters' : 'No service records yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ServiceCard key={r.id} record={r} onDelete={() => setToDelete(r)} />
          ))}
        </div>
      )}

      <DeleteDialog record={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}
