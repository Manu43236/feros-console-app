import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { equipmentApi } from '@/api/equipment'
import type { EquipmentBreakdown, EquipmentServiceRecord } from '@/api/equipment'
import { serviceManagerApi } from '@/api/serviceManager'
import { sparePartsApi } from '@/api/inventory'
import { globalMastersApi } from '@/api/masters'
import { ServiceBoard } from '@/components/service/ServiceBoard'
import type { BoardBreakdown, BoardService, ServiceBoardConfig } from '@/components/service/ServiceBoard'
import { ServiceDialog } from './MachineDetailPage'
import { ReportBreakdownDialog } from './BreakdownTab'

function toBoardService(s: EquipmentServiceRecord): BoardService {
  return {
    id: s.id,
    serviceNumber: s.serviceNumber ?? undefined,
    assetName: s.equipmentName ?? s.equipmentIdentifier ?? 'Machine',
    status: s.status,
    tasks: (s.tasks ?? []).map(t => ({
      id: t.id,
      displayName: t.displayName ?? t.taskTypeName ?? t.customName ?? 'Task',
      status: t.status,
      assignedMechanicId: t.assignedMechanicId,
      assignedMechanicName: t.assignedMechanicName,
      mechanicStartedAt: t.mechanicStartedAt,
      mechanicClosedAt: t.mechanicClosedAt,
      parts: (t.parts ?? []).map(p => ({
        id: p.id, partName: p.sparePartName, partNumber: p.partNumber,
        quantityRequested: p.quantityRequested, quantityApproved: p.quantityApproved, status: p.status,
      })),
    })),
  }
}

export function EquipmentServiceManagerPage() {
  const qc = useQueryClient()
  const [reportOpen, setReportOpen] = useState(false)
  const [logService, setLogService] = useState<{ equipmentId: number; currentHmr: number | null } | null>(null)

  const { data: machinesRes } = useQuery({ queryKey: ['equipment'], queryFn: equipmentApi.getAll })
  const machines = machinesRes?.data ?? []
  const { data: bdRes } = useQuery({ queryKey: ['eq-breakdowns', 'all'], queryFn: equipmentApi.getAllBreakdowns })
  const breakdowns = (bdRes?.data ?? []) as EquipmentBreakdown[]
  const { data: svcRes } = useQuery({ queryKey: ['eq-services', 'all'], queryFn: equipmentApi.getAllServices })
  const services = (svcRes?.data ?? []) as EquipmentServiceRecord[]
  const { data: techRes } = useQuery({ queryKey: ['sm-technicians'], queryFn: serviceManagerApi.getTechnicians })
  const technicians = techRes?.data ?? []
  const { data: partsRes } = useQuery({ queryKey: ['spare-parts'], queryFn: sparePartsApi.getAll })
  const spareParts = partsRes?.data ?? []
  const { data: typesRes } = useQuery({ queryKey: ['equipment-service-task-types'], queryFn: globalMastersApi.getEquipmentServiceTaskTypes })
  const taskTypes = typesRes?.data ?? []

  const machineHmr = (id: number) => {
    const m = machines.find(x => x.id === id)
    return m?.currentMeterReading != null ? Number(m.currentMeterReading) : null
  }
  const equipmentIdOf = (serviceId: number) => services.find(s => s.id === serviceId)?.equipmentId

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['eq-services'] })
    qc.invalidateQueries({ queryKey: ['eq-breakdowns'] })
    qc.invalidateQueries({ queryKey: ['equipment'] })
  }

  // Breakdowns nest their machine's open service; those are excluded from General Services (mirror vehicle).
  const nestedServiceIds = new Set<number>()
  const boardBreakdowns: BoardBreakdown[] = breakdowns
    .filter(b => b.status !== 'RESOLVED')
    .map(b => {
      const open = services.find(s => s.equipmentId === b.equipmentId && s.status !== 'COMPLETED')
      if (open) nestedServiceIds.add(open.id)
      return {
        id: b.id,
        assetId: b.equipmentId,
        assetName: b.equipmentName ?? b.equipmentIdentifier ?? 'Machine',
        date: b.breakdownDate,
        location: b.location ?? undefined,
        typeLabel: b.reason ?? undefined,
        status: b.status,
        service: open ? toBoardService(open) : undefined,
      }
    })
  const boardServices: BoardService[] = services.filter(s => !nestedServiceIds.has(s.id)).map(toBoardService)

  const cfg: ServiceBoardConfig = {
    title: 'Service Manager',
    subtitle: 'Examine breakdowns, log services, and assign technicians',
    meterLabel: 'HMR',
    technicians,
    spareParts,
    taskTypes,
    onAssign: (serviceId, taskId, mechanicId) => equipmentApi.assignTaskTechnician(equipmentIdOf(serviceId)!, serviceId, taskId, mechanicId),
    onAddTask: (serviceId, body) => equipmentApi.addTask(equipmentIdOf(serviceId)!, serviceId, body),
    onRequestPart: (serviceId, taskId, body) => equipmentApi.requestPart(equipmentIdOf(serviceId)!, serviceId, { ...body, taskId }),
    onComplete: (serviceId, body) => equipmentApi.completeService(equipmentIdOf(serviceId)!, serviceId, { completedHmr: body.meterReading ?? null, completedDate: body.completedDate }),
    onLogService: (b) => setLogService({ equipmentId: b.assetId, currentHmr: machineHmr(b.assetId) }),
    onChanged: invalidate,
    reportBreakdownSlot: (
      <Button size="sm" onClick={() => setReportOpen(true)} className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1.5 mb-1">
        <Plus size={14} /> Report Breakdown
      </Button>
    ),
  }

  return (
    <>
      <ServiceBoard
        data={{ breakdowns: boardBreakdowns, generalServices: boardServices, technicianCount: technicians.length }}
        cfg={cfg}
      />
      <ReportBreakdownDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        machines={machines.map(m => ({ id: m.id, label: `${m.makeName} ${m.modelName}${m.serialNumber ? ` · ${m.serialNumber}` : ''}` }))}
      />
      {logService && (
        <ServiceDialog
          open={!!logService}
          onClose={() => { setLogService(null); invalidate() }}
          equipmentId={logService.equipmentId}
          editing={null}
          currentHmr={logService.currentHmr}
        />
      )}
    </>
  )
}
