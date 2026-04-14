import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tiresApi } from '@/api/tires'
import type { Tire, TireStatus, TireType, TireFitting } from '@/types'
import { toast } from 'sonner'
import { Plus, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

const STATUS_COLORS: Record<TireStatus, string> = {
  IN_STOCK:   'bg-green-100 text-green-700',
  FITTED:     'bg-blue-100 text-blue-700',
  RETREADING: 'bg-yellow-100 text-yellow-700',
  SCRAPPED:   'bg-red-100 text-red-700',
  DISPOSED:   'bg-gray-100 text-gray-500',
}

const TIRE_TYPES: TireType[] = ['RADIAL', 'BIAS', 'TUBELESS', 'TUBE_TYPE']
const TIRE_TYPE_LABELS: Record<TireType, string> = {
  RADIAL: 'Radial', BIAS: 'Bias', TUBELESS: 'Tubeless', TUBE_TYPE: 'Tube Type',
}

// ── Add/Edit Tire Dialog ───────────────────────────────────────────────────────
function TireDialog({ open, onClose, tire }: { open: boolean; onClose: () => void; tire?: Tire }) {
  const qc = useQueryClient()
  const isEdit = !!tire

  const [form, setForm] = useState({
    serialNumber: tire?.serialNumber ?? '',
    brand: tire?.brand ?? '',
    size: tire?.size ?? '',
    tireType: (tire?.tireType ?? 'RADIAL') as TireType,
    plyRating: tire?.plyRating ?? '',
    purchaseDate: tire?.purchaseDate ?? '',
    purchaseCost: tire?.purchaseCost?.toString() ?? '',
    notes: tire?.notes ?? '',
  })

  const mutation = useMutation({
    mutationFn: (data: unknown) => isEdit ? tiresApi.update(tire!.id, data) : tiresApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Tire updated' : 'Tire added')
      qc.invalidateQueries({ queryKey: ['tires'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({
      ...form,
      purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
      purchaseDate: form.purchaseDate || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Tire' : 'Add Tire'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Serial Number *</Label>
              <Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} placeholder="TYR-001" required disabled={isEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Brand *</Label>
              <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="MRF" required />
            </div>
            <div className="space-y-1.5">
              <Label>Size *</Label>
              <Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="295/80 R22.5" required />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.tireType}
                onChange={e => setForm(f => ({ ...f, tireType: e.target.value as TireType }))}
              >
                {TIRE_TYPES.map(t => <option key={t} value={t}>{TIRE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ply Rating</Label>
              <Input value={form.plyRating} onChange={e => setForm(f => ({ ...f, plyRating: e.target.value }))} placeholder="18PR" />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Cost (₹)</Label>
              <Input type="number" value={form.purchaseCost} onChange={e => setForm(f => ({ ...f, purchaseCost: e.target.value }))} placeholder="12000" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Tire'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Tire History Dialog ────────────────────────────────────────────────────────
function TireHistoryDialog({ open, onClose, tire }: { open: boolean; onClose: () => void; tire: Tire }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tire-history', tire.id],
    queryFn: () => tiresApi.getTireHistory(tire.id),
    enabled: open,
  })
  const fittings: TireFitting[] = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tire History — {tire.serialNumber}</DialogTitle>
          <p className="text-sm text-gray-500">{tire.brand} · {tire.size} · {TIRE_TYPE_LABELS[tire.tireType]}</p>
        </DialogHeader>
        <div className="pt-2">
          <div className="flex gap-6 text-sm text-gray-600 mb-4">
            <span>Retread count: <strong>{tire.retreadCount}</strong></span>
            <span>Total km: <strong>{Number(tire.totalLifetimeKm).toLocaleString('en-IN')}</strong></span>
          </div>
          {isLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
          ) : fittings.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No fitting history yet</p>
          ) : (
            <div className="space-y-3">
              {fittings.map(f => (
                <div key={f.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{f.vehicleRegistrationNumber} — Position {f.positionCode}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', f.removedDate ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700')}>
                      {f.removedDate ? 'Removed' : 'Currently Fitted'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>Fitted: {fmtDate(f.fittedDate)} at {Number(f.fittedAtKm).toLocaleString('en-IN')} km</div>
                    {f.removedDate && (
                      <div>Removed: {fmtDate(f.removedDate)} at {Number(f.removedAtKm).toLocaleString('en-IN')} km · {f.removalReason} · {Number(f.kmDriven ?? 0).toLocaleString('en-IN')} km driven</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TireInventoryPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TireStatus | 'ALL'>('ALL')
  const [addOpen, setAddOpen] = useState(false)
  const [editTire, setEditTire] = useState<Tire | null>(null)
  const [historyTire, setHistoryTire] = useState<Tire | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tires'],
    queryFn: tiresApi.getAll,
  })
  const tires: Tire[] = data?.data ?? []

  const filtered = tires.filter(t => {
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q || t.serialNumber.toLowerCase().includes(q) || t.brand.toLowerCase().includes(q) || t.size.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const stats = {
    total:      tires.length,
    fitted:     tires.filter(t => t.status === 'FITTED').length,
    inStock:    tires.filter(t => t.status === 'IN_STOCK').length,
    retreading: tires.filter(t => t.status === 'RETREADING').length,
    scrapped:   tires.filter(t => t.status === 'SCRAPPED').length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tire Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all tires across the fleet</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
            <Plus size={14} /> Add Tire
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',      value: stats.total,      color: 'bg-gray-50 border-gray-200' },
          { label: 'Fitted',     value: stats.fitted,     color: 'bg-blue-50 border-blue-200' },
          { label: 'In Stock',   value: stats.inStock,    color: 'bg-green-50 border-green-200' },
          { label: 'Retreading', value: stats.retreading, color: 'bg-yellow-50 border-yellow-200' },
          { label: 'Scrapped',   value: stats.scrapped,   color: 'bg-red-50 border-red-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={cn('rounded-xl border p-4', color)}>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8 h-9"
            placeholder="Search serial, brand, size…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm h-9"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TireStatus | 'ALL')}
        >
          <option value="ALL">All Statuses</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="FITTED">Fitted</option>
          <option value="RETREADING">Retreading</option>
          <option value="SCRAPPED">Scrapped</option>
          <option value="DISPOSED">Disposed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No tires found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Serial No.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Brand</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lifetime km</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Retreads</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(tire => (
                <tr key={tire.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setHistoryTire(tire)}>
                  <td className="px-4 py-3 font-medium text-gray-800">{tire.serialNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{tire.brand}</td>
                  <td className="px-4 py-3 text-gray-600">{tire.size}</td>
                  <td className="px-4 py-3 text-gray-500">{TIRE_TYPE_LABELS[tire.tireType]}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STATUS_COLORS[tire.status])}>
                      {tire.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{Number(tire.totalLifetimeKm).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-600">{tire.retreadCount}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setEditTire(tire) }}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && <TireDialog open={addOpen} onClose={() => setAddOpen(false)} />}
      {editTire && <TireDialog open={!!editTire} onClose={() => setEditTire(null)} tire={editTire} />}
      {historyTire && <TireHistoryDialog open={!!historyTire} onClose={() => setHistoryTire(null)} tire={historyTire} />}
    </div>
  )
}
