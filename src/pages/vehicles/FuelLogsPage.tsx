import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fuelLogsApi } from '@/api/fuelLogs'
import { vehiclesApi } from '@/api/vehicles'
import type { FuelLog, FuelPaymentMode, Vehicle } from '@/types'
import { toast } from 'sonner'
import {
  Fuel, IndianRupee, Gauge, TrendingUp, Search, Plus, Trash2,
  Edit2, Upload, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const fmtNum = (n: number, dec = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })

function paymentChip(mode: FuelPaymentMode) {
  const map: Record<FuelPaymentMode, { label: string; cls: string }> = {
    CASH:            { label: 'Cash',            cls: 'bg-green-50 text-green-700' },
    COMPANY_ACCOUNT: { label: 'Company Account', cls: 'bg-blue-50 text-blue-700' },
    REIMBURSEMENT:   { label: 'Reimbursement',   cls: 'bg-purple-50 text-purple-700' },
  }
  const { label, cls } = map[mode] ?? map.CASH
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

// ── Delete Dialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ log, onClose }: { log: FuelLog | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: number) => fuelLogsApi.delete(id),
    onSuccess: () => {
      toast.success('Fuel log deleted')
      qc.invalidateQueries({ queryKey: ['fuel-logs'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to delete')
    },
  })

  return (
    <Dialog open={!!log} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete Fuel Log</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          Delete fuel entry for <strong>{log?.vehicleRegistrationNumber}</strong> on{' '}
          <strong>{log?.fillDate}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={mutation.isPending}
            onClick={() => log && mutation.mutate(log.id)}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add / Edit Dialog ─────────────────────────────────────────────────────────
interface FuelLogForm {
  vehicleId: string
  fillDate: string
  litresFilled: string
  odometerReading: string
  costPerLitre: string
  totalCost: string
  isFullTank: boolean
  paymentMode: FuelPaymentMode
  fuelStationName: string
  fuelStationCity: string
  notes: string
  receiptUrl: string
}

const BLANK: FuelLogForm = {
  vehicleId: '', fillDate: '', litresFilled: '', odometerReading: '',
  costPerLitre: '', totalCost: '', isFullTank: false,
  paymentMode: 'CASH', fuelStationName: '', fuelStationCity: '',
  notes: '', receiptUrl: '',
}

function toForm(log: FuelLog): FuelLogForm {
  return {
    vehicleId:       String(log.vehicleId),
    fillDate:        log.fillDate,
    litresFilled:    String(log.litresFilled),
    odometerReading: String(log.odometerReading),
    costPerLitre:    String(log.costPerLitre),
    totalCost:       String(log.totalCost),
    isFullTank:      log.isFullTank,
    paymentMode:     log.paymentMode,
    fuelStationName: log.fuelStationName ?? '',
    fuelStationCity: log.fuelStationCity ?? '',
    notes:           log.notes ?? '',
    receiptUrl:      log.receiptUrl ?? '',
  }
}

function FuelLogDialog({
  editing, open, onClose, vehicles,
}: {
  editing: FuelLog | null
  open: boolean
  onClose: () => void
  vehicles: Vehicle[]
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<FuelLogForm>(() => editing ? toForm(editing) : BLANK)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Reset form when dialog opens
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setForm(editing ? toForm(editing) : BLANK)
  }

  const set = (field: keyof FuelLogForm, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }))

  // Auto-calc total cost
  const autoTotal = () => {
    const l = parseFloat(form.litresFilled)
    const c = parseFloat(form.costPerLitre)
    if (!isNaN(l) && !isNaN(c)) set('totalCost', (l * c).toFixed(2))
  }

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editing
        ? fuelLogsApi.update(editing.id, data)
        : fuelLogsApi.create(data),
    onSuccess: () => {
      toast.success(editing ? 'Fuel log updated' : 'Fuel log added')
      qc.invalidateQueries({ queryKey: ['fuel-logs'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to save')
    },
  })

  async function handleUpload(file: File) {
    if (!form.vehicleId) { toast.error('Select a vehicle first'); return }
    setUploading(true)
    try {
      const res = await fuelLogsApi.uploadReceipt(Number(form.vehicleId), file)
      set('receiptUrl', res.data?.publicUrl ?? '')
      toast.success('Receipt uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    if (!form.vehicleId || !form.fillDate || !form.litresFilled || !form.odometerReading || !form.costPerLitre) {
      toast.error('Fill all required fields')
      return
    }
    const payload: Record<string, unknown> = {
      vehicleId:       Number(form.vehicleId),
      fillDate:        form.fillDate,
      litresFilled:    parseFloat(form.litresFilled),
      odometerReading: parseFloat(form.odometerReading),
      costPerLitre:    parseFloat(form.costPerLitre),
      totalCost:       form.totalCost ? parseFloat(form.totalCost) : undefined,
      isFullTank:      form.isFullTank,
      paymentMode:     form.paymentMode,
      fuelStationName: form.fuelStationName || undefined,
      fuelStationCity: form.fuelStationCity || undefined,
      notes:           form.notes || undefined,
      receiptUrl:      form.receiptUrl || undefined,
    }
    mutation.mutate(payload)
  }

  const PAYMENT_MODES: { value: FuelPaymentMode; label: string }[] = [
    { value: 'CASH',            label: 'Cash' },
    { value: 'COMPANY_ACCOUNT', label: 'Company Account' },
    { value: 'REIMBURSEMENT',   label: 'Reimbursement' },
  ]

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Fuel Log' : 'Add Fuel Log'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Vehicle */}
          <div>
            <Label>Vehicle *</Label>
            <SearchableSelect
              value={form.vehicleId}
              onValueChange={v => set('vehicleId', v)}
              options={vehicles.map(v => ({ value: String(v.id), label: v.registrationNumber }))}
              placeholder="Select vehicle…"
              className="mt-1"
            />
          </div>

          {/* Date */}
          <div>
            <Label>Fill Date *</Label>
            <Input type="date" className="mt-1" value={form.fillDate}
              onChange={e => set('fillDate', e.target.value)} />
          </div>

          {/* Litres + Cost per litre */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Litres Filled *</Label>
              <Input className="mt-1" type="number" step="0.01" placeholder="e.g. 50"
                value={form.litresFilled}
                onChange={e => set('litresFilled', e.target.value)}
                onBlur={autoTotal} />
            </div>
            <div>
              <Label>Cost / Litre (₹) *</Label>
              <Input className="mt-1" type="number" step="0.01" placeholder="e.g. 96.50"
                value={form.costPerLitre}
                onChange={e => set('costPerLitre', e.target.value)}
                onBlur={autoTotal} />
            </div>
          </div>

          {/* Total cost + Odometer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total Cost (₹)</Label>
              <Input className="mt-1" type="number" step="0.01" placeholder="Auto-calculated"
                value={form.totalCost}
                onChange={e => set('totalCost', e.target.value)} />
            </div>
            <div>
              <Label>Odometer Reading (km) *</Label>
              <Input className="mt-1" type="number" step="0.1" placeholder="e.g. 45820"
                value={form.odometerReading}
                onChange={e => set('odometerReading', e.target.value)} />
            </div>
          </div>

          {/* Payment mode + Full tank */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment Mode</Label>
              <SearchableSelect
                value={form.paymentMode}
                onValueChange={v => set('paymentMode', v as FuelPaymentMode)}
                options={PAYMENT_MODES.map(m => ({ value: m.value, label: m.label }))}
                placeholder="Select…"
                className="mt-1"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isFullTank}
                  onChange={e => set('isFullTank', e.target.checked)}
                  className="w-4 h-4 accent-feros-navy" />
                <span className="text-sm font-medium text-gray-700">Full Tank</span>
              </label>
            </div>
          </div>

          {/* Station details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fuel Station Name</Label>
              <Input className="mt-1" placeholder="e.g. HP Petrol Pump"
                value={form.fuelStationName}
                onChange={e => set('fuelStationName', e.target.value)} />
            </div>
            <div>
              <Label>City</Label>
              <Input className="mt-1" placeholder="e.g. Vizianagaram"
                value={form.fuelStationCity}
                onChange={e => set('fuelStationCity', e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional notes…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Receipt upload */}
          <div>
            <Label>Receipt</Label>
            <div className="mt-1 flex items-center gap-2">
              {form.receiptUrl ? (
                <>
                  <a href={form.receiptUrl} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 underline truncate max-w-[200px]">
                    View receipt
                  </a>
                  <button onClick={() => set('receiptUrl', '')}
                    className="text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <Button type="button" variant="outline" size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" />
                  {uploading ? 'Uploading…' : 'Upload Receipt'}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add Fuel Log'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Fuel Log Card ─────────────────────────────────────────────────────────────
function FuelLogCard({
  log, onEdit, onDelete,
}: {
  log: FuelLog
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-xl border hover:border-gray-300 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{log.vehicleRegistrationNumber}</span>
              {log.isFullTank && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700">Full Tank</span>
              )}
              {paymentChip(log.paymentMode)}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span>Date: <span className="text-gray-700">{log.fillDate}</span></span>
              <span>Litres: <span className="text-gray-700">{fmtNum(log.litresFilled)} L</span></span>
              <span>Odometer: <span className="text-gray-700">{fmtNum(log.odometerReading, 0)} km</span></span>
              {log.fuelStationName && (
                <span>Station: <span className="text-gray-700">{log.fuelStationName}{log.fuelStationCity ? `, ${log.fuelStationCity}` : ''}</span></span>
              )}
              {log.orderNumber && (
                <span>Order: <span className="text-gray-700">{log.orderNumber}</span></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-semibold text-gray-900">{fmt(log.totalCost)}</span>
            <button onClick={() => setExpanded(v => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-feros-navy rounded transition-colors" title="Edit">
              <Edit2 size={15} />
            </button>
            <button onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors" title="Delete">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gray-400 mb-0.5">Cost / Litre</p>
            <p className="font-medium text-gray-700">₹{fmtNum(log.costPerLitre)}</p>
          </div>
          {log.mileageKmPerLitre != null && (
            <div>
              <p className="text-gray-400 mb-0.5">Mileage</p>
              <p className="font-medium text-gray-700">{fmtNum(log.mileageKmPerLitre)} km/L</p>
            </div>
          )}
          {log.kmTravelled != null && (
            <div>
              <p className="text-gray-400 mb-0.5">KM Travelled</p>
              <p className="font-medium text-gray-700">{fmtNum(log.kmTravelled, 0)} km</p>
            </div>
          )}
          <div>
            <p className="text-gray-400 mb-0.5">Filled By</p>
            <p className="font-medium text-gray-700">{log.filledByName}</p>
          </div>
          {log.notes && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-gray-400 mb-0.5">Notes</p>
              <p className="text-gray-700">{log.notes}</p>
            </div>
          )}
          {log.receiptUrl && (
            <div>
              <a href={log.receiptUrl} target="_blank" rel="noreferrer"
                className="text-blue-600 underline text-xs">
                View Receipt
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type FilterMode = 'ALL' | FuelPaymentMode | 'FULL_TANK'

export default function FuelLogsPage() {
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<FilterMode>('ALL')
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<FuelLog | null>(null)
  const [toDelete, setToDelete] = useState<FuelLog | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['fuel-logs'],
    queryFn:  () => fuelLogsApi.getAll(),
  })
  const logs: FuelLog[] = [...(data?.data ?? [])].sort((a, b) => {
    const d = b.fillDate.localeCompare(a.fillDate)
    return d !== 0 ? d : b.id - a.id
  })

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  () => vehiclesApi.getAll(),
  })
  const vehicles: Vehicle[] = vehiclesData?.data ?? []

  const filtered = logs.filter(l => {
    const matchSearch =
      l.vehicleRegistrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      (l.fuelStationName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.fuelStationCity ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'ALL' ||
      (filter === 'FULL_TANK' ? l.isFullTank : l.paymentMode === filter)
    return matchSearch && matchFilter
  })

  // Stats
  const totalLitres = logs.reduce((s, l) => s + l.litresFilled, 0)
  const totalCost   = logs.reduce((s, l) => s + l.totalCost, 0)
  const mileageLogs = logs.filter(l => l.mileageKmPerLitre != null)
  const avgMileage  = mileageLogs.length > 0
    ? mileageLogs.reduce((s, l) => s + (l.mileageKmPerLitre ?? 0), 0) / mileageLogs.length
    : null

  const filterPills: { label: string; value: FilterMode; count?: number }[] = [
    { label: 'All',             value: 'ALL',            count: logs.length },
    { label: 'Full Tank',       value: 'FULL_TANK',      count: logs.filter(l => l.isFullTank).length },
    { label: 'Cash',            value: 'CASH',           count: logs.filter(l => l.paymentMode === 'CASH').length },
    { label: 'Company Account', value: 'COMPANY_ACCOUNT' },
    { label: 'Reimbursement',   value: 'REIMBURSEMENT' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track fuel consumption across your fleet</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus size={16} /> Add Fuel Log
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-orange-50 rounded-lg"><Fuel size={20} className="text-orange-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Entries</p>
            <p className="text-lg font-bold text-gray-900">{logs.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 rounded-lg"><Gauge size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Litres</p>
            <p className="text-lg font-bold text-gray-900">{fmtNum(totalLitres, 0)} L</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-green-50 rounded-lg"><IndianRupee size={20} className="text-green-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Spent</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalCost)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-purple-50 rounded-lg"><TrendingUp size={20} className="text-purple-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Avg Mileage</p>
            <p className="text-lg font-bold text-gray-900">
              {avgMileage != null ? `${fmtNum(avgMileage)} km/L` : '—'}
            </p>
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
            placeholder="Search vehicle, station…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm w-52"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Fuel size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">
            {search || filter !== 'ALL' ? 'No logs match your filters' : 'No fuel logs yet'}
          </p>
          {!search && filter === 'ALL' && (
            <Button variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
              Add First Fuel Log
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => (
            <FuelLogCard
              key={l.id}
              log={l}
              onEdit={() => setEditing(l)}
              onDelete={() => setToDelete(l)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <FuelLogDialog
        open={showAdd}
        editing={null}
        vehicles={vehicles}
        onClose={() => setShowAdd(false)}
      />
      {editing && (
        <FuelLogDialog
          open={!!editing}
          editing={editing}
          vehicles={vehicles}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteDialog log={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}
