import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehiclesApi } from '@/api/vehicles'
import { globalMastersApi, tenantMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import { differenceInDays, parseISO, isValid } from 'date-fns'
import {
  Plus, Search, Truck, ChevronRight, Pencil, Trash2, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Vehicle } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────
type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok' | 'none'

function expiryStatus(dateStr?: string): ExpiryStatus {
  if (!dateStr) return 'none'
  const d = parseISO(dateStr)
  if (!isValid(d)) return 'none'
  const days = differenceInDays(d, new Date())
  if (days < 0)  return 'expired'
  if (days <= 7)  return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

function ExpiryChip({ date, label }: { date?: string; label: string }) {
  const s = expiryStatus(date)
  if (s === 'none') return <span className="text-gray-300 text-xs">—</span>
  const colors: Record<ExpiryStatus, string> = {
    expired:  'bg-red-50 text-red-700',
    critical: 'bg-orange-50 text-orange-700',
    warning:  'bg-yellow-50 text-yellow-700',
    ok:       'bg-green-50 text-green-700',
    none:     '',
  }
  const days = differenceInDays(parseISO(date!), new Date())
  const text = s === 'expired' ? `${label} expired` : `${label} ${days}d`
  return (
    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', colors[s])}>
      {s === 'expired' && <AlertTriangle size={10} className="inline mr-0.5" />}
      {text}
    </span>
  )
}

// ── form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  registrationNumber:       z.string().min(1, 'Registration number is required'),
  brandId:                  z.coerce.number().optional(),
  vehicleTypeId:            z.coerce.number().optional(),
  fuelTypeId:               z.coerce.number().optional(),
  ownershipTypeId:          z.coerce.number().optional(),
  currentStatusId:          z.coerce.number().optional(),
  capacityInTons:           z.coerce.number().optional(),
  manufactureYear:          z.coerce.number().optional(),
  color:                    z.string().optional(),
  chassisNumber:            z.string().optional(),
  engineNumber:             z.string().optional(),
  // Compliance
  rcNumber:                 z.string().optional(),
  rcExpiryDate:             z.string().optional(),
  insuranceCompanyName:     z.string().optional(),
  insurancePolicyNumber:    z.string().optional(),
  insuranceStartDate:       z.string().optional(),
  insuranceExpiryDate:      z.string().optional(),
  permitNumber:             z.string().optional(),
  permitType:               z.string().optional(),
  permitStartDate:          z.string().optional(),
  permitExpiryDate:         z.string().optional(),
  fitnessCertificateNumber: z.string().optional(),
  fitnessExpiryDate:        z.string().optional(),
  pucNumber:                z.string().optional(),
  pollutionExpiryDate:      z.string().optional(),
  roadTaxPaidDate:          z.string().optional(),
  roadTaxExpiryDate:        z.string().optional(),
  // Owner / hired info
  ownerName:                z.string().optional(),
  ownerPhone:               z.string().optional(),
  ownerPan:                 z.string().optional(),
  ownerAddress:             z.string().optional(),
  agreementStartDate:       z.string().optional(),
  agreementEndDate:         z.string().optional(),
  agreementAmount:          z.coerce.number().optional(),
  // GPS & misc
  gpsDeviceNumber:          z.string().optional(),
  gpsDeviceImei:            z.string().optional(),
  gpsProvider:              z.string().optional(),
  currentOdometerReading:   z.coerce.number().optional(),
  notes:                    z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ── vehicle form dialog ───────────────────────────────────────────────────────
export function VehicleForm({
  open, onClose, vehicle,
}: {
  open: boolean; onClose: () => void; vehicle?: Vehicle
}) {
  const qc = useQueryClient()
  const isEdit = !!vehicle
  const [ownershipTypeId, setOwnershipTypeId] = useState<number | undefined>(vehicle?.ownershipTypeId)

  const { data: brandsRes }        = useQuery({ queryKey: ['vehicle-brands'],    queryFn: globalMastersApi.getVehicleBrands })
  const { data: typesRes }         = useQuery({ queryKey: ['vehicle-types'],     queryFn: globalMastersApi.getVehicleTypes })
  const { data: fuelRes }          = useQuery({ queryKey: ['fuel-types'],        queryFn: globalMastersApi.getFuelTypes })
  const { data: ownershipRes }     = useQuery({ queryKey: ['ownership-types'],   queryFn: globalMastersApi.getOwnershipTypes })
  const { data: statusRes }        = useQuery({ queryKey: ['vehicle-statuses'],  queryFn: tenantMastersApi.getVehicleStatuses })

  const selectedOwnershipName = ownershipRes?.data?.find(o => o.id === ownershipTypeId)?.name ?? ''
  const showOwnerSection = !!ownershipTypeId && !selectedOwnershipName.toUpperCase().includes('OWN')

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: vehicle ? {
      registrationNumber: vehicle.registrationNumber,
      brandId: vehicle.brandId, vehicleTypeId: vehicle.vehicleTypeId,
      fuelTypeId: vehicle.fuelTypeId, ownershipTypeId: vehicle.ownershipTypeId,
      currentStatusId: vehicle.currentStatusId, capacityInTons: vehicle.capacityInTons,
      manufactureYear: vehicle.manufactureYear, color: vehicle.color ?? '',
      chassisNumber: vehicle.chassisNumber ?? '', engineNumber: vehicle.engineNumber ?? '',
      rcNumber: vehicle.rcNumber ?? '', rcExpiryDate: vehicle.rcExpiryDate ?? '',
      insuranceCompanyName: vehicle.insuranceCompanyName ?? '',
      insurancePolicyNumber: vehicle.insurancePolicyNumber ?? '',
      insuranceStartDate: vehicle.insuranceStartDate ?? '',
      insuranceExpiryDate: vehicle.insuranceExpiryDate ?? '',
      permitNumber: vehicle.permitNumber ?? '', permitType: vehicle.permitType ?? '',
      permitStartDate: vehicle.permitStartDate ?? '', permitExpiryDate: vehicle.permitExpiryDate ?? '',
      fitnessCertificateNumber: vehicle.fitnessCertificateNumber ?? '',
      fitnessExpiryDate: vehicle.fitnessExpiryDate ?? '',
      pucNumber: vehicle.pucNumber ?? '', pollutionExpiryDate: vehicle.pollutionExpiryDate ?? '',
      roadTaxPaidDate: vehicle.roadTaxPaidDate ?? '', roadTaxExpiryDate: vehicle.roadTaxExpiryDate ?? '',
      ownerName: vehicle.ownerName ?? '', ownerPhone: vehicle.ownerPhone ?? '',
      ownerPan: vehicle.ownerPan ?? '', ownerAddress: vehicle.ownerAddress ?? '',
      agreementStartDate: vehicle.agreementStartDate ?? '',
      agreementEndDate: vehicle.agreementEndDate ?? '',
      agreementAmount: vehicle.agreementAmount,
      gpsDeviceNumber: vehicle.gpsDeviceNumber ?? '',
      gpsDeviceImei: vehicle.gpsDeviceImei ?? '', gpsProvider: vehicle.gpsProvider ?? '',
      currentOdometerReading: vehicle.currentOdometerReading, notes: vehicle.notes ?? '',
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? vehiclesApi.update(vehicle!.id, data) : vehiclesApi.create(data),
    onSuccess: () => {
      toast.success(`Vehicle ${isEdit ? 'updated' : 'added'} successfully`)
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Something went wrong')
    },
  })

  const sel = 'w-full h-10 px-3 rounded-md border border-input bg-background text-sm'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 pt-2">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Registration Number *</Label>
              <Input placeholder="MH12AB1234" className="uppercase" {...register('registrationNumber')} />
              {errors.registrationNumber && <p className="text-red-500 text-xs">{errors.registrationNumber.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <select {...register('brandId')} className={sel}>
                <option value="">Select brand</option>
                {brandsRes?.data?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle Type</Label>
              <select {...register('vehicleTypeId')} className={sel}>
                <option value="">Select type</option>
                {typesRes?.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Fuel Type</Label>
              <select {...register('fuelTypeId')} className={sel}>
                <option value="">Select fuel type</option>
                {fuelRes?.data?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ownership Type</Label>
              <select
                {...register('ownershipTypeId')}
                onChange={e => setOwnershipTypeId(Number(e.target.value) || undefined)}
                className={sel}
              >
                <option value="">Select ownership</option>
                {ownershipRes?.data?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Current Status</Label>
              <select {...register('currentStatusId')} className={sel}>
                <option value="">Select status</option>
                {statusRes?.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Capacity (tons)</Label>
              <Input type="number" step="0.1" placeholder="10" {...register('capacityInTons')} />
            </div>
            <div className="space-y-1.5">
              <Label>Manufacture Year</Label>
              <Input type="number" placeholder="2020" {...register('manufactureYear')} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input placeholder="White" {...register('color')} />
            </div>
            <div className="space-y-1.5">
              <Label>Chassis Number</Label>
              <Input placeholder="MA3EWDE1S00000000" {...register('chassisNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label>Engine Number</Label>
              <Input placeholder="G10B1234567" {...register('engineNumber')} />
            </div>
          </div>

          {/* Compliance */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Compliance & Documents</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>RC Number</Label>
                <Input placeholder="MH12AB1234" {...register('rcNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>RC Expiry Date</Label>
                <Input type="date" {...register('rcExpiryDate')} />
              </div>

              <div className="space-y-1.5">
                <Label>Insurance Company</Label>
                <Input placeholder="New India Assurance" {...register('insuranceCompanyName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Policy Number</Label>
                <Input placeholder="NIA/12345/2024" {...register('insurancePolicyNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>Insurance Start</Label>
                <Input type="date" {...register('insuranceStartDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Insurance Expiry</Label>
                <Input type="date" {...register('insuranceExpiryDate')} />
              </div>

              <div className="space-y-1.5">
                <Label>Permit Number</Label>
                <Input placeholder="MH/NP/12345" {...register('permitNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>Permit Type</Label>
                <select {...register('permitType')} className={sel}>
                  <option value="">Select type</option>
                  <option value="NATIONAL">National</option>
                  <option value="STATE">State</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Permit Start</Label>
                <Input type="date" {...register('permitStartDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Permit Expiry</Label>
                <Input type="date" {...register('permitExpiryDate')} />
              </div>

              <div className="space-y-1.5">
                <Label>Fitness Certificate No.</Label>
                <Input placeholder="FC/MH/12345" {...register('fitnessCertificateNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>Fitness Expiry</Label>
                <Input type="date" {...register('fitnessExpiryDate')} />
              </div>

              <div className="space-y-1.5">
                <Label>PUC Number</Label>
                <Input placeholder="PUC123456" {...register('pucNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>Pollution Expiry</Label>
                <Input type="date" {...register('pollutionExpiryDate')} />
              </div>

              <div className="space-y-1.5">
                <Label>Road Tax Paid Date</Label>
                <Input type="date" {...register('roadTaxPaidDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Road Tax Expiry</Label>
                <Input type="date" {...register('roadTaxExpiryDate')} />
              </div>
            </div>
          </div>

          {/* Owner / Hired Info */}
          {showOwnerSection && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Owner / Hired Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Owner Name</Label>
                  <Input placeholder="Ramesh Kumar" {...register('ownerName')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Owner Phone</Label>
                  <Input placeholder="9876543210" {...register('ownerPhone')} />
                </div>
                <div className="space-y-1.5">
                  <Label>PAN Number</Label>
                  <Input placeholder="AAAAA0000A" {...register('ownerPan')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Agreement Amount (₹)</Label>
                  <Input type="number" placeholder="15000" {...register('agreementAmount')} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Owner Address</Label>
                  <Input placeholder="123 Main St, Mumbai" {...register('ownerAddress')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Agreement Start</Label>
                  <Input type="date" {...register('agreementStartDate')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Agreement End</Label>
                  <Input type="date" {...register('agreementEndDate')} />
                </div>
              </div>
            </div>
          )}

          {/* GPS & Notes */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">GPS & Notes</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>GPS Device No.</Label>
                <Input placeholder="GPS001" {...register('gpsDeviceNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>GPS Provider</Label>
                <Input placeholder="TrackOn" {...register('gpsProvider')} />
              </div>
              <div className="space-y-1.5">
                <Label>GPS IMEI</Label>
                <Input placeholder="359012345678901" {...register('gpsDeviceImei')} />
              </div>
              <div className="space-y-1.5">
                <Label>Current Odometer (km)</Label>
                <Input type="number" placeholder="45000" {...register('currentOdometerReading')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input placeholder="Any special notes about this vehicle" {...register('notes')} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update Vehicle' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export function VehiclesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [formOpen, setFormOpen]       = useState(false)
  const [editing, setEditing]         = useState<Vehicle | undefined>()
  const [typeFilter, setTypeFilter]   = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: res, isLoading }  = useQuery({ queryKey: ['vehicles'],         queryFn: vehiclesApi.getAll })
  const { data: typesRes }        = useQuery({ queryKey: ['vehicle-types'],    queryFn: globalMastersApi.getVehicleTypes })
  const { data: ownershipRes }    = useQuery({ queryKey: ['ownership-types'],  queryFn: globalMastersApi.getOwnershipTypes })

  const deleteMutation = useMutation({
    mutationFn: vehiclesApi.remove,
    onSuccess: () => { toast.success('Vehicle removed'); qc.invalidateQueries({ queryKey: ['vehicles'] }) },
    onError: () => toast.error('Failed to remove vehicle'),
  })

  function handleDelete(v: Vehicle, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Remove vehicle ${v.registrationNumber}?`)) return
    deleteMutation.mutate(v.id)
  }

  const allVehicles = res?.data ?? []

  const vehicles = allVehicles.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = v.registrationNumber.toLowerCase().includes(q) ||
                        (v.brandName ?? '').toLowerCase().includes(q) ||
                        (v.vehicleTypeName ?? '').toLowerCase().includes(q)
    const matchType   = !typeFilter  || String(v.vehicleTypeId) === typeFilter
    const matchOwner  = !ownerFilter || String(v.ownershipTypeId) === ownerFilter
    const matchStatus = !statusFilter || (statusFilter === 'active' ? v.isActive : !v.isActive)
    return matchSearch && matchType && matchOwner && matchStatus
  })

  // Count vehicles with any compliance issue
  const alertCount = allVehicles.filter(v =>
    ['expired', 'critical'].includes(expiryStatus(v.insuranceExpiryDate)) ||
    ['expired', 'critical'].includes(expiryStatus(v.rcExpiryDate)) ||
    ['expired', 'critical'].includes(expiryStatus(v.permitExpiryDate)) ||
    ['expired', 'critical'].includes(expiryStatus(v.fitnessExpiryDate))
  ).length

  function openEdit(v: Vehicle, e: React.MouseEvent) { e.stopPropagation(); setEditing(v); setFormOpen(true) }
  function openCreate() { setEditing(undefined); setFormOpen(true) }
  function onClose()    { setFormOpen(false); setEditing(undefined) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {allVehicles.length} total
            {alertCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · <AlertTriangle size={12} className="inline mb-0.5" /> {alertCount} compliance alert{alertCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
          <Plus size={16} /> Add Vehicle
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by registration, brand, type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All Types</option>
          {typesRes?.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={ownerFilter}
          onChange={e => setOwnerFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All Ownership</option>
          {ownershipRes?.data?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading vehicles…</div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <Truck size={36} className="text-gray-200" />
            <p className="text-sm">{search ? 'No vehicles match your search' : 'No vehicles yet. Add your first vehicle.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Type / Capacity</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Ownership</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Current Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Compliance</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Active</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => {
                  const insStatus = expiryStatus(v.insuranceExpiryDate)
                  const rcStatus  = expiryStatus(v.rcExpiryDate)
                  const hasAlert  = ['expired', 'critical'].includes(insStatus) || ['expired', 'critical'].includes(rcStatus)

                  return (
                    <tr
                      key={v.id}
                      onClick={() => navigate(`/vehicles/${v.id}`)}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                            hasAlert ? 'bg-red-50' : 'bg-feros-navy/10'
                          )}>
                            <Truck size={14} className={hasAlert ? 'text-red-500' : 'text-feros-navy'} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 font-mono">{v.registrationNumber}</p>
                            {v.brandName && <p className="text-xs text-gray-400">{v.brandName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-700">{v.vehicleTypeName ?? '—'}</p>
                        {v.capacityInTons && (
                          <p className="text-xs text-gray-400">{v.capacityInTons}T · {v.fuelTypeName ?? ''}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded-full">
                          {v.ownershipTypeName ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {v.currentStatusName ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                            {v.currentStatusName}
                          </span>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <ExpiryChip date={v.insuranceExpiryDate} label="Ins" />
                          <ExpiryChip date={v.rcExpiryDate} label="RC" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={cn('text-xs', v.isActive
                          ? 'bg-green-50 text-green-700 hover:bg-green-50'
                          : 'bg-red-50 text-red-700 hover:bg-red-50'
                        )}>
                          {v.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={e => openEdit(v, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={e => handleDelete(v, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={16} className="text-gray-300 ml-1" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VehicleForm open={formOpen} onClose={onClose} vehicle={editing} />
    </div>
  )
}
