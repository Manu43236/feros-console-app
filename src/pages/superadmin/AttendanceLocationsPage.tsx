import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { attendanceLocationsApi } from '@/api/superadmin'
import type { AttendanceLocation, AttendanceLocationRequest } from '@/types'

// ── Form state ────────────────────────────────────────────────────────────────
const EMPTY_FORM: AttendanceLocationRequest = {
  name: '',
  latitude: 0,
  longitude: 0,
  radiusMeters: 200,
}

type FormErrors = Partial<Record<keyof AttendanceLocationRequest, string>>

function validate(f: AttendanceLocationRequest): FormErrors {
  const errors: FormErrors = {}
  if (!f.name.trim())                           errors.name         = 'Name is required'
  if (f.latitude < -90 || f.latitude > 90)      errors.latitude     = 'Must be between -90 and 90'
  if (f.longitude < -180 || f.longitude > 180)  errors.longitude    = 'Must be between -180 and 180'
  if (f.radiusMeters < 50 || f.radiusMeters > 5000) errors.radiusMeters = 'Must be between 50 and 5000 m'
  return errors
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function AttendanceLocationsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-locations'],
    queryFn: () => attendanceLocationsApi.getAll(),
  })
  const locations: AttendanceLocation[] = data?.data ?? []

  // dialog state
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<AttendanceLocation | null>(null)
  const [form, setForm]       = useState<AttendanceLocationRequest>(EMPTY_FORM)
  const [errors, setErrors]   = useState<FormErrors>({})

  // confirm delete
  const [deleteDlg, setDeleteDlg] = useState<{ id: number; name: string } | null>(null)

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setOpen(true)
  }

  function openEdit(loc: AttendanceLocation) {
    setEditing(loc)
    setForm({ name: loc.name, latitude: loc.latitude, longitude: loc.longitude, radiusMeters: loc.radiusMeters })
    setErrors({})
    setOpen(true)
  }

  function setField<K extends keyof AttendanceLocationRequest>(key: K, raw: string) {
    const numericKeys: (keyof AttendanceLocationRequest)[] = ['latitude', 'longitude', 'radiusMeters']
    const value = numericKeys.includes(key) ? (raw === '' ? 0 : parseFloat(raw)) : raw
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const createMutation = useMutation({
    mutationFn: (d: AttendanceLocationRequest) => attendanceLocationsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-locations'] })
      toast.success('Location added')
      setOpen(false)
    },
    onError: () => toast.error('Failed to add location'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AttendanceLocationRequest }) =>
      attendanceLocationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-locations'] })
      toast.success('Location updated')
      setOpen(false)
    },
    onError: () => toast.error('Failed to update location'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => attendanceLocationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-locations'] })
      toast.success('Location removed')
    },
    onError: () => toast.error('Failed to delete location'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Attendance Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage known locations (offices, ports, yards). Attendance marked within the radius
            will display the location name.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} className="mr-1.5" /> Add Location
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Latitude</th>
              <th className="px-5 py-3 text-left">Longitude</th>
              <th className="px-5 py-3 text-left">Radius (m)</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">
                  Loading…
                </td>
              </tr>
            ) : locations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <MapPin size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-sm">No locations yet. Add your first location.</p>
                </td>
              </tr>
            ) : (
              locations.map(loc => (
                <tr key={loc.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{loc.name}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">{loc.latitude.toFixed(6)}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">{loc.longitude.toFixed(6)}</td>
                  <td className="px-5 py-3 text-gray-600">{loc.radiusMeters}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      loc.isActive
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(loc)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteDlg({ id: loc.id, name: loc.name })}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Location' : 'Add Location'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Name */}
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. Vizag Port, Ashlar Office"
                className={`mt-1 ${errors.name ? 'border-red-400' : ''}`}
                autoFocus
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Lat / Long */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="any"
                  value={form.latitude || ''}
                  onChange={e => setField('latitude', e.target.value)}
                  placeholder="17.686815"
                  className={`mt-1 ${errors.latitude ? 'border-red-400' : ''}`}
                />
                {errors.latitude && <p className="text-red-500 text-xs mt-1">{errors.latitude}</p>}
              </div>
              <div>
                <Label>Longitude <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="any"
                  value={form.longitude || ''}
                  onChange={e => setField('longitude', e.target.value)}
                  placeholder="83.218483"
                  className={`mt-1 ${errors.longitude ? 'border-red-400' : ''}`}
                />
                {errors.longitude && <p className="text-red-500 text-xs mt-1">{errors.longitude}</p>}
              </div>
            </div>

            {/* Radius */}
            <div>
              <Label>Radius (meters) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={form.radiusMeters || ''}
                onChange={e => setField('radiusMeters', e.target.value)}
                placeholder="200"
                className={`mt-1 ${errors.radiusMeters ? 'border-red-400' : ''}`}
              />
              <p className="text-xs text-gray-400 mt-1">Office: 100–200 m &nbsp;|&nbsp; Port/Yard: 500–1000 m</p>
              {errors.radiusMeters && <p className="text-red-500 text-xs mt-1">{errors.radiusMeters}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving…' : editing ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteDlg}
        title="Remove Location"
        description={`Remove "${deleteDlg?.name}"? Attendance already marked will keep their location name.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (deleteDlg) deleteMutation.mutate(deleteDlg.id)
          setDeleteDlg(null)
        }}
        onCancel={() => setDeleteDlg(null)}
      />
    </div>
  )
}
