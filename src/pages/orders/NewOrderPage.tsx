import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ordersApi } from '@/api/orders'
import { clientsApi } from '@/api/clients'
import { vehiclesApi } from '@/api/vehicles'
import { globalMastersApi } from '@/api/masters'
import { attendanceApi } from '@/api/attendance'
import type { Attendance } from '@/types'

// ── shared constants ──────────────────────────────────────────────────────────
const MATERIAL_OTHER = 0
const today = new Date().toISOString().split('T')[0]

// ── Live Order form ───────────────────────────────────────────────────────────
const liveSchema = z.object({
  clientId:             z.coerce.number().min(1, 'Select a client'),
  materialTypeId:       z.coerce.number().min(0, 'Select material type'),
  customMaterialName:   z.string().optional(),
  totalWeight:          z.coerce.number().positive('Weight must be positive'),
  orderDate:            z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  sourceAddress:        z.string().optional(),
  sourceStateId:        z.coerce.number().min(1, 'Select source state'),
  sourceCityId:         z.coerce.number().min(1, 'Select source city'),
  destinationAddress:   z.string().optional(),
  destinationStateId:   z.coerce.number().min(1, 'Select destination state'),
  destinationCityId:    z.coerce.number().min(1, 'Select destination city'),
  freightRateType:      z.enum(['PER_TON', 'PER_TRIP', 'PER_KM']),
  freightRate:          z.coerce.number().positive('Enter freight rate'),
  billingOn:            z.enum(['LOADED_WEIGHT', 'DELIVERED_WEIGHT']).optional(),
  specialInstructions:  z.string().optional(),
  remarks:              z.string().optional(),
})
type LiveFormData = z.infer<typeof liveSchema>

function LiveOrderForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [srcState, setSrcState] = useState<number | undefined>()
  const [dstState, setDstState] = useState<number | undefined>()
  const [clientAutoFilled, setClientAutoFilled] = useState(false)

  const { data: clientsRes }   = useQuery({ queryKey: ['clients-all'],    queryFn: () => clientsApi.getAll({ size: 1000 }) })
  const { data: materialsRes } = useQuery({ queryKey: ['material-types'], queryFn: globalMastersApi.getMaterialTypes })
  const { data: statesRes }    = useQuery({ queryKey: ['states'],         queryFn: globalMastersApi.getStates })

  const { data: srcCitiesRes } = useQuery({
    queryKey: ['cities', srcState],
    queryFn: () => globalMastersApi.getCities(srcState),
    enabled: !!srcState,
  })
  const { data: dstCitiesRes } = useQuery({
    queryKey: ['cities', dstState],
    queryFn: () => globalMastersApi.getCities(dstState),
    enabled: !!dstState,
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<LiveFormData>({
    resolver: zodResolver(liveSchema) as Resolver<LiveFormData>,
    defaultValues: { freightRateType: 'PER_TON', billingOn: 'LOADED_WEIGHT' },
  })

  const watchedClientId    = watch('clientId')
  const watchedMaterialId  = watch('materialTypeId')
  const watchedSrcState    = watch('sourceStateId')
  const watchedSrcCity     = watch('sourceCityId')
  const watchedDstState    = watch('destinationStateId')
  const watchedDstCity     = watch('destinationCityId')
  const watchedFreightType = watch('freightRateType')
  const watchedBillingOn   = watch('billingOn')

  const prevClientId = useRef<number | undefined>(undefined)

  useEffect(() => {
    const id = Number(watchedClientId)
    if (!id || !clientsRes?.data?.content) return
    if (id === prevClientId.current) return
    prevClientId.current = id
    const client = clientsRes.data.content.find(c => c.id === id)
    if (!client) return
    if (client.stateId) { setValue('destinationStateId', client.stateId); setDstState(client.stateId) }
    if (client.cityId) setValue('destinationCityId', client.cityId)
    setValue('destinationAddress', client.address ?? '')
    setClientAutoFilled(true)
  }, [watchedClientId, clientsRes?.data?.content])

  const materials       = materialsRes?.data ?? []
  const isOtherMaterial = Number(watchedMaterialId) === MATERIAL_OTHER

  const mutation = useMutation({
    mutationFn: (data: LiveFormData) => {
      const payload: Record<string, unknown> = { ...data }
      if (isOtherMaterial) delete payload.materialTypeId
      else delete payload.customMaterialName
      return ordersApi.create(payload)
    },
    onSuccess: (res) => {
      toast.success('Order created successfully')
      qc.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/orders/${res.data?.id}`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Something went wrong')
    },
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Order Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <SearchableSelect
              value={watchedClientId ? String(watchedClientId) : ''}
              onValueChange={v => setValue('clientId', Number(v))}
              options={(clientsRes?.data?.content ?? []).filter(c => c.isActive).map(c => ({ value: String(c.id), label: c.clientName }))}
              placeholder="Select client"
            />
            {errors.clientId && <p className="text-red-500 text-xs">{errors.clientId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Material Type *</Label>
            <SearchableSelect
              value={watchedMaterialId != null ? String(watchedMaterialId) : ''}
              onValueChange={v => setValue('materialTypeId', Number(v))}
              options={[
                ...materials.map(m => ({ value: String(m.id), label: m.name })),
                { value: String(MATERIAL_OTHER), label: 'Other (specify manually)' },
              ]}
              placeholder="Select material"
            />
            {errors.materialTypeId && <p className="text-red-500 text-xs">{errors.materialTypeId.message}</p>}
            {isOtherMaterial && (
              <Input {...register('customMaterialName')} placeholder="Type material name…" className="mt-1.5" autoFocus />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Total Weight (tons) *</Label>
            <Input type="number" step="0.01" min="0.01" placeholder="25.00" {...register('totalWeight')} />
            {errors.totalWeight && <p className="text-red-500 text-xs">{errors.totalWeight.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Order Date</Label>
            <Input type="date" {...register('orderDate')} />
          </div>

          <div className="space-y-1.5">
            <Label>Expected Delivery Date</Label>
            <Input type="date" {...register('expectedDeliveryDate')} />
          </div>
        </div>

        {/* Source */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Source (From)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>State *</Label>
              <SearchableSelect
                value={watchedSrcState ? String(watchedSrcState) : ''}
                onValueChange={v => { setSrcState(Number(v) || undefined); setValue('sourceStateId', Number(v)); setValue('sourceCityId', 0) }}
                options={(statesRes?.data ?? []).map(s => ({ value: String(s.id), label: s.name }))}
                placeholder="Select state"
              />
              {errors.sourceStateId && <p className="text-red-500 text-xs">{errors.sourceStateId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>City *</Label>
              <SearchableSelect
                value={watchedSrcCity ? String(watchedSrcCity) : ''}
                onValueChange={v => setValue('sourceCityId', Number(v))}
                options={(srcCitiesRes?.data ?? []).map(c => ({ value: String(c.id), label: c.name }))}
                placeholder="Select city"
              />
              {errors.sourceCityId && <p className="text-red-500 text-xs">{errors.sourceCityId.message}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Depot / Loading point" {...register('sourceAddress')} />
            </div>
          </div>
        </div>

        {/* Destination */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">Destination (To)</p>
            {clientAutoFilled && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Auto-filled from client</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>State *</Label>
              <SearchableSelect
                value={watchedDstState ? String(watchedDstState) : ''}
                onValueChange={v => { setDstState(Number(v) || undefined); setValue('destinationStateId', Number(v)); setValue('destinationCityId', 0) }}
                options={(statesRes?.data ?? []).map(s => ({ value: String(s.id), label: s.name }))}
                placeholder="Select state"
              />
              {errors.destinationStateId && <p className="text-red-500 text-xs">{errors.destinationStateId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>City *</Label>
              <SearchableSelect
                value={watchedDstCity ? String(watchedDstCity) : ''}
                onValueChange={v => setValue('destinationCityId', Number(v))}
                options={(dstCitiesRes?.data ?? []).map(c => ({ value: String(c.id), label: c.name }))}
                placeholder="Select city"
              />
              {errors.destinationCityId && <p className="text-red-500 text-xs">{errors.destinationCityId.message}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Delivery point" {...register('destinationAddress')} />
            </div>
          </div>
        </div>

        {/* Freight */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Freight</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Rate Type *</Label>
              <Select value={watchedFreightType ?? 'PER_TON'} onValueChange={v => setValue('freightRateType', v as 'PER_TON' | 'PER_TRIP' | 'PER_KM')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_TON">Per Ton</SelectItem>
                  <SelectItem value="PER_TRIP">Per Trip</SelectItem>
                  <SelectItem value="PER_KM">Per KM</SelectItem>
                </SelectContent>
              </Select>
              {errors.freightRateType && <p className="text-red-500 text-xs">{errors.freightRateType.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Rate (₹) *</Label>
              <Input type="number" step="0.01" placeholder="1500.00" {...register('freightRate')} />
              {errors.freightRate && <p className="text-red-500 text-xs">{errors.freightRate.message}</p>}
            </div>
            {watchedFreightType === 'PER_TON' && (
              <div className="space-y-1.5">
                <Label>Bill On</Label>
                <Select value={watchedBillingOn ?? 'LOADED_WEIGHT'} onValueChange={v => setValue('billingOn', v as 'LOADED_WEIGHT' | 'DELIVERED_WEIGHT')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOADED_WEIGHT">Loaded Weight</SelectItem>
                    <SelectItem value="DELIVERED_WEIGHT">Delivered Weight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Remarks */}
        <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Special Instructions</Label>
            <Input placeholder="Handle with care…" {...register('specialInstructions')} />
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input placeholder="Internal notes…" {...register('remarks')} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => navigate('/orders')}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white px-8">
          {mutation.isPending ? 'Saving…' : 'Create Order'}
        </Button>
      </div>
    </form>
  )
}

// ── POL form ──────────────────────────────────────────────────────────────────
const polSchema = z.object({
  clientId:           z.coerce.number().min(1, 'Select a client'),
  materialTypeId:     z.coerce.number().min(0),
  customMaterialName: z.string().optional(),
  totalWeight:        z.coerce.number().positive('Required'),
  orderDate:          z.string().min(1, 'Order date is required'),
  sourceStateId:      z.coerce.number().min(1, 'Required'),
  sourceCityId:       z.coerce.number().min(1, 'Required'),
  destinationStateId: z.coerce.number().min(1, 'Required'),
  destinationCityId:  z.coerce.number().min(1, 'Required'),
  freightRateType:    z.enum(['PER_TON', 'PER_TRIP', 'PER_KM']),
  freightRate:        z.coerce.number().positive('Required'),
  billingOn:          z.enum(['LOADED_WEIGHT', 'DELIVERED_WEIGHT']).optional(),
  remarks:            z.string().optional(),
})
type PolFormData = z.infer<typeof polSchema>

type LrRow = {
  vehicleId: number; driverId: number; cleanerId?: number
  paperLrNumber: string; vehicleCapacity: number; allocatedWeight: number
  loadedWeight: number; deliveredWeight: number; lrDate: string
  ewayBillNumber: string; remarks: string
}

function emptyRow(): LrRow {
  return {
    vehicleId: 0, driverId: 0, cleanerId: undefined,
    paperLrNumber: '', vehicleCapacity: 0, allocatedWeight: 0,
    loadedWeight: 0, deliveredWeight: 0, lrDate: '',
    ewayBillNumber: '', remarks: '',
  }
}

function PolOrderForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [srcState, setSrcState] = useState<number | undefined>()
  const [dstState, setDstState] = useState<number | undefined>()
  const [rows, setRows] = useState<LrRow[]>([emptyRow()])
  const [rowErrors, setRowErrors] = useState<Record<number, Record<string, string>>>({})

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PolFormData>({
    resolver: zodResolver(polSchema) as Resolver<PolFormData>,
    defaultValues: { freightRateType: 'PER_TON', billingOn: 'LOADED_WEIGHT', materialTypeId: MATERIAL_OTHER },
  })

  const watchedOrderDate   = watch('orderDate')
  const watchedMaterialId  = watch('materialTypeId')
  const watchedSrcState    = watch('sourceStateId')
  const watchedDstState    = watch('destinationStateId')
  const watchedClientId    = watch('clientId')
  const watchedFreightType = watch('freightRateType')
  const watchedBillingOn   = watch('billingOn')
  const isOtherMaterial    = Number(watchedMaterialId) === MATERIAL_OTHER

  const { data: clientsRes }   = useQuery({ queryKey: ['clients-all'],    queryFn: () => clientsApi.getAll({ size: 1000 }) })
  const { data: materialsRes } = useQuery({ queryKey: ['material-types'], queryFn: globalMastersApi.getMaterialTypes })
  const { data: statesRes }    = useQuery({ queryKey: ['states'],         queryFn: globalMastersApi.getStates })
  const { data: vehiclesRes }  = useQuery({ queryKey: ['vehicles-all'],   queryFn: () => vehiclesApi.getAll() })
  const { data: srcCitiesRes } = useQuery({ queryKey: ['cities', srcState], queryFn: () => globalMastersApi.getCities(srcState), enabled: !!srcState })
  const { data: dstCitiesRes } = useQuery({ queryKey: ['cities', dstState], queryFn: () => globalMastersApi.getCities(dstState), enabled: !!dstState })
  const { data: attendanceRes } = useQuery({
    queryKey: ['attendance-by-date', watchedOrderDate],
    queryFn: () => attendanceApi.getByDate(watchedOrderDate),
    enabled: !!watchedOrderDate,
  })

  const attendance: Attendance[] = attendanceRes?.data ?? []
  const drivers  = attendance.filter(a => a.roleName === 'DRIVER'  && a.approvalStatus !== 'REJECTED')
  const cleaners = attendance.filter(a => a.roleName === 'CLEANER' && a.approvalStatus !== 'REJECTED')

  useEffect(() => {
    const id = Number(watchedClientId)
    if (!id || !clientsRes?.data?.content) return
    const client = clientsRes.data.content.find(c => c.id === id)
    if (!client) return
    if (client.stateId) { setValue('destinationStateId', client.stateId); setDstState(client.stateId) }
    if (client.cityId) setValue('destinationCityId', client.cityId)
  }, [watchedClientId, clientsRes?.data?.content])

  const mutation = useMutation({
    mutationFn: (data: PolFormData) => {
      const payload: Record<string, unknown> = {
        clientId: data.clientId, totalWeight: data.totalWeight, orderDate: data.orderDate,
        sourceStateId: data.sourceStateId, sourceCityId: data.sourceCityId,
        destinationStateId: data.destinationStateId, destinationCityId: data.destinationCityId,
        freightRateType: data.freightRateType, freightRate: data.freightRate,
        billingOn: data.billingOn, remarks: data.remarks,
        lrs: rows.map(r => ({
          vehicleId: r.vehicleId, driverId: r.driverId,
          cleanerId: r.cleanerId || undefined,
          paperLrNumber: r.paperLrNumber || undefined,
          vehicleCapacity: r.vehicleCapacity, allocatedWeight: r.allocatedWeight,
          loadedWeight: r.loadedWeight, deliveredWeight: r.deliveredWeight,
          lrDate: r.lrDate || undefined,
          ewayBillNumber: r.ewayBillNumber || undefined,
          remarks: r.remarks || undefined,
        })),
      }
      if (isOtherMaterial) payload.customMaterialName = data.customMaterialName
      else payload.materialTypeId = data.materialTypeId
      return ordersApi.createPol(payload)
    },
    onSuccess: (res) => {
      toast.success('POL order created successfully')
      qc.invalidateQueries({ queryKey: ['orders'] })
      navigate(`/orders/${res.data?.id}`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create POL order')
    },
  })

  function validateRows(): boolean {
    const errs: Record<number, Record<string, string>> = {}
    rows.forEach((r, i) => {
      const rowErr: Record<string, string> = {}
      if (!r.vehicleId) rowErr.vehicleId = 'Select vehicle'
      if (!r.driverId)  rowErr.driverId  = 'Select driver'
      if (!r.vehicleCapacity || r.vehicleCapacity <= 0) rowErr.vehicleCapacity = 'Required'
      if (!r.allocatedWeight || r.allocatedWeight <= 0) rowErr.allocatedWeight = 'Required'
      if (!r.loadedWeight    || r.loadedWeight    <= 0) rowErr.loadedWeight    = 'Required'
      if (!r.deliveredWeight || r.deliveredWeight <= 0) rowErr.deliveredWeight = 'Required'
      if (Object.keys(rowErr).length) errs[i] = rowErr
    })
    setRowErrors(errs)
    return Object.keys(errs).length === 0
  }

  function onSubmit(data: PolFormData): void {
    if (!validateRows()) { toast.error('Fix LR row errors before saving'); return }
    mutation.mutate(data)
  }

  function updateRow(i: number, field: keyof LrRow, value: unknown) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
    setRowErrors(prev => { const next = { ...prev }; if (next[i]) delete next[i][field as string]; return next })
  }

  const vehicles  = vehiclesRes?.data ?? []
  const materials = materialsRes?.data ?? []
  const states    = statesRes?.data ?? []

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        POL is for orders that already happened but weren't entered in FEROS. All LRs will be marked as <strong>Delivered</strong> immediately and ready for invoicing.
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Order Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <SearchableSelect
              value={watchedClientId ? String(watchedClientId) : ''}
              onValueChange={v => setValue('clientId', Number(v))}
              options={(clientsRes?.data?.content ?? []).filter(c => c.isActive).map(c => ({ value: String(c.id), label: c.clientName }))}
              placeholder="Select client"
            />
            {errors.clientId && <p className="text-red-500 text-xs">{errors.clientId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Order Date * <span className="text-gray-400 text-xs">(must be a past date)</span></Label>
            <Input type="date" max={today} {...register('orderDate')} />
            {errors.orderDate && <p className="text-red-500 text-xs">{errors.orderDate.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Material Type *</Label>
            <SearchableSelect
              value={watchedMaterialId != null ? String(watchedMaterialId) : ''}
              onValueChange={v => setValue('materialTypeId', Number(v))}
              options={[
                ...materials.map(m => ({ value: String(m.id), label: m.name })),
                { value: String(MATERIAL_OTHER), label: 'Other (specify manually)' },
              ]}
              placeholder="Select material"
            />
            {isOtherMaterial && (
              <Input {...register('customMaterialName')} placeholder="Type material name…" className="mt-1.5" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Total Weight (tons) *</Label>
            <Input type="number" step="0.01" min="0.01" placeholder="25.00" {...register('totalWeight')} />
            {errors.totalWeight && <p className="text-red-500 text-xs">{errors.totalWeight.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">From (Source)</p>
            <div className="space-y-2">
              <SearchableSelect
                value={watchedSrcState ? String(watchedSrcState) : ''}
                onValueChange={v => { setSrcState(Number(v)); setValue('sourceStateId', Number(v)); setValue('sourceCityId', 0) }}
                options={states.map(s => ({ value: String(s.id), label: s.name }))}
                placeholder="Select state"
              />
              {errors.sourceStateId && <p className="text-red-500 text-xs">{errors.sourceStateId.message}</p>}
              <SearchableSelect
                value={watch('sourceCityId') ? String(watch('sourceCityId')) : ''}
                onValueChange={v => setValue('sourceCityId', Number(v))}
                options={(srcCitiesRes?.data ?? []).map(c => ({ value: String(c.id), label: c.name }))}
                placeholder="Select city"
              />
              {errors.sourceCityId && <p className="text-red-500 text-xs">{errors.sourceCityId.message}</p>}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">To (Destination)</p>
            <div className="space-y-2">
              <SearchableSelect
                value={watchedDstState ? String(watchedDstState) : ''}
                onValueChange={v => { setDstState(Number(v)); setValue('destinationStateId', Number(v)); setValue('destinationCityId', 0) }}
                options={states.map(s => ({ value: String(s.id), label: s.name }))}
                placeholder="Select state"
              />
              {errors.destinationStateId && <p className="text-red-500 text-xs">{errors.destinationStateId.message}</p>}
              <SearchableSelect
                value={watch('destinationCityId') ? String(watch('destinationCityId')) : ''}
                onValueChange={v => setValue('destinationCityId', Number(v))}
                options={(dstCitiesRes?.data ?? []).map(c => ({ value: String(c.id), label: c.name }))}
                placeholder="Select city"
              />
              {errors.destinationCityId && <p className="text-red-500 text-xs">{errors.destinationCityId.message}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
          <div className="space-y-1.5">
            <Label>Freight Rate Type *</Label>
            <Select value={watchedFreightType} onValueChange={v => setValue('freightRateType', v as 'PER_TON' | 'PER_TRIP' | 'PER_KM')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_TON">Per Ton</SelectItem>
                <SelectItem value="PER_TRIP">Per Trip</SelectItem>
                <SelectItem value="PER_KM">Per KM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Freight Rate (₹) *</Label>
            <Input type="number" step="0.01" min="0.01" placeholder="2500.00" {...register('freightRate')} />
            {errors.freightRate && <p className="text-red-500 text-xs">{errors.freightRate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Billing On</Label>
            <Select value={watchedBillingOn ?? 'LOADED_WEIGHT'} onValueChange={v => setValue('billingOn', v as 'LOADED_WEIGHT' | 'DELIVERED_WEIGHT')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOADED_WEIGHT">Loaded Weight</SelectItem>
                <SelectItem value="DELIVERED_WEIGHT">Delivered Weight</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Remarks</Label>
          <Input placeholder="Optional remarks" {...register('remarks')} />
        </div>
      </div>

      {/* LR Rows */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">LR Details</h2>
          {!watchedOrderDate && (
            <p className="text-xs text-amber-600">Select order date first to filter drivers/cleaners by attendance</p>
          )}
        </div>

        {rows.map((row, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">LR #{i + 1}</p>
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vehicle *</Label>
                <SearchableSelect
                  value={row.vehicleId ? String(row.vehicleId) : ''}
                  onValueChange={v => {
                    const vehicle = vehicles.find(vh => vh.id === Number(v))
                    updateRow(i, 'vehicleId', Number(v))
                    if (vehicle?.capacityInTons) updateRow(i, 'vehicleCapacity', vehicle.capacityInTons)
                  }}
                  options={vehicles.map(v => ({ value: String(v.id), label: v.registrationNumber }))}
                  placeholder="Select vehicle"
                />
                {rowErrors[i]?.vehicleId && <p className="text-red-500 text-xs">{rowErrors[i].vehicleId}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Driver * {watchedOrderDate && <span className="text-gray-400">(present on {watchedOrderDate})</span>}</Label>
                <SearchableSelect
                  value={row.driverId ? String(row.driverId) : ''}
                  onValueChange={v => updateRow(i, 'driverId', Number(v))}
                  options={drivers.map(d => ({ value: String(d.userId), label: d.userName }))}
                  placeholder={watchedOrderDate ? (drivers.length === 0 ? 'No drivers present' : 'Select driver') : 'Select order date first'}
                />
                {rowErrors[i]?.driverId && <p className="text-red-500 text-xs">{rowErrors[i].driverId}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cleaner (optional)</Label>
                <SearchableSelect
                  value={row.cleanerId ? String(row.cleanerId) : ''}
                  onValueChange={v => updateRow(i, 'cleanerId', v ? Number(v) : undefined)}
                  options={[{ value: '', label: 'None' }, ...cleaners.map(c => ({ value: String(c.userId), label: c.userName }))]}
                  placeholder="Select cleaner"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Paper LR No.</Label>
                <Input value={row.paperLrNumber} onChange={e => updateRow(i, 'paperLrNumber', e.target.value)} placeholder="e.g. LR-4521" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vehicle Capacity (T) *</Label>
                <Input type="number" step="0.01" min="0.01" value={row.vehicleCapacity || ''}
                  onChange={e => updateRow(i, 'vehicleCapacity', Number(e.target.value))} placeholder="20.00" />
                {rowErrors[i]?.vehicleCapacity && <p className="text-red-500 text-xs">{rowErrors[i].vehicleCapacity}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Allocated Weight (T) *</Label>
                <Input type="number" step="0.01" min="0.01" value={row.allocatedWeight || ''}
                  onChange={e => updateRow(i, 'allocatedWeight', Number(e.target.value))} placeholder="18.00" />
                {rowErrors[i]?.allocatedWeight && <p className="text-red-500 text-xs">{rowErrors[i].allocatedWeight}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Loaded Weight (T) *</Label>
                <Input type="number" step="0.01" min="0.01" value={row.loadedWeight || ''}
                  onChange={e => updateRow(i, 'loadedWeight', Number(e.target.value))} placeholder="18.00" />
                {rowErrors[i]?.loadedWeight && <p className="text-red-500 text-xs">{rowErrors[i].loadedWeight}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Delivered Weight (T) *</Label>
                <Input type="number" step="0.01" min="0.01" value={row.deliveredWeight || ''}
                  onChange={e => updateRow(i, 'deliveredWeight', Number(e.target.value))} placeholder="17.50" />
                {rowErrors[i]?.deliveredWeight && <p className="text-red-500 text-xs">{rowErrors[i].deliveredWeight}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">LR Date <span className="text-gray-400">(defaults to order date)</span></Label>
                <Input type="date" max={today} value={row.lrDate} onChange={e => updateRow(i, 'lrDate', e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">E-way Bill No.</Label>
                <Input value={row.ewayBillNumber} onChange={e => updateRow(i, 'ewayBillNumber', e.target.value)} placeholder="Optional" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">LR Remarks</Label>
                <Input value={row.remarks} onChange={e => updateRow(i, 'remarks', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={() => setRows(prev => [...prev, emptyRow()])}
          className="gap-2 text-feros-navy border-feros-navy/30">
          <Plus className="h-4 w-4" /> Add LR
        </Button>
      </div>

      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => navigate('/orders')}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white px-8">
          {mutation.isPending ? 'Saving…' : 'Save POL Order'}
        </Button>
      </div>
    </form>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────
type OrderType = 'LIVE' | 'POL'

export default function NewOrderPage() {
  const navigate = useNavigate()
  const [type, setType] = useState<OrderType | ''>('')

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/orders')} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Orders
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">New Order</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="space-y-1.5 max-w-xs">
          <Label>Order Type *</Label>
          <Select value={type} onValueChange={v => setType(v as OrderType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select order type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LIVE">Live Order</SelectItem>
              <SelectItem value="POL">Post Order Log (POL)</SelectItem>
            </SelectContent>
          </Select>
          {type === 'LIVE' && <p className="text-xs text-gray-400">Real-time order entry — assigns vehicles and drivers for an upcoming trip</p>}
          {type === 'POL'  && <p className="text-xs text-gray-400">Retrospective entry — for trips that already happened offline</p>}
        </div>
      </div>

      {type === 'LIVE' && <LiveOrderForm />}
      {type === 'POL'  && <PolOrderForm />}
    </div>
  )
}
