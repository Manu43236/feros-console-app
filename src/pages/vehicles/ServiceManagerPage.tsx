import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Truck, Construction } from 'lucide-react'
import { cn } from '@/lib/utils'
import { serviceManagerApi } from '@/api/serviceManager'
import { servicePartsApi, sparePartsApi } from '@/api/inventory'
import { vehicleServicesApi, vehiclesApi } from '@/api/vehicles'
import { globalMastersApi } from '@/api/masters'
import { CreateServiceDialog } from '@/components/shared/CreateServiceDialog'
import { ServiceBoard } from '@/components/service/ServiceBoard'
import type { BoardBreakdown, BoardService, ServiceBoardConfig } from '@/components/service/ServiceBoard'
import type { SmServiceItem } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { EquipmentServiceManagerPage } from '@/pages/equipment/EquipmentServiceManagerPage'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'

function svcToBoard(s: SmServiceItem): BoardService {
  return {
    id: s.serviceId,
    serviceNumber: s.serviceNumber,
    assetName: s.vehicleRegistrationNumber,
    status: s.serviceStatus,
    serviceTypeLabel: s.serviceType ? s.serviceType.replace(/_/g, ' ').toLowerCase() : undefined,
    tasks: s.tasks.map(t => ({
      id: t.taskId,
      displayName: t.displayName,
      status: t.status,
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
    onComplete: (serviceId, body) => vehicleServicesApi.complete(serviceId, { completedDate: body.completedDate, odometer: body.meterReading }),
    onLogService: (b) => setLogService({ vehicleId: b.assetId, vehicleReg: b.assetName, breakdownId: b.id }),
    onCreateGeneralService: openVehiclePicker,
    onChanged: () => qc.invalidateQueries({ queryKey: ['sm-dashboard'] }),
  }

  return (
    <>
      <ServiceBoard
        data={{ breakdowns: boardBreakdowns, generalServices: boardServices, technicianCount: technicians.length }}
        cfg={cfg}
      />

      {/* Vehicle picker before opening CreateServiceDialog */}
      <Dialog open={pickingVehicle} onOpenChange={v => !v && setPickingVehicle(false)}>
        <DialogContent className="max-w-sm">
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
