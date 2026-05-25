import { useRef, useState, useEffect } from 'react'
import { useSubscription } from '@/context/SubscriptionContext'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehiclesApi } from '@/api/vehicles'
import { globalMastersApi, tenantMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import {
  Plus, Search, Truck, ChevronRight, Upload, Download, CheckCircle, XCircle, Calendar,
  Paperclip, FileText, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Vehicle, BulkUploadResult, VehicleStatusType, DocumentTypeItem } from '@/types'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── bulk upload dialog ────────────────────────────────────────────────────────
const CSV_TEMPLATE = [
  'registrationNumber,vehicleType,brand,fuelType,ownershipType,capacityInTons,manufactureYear,color,model,grossVehicleWeight,chassisNumber,engineNumber,currentOdometerReading,fuelTankCapacity,currentFuelLevel,tyreRotationIntervalKm,gpsDeviceNumber,gpsDeviceImei,gpsProvider,isFinanced,financerName,financeStartDate,financeEndDate,ownerName,ownerPhone,ownerAddress,ownerPan,agreementStartDate,agreementEndDate,agreementAmount,notes,doc1Type,doc1Number,doc1IssueDate,doc1ExpiryDate,doc2Type,doc2Number,doc2IssueDate,doc2ExpiryDate',
  'MH12AB1234,Truck,TATA,DIESEL,Own,10,2020,White,407,16.2,CH123456,ENG123456,5000,80,40,50000,,,,false,,,,,,,,,,,,RC,MH12AB1234,2020-01-15,2040-01-14,Insurance,POL123456,2024-06-01,2025-05-31',
  'MH14CD5678,Trailer,Ashok Leyland,DIESEL,Hired,25,2019,Blue,Prima 4940,49,,,,,,,,,,false,,,,,Raju Transport,9876543210,Vizianagaram,ABCDE1234F,2024-01-01,2025-12-31,15000,,Fitness,FIT987654,2023-04-01,2025-03-31,,,,',
].join('\n')

function VehicleBulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<BulkUploadResult | null>(null)

  function handleClose() {
    setFile(null)
    setResult(null)
    onClose()
  }

  const mutation = useMutation({
    mutationFn: (f: File) => vehiclesApi.bulkUpload(f),
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      if (res.data.failureCount === 0)
        toast.success(`${res.data.successCount} vehicles uploaded successfully`)
      else
        toast.warning(`${res.data.successCount} uploaded, ${res.data.failureCount} failed`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Upload failed')
    },
  })

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vehicles_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Vehicles</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-medium">CSV Format</p>
            <p>Required: <code className="bg-blue-100 px-1 rounded">registrationNumber</code></p>
            <p><span className="font-medium">Vehicle info:</span> vehicleType, brand, fuelType, ownershipType, capacityInTons, manufactureYear, color, model, grossVehicleWeight, chassisNumber, engineNumber</p>
            <p><span className="font-medium">Operational:</span> currentOdometerReading, fuelTankCapacity, currentFuelLevel, tyreRotationIntervalKm</p>
            <p><span className="font-medium">GPS:</span> gpsDeviceNumber, gpsDeviceImei, gpsProvider</p>
            <p><span className="font-medium">Finance:</span> isFinanced (true/false), financerName, financeStartDate, financeEndDate</p>
            <p><span className="font-medium">Owner (hired):</span> ownerName, ownerPhone, ownerAddress, ownerPan, agreementStartDate, agreementEndDate, agreementAmount</p>
            <p><span className="font-medium">Notes:</span> notes</p>
            <p><span className="font-medium">Documents</span> (repeating groups of 4 from col 32): docType, docNumber, issueDate, expiryDate</p>
            <p className="text-blue-600 text-xs mt-2">Dates must be YYYY-MM-DD. Vehicle status defaults to Available. Document type names must match Global Masters exactly. Add more doc groups by appending 4 more columns.</p>
          </div>

          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 w-full">
            <Download size={14} /> Download Template
          </Button>

          {/* File input */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <Upload size={20} className={cn('mx-auto mb-2', file ? 'text-green-500' : 'text-gray-400')} />
              {file
                ? <p className="text-sm font-medium text-green-700">{file.name}</p>
                : <p className="text-sm text-gray-500">Click to select a CSV file</p>
              }
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle size={14} /> {result.successCount} succeeded
                </span>
                {result.failureCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-700">
                    <XCircle size={14} /> {result.failureCount} failed
                  </span>
                )}
                <span className="text-gray-500 ml-auto">Total: {result.totalRows}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button
                disabled={!file || mutation.isPending}
                onClick={() => file && mutation.mutate(file)}
                className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2"
              >
                <Upload size={14} />
                {mutation.isPending ? 'Uploading…' : 'Upload'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  registrationNumber:       z.string().min(1, 'Registration number is required').max(10, 'Max 10 characters allowed'),
  brandId:                  z.coerce.number().optional(),
  vehicleTypeId:            z.coerce.number().optional(),
  fuelTypeId:               z.coerce.number().optional(),
  ownershipTypeId:          z.coerce.number().optional(),
  currentStatusId:          z.coerce.number().optional(),
  model:                    z.string().optional(),
  capacityInTons:           z.coerce.number().min(0, 'Capacity cannot be negative').optional(),
  grossVehicleWeight:       z.coerce.number().min(0, 'GVW cannot be negative').optional(),
  manufactureYear:          z.coerce.number().optional(),
  color:                    z.string().optional(),
  chassisNumber:            z.string().optional(),
  engineNumber:             z.string().optional(),
  // Owner / hired info
  ownerName:                z.string().optional(),
  ownerPhone:               z.string().regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit phone number').optional().or(z.literal('')),
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
  fuelTankCapacity:         z.coerce.number().optional(),
  tyreRotationIntervalKm:   z.coerce.number().optional(),
  currentFuelLevel:         z.coerce.number().optional(),
  // Finance
  isFinanced:               z.boolean().optional(),
  financerName:             z.string().optional(),
  financeStartDate:         z.string().optional(),
  financeEndDate:           z.string().optional(),
  notes:                    z.string().optional(),
}).refine(
  data => {
    const cap  = data.fuelTankCapacity
    const fuel = data.currentFuelLevel
    if (cap != null && fuel != null) return fuel <= cap
    return true
  },
  { message: 'Current fuel cannot exceed tank capacity', path: ['currentFuelLevel'] }
)
type FormData = z.infer<typeof schema>

// ── step 2: document checklist ────────────────────────────────────────────────
type DocEntry = { documentNumber: string; issueDate: string; expiryDate: string; issuerName: string; file: File | null }
const emptyEntry = (): DocEntry => ({ documentNumber: '', issueDate: '', expiryDate: '', issuerName: '', file: null })

function VehicleDocStep({ vehicleId, onFinish, onBack }: { vehicleId: number; onFinish: () => void; onBack: () => void }) {
  const { data: docTypesRes, isLoading } = useQuery({
    queryKey: ['document-types'],
    queryFn: globalMastersApi.getDocumentTypes,
  })
  const vehicleDocTypes: DocumentTypeItem[] = (docTypesRes?.data ?? []).filter(
    dt => dt.applicableFor === 'VEHICLE' || dt.applicableFor === 'BOTH'
  )

  const [entries, setEntries] = useState<Record<number, DocEntry>>({})
  const [isSaving, setIsSaving] = useState(false)
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})

  function update(typeId: number, patch: Partial<DocEntry>) {
    setEntries(prev => ({ ...prev, [typeId]: { ...emptyEntry(), ...prev[typeId], ...patch } }))
  }

  function isFilled(typeId: number) {
    const e = entries[typeId]
    return !!(e?.documentNumber || e?.expiryDate || e?.issueDate || e?.file)
  }

  async function handleSave() {
    const filled = vehicleDocTypes.filter(dt => isFilled(dt.id))
    if (filled.length === 0) { onFinish(); return }
    setIsSaving(true)
    let savedCount = 0
    try {
      for (const dt of filled) {
        const entry = entries[dt.id]
        let fileUrl: string | undefined
        if (entry.file) {
          const up = await vehiclesApi.uploadDocFile(vehicleId, entry.file)
          fileUrl = up.data?.publicUrl
        }
        await vehiclesApi.addDocument(vehicleId, {
          documentTypeId: dt.id,
          documentNumber: entry.documentNumber || undefined,
          issueDate: entry.issueDate || undefined,
          expiryDate: entry.expiryDate || undefined,
          issuerName: entry.issuerName || undefined,
          fileUrl,
        })
        savedCount++
      }
      toast.success(`Vehicle added with ${savedCount} document${savedCount !== 1 ? 's' : ''}`)
    } catch {
      if (savedCount > 0) toast.warning(`${savedCount} document${savedCount !== 1 ? 's' : ''} saved, some failed`)
      else toast.error('Failed to save documents — vehicle was still created')
    } finally {
      setIsSaving(false)
      onFinish()
    }
  }

  if (isLoading) return <div className="py-8 text-center text-sm text-gray-400">Loading document types…</div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Fill in what you have on hand. Leave the rest blank — you can always add documents later from the vehicle details page.
      </p>

      <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
        {vehicleDocTypes.map(dt => {
          const e = entries[dt.id]
          const filled = isFilled(dt.id)
          return (
            <div key={dt.id} className={cn(
              'border rounded-lg p-3 transition-colors',
              filled ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-gray-50/50'
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{dt.name}</span>
                {filled && <span className="text-[11px] font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Will save</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Doc number"
                  value={e?.documentNumber ?? ''}
                  onChange={ev => update(dt.id, { documentNumber: ev.target.value })}
                  className="text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
                <input
                  type="date"
                  title="Issue Date"
                  value={e?.issueDate ?? ''}
                  onChange={ev => update(dt.id, { issueDate: ev.target.value })}
                  className="text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
                <input
                  type="date"
                  title="Expiry Date"
                  value={e?.expiryDate ?? ''}
                  onChange={ev => update(dt.id, { expiryDate: ev.target.value })}
                  className="text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  ref={el => { fileRefs.current[dt.id] = el }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={ev => update(dt.id, { file: ev.target.files?.[0] ?? null })}
                />
                <button
                  type="button"
                  onClick={() => fileRefs.current[dt.id]?.click()}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Paperclip size={11} />
                  {e?.file ? <span className="text-blue-600 font-medium truncate max-w-[160px]">{e.file.name}</span> : 'Attach file'}
                </button>
                {e?.file && (
                  <button type="button" onClick={() => update(dt.id, { file: null })} className="text-gray-300 hover:text-red-400">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" onClick={onBack} className="gap-1.5">
            ← Back
          </Button>
          <button
            type="button"
            onClick={onFinish}
            className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            Skip, add later
          </button>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-feros-navy hover:bg-feros-navy/90 text-white"
        >
          <FileText size={14} className="mr-1.5" />
          {isSaving ? 'Saving…' : 'Save & Finish'}
        </Button>
      </div>
    </div>
  )
}

// ── step indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 py-3 border-b mb-1">
      <div className={cn('flex items-center gap-1.5 text-sm font-medium transition-colors', step === 1 ? 'text-feros-navy' : 'text-gray-400')}>
        <span className={cn('w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold transition-colors',
          step === 1 ? 'bg-feros-navy text-white' : 'bg-green-500 text-white'
        )}>
          {step === 1 ? '1' : '✓'}
        </span>
        Vehicle Info
      </div>
      <div className={cn('flex-1 h-px transition-colors', step === 2 ? 'bg-feros-navy' : 'bg-gray-200')} />
      <div className={cn('flex items-center gap-1.5 text-sm font-medium transition-colors', step === 2 ? 'text-feros-navy' : 'text-gray-400')}>
        <span className={cn('w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold transition-colors',
          step === 2 ? 'bg-feros-navy text-white' : 'bg-gray-200 text-gray-500'
        )}>2</span>
        Documents
        <span className="text-xs font-normal text-gray-400">(optional)</span>
      </div>
    </div>
  )
}

// ── vehicle form dialog ───────────────────────────────────────────────────────
export function VehicleForm({
  open, onClose, vehicle, onSuccess: onSuccessExtra,
}: {
  open: boolean; onClose: () => void; vehicle?: Vehicle; onSuccess?: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!vehicle
  const [step, setStep] = useState<1 | 2>(1)
  const [createdVehicleId, setCreatedVehicleId] = useState<number | null>(null)
  const [ownershipTypeId, setOwnershipTypeId] = useState<number | undefined>(vehicle?.ownershipTypeId)

  const { data: brandsRes }        = useQuery({ queryKey: ['vehicle-brands'],    queryFn: globalMastersApi.getVehicleBrands })
  const { data: typesRes }         = useQuery({ queryKey: ['vehicle-types'],     queryFn: globalMastersApi.getVehicleTypes })
  const { data: fuelRes }          = useQuery({ queryKey: ['fuel-types'],        queryFn: globalMastersApi.getFuelTypes })
  const { data: ownershipRes }     = useQuery({ queryKey: ['ownership-types'],   queryFn: globalMastersApi.getOwnershipTypes })
  const { data: statusRes }        = useQuery({ queryKey: ['vehicle-statuses'],  queryFn: tenantMastersApi.getVehicleStatuses })

  const selectedOwnershipName = ownershipRes?.data?.find(o => o.id === ownershipTypeId)?.name ?? ''
  const showOwnerSection = !!ownershipTypeId && !selectedOwnershipName.toUpperCase().includes('OWN')

  const { register, handleSubmit, control, formState: { errors }, reset, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: vehicle ? {
      registrationNumber: vehicle.registrationNumber,
      brandId: vehicle.brandId, vehicleTypeId: vehicle.vehicleTypeId,
      fuelTypeId: vehicle.fuelTypeId, ownershipTypeId: vehicle.ownershipTypeId,
      currentStatusId: vehicle.currentStatusId, capacityInTons: vehicle.capacityInTons,
      grossVehicleWeight: vehicle.grossVehicleWeight, model: vehicle.model ?? '',
      manufactureYear: vehicle.manufactureYear, color: vehicle.color ?? '',
      chassisNumber: vehicle.chassisNumber ?? '', engineNumber: vehicle.engineNumber ?? '',
      ownerName: vehicle.ownerName ?? '', ownerPhone: vehicle.ownerPhone ?? '',
      ownerPan: vehicle.ownerPan ?? '', ownerAddress: vehicle.ownerAddress ?? '',
      agreementStartDate: vehicle.agreementStartDate ?? '',
      agreementEndDate: vehicle.agreementEndDate ?? '',
      agreementAmount: vehicle.agreementAmount,
      gpsDeviceNumber: vehicle.gpsDeviceNumber ?? '',
      gpsDeviceImei: vehicle.gpsDeviceImei ?? '', gpsProvider: vehicle.gpsProvider ?? '',
      currentOdometerReading: vehicle.currentOdometerReading,
      fuelTankCapacity: vehicle.fuelTankCapacity,
      currentFuelLevel: vehicle.currentFuelLevel,
      tyreRotationIntervalKm: vehicle.tyreRotationIntervalKm,
      isFinanced: vehicle.isFinanced ?? false,
      financerName: vehicle.financerName ?? '',
      financeStartDate: vehicle.financeStartDate ?? '',
      financeEndDate: vehicle.financeEndDate ?? '',
      notes: vehicle.notes ?? '',
    } : {},
  })

  useEffect(() => {
    if (open && vehicle) {
      reset({
        registrationNumber: vehicle.registrationNumber,
        brandId: vehicle.brandId, vehicleTypeId: vehicle.vehicleTypeId,
        fuelTypeId: vehicle.fuelTypeId, ownershipTypeId: vehicle.ownershipTypeId,
        currentStatusId: vehicle.currentStatusId, capacityInTons: vehicle.capacityInTons,
        grossVehicleWeight: vehicle.grossVehicleWeight, model: vehicle.model ?? '',
        manufactureYear: vehicle.manufactureYear, color: vehicle.color ?? '',
        chassisNumber: vehicle.chassisNumber ?? '', engineNumber: vehicle.engineNumber ?? '',
        ownerName: vehicle.ownerName ?? '', ownerPhone: vehicle.ownerPhone ?? '',
        ownerPan: vehicle.ownerPan ?? '', ownerAddress: vehicle.ownerAddress ?? '',
        agreementStartDate: vehicle.agreementStartDate ?? '',
        agreementEndDate: vehicle.agreementEndDate ?? '',
        agreementAmount: vehicle.agreementAmount,
        gpsDeviceNumber: vehicle.gpsDeviceNumber ?? '',
        gpsDeviceImei: vehicle.gpsDeviceImei ?? '', gpsProvider: vehicle.gpsProvider ?? '',
        currentOdometerReading: vehicle.currentOdometerReading,
        fuelTankCapacity: vehicle.fuelTankCapacity,
        currentFuelLevel: vehicle.currentFuelLevel,
        tyreRotationIntervalKm: vehicle.tyreRotationIntervalKm,
        isFinanced: vehicle.isFinanced ?? false,
        financerName: vehicle.financerName ?? '',
        financeStartDate: vehicle.financeStartDate ?? '',
        financeEndDate: vehicle.financeEndDate ?? '',
        notes: vehicle.notes ?? '',
      })
      setOwnershipTypeId(vehicle.ownershipTypeId)
    }
    if (!open) { reset({}); setStep(1); setCreatedVehicleId(null) }
  }, [open])

  const watchedTypeId    = watch('vehicleTypeId')
  const watchedFinanced  = watch('isFinanced')
  useEffect(() => {
    if (!watchedTypeId) return
    const vehicleType = (typesRes?.data ?? []).find(t => t.id === watchedTypeId)
    if (vehicleType?.capacityInTons) setValue('capacityInTons', Number(vehicleType.capacityInTons))
  }, [watchedTypeId])

  function handleClose() {
    // If vehicle was already created (step 2 or skip), refresh the list
    if (createdVehicleId) {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      onSuccessExtra?.()
    }
    reset(); setStep(1); setCreatedVehicleId(null); onClose()
  }

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (isEdit) return vehiclesApi.update(vehicle!.id, data)
      if (createdVehicleId) return vehiclesApi.update(createdVehicleId, data)
      return vehiclesApi.create(data)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      if (isEdit) {
        toast.success('Vehicle updated successfully')
        onSuccessExtra?.()
        reset(); onClose()
      } else {
        // Advance to step 2 (or return to it after back-navigation)
        if (!createdVehicleId) setCreatedVehicleId(res.data.id)
        setStep(2)
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      const isTechnical = msg && (msg.startsWith('JSON parse error') || msg.includes('Cannot coerce') || msg.includes('Unrecognized field'))
      toast.error(isTechnical ? 'Invalid data submitted. Please check all fields and try again.' : (msg ?? 'Something went wrong'))
    },
  })

  const dialogTitle = isEdit ? 'Edit Vehicle' : step === 1 ? 'Add Vehicle' : 'Add Documents'

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {/* Progress indicator — only for new vehicle creation */}
        {!isEdit && <StepIndicator step={step} />}

        {/* ── Step 2: Documents ── */}
        {step === 2 && createdVehicleId && (
          <VehicleDocStep vehicleId={createdVehicleId} onFinish={handleClose} onBack={() => setStep(1)} />
        )}

        {/* ── Step 1: Vehicle Info ── */}
        {step === 1 && (
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 pt-2">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Registration Number <span className="text-red-500">*</span></Label>
              <Input placeholder="MH12AB1234" className={`uppercase ${errors.registrationNumber ? 'border-red-400' : ''}`} {...register('registrationNumber')} />
              {errors.registrationNumber && <p className="text-red-500 text-xs mt-1">{errors.registrationNumber.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Controller
                name="brandId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ? String(field.value) : ''}
                    onValueChange={v => field.onChange(v ? Number(v) : undefined)}
                    options={(brandsRes?.data ?? []).map(b => ({ value: String(b.id), label: b.name }))}
                    placeholder="Select brand"
                    className="mt-1"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input placeholder="e.g. 407, Prima 4940, BS4" {...register('model')} />
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle Type</Label>
              <Controller
                name="vehicleTypeId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ? String(field.value) : ''}
                    onValueChange={v => field.onChange(v ? Number(v) : undefined)}
                    options={(typesRes?.data ?? []).map(t => ({ value: String(t.id), label: t.tyreCount ? `${t.name} – ${t.capacityInTons}T` : t.name }))}
                    placeholder="Select type"
                    className="mt-1"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fuel Type</Label>
              <Controller
                name="fuelTypeId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ? String(field.value) : ''}
                    onValueChange={v => field.onChange(v ? Number(v) : undefined)}
                    options={(fuelRes?.data ?? []).map(f => ({ value: String(f.id), label: f.name }))}
                    placeholder="Select fuel type"
                    className="mt-1"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ownership Type</Label>
              <Controller
                name="ownershipTypeId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ? String(field.value) : ''}
                    onValueChange={v => {
                      field.onChange(v ? Number(v) : undefined)
                      setOwnershipTypeId(Number(v) || undefined)
                    }}
                    options={(ownershipRes?.data ?? []).map(o => ({ value: String(o.id), label: o.name }))}
                    placeholder="Select ownership"
                    className="mt-1"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Current Status</Label>
              <Controller
                name="currentStatusId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ? String(field.value) : ''}
                    onValueChange={v => field.onChange(v ? Number(v) : undefined)}
                    options={(statusRes?.data ?? []).map(s => ({ value: String(s.id), label: s.name }))}
                    placeholder="Select status"
                    className="mt-1"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity (tons)</Label>
              <Input type="number" step="0.1" min="0" placeholder="10" {...register('capacityInTons')} />
              {errors.capacityInTons && <p className="text-red-500 text-xs">{errors.capacityInTons.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>GVW — Gross Vehicle Weight (tons)</Label>
              <Input type="number" step="0.01" min="0" placeholder="49.00" {...register('grossVehicleWeight')} />
              {errors.grossVehicleWeight && <p className="text-red-500 text-xs">{errors.grossVehicleWeight.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Current Odometer (km)</Label>
              <Input type="number" placeholder="45000" {...register('currentOdometerReading')} />
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
                  <Input placeholder="9876543210" maxLength={10} {...register('ownerPhone')} />
                  {errors.ownerPhone && <p className="text-red-500 text-xs">{errors.ownerPhone.message}</p>}
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

          {/* Finance */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">Finance</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-500">Vehicle is financed</span>
                <input type="checkbox" className="w-4 h-4 accent-feros-navy" {...register('isFinanced')} />
              </label>
            </div>
            {watchedFinanced && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Financer Name (Bank / NBFC)</Label>
                  <Input placeholder="e.g. HDFC Bank, Shriram Finance" {...register('financerName')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Finance From</Label>
                  <Input type="date" {...register('financeStartDate')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Finance To</Label>
                  <Input type="date" {...register('financeEndDate')} />
                </div>
              </div>
            )}
          </div>

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
                <Label>Tank Capacity (litres)</Label>
                <Input type="number" placeholder="300" {...register('fuelTankCapacity')} />
              </div>
              <div className="space-y-1.5">
                <Label>Current Fuel Level (litres)</Label>
                <Input type="number" placeholder="120" {...register('currentFuelLevel')} className={errors.currentFuelLevel ? 'border-red-400' : ''} />
                {errors.currentFuelLevel && <p className="text-red-500 text-xs mt-1">{errors.currentFuelLevel.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Tyre Rotation Interval (km)</Label>
                <Input type="number" placeholder="20000" {...register('tyreRotationIntervalKm')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input placeholder="Any special notes about this vehicle" {...register('notes')} />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending
                ? 'Saving…'
                : isEdit
                  ? 'Update Vehicle'
                  : createdVehicleId
                    ? 'Save & Continue →'
                    : 'Next: Add Documents →'}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

const vehicleStatusBadge: Record<VehicleStatusType, string> = {
  AVAILABLE:  'bg-green-100 text-green-700',
  ASSIGNED:   'bg-blue-100 text-blue-700',
  ON_TRIP:    'bg-orange-100 text-orange-700',
  IN_REPAIR:  'bg-yellow-100 text-yellow-700',
  BREAKDOWN:  'bg-red-100 text-red-700',
  OTHER:      'bg-gray-100 text-gray-600',
}

// ── main page ─────────────────────────────────────────────────────────────────
export function VehiclesPage() {
  const { locked } = useSubscription()
  const navigate = useNavigate()
  const [search, setSearch]           = useState('')
  const [formOpen, setFormOpen]       = useState(false)
  const [bulkOpen, setBulkOpen]       = useState(false)
  const [typeFilter, setTypeFilter]   = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignFilter, setAssignFilter] = useState('')
  const [dateFilter, setDateFilter]   = useState(() => new Date().toISOString().slice(0, 10))

  const { data: res, isLoading }  = useQuery({
    queryKey: ['vehicles', dateFilter],
    queryFn: () => vehiclesApi.getAll(dateFilter),
  })
  const { data: typesRes }        = useQuery({ queryKey: ['vehicle-types'],    queryFn: globalMastersApi.getVehicleTypes })
  const { data: ownershipRes }    = useQuery({ queryKey: ['ownership-types'],  queryFn: globalMastersApi.getOwnershipTypes })

  const allVehicles = [...(res?.data ?? [])].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber))

  const vehicles = allVehicles.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = v.registrationNumber.toLowerCase().includes(q) ||
                        (v.brandName ?? '').toLowerCase().includes(q) ||
                        (v.vehicleTypeName ?? '').toLowerCase().includes(q)
    const matchType   = !typeFilter  || String(v.vehicleTypeId) === typeFilter
    const matchOwner  = !ownerFilter || String(v.ownershipTypeId) === ownerFilter
    const matchStatus = !statusFilter || (statusFilter === 'active' ? v.isActive : !v.isActive)
    const matchAssign = !assignFilter || (assignFilter === 'assigned' ? v.isAssigned : !v.isAssigned)
    return matchSearch && matchType && matchOwner && matchStatus && matchAssign
  })

  function openCreate() { setFormOpen(true) }
  function onClose()    { setFormOpen(false) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {allVehicles.length} total
            {(() => { const assigned = allVehicles.filter(v => v.isAssigned).length; return assigned > 0 ? (
              <span className="ml-2 text-blue-600 font-medium">· {assigned} on trip</span>
            ) : null })()}
          </p>
        </div>
        {!locked && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
              <Upload size={16} /> Bulk Upload
            </Button>
            <Button onClick={openCreate} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
              <Plus size={16} /> Add Vehicle
            </Button>
          </div>
        )}
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
        <div className="relative">
          <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="pl-9 w-44"
          />
        </div>
        <SearchableSelect
          value={typeFilter}
          onValueChange={setTypeFilter}
          options={[
            { value: '', label: 'All Types' },
            ...(typesRes?.data ?? []).map(t => ({ value: String(t.id), label: t.name })),
          ]}
          className="h-10 w-36"
        />
        <SearchableSelect
          value={ownerFilter}
          onValueChange={setOwnerFilter}
          options={[
            { value: '', label: 'All Ownership' },
            ...(ownershipRes?.data ?? []).map(o => ({ value: String(o.id), label: o.name })),
          ]}
          className="h-10 w-40"
        />
        <SearchableSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          className="h-10 w-36"
        />
        <SearchableSelect
          value={assignFilter}
          onValueChange={setAssignFilter}
          options={[
            { value: '', label: 'All Trips' },
            { value: 'assigned', label: 'On Trip' },
            { value: 'available', label: 'Available' },
          ]}
          className="h-10 w-36"
        />
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
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Active</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => {
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
                            v.currentStatusType === 'BREAKDOWN' ? 'bg-red-100' :
                            v.currentStatusType === 'IN_REPAIR'  ? 'bg-yellow-100' :
                            'bg-feros-navy/10'
                          )}>
                            <Truck size={14} className={
                              v.currentStatusType === 'BREAKDOWN' ? 'text-red-600' :
                              v.currentStatusType === 'IN_REPAIR'  ? 'text-yellow-600' :
                              'text-feros-navy'
                            } />
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
                        {v.isAssigned ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium w-fit ${vehicleStatusBadge['ASSIGNED']}`}>
                              Assigned
                            </span>
                            {v.assignedOrderNumber && (
                              <span className="text-xs text-gray-400 font-mono pl-1">{v.assignedOrderNumber}</span>
                            )}
                          </div>
                        ) : v.currentStatusName ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium w-fit ${v.currentStatusType ? vehicleStatusBadge[v.currentStatusType] : 'bg-blue-50 text-blue-700'}`}>
                              {v.currentStatusName}
                            </span>
                            {v.currentStatusType === 'BREAKDOWN' && (
                              <span className="text-xs text-red-500 flex items-center gap-1 pl-1">
                                ⚠ Breakdown
                              </span>
                            )}
                            {v.currentStatusType === 'IN_REPAIR' && (
                              <span className="text-xs text-yellow-600 flex items-center gap-1 pl-1">
                                🔧 In Repair
                              </span>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-sm">—</span>}
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
                        <ChevronRight size={16} className="text-gray-300" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VehicleForm open={formOpen} onClose={onClose} />
      <VehicleBulkUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  )
}
