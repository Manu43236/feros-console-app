import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Truck, Users, Tag, CreditCard, MapPin, Settings, Wifi,
  Plus, Pencil, Trash2, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Loader2, Link, Link2Off,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { tenantMastersApi, globalMastersApi, rbacApi } from '@/api/masters'
import { gpsApi } from '@/api/gps'
import type { GpsProviderConfig, GpsProviderVehicle, GpsProviderConfigRequest, GpsProviderType, VehicleGpsMappingRequest } from '@/types'
import type { RbacEntry } from '@/api/masters'
import { moduleAccessApi } from '@/api/moduleAccess'
import type { ModuleAccessEntry, ModuleKey } from '@/types'
import { useSubscription } from '@/context/SubscriptionContext'
import type { TenantMasterItem, DesignationItem, RouteItem, PaymentTermsItem, VehicleStatusItem, VehicleStatusType } from '@/types'

// ── Section config ────────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'vehicleStatuses', label: 'Vehicle Statuses', icon: Truck      },
  { key: 'clientTypes',     label: 'Client Types',     icon: Users      },
  { key: 'chargeTypes',     label: 'Charge Types',     icon: Tag        },
  { key: 'paymentTerms',    label: 'Payment Terms',    icon: CreditCard },
  { key: 'designations',    label: 'Designations',     icon: Users      },
  { key: 'routes',          label: 'Routes',           icon: MapPin     },
  { key: 'gpsProviders',   label: 'GPS Providers',    icon: Wifi       },
  { key: 'settings',       label: 'Settings',         icon: Settings   },
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

  const { locked } = useSubscription()

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
        {!locked && <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>}
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
              {!locked && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(item.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              )}
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
              <SearchableSelect
                value={selectedType}
                onValueChange={v => setValue('statusType', v as VehicleStatusType)}
                options={VEHICLE_STATUS_TYPES.map(t => ({ value: t.value, label: t.label }))}
                placeholder="Select type"
                className="mt-1"
              />
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

  const { locked } = useSubscription()

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
        {!locked && <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>}
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
              {!locked && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(item.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              )}
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

  const { locked } = useSubscription()

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
        {!locked && <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>}
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
                {!locked && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove.mutate(item.id)}><Trash2 size={13} /></Button>
                  </div>
                )}
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
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; payPerDay?: number }>()

  const { data, isLoading } = useQuery({ queryKey: ['designations'], queryFn: tenantMastersApi.getDesignations })
  const items: DesignationItem[] = (data?.data as DesignationItem[]) ?? []

  const create = useMutation({
    mutationFn: (d: { name: string; roleType: string; payPerDay?: number }) => tenantMastersApi.createDesignation(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); toast.success('Added'); setOpen(false) },
    onError: () => toast.error('Failed to add'),
  })
  const update = useMutation({
    mutationFn: ({ id, d }: { id: number; d: { name: string; roleType: string; payPerDay?: number } }) => tenantMastersApi.updateDesignation(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); toast.success('Updated'); setOpen(false) },
    onError: () => toast.error('Failed to update'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => tenantMastersApi.deleteDesignation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['designations'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const { locked } = useSubscription()

  function openAdd() { setEditing(null); reset({}); setRoleType(''); setRoleError(false); setOpen(true) }
  function openEdit(item: DesignationItem) {
    setEditing(item)
    reset({ name: item.name, payPerDay: item.payPerDay })
    setRoleType(item.roleType); setRoleError(false); setOpen(true)
  }
  function onSubmit(d: { name: string; payPerDay?: number }) {
    if (!roleType) { setRoleError(true); return }
    const payload = { name: d.name, roleType, payPerDay: d.payPerDay ? Number(d.payPerDay) : undefined }
    if (editing) update.mutate({ id: editing.id, d: payload })
    else create.mutate(payload)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Designations</h2>
        {!locked && <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>}
      </div>
      {isLoading ? <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
        : items.length === 0 ? <div className="text-sm text-gray-400 py-6 text-center">No designations yet</div>
        : (
          <div className="border rounded-lg divide-y">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.roleType.replace('_', ' ')}
                    {item.payPerDay ? ` · ₹${item.payPerDay}/day` : ''}
                  </p>
                </div>
                {!locked && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove.mutate(item.id)}><Trash2 size={13} /></Button>
                  </div>
                )}
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
              <SearchableSelect
                value={roleType}
                onValueChange={v => { setRoleType(v); setRoleError(false) }}
                options={ROLE_TYPES.map(r => ({ value: r, label: r.replace('_', ' ') }))}
                placeholder="Select role"
                className="mt-1"
              />
              {roleError && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
            <div>
              <Label>Pay Per Day (₹)</Label>
              <Input type="number" step="0.01" min="0" {...register('payPerDay')} className="mt-1" placeholder="e.g. 800" />
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

  const { locked } = useSubscription()

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
        {!locked && <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1" />Add</Button>}
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
                {!locked && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove.mutate(r.id)}><Trash2 size={13} /></Button>
                  </div>
                )}
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
                <SearchableSelect
                  value={String(srcState ?? '')}
                  onValueChange={v => { setSrcState(Number(v)); setSrcCity('') }}
                  options={states.map(s => ({ value: String(s.id), label: s.name }))}
                  placeholder="State"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Source City *</Label>
                <SearchableSelect
                  value={srcCity}
                  onValueChange={v => { setSrcCity(v); setCityError(false) }}
                  options={srcCities.map(c => ({ value: String(c.id), label: c.name }))}
                  placeholder="City"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Destination State</Label>
                <SearchableSelect
                  value={String(dstState ?? '')}
                  onValueChange={v => { setDstState(Number(v)); setDstCity('') }}
                  options={states.map(s => ({ value: String(s.id), label: s.name }))}
                  placeholder="State"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Destination City *</Label>
                <SearchableSelect
                  value={dstCity}
                  onValueChange={v => { setDstCity(v); setCityError(false) }}
                  options={dstCities.map(c => ({ value: String(c.id), label: c.name }))}
                  placeholder="City"
                  className="mt-1"
                />
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

// ── RBAC ──────────────────────────────────────────────────────────────────────
const RBAC_ROLES = [
  { key: 'OFFICE_STAFF', label: 'Office Staff' },
  { key: 'SUPERVISOR',   label: 'Supervisor' },
  { key: 'DRIVER',       label: 'Driver' },
  { key: 'CLEANER',      label: 'Cleaner' },
  { key: 'STORE_KEEPER', label: 'Store Keeper' },
  { key: 'SERVICE_MEN',  label: 'Service Men' },
]

// Roles shown in Module Access tab (DRIVER/CLEANER have nothing configurable)
const MODULE_ACCESS_ROLES = [
  { key: 'OFFICE_STAFF', label: 'Office Staff' },
  { key: 'SUPERVISOR',   label: 'Supervisor' },
  { key: 'STORE_KEEPER', label: 'Store Keeper' },
  { key: 'SERVICE_MEN',  label: 'Service Men' },
]

// Module rows — keys match backend ModuleKey enum, roles = which roles can configure this module
const RBAC_MODULE_ROWS: { key: string; label: string; section: string; roles: string[] }[] = [
  { key: 'CLIENTS',          label: 'Clients',          section: 'Operations', roles: ['OFFICE_STAFF'] },
  { key: 'ORDERS',           label: 'Orders',           section: 'Operations', roles: ['OFFICE_STAFF', 'SUPERVISOR'] },
  { key: 'ASSIGNMENTS',      label: 'Assignments',      section: 'Operations', roles: ['SUPERVISOR'] },
  { key: 'LR_REGISTER',      label: 'LR Register',      section: 'Operations', roles: ['OFFICE_STAFF', 'SUPERVISOR'] },
  { key: 'INVOICES',         label: 'Invoices',         section: 'Finance',    roles: ['OFFICE_STAFF'] },
  { key: 'CREDIT_NOTES',     label: 'Credit Notes',     section: 'Finance',    roles: ['OFFICE_STAFF'] },
  { key: 'SERVICE_INVOICES', label: 'Service Invoices', section: 'Finance',    roles: ['OFFICE_STAFF'] },
  { key: 'ATTENDANCE',       label: 'Attendance',       section: 'HR',         roles: ['OFFICE_STAFF'] },
  { key: 'SPARE_PARTS',      label: 'Spare Parts',      section: 'Inventory',  roles: ['STORE_KEEPER'] },
  { key: 'TYRES',            label: 'Tyres',            section: 'Inventory',  roles: ['STORE_KEEPER'] },
  { key: 'PART_REQUESTS',    label: 'Part Requests',    section: 'Inventory',  roles: ['STORE_KEEPER'] },
  { key: 'TYRE_REQUESTS',    label: 'Tyre Requests',    section: 'Inventory',  roles: ['STORE_KEEPER'] },
  { key: 'VEHICLE_SERVICES', label: 'Vehicle Services', section: 'Fleet',      roles: ['SERVICE_MEN'] },
]

const RBAC_MODULE_SECTIONS = ['Operations', 'Finance', 'HR', 'Analytics', 'Inventory', 'Fleet']

type CheckMap = Record<string, Record<string, boolean>>
// [role][moduleKey] = enabled
type ModuleMap = Record<string, Record<string, boolean>>

function defaultLoginAccess(): CheckMap {
  const map: CheckMap = {}
  for (const p of ['web', 'mobile']) {
    map[p] = {}
    for (const r of RBAC_ROLES) map[p][r.key] = true
  }
  return map
}

function RbacCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          checked
            ? 'bg-feros-orange border-feros-orange'
            : 'bg-white border-gray-300 hover:border-feros-orange'
        )}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </div>
  )
}

function RbacRoleHeader({ label, allChecked, onToggleAll }: {
  label: string; allChecked: boolean; onToggleAll: () => void
}) {
  return (
    <th className="px-3 py-3 text-center min-w-[90px]">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{label}</span>
        <button onClick={onToggleAll} className="text-[10px] text-feros-orange hover:underline font-medium">
          {allChecked ? 'None' : 'All'}
        </button>
      </div>
    </th>
  )
}

type RbacSubTab = 'login' | 'modules'

function RbacTab() {
  const qc = useQueryClient()
  const [subTab, setSubTab] = useState<RbacSubTab>('login')
  const [loginAccess, setLoginAccess] = useState<CheckMap>(defaultLoginAccess)
  const [moduleMap, setModuleMap]     = useState<ModuleMap>({})

  const platforms = [
    { key: 'web',    label: 'Web Platform', icon: '🖥' },
    { key: 'mobile', label: 'Mobile App',   icon: '📱' },
  ]

  // ── Load login access from API ───────────────────────────────────────────
  const { data: loginAccessData } = useQuery({
    queryKey: ['rbac-login-access'],
    queryFn: rbacApi.getLoginAccess,
  })

  const [loginInitialized, setLoginInitialized] = useState(false)
  useEffect(() => {
    if (!loginAccessData) return  // wait for data to actually load
    const entries: RbacEntry[] = loginAccessData?.data?.entries ?? []
    if (loginInitialized) return  // don't overwrite user edits after initial load
    const map = defaultLoginAccess()
    for (const e of entries) {
      const p = e.platform.toLowerCase()
      if (map[p]) map[p][e.role] = e.allowed
    }
    setLoginAccess(map)
    setLoginInitialized(true)
  }, [loginAccessData])

  // ── Save login access ────────────────────────────────────────────────────
  const saveLogin = useMutation({
    mutationFn: () => {
      const entries: RbacEntry[] = []
      for (const p of platforms) {
        for (const r of RBAC_ROLES) {
          entries.push({ role: r.key, platform: p.key.toUpperCase(), allowed: loginAccess[p.key]?.[r.key] ?? true })
        }
      }
      return rbacApi.saveLoginAccess({ entries })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac-login-access'] }); toast.success('Login access saved') },
    onError: () => toast.error('Failed to save login access'),
  })

  // ── Load module access from API ──────────────────────────────────────────
  const { data: moduleAccessData } = useQuery({
    queryKey: ['module-access'],
    queryFn: moduleAccessApi.getAll,
  })

  const [moduleInitialized, setModuleInitialized] = useState(false)
  useEffect(() => {
    if (!moduleAccessData) return  // wait for data to actually load
    const entries: ModuleAccessEntry[] = moduleAccessData?.data?.data?.entries ?? []
    if (moduleInitialized) return
    if (!entries.length) return
    const map: ModuleMap = {}
    for (const e of entries) {
      if (!map[e.role]) map[e.role] = {}
      map[e.role][e.moduleKey] = e.enabled
    }
    setModuleMap(map)
    setModuleInitialized(true)
  }, [moduleAccessData])

  // ── Save module access ───────────────────────────────────────────────────
  const saveModules = useMutation({
    mutationFn: () => {
      const entries: ModuleAccessEntry[] = []
      for (const m of RBAC_MODULE_ROWS) {
        for (const role of m.roles) {
          entries.push({ role, moduleKey: m.key as ModuleKey, enabled: moduleMap[role]?.[m.key] ?? true })
        }
      }
      return moduleAccessApi.saveAll({ entries })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['module-access'] }); toast.success('Module access saved') },
    onError: (err: any) => {
      if (!err?.isSubscriptionBlock) toast.error(err?.response?.data?.message ?? 'Failed to save module access')
    },
  })

  // ── Login access helpers ─────────────────────────────────────────────────
  function toggleLogin(platform: string, role: string, val: boolean) {
    setLoginAccess(prev => ({ ...prev, [platform]: { ...prev[platform], [role]: val } }))
  }
  function toggleLoginCol(role: string) {
    const all = platforms.every(p => loginAccess[p.key]?.[role])
    setLoginAccess(prev => {
      const next = { ...prev }
      for (const p of platforms) next[p.key] = { ...next[p.key], [role]: !all }
      return next
    })
  }
  // ── Module access helpers ────────────────────────────────────────────────
  function toggleModule(mod: string, role: string, val: boolean) {
    setModuleMap(prev => ({ ...prev, [role]: { ...(prev[role] ?? {}), [mod]: val } }))
  }
  function toggleModuleCol(role: string) {
    const applicableMods = RBAC_MODULE_ROWS.filter(m => m.roles.includes(role))
    const all = applicableMods.every(m => moduleMap[role]?.[m.key] ?? true)
    setModuleMap(prev => {
      const next = { ...prev, [role]: { ...(prev[role] ?? {}) } }
      for (const m of applicableMods) next[role][m.key] = !all
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['login', 'modules'] as RbacSubTab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              subTab === t ? 'bg-white text-feros-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'login' ? 'Login Access' : 'Module Access'}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        {subTab === 'login'
          ? 'Control which roles can log in on each platform. Admin always has full access.'
          : 'Control which modules each role can access. Admin always has full access.'}
      </p>

      {/* ── Login Access ── */}
      {subTab === 'login' && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 w-36">Platform</th>
                  {RBAC_ROLES.map(r => (
                    <RbacRoleHeader
                      key={r.key} label={r.label}
                      allChecked={platforms.every(p => loginAccess[p.key]?.[r.key])}
                      onToggleAll={() => toggleLoginCol(r.key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {platforms.map(p => (
                  <tr key={p.key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{p.icon} {p.label}</span>
                    </td>
                    {RBAC_ROLES.map(r => (
                      <td key={r.key} className="px-3 py-3">
                        <RbacCheckbox
                          checked={loginAccess[p.key]?.[r.key] ?? false}
                          onChange={v => toggleLogin(p.key, r.key, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Module Access ── */}
      {subTab === 'modules' && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 w-44">Module</th>
                  {MODULE_ACCESS_ROLES.map(r => (
                    <RbacRoleHeader
                      key={r.key} label={r.label}
                      allChecked={RBAC_MODULE_ROWS.filter(m => m.roles.includes(r.key)).every(m => moduleMap[r.key]?.[m.key] ?? true)}
                      onToggleAll={() => toggleModuleCol(r.key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {RBAC_MODULE_SECTIONS.map(section => {
                  const mods = RBAC_MODULE_ROWS.filter(m => m.section === section)
                  return (
                    <>
                      <tr key={`sec-${section}`} className="bg-gray-50 border-y border-gray-200">
                        <td className="px-4 py-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{section}</span>
                        </td>
                        {MODULE_ACCESS_ROLES.map(r => <td key={r.key} />)}
                      </tr>
                      {mods.map(m => (
                        <tr key={m.key} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3 pl-7">
                            <span className="text-gray-700">{m.label}</span>
                          </td>
                          {MODULE_ACCESS_ROLES.map(r => (
                            <td key={r.key} className="px-3 py-3">
                              {m.roles.includes(r.key) ? (
                                <RbacCheckbox
                                  checked={moduleMap[r.key]?.[m.key] ?? true}
                                  onChange={v => toggleModule(m.key, r.key, v)}
                                />
                              ) : (
                                <div className="flex justify-center text-gray-300 text-xs">—</div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'login' && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => saveLogin.mutate()} disabled={saveLogin.isPending}>
            {saveLogin.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
      {subTab === 'modules' && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => saveModules.mutate()} disabled={saveModules.isPending}>
            {saveModules.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_TABS = ['General', 'RBAC'] as const
type SettingsTab = typeof SETTINGS_TABS[number]

function SettingsSection() {
  const [tab, setTab] = useState<SettingsTab>('General')
  const qc = useQueryClient()
  const [payCycle, setPayCycle] = useState('MONTHLY')
  const [attendanceEnforced, setAttendanceEnforced] = useState(false)
  const [attendanceDeadlineTime, setAttendanceDeadlineTime] = useState('08:00')
  const [requireTyreApproval, setRequireTyreApproval] = useState(false)
  const [requireSparePartApproval, setRequireSparePartApproval] = useState(false)
  const [invoiceDescription, setInvoiceDescription] = useState('')
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
      setAttendanceEnforced(s.attendanceEnforced ?? false)
      // API returns "HH:MM:SS" — strip seconds for the time input
      setAttendanceDeadlineTime((s.attendanceDeadlineTime ?? '08:00:00').slice(0, 5))
      setRequireTyreApproval(s.requireTyreApproval ?? false)
      setRequireSparePartApproval(s.requireSparePartApproval ?? false)
      setInvoiceDescription(s.invoiceDescription ?? '')
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
    save.mutate({
      ...d,
      payCycle,
      isTripBonusEnabled: Boolean(d.isTripBonusEnabled),
      attendanceEnforced,
      attendanceDeadlineTime: attendanceDeadlineTime + ':00',
      requireTyreApproval,
      requireSparePartApproval,
      invoiceDescription: invoiceDescription || null,
    })
  }

  const { locked } = useSubscription()

  if (isLoading) return <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {SETTINGS_TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-feros-navy text-feros-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'RBAC' && <RbacTab />}

      {tab === 'General' && <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
        <div>
          <Label>Pay Cycle</Label>
          <SearchableSelect
            value={payCycle}
            onValueChange={setPayCycle}
            options={PAY_CYCLES.map(c => ({ value: c, label: c }))}
            className="mt-1"
          />
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

        {/* Attendance Gate */}
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="attendanceEnforced"
              checked={attendanceEnforced}
              onChange={e => setAttendanceEnforced(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            <Label htmlFor="attendanceEnforced" className="cursor-pointer">
              Require Attendance Before Trip Start
            </Label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, drivers and cleaners must mark attendance before they can start a trip on the mobile app.
          </p>
          <div>
            <Label>Missed Attendance Notification Time (IST)</Label>
            <Input
              type="time"
              value={attendanceDeadlineTime}
              onChange={e => setAttendanceDeadlineTime(e.target.value)}
              className="mt-1 w-40"
              disabled={!attendanceEnforced}
            />
            <p className="text-xs text-gray-400 mt-1">
              Staff who haven't marked attendance by this time will be notified. Supervisors and office staff are also alerted.
            </p>
          </div>
        </div>

        {/* Inventory Approval Gates */}
        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Inventory Approval</p>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requireTyreApproval"
              checked={requireTyreApproval}
              onChange={e => setRequireTyreApproval(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            <Label htmlFor="requireTyreApproval" className="cursor-pointer">
              Require Store Keeper Approval for Tyre Fitting
            </Label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, service technicians must submit a tyre request. The store keeper approves and issues the tyre.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requireSparePartApproval"
              checked={requireSparePartApproval}
              onChange={e => setRequireSparePartApproval(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            <Label htmlFor="requireSparePartApproval" className="cursor-pointer">
              Require Store Keeper Approval for Spare Parts
            </Label>
          </div>
          <p className="text-xs text-gray-500">
            When enabled, spare part requests are held for store keeper approval before stock is deducted.
          </p>
        </div>

        {/* Invoice Defaults */}
        <div className="border rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Invoice Defaults</p>
          <div>
            <Label>Default Description of Goods/Service</Label>
            <textarea
              rows={2}
              value={invoiceDescription}
              onChange={e => setInvoiceDescription(e.target.value)}
              className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm resize-none bg-background"
              placeholder="e.g. Transportation of Iron Ore Pellets from Konsor to Kakinada"
            />
            <p className="text-xs text-gray-400 mt-1">Printed in the Description column on all tax invoices. Leave blank to use invoice remarks as description.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending || locked}>{save.isPending ? 'Saving…' : 'Save Settings'}</Button>
        </div>
      </form>}
    </div>
  )
}

// ── GPS Providers Section ──────────────────────────────────────────────────────
const GPS_PROVIDER_OPTIONS: { value: GpsProviderType; label: string }[] = [
  { value: 'TATA_FLEET_EDGE', label: 'TATA Fleet Edge' },
  { value: 'BLACKBUCK',       label: 'Blackbuck Omnicom' },
  { value: 'VAMOSYS',         label: 'Vamosys' },
  { value: 'FLEETX',          label: 'Fleetx' },
  { value: 'CUSTOM',          label: 'Custom' },
]

function gpsProviderLabel(type: GpsProviderType) {
  return GPS_PROVIDER_OPTIONS.find(o => o.value === type)?.label ?? type
}

function gpsSyncBadge(status: string) {
  if (status === 'OK')    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Connected</span>
  if (status === 'ERROR') return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Error</span>
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not tested</span>
}

function GpsConfigDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: GpsProviderConfig | null }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GpsProviderConfigRequest>()

  const save = useMutation({
    mutationFn: (data: GpsProviderConfigRequest) =>
      editing ? gpsApi.updateConfig(editing.id, data) : gpsApi.createConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gps-configs'] })
      toast.success(editing ? 'Config updated' : 'GPS provider added')
      reset()
      onClose()
    },
    onError: () => toast.error('Failed to save config'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit GPS Provider' : 'Add GPS Provider'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => save.mutate(d))} className="space-y-4 pt-2">
          <div>
            <Label>Provider</Label>
            <select
              {...register('providerType', { required: true })}
              defaultValue={editing?.providerType ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy"
            >
              <option value="" disabled>Select provider</option>
              {GPS_PROVIDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.providerType && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>
          <div>
            <Label>Display Name <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input {...register('displayName')} defaultValue={editing?.displayName ?? ''} className="mt-1" placeholder="e.g. Main Fleet" />
          </div>
          <div>
            <Label>Client ID</Label>
            <Input {...register('clientId', { required: true })} className="mt-1" placeholder="Your provider client ID" />
            {errors.clientId && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>
          <div>
            <Label>Client Secret</Label>
            <Input {...register('clientSecret', { required: true })} type="password" className="mt-1" placeholder="Your provider client secret" />
            {errors.clientSecret && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>
          <div>
            <Label>API Base URL <span className="text-gray-400 font-normal">(optional — uses provider default)</span></Label>
            <Input {...register('apiBaseUrl')} defaultValue={editing?.apiBaseUrl ?? ''} className="mt-1" placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
              {editing ? 'Update' : 'Add Provider'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GpsMappingPanel({ config }: { config: GpsProviderConfig }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: providerVehicles, isLoading: loadingPV } = useQuery({
    queryKey: ['gps-provider-vehicles', config.id],
    queryFn: () => gpsApi.getProviderVehicles(config.id).then(r => r.data ?? []),
    enabled: open,
  })

  const { data: mappings } = useQuery({
    queryKey: ['gps-mappings'],
    queryFn: () => gpsApi.getMappings().then(r => r.data ?? []),
  })

  const addMapping = useMutation({
    mutationFn: (data: VehicleGpsMappingRequest) => gpsApi.createMapping(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gps-mappings'] }); qc.invalidateQueries({ queryKey: ['gps-fleet'] }); toast.success('Vehicle linked to GPS') },
    onError: () => toast.error('Failed to link vehicle'),
  })

  const removeMapping = useMutation({
    mutationFn: (id: number) => gpsApi.deleteMapping(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gps-mappings'] }); qc.invalidateQueries({ queryKey: ['gps-fleet'] }); toast.success('Mapping removed') },
  })

  const configMappings = (mappings ?? []).filter(m => m.gpsProviderConfigId === config.id)

  function getMappingForVehicle(pv: GpsProviderVehicle) {
    return configMappings.find(m => m.providerVehicleId === pv.providerVehicleId)
  }

  function handleLink(pv: GpsProviderVehicle) {
    if (!pv.ferosVehicleId) return
    addMapping.mutate({ vehicleId: pv.ferosVehicleId, gpsProviderConfigId: config.id, providerVehicleId: pv.providerVehicleId, providerRegNumber: pv.registrationNumber })
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
      >
        <span>Vehicle Mapping ({configMappings.length} linked)</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="overflow-x-auto">
          {loadingPV ? (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <Loader2 size={18} className="animate-spin mr-2" /> Fetching vehicles from provider...
            </div>
          ) : (providerVehicles ?? []).length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">No vehicles returned from provider. Check your credentials.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Provider Vehicle ID</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Reg Number</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">FEROS Match</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {(providerVehicles ?? []).map(pv => {
                  const mapping = getMappingForVehicle(pv)
                  return (
                    <tr key={pv.providerVehicleId} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">{pv.providerVehicleId}</td>
                      <td className="px-4 py-2 font-medium">{pv.registrationNumber}</td>
                      <td className="px-4 py-2">
                        {pv.autoMatched
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Auto-matched</span>
                          : <span className="text-gray-400 text-xs">No match</span>}
                      </td>
                      <td className="px-4 py-2">
                        {mapping ? (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs" onClick={() => removeMapping.mutate(mapping.id)} disabled={removeMapping.isPending}>
                            <Link2Off size={12} className="mr-1" /> Unlink
                          </Button>
                        ) : pv.ferosVehicleId ? (
                          <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2 text-xs" onClick={() => handleLink(pv)} disabled={addMapping.isPending}>
                            <Link size={12} className="mr-1" /> Link
                          </Button>
                        ) : (
                          <span className="text-gray-300 text-xs">No FEROS vehicle</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function GpsProvidersSection() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<GpsProviderConfig | null>(null)

  const { data: configs, isLoading } = useQuery({
    queryKey: ['gps-configs'],
    queryFn: () => gpsApi.getConfigs().then(r => r.data ?? []),
  })

  const deleteConfig = useMutation({
    mutationFn: (id: number) => gpsApi.deleteConfig(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gps-configs'] }); toast.success('GPS provider removed') },
    onError: () => toast.error('Failed to remove config'),
  })

  const testConnection = useMutation({
    mutationFn: (id: number) => gpsApi.testConnection(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['gps-configs'] })
      res.data ? toast.success('Connection successful!') : toast.error('Connection failed. Check your credentials.')
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800">GPS Providers</h2>
          <p className="text-xs text-gray-500 mt-0.5">Connect your GPS provider and map vehicles</p>
        </div>
        <Button size="sm" onClick={() => { setEditingConfig(null); setDialogOpen(true) }}>
          <Plus size={14} className="mr-1" /> Add Provider
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading...
        </div>
      ) : (configs ?? []).length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl text-gray-400">
          <Wifi size={28} className="mx-auto mb-2 opacity-40" />
          <p className="font-medium text-gray-600">No GPS providers configured</p>
          <p className="text-sm mt-1">Add your first provider to start tracking vehicles</p>
          <Button className="mt-4" size="sm" onClick={() => { setEditingConfig(null); setDialogOpen(true) }}>
            <Plus size={14} className="mr-1" /> Add Provider
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {(configs ?? []).map(config => (
            <div key={config.id} className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{config.displayName || gpsProviderLabel(config.providerType)}</h3>
                    {gpsSyncBadge(config.syncStatus)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{gpsProviderLabel(config.providerType)}</p>
                  {config.lastSyncAt && (
                    <p className="text-xs text-gray-400 mt-1">Last tested: {new Date(config.lastSyncAt).toLocaleString()}</p>
                  )}
                  {config.syncStatus === 'ERROR' && config.syncErrorMsg && (
                    <p className="text-xs text-red-500 mt-1">{config.syncErrorMsg}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => testConnection.mutate(config.id)} disabled={testConnection.isPending}>
                    {testConnection.isPending
                      ? <Loader2 size={13} className="animate-spin mr-1" />
                      : config.syncStatus === 'OK'
                        ? <CheckCircle size={13} className="mr-1 text-green-600" />
                        : <XCircle size={13} className="mr-1 text-gray-400" />}
                    Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingConfig(config); setDialogOpen(true) }}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteConfig.mutate(config.id)} disabled={deleteConfig.isPending}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <GpsMappingPanel config={config} />
            </div>
          ))}
        </div>
      )}

      <GpsConfigDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingConfig(null) }}
        editing={editingConfig}
      />
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
      case 'gpsProviders':   return <GpsProvidersSection />
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
