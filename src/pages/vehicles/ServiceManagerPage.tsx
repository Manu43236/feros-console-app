import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Truck, Construction, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { serviceManagerApi } from '@/api/serviceManager'
import { servicePartsApi, sparePartsApi } from '@/api/inventory'
import { vehicleServicesApi, vehiclesApi, vehicleBreakdownApi } from '@/api/vehicles'
import { globalMastersApi } from '@/api/masters'
import { compressImage } from '@/lib/imageCompress'
import { CreateServiceDialog } from '@/components/shared/CreateServiceDialog'
import { ServiceBoard } from '@/components/service/ServiceBoard'
import type { BoardBreakdown, BoardService, ServiceBoardConfig } from '@/components/service/ServiceBoard'
import type { SmServiceItem } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { EquipmentServiceManagerPage } from '@/pages/equipment/EquipmentServiceManagerPage'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

// ── Report Breakdown Dialog ─────────────────────────────────────────────────────
const BREAKDOWN_TYPES = ['MECHANICAL', 'TYRE', 'ENGINE', 'ELECTRICAL', 'ACCIDENT', 'OTHER'] as const

function ReportBreakdownDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [vehicleId, setVehicleId] = useState<number | null>(null)
  const [type, setType] = useState('MECHANICAL')
  const [duration, setDuration] = useState<'SHORT' | 'LONG'>('SHORT')
  const [reason, setReason] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll(), enabled: open })
  const vehicles = (vehiclesRes?.data ?? []).filter(v => v.isActive)

  const mutation = useMutation({
    mutationFn: () => vehicleBreakdownApi.report(vehicleId!, {
      breakdownType: type,
      breakdownDuration: duration,
      breakdownDate: new Date().toISOString(),
      reason: reason.trim(),
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Breakdown reported')
      onSuccess()
      onClose()
      setVehicleId(null); setType('MECHANICAL'); setDuration('SHORT')
      setReason(''); setLocation(''); setNotes('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to report breakdown'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Report Breakdown</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Vehicle *</Label>
            <SearchableSelect
              options={vehicles.map(v => ({ value: String(v.id), label: v.registrationNumber }))}
              value={vehicleId ? String(vehicleId) : ''}
              onValueChange={v => setVehicleId(Number(v))}
              placeholder="Search vehicle…"
            />
          </div>
          <div>
            <Label className="mb-2 block">Breakdown Type</Label>
            <div className="flex flex-wrap gap-2">
              {BREAKDOWN_TYPES.map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    type === t ? 'bg-feros-navy text-white border-feros-navy' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300')}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Severity</Label>
            <div className="flex gap-2">
              {([['SHORT', 'Minor'], ['LONG', 'Major']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setDuration(val)}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                    duration === val ? 'bg-feros-navy text-white border-feros-navy' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Reason *</Label>
            <Textarea placeholder="Describe the breakdown…" value={reason} onChange={e => setReason(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Location (optional)</Label>
              <Input placeholder="e.g. NH-16, Km 42" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Notes (optional)</Label>
              <Input placeholder="Any extra details" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!vehicleId || !reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="bg-red-600 hover:bg-red-700 text-white">
            {mutation.isPending ? 'Reporting…' : 'Report Breakdown'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function svcToBoard(s: SmServiceItem): BoardService {
  return {
    id: s.serviceId,
    serviceNumber: s.serviceNumber,
    assetName: s.vehicleRegistrationNumber,
    status: s.serviceStatus,
    serviceType: s.serviceType,
    serviceTypeLabel: s.serviceType ? s.serviceType.replace(/_/g, ' ').toLowerCase() : undefined,
    serviceDate: s.serviceDate,
    triggeredBy: s.triggeredBy,
    vendorName: s.vendorName,
    location: s.location,
    notes: s.notes,
    estimatedCost: s.estimatedCost,
    completedCost: s.completedCost,
    totalCost: s.totalCost,
    estimateDocUrl: s.estimateDocUrl,
    billDocUrl: s.billDocUrl,
    vendorItems: s.vendorItems,
    tasks: s.tasks.map(t => ({
      id: t.taskId,
      displayName: t.displayName,
      status: t.status,
      cost: t.cost,
      assignedMechanicId: t.assignedMechanicId,
      assignedMechanicName: t.assignedMechanicName,
      mechanicStartedAt: t.mechanicStartedAt,
      mechanicClosedAt: t.mechanicClosedAt,
      parts: (t.parts ?? []).map(p => ({
        id: p.partId, partName: p.partName, partNumber: p.partNumber,
        quantityRequested: p.quantityRequested, quantityApproved: p.quantityApproved, status: p.status,
      })),
    })),
  }
}

// ── Vehicle Service Manager (adapter into the shared ServiceBoard) ──────────────
function VehicleServiceManagerView() {
  const qc = useQueryClient()
  const [logService, setLogService] = useState<{ vehicleId: number; vehicleReg: string; breakdownId?: number } | null>(null)
  const [pickingVehicle, setPickingVehicle] = useState(false)
  const [pickedVehicleId, setPickedVehicleId] = useState<number | null>(null)
  const [reportingBreakdown, setReportingBreakdown] = useState(false)

  const { data: dashRes } = useQuery({ queryKey: ['sm-dashboard'], queryFn: serviceManagerApi.getDashboard, refetchInterval: 60_000 })
  const { data: techRes } = useQuery({ queryKey: ['sm-technicians'], queryFn: serviceManagerApi.getTechnicians })
  const { data: partsRes } = useQuery({ queryKey: ['spare-parts'], queryFn: sparePartsApi.getAll })
  const { data: typesRes } = useQuery({ queryKey: ['service-task-types'], queryFn: globalMastersApi.getServiceTaskTypes })
  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll(), enabled: pickingVehicle })

  const dashboard = dashRes?.data
  const technicians = techRes?.data ?? []
  const vehicles = (vehiclesRes?.data ?? []).filter(v => v.isActive)

  const boardBreakdowns: BoardBreakdown[] = (dashboard?.breakdowns ?? []).map(b => ({
    id: b.breakdownId,
    assetId: b.vehicleId,
    assetName: b.vehicleRegistrationNumber,
    date: b.breakdownDate,
    location: b.location,
    typeLabel: b.breakdownType,
    reason: b.reason,
    notes: b.notes,
    status: b.status,
    service: b.service ? svcToBoard(b.service) : undefined,
  }))
  const boardServices: BoardService[] = (dashboard?.generalServices ?? []).map(svcToBoard)

  function openVehiclePicker() {
    setPickedVehicleId(null)
    setPickingVehicle(true)
  }

  function confirmVehicle() {
    const v = vehicles.find(x => x.id === pickedVehicleId)
    if (!v) return
    setPickingVehicle(false)
    setLogService({ vehicleId: v.id, vehicleReg: v.registrationNumber })
  }

  const cfg: ServiceBoardConfig = {
    title: 'Service Manager',
    subtitle: 'Examine breakdowns, log services, and assign technicians',
    meterLabel: 'Odometer',
    technicians,
    spareParts: partsRes?.data ?? [],
    taskTypes: typesRes?.data ?? [],
    onAssign: (serviceId, taskId, mechanicId) => serviceManagerApi.assignTechnician(serviceId, taskId, mechanicId),
    onAddTask: (serviceId, body) => serviceManagerApi.addTask(serviceId, body),
    onRequestPart: (serviceId, taskId, body) => servicePartsApi.request(serviceId, { ...body, taskId }),
    onComplete: (serviceId, body) => vehicleServicesApi.complete(serviceId, { completedDate: body.completedDate, odometer: body.odometer, completedCost: body.completedCost }),
    onUploadBillDoc: async (serviceId, file) => {
      const res = await vehicleServicesApi.uploadBillDoc(serviceId, await compressImage(file))
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] })
      return res.data?.billDocUrl
    },
    onLogService: (b) => setLogService({ vehicleId: b.assetId, vehicleReg: b.assetName, breakdownId: b.id }),
    onCreateGeneralService: openVehiclePicker,
    onUploadDoc: async (serviceId, type, file) => {
      const compressed = await compressImage(file)
      const fn = type === 'estimate' ? vehicleServicesApi.uploadEstimateDoc : vehicleServicesApi.uploadBillDoc
      await fn(serviceId, compressed)
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] })
    },
    onOpenPdf: (id) => window.open(`/vehicle-services/${id}/pdf`, '_blank'),
    onAddVendorItem: (serviceId, description, cost) => vehicleServicesApi.addVendorItem(serviceId, description, cost),
    onDeleteVendorItem: (serviceId, itemId) => vehicleServicesApi.deleteVendorItem(serviceId, itemId),
    onChanged: () => qc.invalidateQueries({ queryKey: ['sm-dashboard'] }),
    reportBreakdownSlot: (
      <Button size="sm" onClick={() => setReportingBreakdown(true)} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white">
        <Plus size={12} className="mr-1" /> Report Breakdown
      </Button>
    ),
  }

  return (
    <>
      <ServiceBoard
        data={{ breakdowns: boardBreakdowns, generalServices: boardServices, technicianCount: technicians.length }}
        cfg={cfg}
      />

      {/* Vehicle picker before opening CreateServiceDialog */}
      <Dialog open={pickingVehicle} onOpenChange={v => !v && setPickingVehicle(false)}>
        <DialogContent className="max-w-sm min-h-[300px]">
          <DialogHeader><DialogTitle>Select Vehicle</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <SearchableSelect
              options={vehicles.map(v => ({ value: String(v.id), label: v.registrationNumber }))}
              value={pickedVehicleId ? String(pickedVehicleId) : ''}
              onValueChange={val => setPickedVehicleId(Number(val))}
              placeholder="Search vehicle…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPickingVehicle(false)}>Cancel</Button>
              <Button disabled={!pickedVehicleId} onClick={confirmVehicle} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                Next
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {logService && (
        <CreateServiceDialog
          vehicleId={logService.vehicleId}
          vehicleReg={logService.vehicleReg}
          breakdownId={logService.breakdownId}
          open
          onClose={() => setLogService(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['sm-dashboard'] })}
        />
      )}

      <ReportBreakdownDialog
        open={reportingBreakdown}
        onClose={() => setReportingBreakdown(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['sm-dashboard'] })}
      />
    </>
  )
}

// ── Wrapper: one Service Manager for both vehicles and equipment ────────────────
export default function ServiceManagerPage() {
  const moduleType = useAuthStore(s => s.moduleType)
  const canAccessVehicles = useAuthStore(s => s.canAccessVehicles)
  const canAccessEquipment = useAuthStore(s => s.canAccessEquipment)

  const hasEquipment = (moduleType === 'BOTH' || moduleType === 'EQUIPMENT_ONLY') && canAccessEquipment !== false
  const hasVehicles = moduleType !== 'EQUIPMENT_ONLY' && canAccessVehicles !== false
  const [asset, setAsset] = useState<'vehicle' | 'equipment'>(hasVehicles ? 'vehicle' : 'equipment')
  const showSwitch = hasVehicles && hasEquipment

  return (
    <div className="space-y-5">
      {showSwitch && (
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          {([
            { key: 'vehicle', label: 'Vehicles', icon: Truck },
            { key: 'equipment', label: 'Equipment', icon: Construction },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setAsset(key)}
              className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                asset === key ? 'bg-white shadow-sm text-feros-navy' : 'text-gray-500 hover:text-gray-700')}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}
      {asset === 'equipment' ? <EquipmentServiceManagerPage /> : <VehicleServiceManagerView />}
    </div>
  )
}
