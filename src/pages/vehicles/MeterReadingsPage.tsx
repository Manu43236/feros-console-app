import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { meterReadingsApi } from '@/api/meterReadings'
import { vehiclesApi } from '@/api/vehicles'
import type { MeterReading, MeterReadingType, Vehicle } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import {
  Gauge, Search, Plus, Trash2, Upload, X, AlertTriangle, ChevronDown, ChevronUp, Edit2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtKm = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + ' km'

const READING_TYPE_LABELS: Record<MeterReadingType, string> = {
  TRIP_START: 'Trip Start',
  TRIP_END:   'Trip End',
  FUEL_FILL:  'Fuel Fill',
  GENERAL:    'General',
}

const READING_TYPE_COLORS: Record<MeterReadingType, string> = {
  TRIP_START: 'bg-blue-50 text-blue-700',
  TRIP_END:   'bg-green-50 text-green-700',
  FUEL_FILL:  'bg-orange-50 text-orange-700',
  GENERAL:    'bg-gray-100 text-gray-700',
}

function TypeChip({ type }: { type: MeterReadingType }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${READING_TYPE_COLORS[type]}`}>
      {READING_TYPE_LABELS[type]}
    </span>
  )
}

// ── Delete Dialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ reading, onClose }: { reading: MeterReading | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: number) => meterReadingsApi.delete(id),
    onSuccess: () => {
      toast.success('Reading deleted')
      qc.invalidateQueries({ queryKey: ['meter-readings'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to delete')
    },
  })

  return (
    <Dialog open={!!reading} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete Meter Reading</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          Delete reading of <strong>{reading ? fmtKm(reading.readingKm) : ''}</strong> for{' '}
          <strong>{reading?.vehicleRegistrationNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={mutation.isPending}
            onClick={() => reading && mutation.mutate(reading.id)}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Reading Dialog ────────────────────────────────────────────────────────
interface ReadingForm {
  vehicleId: string
  readingKm: string
  readingType: MeterReadingType
  lrId: string
  photoUrl: string
  recordedAt: string
  notes: string
}

const BLANK: ReadingForm = {
  vehicleId: '', readingKm: '', readingType: 'GENERAL',
  lrId: '', photoUrl: '', recordedAt: '', notes: '',
}

const READING_TYPES: { value: MeterReadingType; label: string }[] = [
  { value: 'TRIP_START', label: 'Trip Start' },
  { value: 'TRIP_END',   label: 'Trip End' },
  { value: 'FUEL_FILL',  label: 'Fuel Fill' },
  { value: 'GENERAL',    label: 'General' },
]

function AddReadingDialog({
  open, onClose, vehicles, editing,
}: {
  open: boolean
  onClose: () => void
  vehicles: Vehicle[]
  editing: MeterReading | null
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ReadingForm>(BLANK)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setForm(editing ? {
      vehicleId:   String(editing.vehicleId),
      readingKm:   String(editing.readingKm),
      readingType: editing.readingType,
      lrId:        editing.lrId ? String(editing.lrId) : '',
      photoUrl:    editing.photoUrl ?? '',
      recordedAt:  editing.recordedAt ? editing.recordedAt.slice(0, 16) : '',
      notes:       editing.notes ?? '',
    } : BLANK)
  }

  const set = (field: keyof ReadingForm, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const mutation = useMutation({
    mutationFn: (data: unknown) =>
      editing ? meterReadingsApi.update(editing.id, data) : meterReadingsApi.create(data),
    onSuccess: (res) => {
      const alerts = res.data?.serviceAlerts ?? []
      toast.success(editing ? 'Meter reading updated' : 'Meter reading recorded')
      if (alerts.length > 0) {
        alerts.forEach(a => {
          toast.warning(
            `Service ${a.status === 'OVERDUE' ? 'OVERDUE' : 'due soon'}: ${a.serviceNumber ?? 'SVC'} at ${fmtKm(a.dueAtOdometer)}`,
            { duration: 6000 }
          )
        })
      }
      qc.invalidateQueries({ queryKey: ['meter-readings'] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
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
      const res = await meterReadingsApi.uploadPhoto(Number(form.vehicleId), file)
      set('photoUrl', res.data?.publicUrl ?? '')
      toast.success('Photo uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function submit() {
    if (!form.vehicleId || !form.readingKm) {
      toast.error('Vehicle and reading (km) are required')
      return
    }
    mutation.mutate({
      vehicleId:   Number(form.vehicleId),
      readingKm:   parseFloat(form.readingKm),
      readingType: form.readingType,
      lrId:        form.lrId ? Number(form.lrId) : undefined,
      photoUrl:    form.photoUrl || undefined,
      recordedAt:  form.recordedAt ? `${form.recordedAt}:00` : undefined,
      notes:       form.notes || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Meter Reading' : 'Record Meter Reading'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Vehicle — read-only when editing */}
          <div>
            <Label>Vehicle *</Label>
            {editing ? (
              <Input className="mt-1" value={editing.vehicleRegistrationNumber} disabled />
            ) : (
              <SearchableSelect
                value={form.vehicleId}
                onValueChange={v => {
                  set('vehicleId', v)
                  const selected = vehicles.find(x => String(x.id) === v)
                  if (selected?.currentOdometerReading) {
                    set('readingKm', String(selected.currentOdometerReading))
                  }
                }}
                options={vehicles.map(v => ({ value: String(v.id), label: v.registrationNumber }))}
                placeholder="Select vehicle…"
                className="mt-1"
              />
            )}
          </div>

          {/* Reading + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Odometer Reading (km) *</Label>
              <Input className="mt-1" type="number" step="0.1" placeholder="e.g. 45820"
                value={form.readingKm}
                onChange={e => set('readingKm', e.target.value)} />
            </div>
            <div>
              <Label>Reading Type *</Label>
              <SearchableSelect
                value={form.readingType}
                onValueChange={v => set('readingType', v as MeterReadingType)}
                options={READING_TYPES}
                placeholder="Select type…"
                className="mt-1"
              />
            </div>
          </div>

          {/* Recorded At */}
          <div>
            <Label>Recorded At</Label>
            <Input type="datetime-local" className="mt-1"
              value={form.recordedAt}
              onChange={e => set('recordedAt', e.target.value)} />
            <p className="text-xs text-gray-400 mt-0.5">Leave blank to use current time</p>
          </div>

          {/* LR Number (optional) */}
          <div>
            <Label>LR ID (optional)</Label>
            <Input className="mt-1" type="number" placeholder="Link to a Lorry Receipt"
              value={form.lrId}
              onChange={e => set('lrId', e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional notes…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Photo upload */}
          <div>
            <Label>Odometer Photo</Label>
            <div className="mt-1 flex items-center gap-2">
              {form.photoUrl ? (
                <>
                  <a href={form.photoUrl} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 underline truncate max-w-[200px]">
                    View photo
                  </a>
                  <button onClick={() => set('photoUrl', '')}
                    className="text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <Button type="button" variant="outline" size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" />
                  {uploading ? 'Uploading…' : 'Upload Photo'}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? 'Saving…' : editing ? 'Update Reading' : 'Record Reading'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Reading Card ──────────────────────────────────────────────────────────────
function ReadingCard({
  reading, onEdit, onDelete, isAdmin,
}: {
  reading: MeterReading
  onEdit: () => void
  onDelete: () => void
  isAdmin: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const hasAlerts = reading.serviceAlerts && reading.serviceAlerts.length > 0

  return (
    <div className="bg-white rounded-xl border hover:border-gray-300 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm">{reading.vehicleRegistrationNumber}</span>
              <TypeChip type={reading.readingType} />
              {hasAlerts && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                  <AlertTriangle size={11} />
                  {reading.serviceAlerts.length} Service Alert{reading.serviceAlerts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span>Reading: <span className="text-gray-700 font-medium">{fmtKm(reading.readingKm)}</span></span>
              <span>By: <span className="text-gray-700">{reading.recordedByName}</span></span>
              <span>At: <span className="text-gray-700">{new Date(reading.recordedAt).toLocaleString('en-IN')}</span></span>
              {reading.lrNumber && (
                <span>LR: <span className="text-gray-700">{reading.lrNumber}</span></span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {(reading.notes || reading.photoUrl || hasAlerts) && (
              <button onClick={() => setExpanded(v => !v)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            )}
            {isAdmin && (
              <button onClick={onEdit}
                className="p-1.5 text-gray-400 hover:text-feros-navy rounded transition-colors" title="Edit">
                <Edit2 size={15} />
              </button>
            )}
            <button onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors" title="Delete">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-2 text-xs">
          {reading.notes && (
            <div>
              <p className="text-gray-400 mb-0.5">Notes</p>
              <p className="text-gray-700">{reading.notes}</p>
            </div>
          )}
          {reading.photoUrl && (
            <div>
              <a href={reading.photoUrl} target="_blank" rel="noreferrer"
                className="text-blue-600 underline">
                View odometer photo
              </a>
            </div>
          )}
          {hasAlerts && (
            <div>
              <p className="text-gray-400 mb-1">Service Alerts</p>
              <div className="space-y-1">
                {reading.serviceAlerts.map(a => (
                  <div key={a.serviceId}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                      a.status === 'OVERDUE' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                    <AlertTriangle size={11} />
                    <span>
                      {a.status === 'OVERDUE' ? 'OVERDUE' : 'Due Soon'} —{' '}
                      {a.serviceNumber ?? 'Service'} at {fmtKm(a.dueAtOdometer)}
                      {a.serviceType && ` (${a.serviceType})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type FilterMode = 'ALL' | MeterReadingType

export default function MeterReadingsPage() {
  const role    = useAuthStore(s => s.role)
  const isAdmin = role === 'ADMIN'

  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<FilterMode>('ALL')
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<MeterReading | null>(null)
  const [toDelete, setToDelete] = useState<MeterReading | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['meter-readings'],
    queryFn:  () => meterReadingsApi.getAll(),
  })
  const readings: MeterReading[] = [...(data?.data ?? [])].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  )

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  () => vehiclesApi.getAll(),
  })
  const vehicles: Vehicle[] = vehiclesData?.data ?? []

  const filtered = readings.filter(r => {
    const matchSearch = r.vehicleRegistrationNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.recordedByName ?? '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'ALL' || r.readingType === filter
    return matchSearch && matchFilter
  })

  // Stats
  const totalReadings  = readings.length
  const alertCount     = readings.reduce((s, r) => s + (r.serviceAlerts?.length ?? 0), 0)
  const uniqueVehicles = new Set(readings.map(r => r.vehicleId)).size

  const filterPills: { label: string; value: FilterMode; count?: number }[] = [
    { label: 'All',        value: 'ALL',        count: readings.length },
    { label: 'Trip Start', value: 'TRIP_START',  count: readings.filter(r => r.readingType === 'TRIP_START').length },
    { label: 'Trip End',   value: 'TRIP_END',    count: readings.filter(r => r.readingType === 'TRIP_END').length },
    { label: 'Fuel Fill',  value: 'FUEL_FILL',   count: readings.filter(r => r.readingType === 'FUEL_FILL').length },
    { label: 'General',    value: 'GENERAL',      count: readings.filter(r => r.readingType === 'GENERAL').length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meter Readings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track odometer readings across your fleet</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus size={16} /> Record Reading
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 rounded-lg"><Gauge size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Readings</p>
            <p className="text-lg font-bold text-gray-900">{totalReadings}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-purple-50 rounded-lg"><Gauge size={20} className="text-purple-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Vehicles Tracked</p>
            <p className="text-lg font-bold text-gray-900">{uniqueVehicles}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-red-50 rounded-lg"><AlertTriangle size={20} className="text-red-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Service Alerts</p>
            <p className="text-lg font-bold text-gray-900">{alertCount}</p>
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
            placeholder="Search vehicle, staff…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm w-48"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Gauge size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">
            {search || filter !== 'ALL' ? 'No readings match your filters' : 'No meter readings yet'}
          </p>
          {!search && filter === 'ALL' && (
            <Button variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
              Record First Reading
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReadingCard
              key={r.id}
              reading={r}
              isAdmin={isAdmin}
              onEdit={() => setEditing(r)}
              onDelete={() => setToDelete(r)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddReadingDialog open={showAdd} editing={null} vehicles={vehicles} onClose={() => setShowAdd(false)} />
      {editing && (
        <AddReadingDialog open={!!editing} editing={editing} vehicles={vehicles} onClose={() => setEditing(null)} />
      )}
      <DeleteDialog reading={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}
