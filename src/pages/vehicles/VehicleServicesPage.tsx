import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehiclesApi } from '@/api/vehicles'
import { vehicleServicesApi } from '@/api/vehicles'
import type { Vehicle } from '@/types'
import { toast } from 'sonner'
import { Plus, Search, Trash2, Pencil, Wrench, IndianRupee, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { VehicleServiceRecord } from '@/types'

const SERVICE_TYPES = ['Oil Change', 'Tyre Change', 'Brake Service', 'Engine Overhaul',
  'Transmission Service', 'Battery Replacement', 'AC Service', 'General Service',
  'Accident Repair', 'Electrical', 'Other']

// ── schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  vehicleId:              z.coerce.number().min(1, 'Select a vehicle'),
  serviceDate:            z.string().min(1, 'Date is required'),
  serviceType:            z.string().min(1, 'Service type is required'),
  description:            z.string().optional(),
  cost:                   z.coerce.number().optional(),
  odometerReading:        z.coerce.number().optional(),
  nextServiceDueDate:     z.string().optional(),
  nextServiceDueOdometer: z.coerce.number().optional(),
  serviceCenterName:      z.string().optional(),
  serviceCenterPhone:     z.string().optional(),
  billUrl:                z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ── Form Dialog ───────────────────────────────────────────────────────────────
function ServiceFormDialog({
  open, onClose, editing,
}: { open: boolean; onClose: () => void; editing?: VehicleServiceRecord | null }) {
  const qc = useQueryClient()
  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll() })
  const vehicles = (vehiclesRes?.data ?? []) as Vehicle[]

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: editing ? {
      vehicleId:              editing.vehicleId,
      serviceDate:            editing.serviceDate,
      serviceType:            editing.serviceType,
      description:            editing.description ?? '',
      cost:                   editing.cost ?? undefined,
      odometerReading:        editing.odometerReading ?? undefined,
      nextServiceDueDate:     editing.nextServiceDueDate ?? '',
      nextServiceDueOdometer: editing.nextServiceDueOdometer ?? undefined,
      serviceCenterName:      editing.serviceCenterName ?? '',
      serviceCenterPhone:     editing.serviceCenterPhone ?? '',
      billUrl:                editing.billUrl ?? '',
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => editing
      ? vehicleServicesApi.update(editing.id, data)
      : vehicleServicesApi.create(data),
    onSuccess: () => {
      toast.success(editing ? 'Service record updated' : 'Service record added')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      reset()
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to save record')
    },
  })

  function handleClose() { reset(); onClose() }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Service Record' : 'Add Service Record'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vehicle *</Label>
              <select {...register('vehicleId')} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white">
                <option value="">Select vehicle</option>
                {vehicles.map((v: Vehicle) => (
                  <option key={v.id} value={v.id}>{v.registrationNumber}</option>
                ))}
              </select>
              {errors.vehicleId && <p className="text-xs text-red-500 mt-1">{errors.vehicleId.message}</p>}
            </div>
            <div>
              <Label>Service Date *</Label>
              <Input type="date" {...register('serviceDate')} className="mt-1" />
              {errors.serviceDate && <p className="text-xs text-red-500 mt-1">{errors.serviceDate.message}</p>}
            </div>
          </div>

          <div>
            <Label>Service Type *</Label>
            <select {...register('serviceType')} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white">
              <option value="">Select type</option>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.serviceType && <p className="text-xs text-red-500 mt-1">{errors.serviceType.message}</p>}
          </div>

          <div>
            <Label>Description</Label>
            <Input placeholder="Work done details" {...register('description')} className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cost (₹)</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('cost')} className="mt-1" />
            </div>
            <div>
              <Label>Odometer (km)</Label>
              <Input type="number" placeholder="Current reading" {...register('odometerReading')} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Next Service Date</Label>
              <Input type="date" {...register('nextServiceDueDate')} className="mt-1" />
            </div>
            <div>
              <Label>Next Service (km)</Label>
              <Input type="number" placeholder="Odometer target" {...register('nextServiceDueOdometer')} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Service Center</Label>
              <Input placeholder="Center name" {...register('serviceCenterName')} className="mt-1" />
            </div>
            <div>
              <Label>Center Phone</Label>
              <Input placeholder="Phone number" {...register('serviceCenterPhone')} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Bill URL</Label>
            <Input placeholder="https://..." {...register('billUrl')} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add Record'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Dialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ record, onClose }: { record: VehicleServiceRecord | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: number) => vehicleServicesApi.delete(id),
    onSuccess: () => {
      toast.success('Record deleted')
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
          Delete the <strong>{record?.serviceType}</strong> record for{' '}
          <strong>{record?.vehicleRegistrationNumber}</strong>?
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VehicleServicesPage() {
  const [search, setSearch]     = useState('')
  const [addOpen, setAddOpen]   = useState(false)
  const [editing, setEditing]   = useState<VehicleServiceRecord | null>(null)
  const [toDelete, setToDelete] = useState<VehicleServiceRecord | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-services'],
    queryFn:  vehicleServicesApi.getAll,
  })
  const records = [...(data?.data ?? [])].sort((a, b) => b.id - a.id)

  const filtered = records.filter(r =>
    r.vehicleRegistrationNumber.toLowerCase().includes(search.toLowerCase()) ||
    r.serviceType.toLowerCase().includes(search.toLowerCase()) ||
    (r.serviceCenterName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalCost  = records.reduce((s, r) => s + (r.cost ?? 0), 0)
  const upcoming   = records.filter(r => r.nextServiceDueDate && new Date(r.nextServiceDueDate) >= new Date()).length

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track maintenance and service history for all vehicles</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Add Service Record
        </Button>
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
          <div className="p-2.5 bg-orange-50 rounded-lg"><CalendarClock size={20} className="text-orange-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Upcoming Services</p>
            <p className="text-lg font-bold text-gray-900">{upcoming}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-gray-400" />
          <Input
            placeholder="Search by vehicle, service type or center…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Wrench size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {search ? 'No records match your search' : 'No service records yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Vehicle</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Service Type</th>
                  <th className="text-right px-4 py-3">Cost</th>
                  <th className="text-right px-4 py-3">Odometer</th>
                  <th className="text-left px-4 py-3">Next Due</th>
                  <th className="text-left px-4 py-3">Service Center</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.vehicleRegistrationNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{r.serviceDate}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        {r.serviceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {r.cost != null ? fmt(r.cost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {r.odometerReading != null ? `${r.odometerReading.toLocaleString('en-IN')} km` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.nextServiceDueDate
                        ? <span className={new Date(r.nextServiceDueDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                            {r.nextServiceDueDate}
                          </span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.serviceCenterName || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setToDelete(r)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServiceFormDialog
        open={addOpen || !!editing}
        onClose={() => { setAddOpen(false); setEditing(null) }}
        editing={editing}
      />
      <DeleteDialog record={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}
