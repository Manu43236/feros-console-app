import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tiresApi } from '@/api/tires'
import { vehiclesApi } from '@/api/vehicles'
import { meterReadingsApi } from '@/api/meterReadings'
import type { Tire, TireStatus, TireType, TireFitting, TirePosition, TireRemovalReason } from '@/types'
import { toast } from 'sonner'
import { Plus, Search, RefreshCw, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/searchable-select'

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

const STATUS_LABELS: Record<TireStatus, string> = {
  IN_STOCK:   'In Stock',
  FITTED:     'Fitted',
  RETREADING: 'Retreading',
  SCRAPPED:   'Scrapped',
  DISPOSED:   'Disposed',
}

const TIRE_TYPES: TireType[] = ['RADIAL', 'BIAS', 'TUBELESS', 'TUBE_TYPE']
const TIRE_TYPE_LABELS: Record<TireType, string> = {
  RADIAL: 'Radial', BIAS: 'Bias', TUBELESS: 'Tubeless', TUBE_TYPE: 'Tube Type',
}

const REMOVAL_REASONS: { value: TireRemovalReason; label: string }[] = [
  { value: 'WORN',     label: 'Worn Out' },
  { value: 'PUNCTURE', label: 'Puncture' },
  { value: 'DAMAGE',   label: 'Damage' },
  { value: 'RETREAD',  label: 'Send for Retread' },
  { value: 'SCRAP',    label: 'Scrap' },
  { value: 'OTHER',    label: 'Other' },
]

// ── Add / Edit Tire Dialog ──────────────────────────────────────────────────
function AddEditTireDialog({ open, onClose, tire }: { open: boolean; onClose: () => void; tire?: Tire }) {
  const qc = useQueryClient()
  const isEdit = !!tire

  const [form, setForm] = useState({
    serialNumber:  tire?.serialNumber ?? '',
    brand:         tire?.brand ?? '',
    size:          tire?.size ?? '',
    tireType:      (tire?.tireType ?? 'RADIAL') as TireType,
    plyRating:     tire?.plyRating ?? '',
    purchaseDate:  tire?.purchaseDate ?? '',
    purchaseCost:  tire?.purchaseCost?.toString() ?? '',
    tyreLifeYears: tire?.tyreLifeYears?.toString() ?? '',
    maxLifetimeKm: tire?.maxLifetimeKm?.toString() ?? '',
    notes:         tire?.notes ?? '',
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
      purchaseCost:  form.purchaseCost  ? Number(form.purchaseCost)  : undefined,
      purchaseDate:  form.purchaseDate  || undefined,
      tyreLifeYears: form.tyreLifeYears ? Number(form.tyreLifeYears) : undefined,
      maxLifetimeKm: form.maxLifetimeKm ? Number(form.maxLifetimeKm) : undefined,
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
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.tireType} onChange={e => setForm(f => ({ ...f, tireType: e.target.value as TireType }))}>
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
            <div className="space-y-1.5">
              <Label>Tyre Life (Years)</Label>
              <Input type="number" value={form.tyreLifeYears} onChange={e => setForm(f => ({ ...f, tyreLifeYears: e.target.value }))} placeholder="5" />
            </div>
            <div className="space-y-1.5">
              <Label>Max Lifetime KM</Label>
              <Input type="number" value={form.maxLifetimeKm} onChange={e => setForm(f => ({ ...f, maxLifetimeKm: e.target.value }))} placeholder="100000" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
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

// ── Fit Tire Dialog ─────────────────────────────────────────────────────────
function FitTireDialog({ open, onClose, tire }: { open: boolean; onClose: () => void; tire: Tire }) {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId] = useState(0)
  const [form, setForm] = useState({
    positionId: 0,
    fittedAtKm: '',
    fittedDate: new Date().toISOString().split('T')[0],
    notes:      '',
  })

  const { data: vehiclesData } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll() })
  const vehicles = (vehiclesData?.data ?? []).filter(v => v.isActive)

  const { data: positionsData } = useQuery({
    queryKey: ['tire-positions-current', vehicleId],
    queryFn:  () => tiresApi.getCurrentPositions(vehicleId),
    enabled:  vehicleId > 0,
  })
  const allPositions: TirePosition[]   = positionsData?.data ?? []
  const emptyPositions: TirePosition[] = allPositions.filter(p => !p.currentFitting)

  const { data: meterData } = useQuery({
    queryKey: ['meter-readings', vehicleId],
    queryFn:  () => meterReadingsApi.getAll(vehicleId),
    enabled:  vehicleId > 0,
  })

  // Auto-fill odometer from latest meter reading when vehicle is selected
  useEffect(() => {
    const readings = meterData?.data ?? []
    if (readings.length > 0) {
      setForm(f => ({ ...f, fittedAtKm: String(readings[0].readingKm) }))
    } else {
      setForm(f => ({ ...f, fittedAtKm: '' }))
    }
  }, [meterData])

  const mutation = useMutation({
    mutationFn: () => tiresApi.fitTire({
      vehicleId,
      tireId:     tire.id,
      positionId: form.positionId,
      fittedAtKm: Number(form.fittedAtKm),
      fittedDate: form.fittedDate || undefined,
      notes:      form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Tire fitted successfully')
      qc.invalidateQueries({ queryKey: ['tires'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to fit tire'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fit Tire to Vehicle</DialogTitle>
          <p className="text-sm text-gray-500">{tire.serialNumber} — {tire.brand} {tire.size}</p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Vehicle *</Label>
            <SearchableSelect
              value={vehicleId === 0 ? '' : String(vehicleId)}
              onValueChange={val => { setVehicleId(Number(val)); setForm(f => ({ ...f, positionId: 0 })) }}
              options={vehicles.map(v => ({ value: String(v.id), label: `${v.registrationNumber} — ${v.vehicleTypeName}` }))}
              placeholder="Select vehicle…"
            />
          </div>

          {vehicleId > 0 && (
            <div className="space-y-1.5">
              <Label>Position *</Label>
              {allPositions.length === 0 ? (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-md">
                  No tyre positions configured for this vehicle. Please set up positions in the Vehicle detail page first.
                </p>
              ) : emptyPositions.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md">
                  All positions on this vehicle are occupied.
                </p>
              ) : (
                <SearchableSelect
                  value={form.positionId === 0 ? '' : String(form.positionId)}
                  onValueChange={val => setForm(f => ({ ...f, positionId: Number(val) }))}
                  options={emptyPositions.map(p => ({ value: String(p.id), label: `${p.positionCode} (${p.positionType})` }))}
                  placeholder="Select position…"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Odometer at Fitting (km) *</Label>
              <Input type="number" value={form.fittedAtKm} onChange={e => setForm(f => ({ ...f, fittedAtKm: e.target.value }))} placeholder="48230" />
            </div>
            <div className="space-y-1.5">
              <Label>Fitting Date</Label>
              <Input type="date" value={form.fittedDate} onChange={e => setForm(f => ({ ...f, fittedDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || vehicleId === 0 || form.positionId === 0 || !form.fittedAtKm}
            onClick={() => mutation.mutate()}
            className="bg-feros-navy hover:bg-feros-navy/90 text-white"
          >
            {mutation.isPending ? 'Fitting…' : 'Fit Tire'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Remove Tire Dialog ──────────────────────────────────────────────────────
function RemoveTireDialog({ open, onClose, tire }: { open: boolean; onClose: () => void; tire: Tire }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    removedAtKm:        '',
    removedDate:        new Date().toISOString().split('T')[0],
    removalReason:      '' as TireRemovalReason | '',
    retreaderName:      '',
    expectedReturnDate: '',
    notes:              '',
  })

  const mutation = useMutation({
    mutationFn: () => tiresApi.removeTire(tire.currentFittingId!, {
      removedAtKm:        Number(form.removedAtKm),
      removedDate:        form.removedDate || undefined,
      removalReason:      form.removalReason as TireRemovalReason,
      retreaderName:      form.retreaderName || undefined,
      expectedReturnDate: form.expectedReturnDate || undefined,
      notes:              form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Tire removed successfully')
      qc.invalidateQueries({ queryKey: ['tires'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to remove tire'),
  })

  const isRetread = form.removalReason === 'RETREAD'
  const isScrap   = form.removalReason === 'SCRAP'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Tire</DialogTitle>
          <p className="text-sm text-gray-500">
            {tire.serialNumber} — {tire.currentVehicleRegistrationNumber} · {tire.currentPositionCode}
          </p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {(isRetread || isScrap) && (
            <div className={cn('rounded-lg px-3 py-2 text-sm border', isRetread ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700')}>
              {isRetread
                ? 'Tire will be sent for retreading. Status will change to Retreading.'
                : 'Tire will be permanently scrapped. This cannot be undone.'}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Removal Reason *</Label>
            <SearchableSelect
              value={form.removalReason}
              onValueChange={val => setForm(f => ({ ...f, removalReason: val as TireRemovalReason, retreaderName: '', expectedReturnDate: '' }))}
              options={REMOVAL_REASONS.map(r => ({ value: r.value, label: r.label }))}
              placeholder="Select reason…"
              showSearch={false}
            />
          </div>
          {isRetread && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Retreader Name</Label>
                <Input value={form.retreaderName} onChange={e => setForm(f => ({ ...f, retreaderName: e.target.value }))} placeholder="e.g. MRF Retread Centre" />
              </div>
              <div className="space-y-1.5">
                <Label>Expected Return Date</Label>
                <Input type="date" value={form.expectedReturnDate} onChange={e => setForm(f => ({ ...f, expectedReturnDate: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Odometer at Removal (km) *</Label>
              <Input type="number" value={form.removedAtKm} onChange={e => setForm(f => ({ ...f, removedAtKm: e.target.value }))} placeholder="52000" />
            </div>
            <div className="space-y-1.5">
              <Label>Removal Date</Label>
              <Input type="date" value={form.removedDate} onChange={e => setForm(f => ({ ...f, removedDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !form.removalReason || !form.removedAtKm}
            onClick={() => mutation.mutate()}
            className={cn(isScrap ? 'bg-red-600 hover:bg-red-700' : 'bg-feros-navy hover:bg-feros-navy/90', 'text-white')}
          >
            {mutation.isPending ? 'Removing…' : 'Remove Tire'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Back to Stock Dialog ────────────────────────────────────────────────────
function BackToStockDialog({ open, onClose, tire }: { open: boolean; onClose: () => void; tire: Tire }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => tiresApi.backToStock(tire.id),
    onSuccess: () => {
      toast.success('Tire marked as back in stock')
      qc.invalidateQueries({ queryKey: ['tires'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Retread Complete</DialogTitle></DialogHeader>
        <div className="py-2 space-y-1">
          <p className="text-sm text-gray-700">Mark <strong>{tire.serialNumber}</strong> as back in stock?</p>
          <p className="text-sm text-gray-400">The tire has returned from retreading and is ready to be fitted again.</p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className="bg-green-600 hover:bg-green-700 text-white">
            {mutation.isPending ? 'Updating…' : 'Back to Stock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tire History Dialog ─────────────────────────────────────────────────────
function TireHistoryDialog({ open, onClose, tire }: { open: boolean; onClose: () => void; tire: Tire }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tire-history', tire.id],
    queryFn:  () => tiresApi.getTireHistory(tire.id),
    enabled:  open,
  })
  const fittings: TireFitting[] = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fitting History — {tire.serialNumber}</DialogTitle>
          <p className="text-sm text-gray-500">{tire.brand} · {tire.size} · {TIRE_TYPE_LABELS[tire.tireType]}</p>
        </DialogHeader>
        <div className="pt-2">
          <div className="flex gap-6 text-sm text-gray-600 mb-4">
            <span>Retread count: <strong>{tire.retreadCount}x</strong></span>
            <span>Total lifetime KM: <strong>{Number(tire.totalLifetimeKm).toLocaleString('en-IN')} km</strong></span>
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
                      <div>
                        Removed: {fmtDate(f.removedDate)} at {Number(f.removedAtKm).toLocaleString('en-IN')} km
                        · {f.removalReason?.replace('_', ' ')}
                        · {Number(f.kmDriven ?? 0).toLocaleString('en-IN')} km driven
                      </div>
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

// ── Main Page ───────────────────────────────────────────────────────────────
type ActiveFilter = TireStatus | 'ALL'

export default function TireInventoryPage() {
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>('ALL')
  const [addOpen, setAddOpen]           = useState(false)
  const [editTire, setEditTire]         = useState<Tire | null>(null)
  const [fitTire, setFitTire]           = useState<Tire | null>(null)
  const [removeTire, setRemoveTire]     = useState<Tire | null>(null)
  const [backToStock, setBackToStock]   = useState<Tire | null>(null)
  const [historyTire, setHistoryTire]   = useState<Tire | null>(null)

  const { data, isLoading, refetch } = useQuery({ queryKey: ['tires'], queryFn: tiresApi.getAll })
  const tires: Tire[] = data?.data ?? []

  const filtered = tires.filter(t => {
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.serialNumber.toLowerCase().includes(q) ||
      t.brand.toLowerCase().includes(q) ||
      t.size.toLowerCase().includes(q) ||
      (t.currentVehicleRegistrationNumber ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const stats = {
    total:      tires.length,
    inStock:    tires.filter(t => t.status === 'IN_STOCK').length,
    fitted:     tires.filter(t => t.status === 'FITTED').length,
    retreading: tires.filter(t => t.status === 'RETREADING').length,
    scrapped:   tires.filter(t => t.status === 'SCRAPPED').length,
  }

  const STAT_CARDS: { label: string; value: number; color: string; filter: ActiveFilter }[] = [
    { label: 'Total',      value: stats.total,      color: 'bg-gray-50   border-gray-200',   filter: 'ALL'        },
    { label: 'In Stock',   value: stats.inStock,    color: 'bg-green-50  border-green-200',  filter: 'IN_STOCK'   },
    { label: 'Fitted',     value: stats.fitted,     color: 'bg-blue-50   border-blue-200',   filter: 'FITTED'     },
    { label: 'Retreading', value: stats.retreading, color: 'bg-yellow-50 border-yellow-200', filter: 'RETREADING' },
    { label: 'Scrapped',   value: stats.scrapped,   color: 'bg-red-50    border-red-200',    filter: 'SCRAPPED'   },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tire Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all tires across the fleet</p>
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

      {/* Stat cards — click to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAT_CARDS.map(({ label, value, color, filter }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(statusFilter === filter ? 'ALL' : filter)}
            className={cn('rounded-xl border p-4 text-left transition-all hover:shadow-sm', color, statusFilter === filter && 'ring-2 ring-feros-orange')}
          >
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-8 h-9"
          placeholder="Search serial, brand, size, vehicle…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No tires found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Serial No.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand & Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle / Retreader</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lifetime KM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Retreads</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(tire => (
                  <tr key={tire.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium text-gray-800">{tire.serialNumber}</p>
                      {tire.expiryDate && (() => {
                        const daysLeft = Math.ceil((new Date(tire.expiryDate).getTime() - Date.now()) / 86400000)
                        if (daysLeft < 0)
                          return <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Expired</span>
                        if (daysLeft <= 15)
                          return <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Expiring in {daysLeft}d</span>
                        return null
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{tire.brand}</p>
                      <p className="text-xs text-gray-400">{tire.size}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STATUS_COLORS[tire.status])}>
                        {STATUS_LABELS[tire.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tire.status === 'FITTED' && tire.currentVehicleRegistrationNumber ? (
                        <div>
                          <p className="font-medium text-gray-800">{tire.currentVehicleRegistrationNumber}</p>
                          <p className="text-xs text-gray-400">{tire.currentPositionCode}</p>
                        </div>
                      ) : tire.status === 'RETREADING' ? (
                        <div>
                          <p className="font-medium text-gray-700">{tire.retreaderName ?? '—'}</p>
                          {tire.expectedReturnDate && (
                            <p className="text-xs text-gray-400">Due {fmtDate(tire.expectedReturnDate)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{Number(tire.totalLifetimeKm).toLocaleString('en-IN')} km</td>
                    <td className="px-4 py-3 text-gray-600">{tire.retreadCount}x</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-gray-500 hover:text-gray-700"
                          onClick={() => setHistoryTire(tire)}>
                          <History size={12} /> History
                        </Button>
                        {tire.status === 'IN_STOCK' && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditTire(tire)}>Edit</Button>
                            <Button size="sm" className="h-7 text-xs bg-feros-navy hover:bg-feros-navy/90 text-white"
                              onClick={() => setFitTire(tire)}>
                              Fit to Vehicle
                            </Button>
                          </>
                        )}
                        {tire.status === 'FITTED' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => setRemoveTire(tire)}>
                            Remove
                          </Button>
                        )}
                        {tire.status === 'RETREADING' && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditTire(tire)}>Edit</Button>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => setBackToStock(tire)}>
                              Back to Stock
                            </Button>
                          </>
                        )}
                        {(tire.status === 'SCRAPPED' || tire.status === 'DISPOSED') && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditTire(tire)}>Edit</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {addOpen     && <AddEditTireDialog open onClose={() => setAddOpen(false)} />}
      {editTire    && <AddEditTireDialog open onClose={() => setEditTire(null)}    tire={editTire} />}
      {fitTire     && <FitTireDialog     open onClose={() => setFitTire(null)}     tire={fitTire} />}
      {removeTire  && <RemoveTireDialog  open onClose={() => setRemoveTire(null)}  tire={removeTire} />}
      {backToStock && <BackToStockDialog open onClose={() => setBackToStock(null)} tire={backToStock} />}
      {historyTire && <TireHistoryDialog open onClose={() => setHistoryTire(null)} tire={historyTire} />}
    </div>
  )
}
