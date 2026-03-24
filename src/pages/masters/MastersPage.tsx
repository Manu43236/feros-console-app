import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Truck, Users, Tag, CreditCard, MapPin, DollarSign, Settings,
  Plus, Pencil, Trash2, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { tenantMastersApi, globalMastersApi } from '@/api/masters'
import type { TenantMasterItem, DesignationItem, PayRateItem, RouteItem, PaymentTermsItem, VehicleStatusItem, VehicleStatusType } from '@/types'

// ── Section config ────────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'vehicleStatuses', label: 'Vehicle Statuses', icon: Truck      },
  { key: 'clientTypes',     label: 'Client Types',     icon: Users      },
  { key: 'chargeTypes',     label: 'Charge Types',     icon: Tag        },
  { key: 'paymentTerms',    label: 'Payment Terms',    icon: CreditCard },
  { key: 'designations',    label: 'Designations',     icon: Users      },
  { key: 'routes',          label: 'Routes',           icon: MapPin     },
  { key: 'payRates',        label: 'Pay Rates',        icon: DollarSign },
  { key: 'settings',        label: 'Settings',         icon: Settings   },
] as const
type SectionKey = typeof SECTIONS[number]['key']

const ROLE_TYPES = ['DRIVER', 'CLEANER', 'SUPERVISOR', 'OFFICE_STAFF', 'ADMIN']
const PAY_CYCLES = ['DAILY', 'WEEKLY', 'MONTHLY']

const VEHICLE_STATUS_TYPES: { value: VehicleStatusType; label: string }[] = [
  { value: 'AVAILABLE',  label: 'Available'  },
  { value: 'ASSIGNED',   label: 'Assigned'   },
  { value: 'ON_TRIP',    label: 'On Trip'    },
  { value: 'IN_REPAIR',  label: 'In Repair'  },
  { value: 'BREAKDOWN',  label: 'Breakdown'  },
  { value: 'OTHER',      label: 'Other'      },
]

const vehicleStatusBadge: Record<VehicleStatusType, string> = {
  AVAILABLE:  'bg-green-100 text-green-700',
  ASSIGNED:   'bg-blue-100 text-blue-700',
  ON_TRIP:    'bg-orange-100 text-orange-700',
  IN_REPAIR:  'bg-yellow-100 text-yellow-700',
  BREAKDOWN:  'bg-red-100 text-red-700',
  OTHER:      'bg-gray-100 text-gray-600',
}

// ── Vehicle Status Section ─────────────────────────────────────────────────────
function VehicleStatusSection({
  items, loading, onAdd, onEdit, onDelete,
}: {
  items: VehicleStatusItem[]
  loading: boolean
  onAdd: (data: { name: string; statusType: VehicleStatusType }) => void
  onEdit: (item: VehicleStatusItem) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleStatusItem | null>(null)
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<{ name: string; statusType: VehicleStatusType }>()
  const selectedType = watch('statusType')

  function openAdd() { setEditing(null); reset({ name: '', statusType: 'AVAILABLE' }); setOpen(true) }
  function openEdit(item: VehicleStatusItem) {
    setEditing(item)
    reset({ name: item.name, statusType: item.statusType })
    setOpen(true)
  }
  function onSubmit(data: { name: string; statusType: VehicleStatusType }) {
    if (editing) onEdit({ ...editing, ...data })
    else onAdd(data)
    setOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Vehicle Statuses</h2>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">No vehicle statuses yet</div>
      ) : (
        <div className="border rounded-lg divide-y">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', vehicleStatusBadge[item.statusType])}>
                  {VEHICLE_STATUS_TYPES.find(t => t.value === item.statusType)?.label ?? item.statusType}
                </span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(item.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} Vehicle Status</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <Label>Name *</Label>
              <Input {...register('name', { required: 'Required' })} className="mt-1" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Status Type *</Label>
              <Select value={selectedType} onValueChange={v => setValue('statusType', v as VehicleStatusType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_STATUS_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.statusType && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Generic simple list section ───────────────────────────────────────────────
function SimpleSection({
  title, items, loading,
  onAdd, onEdit, onDelete,
  hasDescription = false,
}: {
  title: string
  items: TenantMasterItem[]
  loading: boolean
  onAdd: (data: { name: string; description?: string }) => void
  onEdit: (item: TenantMasterItem) => void
  onDelete: (id: number) => void
  hasDescription?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TenantMasterItem | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; description?: string }>()

  function openAdd() { setEditing(null); reset({}); setOpen(true) }
  function openEdit(item: TenantMasterItem) { setEditing(item); reset({ name: item.name, description: item.description }); setOpen(true) }
  function onSubmit(data: { name: string; description?: string }) {
    if (editing) onEdit({ ...editing, ...data })
    else onAdd(data)
    setOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 py-6 text-center">No {title.toLowerCase()} yet</div>
      ) : (
        <div className="border rounded-lg divide-y">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                {hasDescription && item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(item.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} {title.replace(/s$/, '')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <Label>Name *</Label>
              <Input {...register('name', { required: 'Required' })} className="mt-1" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            {hasDescription && (
              <div>
                <Label>Description</Label>
                <Input {...register('description')} className="mt-1" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Payment Terms ─────────────────────────────────────────────────────────────
function PaymentTermsSection() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentTermsItem | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; creditDays: number }>()

  const { data, isLoading } = useQuery({ queryKey: ['paymentTerms'], queryFn: tenantMastersApi.getPaymentTerms })
  const items: PaymentTermsItem[] = (data?.data as PaymentTermsItem[]) ?? []

  const create = useMutation({
    mutationFn: (d: { name: string; creditDays: number }) => tenantMastersApi.createPaymentTerms(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paymentTerms'] }); toast.success('Added'); setOpen(false) },
    onError: () => toast.error('Failed to add'),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: number; d: { name: string; creditDays: number } }) => tenantMastersApi.updatePaymentTerms(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paymentTerms'] }); toast.success('Updated'); setOpen(false) },
    onError: () => toast.error('Failed to update'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deletePaymentTerms(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['paymentTerms'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  function openAdd() { setEditing(null); reset({}); setOpen(true) }
  function openEdit(item: PaymentTermsItem) { setEditing(item); reset({ name: item.name, creditDays: item.creditDays }); setOpen(true) }
  function onSubmit(d: { name: string; creditDays: number }) {
    const payload = { name: d.name, creditDays: Number(d.creditDays) }
    if (editing) update.mutate({ id: editing.id, d: payload })
    else create.mutate(payload)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Payment Terms</h2>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
        : items.length === 0 ? <div className="text-sm text-gray-400 py-6 text-center">No payment terms yet</div>
        : (
          <div className="border rounded-lg divide-y">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.creditDays} days</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove.mutate(item.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Payment Terms</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <Label>Name *</Label>
              <Input {...register('name', { required: 'Required' })} className="mt-1" placeholder="e.g. Net 30" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Credit Days *</Label>
              <Input type="number" {...register('creditDays', { required: 'Required', min: 0 })} className="mt-1" placeholder="30" />
              {errors.creditDays && <p className="text-xs text-red-500 mt-1">{errors.creditDays.message}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Designations ──────────────────────────────────────────────────────────────
function DesignationsSection() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DesignationItem | null>(null)
  const [roleType, setRoleType] = useState('')
  const [roleError, setRoleError] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string }>()

  const { data, isLoading } = useQuery({ queryKey: ['designations'], queryFn: tenantMastersApi.getDesignations })
  const items: DesignationItem[] = (data?.data as DesignationItem[]) ?? []

  const create = useMutation({
    mutationFn: (d: { name: string; roleType: string }) => tenantMastersApi.createDesignation(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); toast.success('Added'); setOpen(false) },
    onError: () => toast.error('Failed to add'),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: number; d: { name: string; roleType: string } }) => tenantMastersApi.updateDesignation(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); toast.success('Updated'); setOpen(false) },
    onError: () => toast.error('Failed to update'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deleteDesignation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  function openAdd() { setEditing(null); reset({}); setRoleType(''); setRoleError(false); setOpen(true) }
  function openEdit(item: DesignationItem) { setEditing(item); reset({ name: item.name }); setRoleType(item.roleType); setRoleError(false); setOpen(true) }
  function onSubmit(d: { name: string }) {
    if (!roleType) { setRoleError(true); return }
    if (editing) update.mutate({ id: editing.id, d: { name: d.name, roleType } })
    else create.mutate({ name: d.name, roleType })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Designations</h2>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
        : items.length === 0 ? <div className="text-sm text-gray-400 py-6 text-center">No designations yet</div>
        : (
          <div className="border rounded-lg divide-y">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.roleType.replace('_', ' ')}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove.mutate(item.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Designation</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <Label>Name *</Label>
              <Input {...register('name', { required: 'Required' })} className="mt-1" placeholder="e.g. Senior Driver" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Role Type *</Label>
              <Select value={roleType} onValueChange={v => { setRoleType(v); setRoleError(false) }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {ROLE_TYPES.map(r => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              {roleError && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Routes ────────────────────────────────────────────────────────────────────
function RoutesSection() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RouteItem | null>(null)
  const [srcState, setSrcState] = useState<number | null>(null)
  const [dstState, setDstState] = useState<number | null>(null)
  const [srcCity, setSrcCity] = useState('')
  const [dstCity, setDstCity] = useState('')
  const [cityError, setCityError] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; distanceInKm?: number; estimatedHours?: number }>()

  const { data, isLoading } = useQuery({ queryKey: ['routes'], queryFn: tenantMastersApi.getRoutes })
  const routes: RouteItem[] = (data?.data as RouteItem[]) ?? []

  const { data: statesData } = useQuery({ queryKey: ['states'], queryFn: globalMastersApi.getStates })
  const states = statesData?.data ?? []

  const { data: srcCitiesData } = useQuery({
    queryKey: ['cities', srcState],
    queryFn: () => globalMastersApi.getCities(srcState!),
    enabled: !!srcState,
  })
  const { data: dstCitiesData } = useQuery({
    queryKey: ['cities', dstState],
    queryFn: () => globalMastersApi.getCities(dstState!),
    enabled: !!dstState,
  })
  const srcCities = srcCitiesData?.data ?? []
  const dstCities = dstCitiesData?.data ?? []

  const create = useMutation({
    mutationFn: (d: Parameters<typeof tenantMastersApi.createRoute>[0]) => tenantMastersApi.createRoute(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route added'); setOpen(false) },
    onError: () => toast.error('Failed to add route'),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Parameters<typeof tenantMastersApi.updateRoute>[1] }) => tenantMastersApi.updateRoute(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route updated'); setOpen(false) },
    onError: () => toast.error('Failed to update route'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deleteRoute(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['routes'] }); toast.success('Route deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  function openAdd() {
    setEditing(null); reset({}); setSrcState(null); setDstState(null); setSrcCity(''); setDstCity(''); setCityError(false)
    setOpen(true)
  }
  function openEdit(item: RouteItem) {
    setEditing(item); reset({ name: item.name, distanceInKm: item.distanceInKm, estimatedHours: item.estimatedHours })
    setSrcCity(String(item.sourceCityId)); setDstCity(String(item.destinationCityId)); setCityError(false)
    setOpen(true)
  }
  function onSubmit(d: { name: string; distanceInKm?: number; estimatedHours?: number }) {
    if (!srcCity || !dstCity) { setCityError(true); return }
    const payload = {
      name: d.name,
      sourceCityId: Number(srcCity),
      destinationCityId: Number(dstCity),
      distanceInKm: d.distanceInKm ? Number(d.distanceInKm) : undefined,
      estimatedHours: d.estimatedHours ? Number(d.estimatedHours) : undefined,
    }
    if (editing) update.mutate({ id: editing.id, d: payload })
    else create.mutate(payload)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Routes</h2>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
        : routes.length === 0 ? <div className="text-sm text-gray-400 py-6 text-center">No routes yet</div>
        : (
          <div className="border rounded-lg divide-y">
            {routes.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-500">
                    {r.sourceCityName} → {r.destinationCityName}
                    {r.distanceInKm ? ` · ${r.distanceInKm} km` : ''}
                    {r.estimatedHours ? ` · ${r.estimatedHours}h` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove.mutate(r.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Route</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <Label>Route Name *</Label>
              <Input {...register('name', { required: 'Required' })} className="mt-1" placeholder="e.g. Vizag to Hyderabad" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source State</Label>
                <Select value={String(srcState ?? '')} onValueChange={v => { setSrcState(Number(v)); setSrcCity('') }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>{states.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source City *</Label>
                <Select value={srcCity} onValueChange={v => { setSrcCity(v); setCityError(false) }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="City" /></SelectTrigger>
                  <SelectContent>{srcCities.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destination State</Label>
                <Select value={String(dstState ?? '')} onValueChange={v => { setDstState(Number(v)); setDstCity('') }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>{states.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Destination City *</Label>
                <Select value={dstCity} onValueChange={v => { setDstCity(v); setCityError(false) }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="City" /></SelectTrigger>
                  <SelectContent>{dstCities.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {cityError && <p className="text-xs text-red-500">Source and destination cities are required</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Distance (km)</Label>
                <Input type="number" step="0.1" {...register('distanceInKm')} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label>Est. Hours</Label>
                <Input type="number" {...register('estimatedHours')} className="mt-1" placeholder="0" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Pay Rates ─────────────────────────────────────────────────────────────────
function PayRatesSection() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PayRateItem | null>(null)
  const [designationId, setDesignationId] = useState('')
  const [vehicleTypeId, setVehicleTypeId] = useState('none')
  const [designationError, setDesignationError] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ payPerDay: number; effectiveFrom: string; effectiveTo?: string }>()

  const { data, isLoading } = useQuery({ queryKey: ['payRates'], queryFn: tenantMastersApi.getPayRates })
  const rates: PayRateItem[] = (data?.data as PayRateItem[]) ?? []

  const { data: designationsData } = useQuery({ queryKey: ['designations'], queryFn: tenantMastersApi.getDesignations })
  const designations = (designationsData?.data as DesignationItem[]) ?? []

  const { data: vehicleTypesData } = useQuery({ queryKey: ['vehicleTypes'], queryFn: globalMastersApi.getVehicleTypes })
  const vehicleTypes = vehicleTypesData?.data ?? []

  const create = useMutation({
    mutationFn: (d: Parameters<typeof tenantMastersApi.createPayRate>[0]) => tenantMastersApi.createPayRate(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payRates'] }); toast.success('Pay rate added'); setOpen(false) },
    onError: () => toast.error('Failed to add'),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Parameters<typeof tenantMastersApi.updatePayRate>[1] }) => tenantMastersApi.updatePayRate(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payRates'] }); toast.success('Pay rate updated'); setOpen(false) },
    onError: () => toast.error('Failed to update'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deletePayRate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payRates'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  function openAdd() { setEditing(null); reset({}); setDesignationId(''); setVehicleTypeId('none'); setDesignationError(false); setOpen(true) }
  function openEdit(item: PayRateItem) {
    setEditing(item)
    reset({ payPerDay: item.payPerDay, effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo })
    setDesignationId(String(item.designationId))
    setVehicleTypeId(item.vehicleTypeId ? String(item.vehicleTypeId) : 'none')
    setDesignationError(false)
    setOpen(true)
  }
  function onSubmit(d: { payPerDay: number; effectiveFrom: string; effectiveTo?: string }) {
    if (!designationId) { setDesignationError(true); return }
    const payload = {
      designationId: Number(designationId),
      vehicleTypeId: vehicleTypeId && vehicleTypeId !== 'none' ? Number(vehicleTypeId) : undefined,
      payPerDay: Number(d.payPerDay),
      effectiveFrom: d.effectiveFrom,
      effectiveTo: d.effectiveTo || undefined,
    }
    if (editing) update.mutate({ id: editing.id, d: payload })
    else create.mutate(payload)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Pay Rates</h2>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
        : rates.length === 0 ? <div className="text-sm text-gray-400 py-6 text-center">No pay rates yet</div>
        : (
          <div className="border rounded-lg divide-y">
            {rates.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.designationName}</p>
                  <p className="text-xs text-gray-500">
                    ₹{r.payPerDay}/day
                    {r.vehicleTypeName ? ` · ${r.vehicleTypeName}` : ''}
                    {` · From ${r.effectiveFrom}`}
                    {r.effectiveTo ? ` to ${r.effectiveTo}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove.mutate(r.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Pay Rate</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div>
              <Label>Designation *</Label>
              <Select value={designationId} onValueChange={v => { setDesignationId(v); setDesignationError(false) }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select designation" /></SelectTrigger>
                <SelectContent>{designations.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
              {designationError && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
            <div>
              <Label>Vehicle Type (optional)</Label>
              <Select value={vehicleTypeId} onValueChange={setVehicleTypeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Any vehicle type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any</SelectItem>
                  {vehicleTypes.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pay Per Day (₹) *</Label>
              <Input type="number" step="0.01" {...register('payPerDay', { required: 'Required' })} className="mt-1" />
              {errors.payPerDay && <p className="text-xs text-red-500 mt-1">{errors.payPerDay.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Effective From *</Label>
                <Input type="date" {...register('effectiveFrom', { required: 'Required' })} className="mt-1" />
                {errors.effectiveFrom && <p className="text-xs text-red-500 mt-1">{errors.effectiveFrom.message}</p>}
              </div>
              <div>
                <Label>Effective To</Label>
                <Input type="date" {...register('effectiveTo')} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsSection() {
  const qc = useQueryClient()
  const [payCycle, setPayCycle] = useState('MONTHLY')
  const { register, handleSubmit, reset } = useForm<{
    overtimeThresholdHours: number
    overtimeRateMultiplier: number
    maxAdvanceAmount: number
    maxAdvanceDeductionPerCycle: number
    tripBonusAmount: number
    isTripBonusEnabled: boolean
  }>()

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: tenantMastersApi.getSettings,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = settingsData?.data as any
  useEffect(() => {
    if (s) {
      setPayCycle(s.payCycle ?? 'MONTHLY')
      reset({
        overtimeThresholdHours: s.overtimeThresholdHours,
        overtimeRateMultiplier: s.overtimeRateMultiplier,
        maxAdvanceAmount: s.maxAdvanceAmount,
        maxAdvanceDeductionPerCycle: s.maxAdvanceDeductionPerCycle,
        tripBonusAmount: s.tripBonusAmount,
        isTripBonusEnabled: s.isTripBonusEnabled,
      })
    }
  }, [s?.id])

  const save = useMutation({
    mutationFn: (d: object) => tenantMastersApi.upsertSettings(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved') },
    onError: () => toast.error('Failed to save settings'),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onSubmit(d: any) {
    save.mutate({ ...d, payCycle, isTripBonusEnabled: Boolean(d.isTripBonusEnabled) })
  }

  if (isLoading) return <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-4">Tenant Settings</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
        <div>
          <Label>Pay Cycle</Label>
          <Select value={payCycle} onValueChange={setPayCycle}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{PAY_CYCLES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>OT Threshold (hrs/day)</Label>
            <Input type="number" step="0.5" {...register('overtimeThresholdHours')} className="mt-1" />
          </div>
          <div>
            <Label>OT Rate Multiplier</Label>
            <Input type="number" step="0.1" {...register('overtimeRateMultiplier')} className="mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Max Advance Amount (₹)</Label>
            <Input type="number" {...register('maxAdvanceAmount')} className="mt-1" />
          </div>
          <div>
            <Label>Max Deduction/Cycle (₹)</Label>
            <Input type="number" {...register('maxAdvanceDeductionPerCycle')} className="mt-1" />
          </div>
        </div>
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="tripBonus" {...register('isTripBonusEnabled')} className="h-4 w-4 accent-blue-600" />
            <Label htmlFor="tripBonus" className="cursor-pointer">Enable Trip Bonus</Label>
          </div>
          <div>
            <Label>Trip Bonus Amount (₹)</Label>
            <Input type="number" step="0.01" {...register('tripBonusAmount')} className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save Settings'}</Button>
        </div>
      </form>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function MastersPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('vehicleStatuses')
  const qc = useQueryClient()

  const { data: vsData, isLoading: vsLoading } = useQuery({ queryKey: ['vehicleStatuses'], queryFn: tenantMastersApi.getVehicleStatuses })
  const vsItems: VehicleStatusItem[] = vsData?.data ?? []
  const vsCreate = useMutation({
    mutationFn: (d: { name: string; statusType: VehicleStatusType }) => tenantMastersApi.createVehicleStatus(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicleStatuses'] }); toast.success('Added') },
    onError: () => toast.error('Failed to add'),
  })
  const vsUpdate = useMutation({
    mutationFn: ({ id, d }: { id: number; d: { name: string; statusType: VehicleStatusType } }) => tenantMastersApi.updateVehicleStatus(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicleStatuses'] }); toast.success('Updated') },
    onError: () => toast.error('Failed to update'),
  })
  const vsDelete = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deleteVehicleStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicleStatuses'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const { data: ctData, isLoading: ctLoading } = useQuery({ queryKey: ['clientTypes'], queryFn: tenantMastersApi.getClientTypes })
  const ctItems: TenantMasterItem[] = (ctData?.data as TenantMasterItem[]) ?? []
  const ctCreate = useMutation({
    mutationFn: (d: { name: string }) => tenantMastersApi.createClientType(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientTypes'] }); toast.success('Added') },
    onError: () => toast.error('Failed to add'),
  })
  const ctUpdate = useMutation({
    mutationFn: ({ id, d }: { id: number; d: { name: string } }) => tenantMastersApi.updateClientType(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientTypes'] }); toast.success('Updated') },
    onError: () => toast.error('Failed to update'),
  })
  const ctDelete = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deleteClientType(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientTypes'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const { data: chargeData, isLoading: chargeLoading } = useQuery({ queryKey: ['chargeTypes'], queryFn: tenantMastersApi.getChargeTypes })
  const chargeItems: TenantMasterItem[] = (chargeData?.data as TenantMasterItem[]) ?? []
  const chargeCreate = useMutation({
    mutationFn: (d: { name: string; description?: string }) => tenantMastersApi.createChargeType(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chargeTypes'] }); toast.success('Added') },
    onError: () => toast.error('Failed to add'),
  })
  const chargeUpdate = useMutation({
    mutationFn: ({ id, d }: { id: number; d: { name: string; description?: string } }) => tenantMastersApi.updateChargeType(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chargeTypes'] }); toast.success('Updated') },
    onError: () => toast.error('Failed to update'),
  })
  const chargeDelete = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deleteChargeType(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chargeTypes'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  function renderContent() {
    switch (activeSection) {
      case 'vehicleStatuses':
        return (
          <VehicleStatusSection
            items={vsItems} loading={vsLoading}
            onAdd={d => vsCreate.mutate(d)}
            onEdit={item => vsUpdate.mutate({ id: item.id, d: { name: item.name, statusType: item.statusType } })}
            onDelete={id => vsDelete.mutate(id)}
          />
        )
      case 'clientTypes':
        return (
          <SimpleSection
            title="Client Types" items={ctItems} loading={ctLoading}
            onAdd={d => ctCreate.mutate(d)}
            onEdit={item => ctUpdate.mutate({ id: item.id, d: { name: item.name } })}
            onDelete={id => ctDelete.mutate(id)}
          />
        )
      case 'chargeTypes':
        return (
          <SimpleSection
            title="Charge Types" items={chargeItems} loading={chargeLoading} hasDescription
            onAdd={d => chargeCreate.mutate(d)}
            onEdit={item => chargeUpdate.mutate({ id: item.id, d: { name: item.name, description: item.description } })}
            onDelete={id => chargeDelete.mutate(id)}
          />
        )
      case 'paymentTerms':   return <PaymentTermsSection />
      case 'designations':   return <DesignationsSection />
      case 'routes':         return <RoutesSection />
      case 'payRates':       return <PayRatesSection />
      case 'settings':       return <SettingsSection />
      default:               return null
    }
  }

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Masters</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your company's reference data</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <div className="border rounded-lg overflow-hidden">
            {SECTIONS.map(s => {
              const Icon = s.icon
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b last:border-b-0',
                    activeSection === s.key
                      ? 'bg-feros-navy text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={15} />
                    {s.label}
                  </span>
                  {activeSection !== s.key && <ChevronRight size={13} className="text-gray-400" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="border rounded-lg p-6 bg-white">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
