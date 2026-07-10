import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, UserCheck, Package, CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { equipmentApi } from '@/api/equipment'
import type { EquipmentServiceRecord, EquipmentServiceTask } from '@/api/equipment'
import { serviceManagerApi } from '@/api/serviceManager'
import { sparePartsApi } from '@/api/inventory'
import { globalMastersApi } from '@/api/masters'

const EQUIP = '#1C1400'

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:        { label: 'Pending',        cls: 'bg-gray-100 text-gray-600' },
  ASSIGNED:       { label: 'Assigned',       cls: 'bg-blue-50 text-blue-700' },
  IN_PROGRESS:    { label: 'In Progress',    cls: 'bg-amber-100 text-amber-700' },
  MECHANIC_CLOSED:{ label: 'Mechanic Closed',cls: 'bg-purple-50 text-purple-700' },
  COMPLETED:      { label: 'Completed',      cls: 'bg-green-100 text-green-700' },
}
const PART_STATUS: Record<string, string> = {
  REQUESTED: 'text-amber-600', APPROVED: 'text-green-600', REJECTED: 'text-red-500',
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['eq-services'] })
    qc.invalidateQueries({ queryKey: ['eq-breakdowns'] })
    qc.invalidateQueries({ queryKey: ['equipment'] })
  }
}

function AssignTechnicianDialog({ equipmentId, serviceId, taskId, onClose }: {
  equipmentId: number; serviceId: number; taskId: number; onClose: () => void
}) {
  const invalidate = useInvalidate()
  const [techId, setTechId] = useState<number | null>(null)
  const { data } = useQuery({ queryKey: ['sm-technicians'], queryFn: serviceManagerApi.getTechnicians })
  const techs = data?.data ?? []
  const mut = useMutation({
    mutationFn: () => equipmentApi.assignTaskTechnician(equipmentId, serviceId, taskId, techId!),
    onSuccess: () => { invalidate(); toast.success('Technician assigned'); onClose() },
    onError: () => toast.error('Failed to assign'),
  })
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign Technician</DialogTitle></DialogHeader>
        <div>
          <Label>Technician</Label>
          <SearchableSelect value={techId != null ? String(techId) : ''} onValueChange={v => setTechId(Number(v))}
            options={techs.map(t => ({ value: String(t.id), label: t.designation ? `${t.name} · ${t.designation}` : t.name }))}
            placeholder="Select technician" />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!techId || mut.isPending} onClick={() => mut.mutate()}
            style={{ background: EQUIP }} className="text-white">Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddPartDialog({ equipmentId, serviceId, taskId, onClose }: {
  equipmentId: number; serviceId: number; taskId: number; onClose: () => void
}) {
  const invalidate = useInvalidate()
  const [partId, setPartId] = useState<number | null>(null)
  const [qty, setQty] = useState('1')
  const { data } = useQuery({ queryKey: ['spare-parts'], queryFn: sparePartsApi.getAll })
  const parts = data?.data ?? []
  const mut = useMutation({
    mutationFn: () => equipmentApi.requestPart(equipmentId, serviceId, { sparePartId: partId!, quantityRequested: Number(qty), taskId }),
    onSuccess: () => { invalidate(); toast.success('Part requested'); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to request part'),
  })
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Part</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Spare Part</Label>
            <SearchableSelect value={partId != null ? String(partId) : ''} onValueChange={v => setPartId(Number(v))}
              options={parts.map(p => ({ value: String(p.id), label: p.partNumber ? `${p.name} (${p.partNumber})` : p.name }))}
              placeholder="Select part" />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!partId || Number(qty) < 1 || mut.isPending} onClick={() => mut.mutate()}
            style={{ background: EQUIP }} className="text-white">Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddTaskDialog({ equipmentId, serviceId, onClose }: {
  equipmentId: number; serviceId: number; onClose: () => void
}) {
  const invalidate = useInvalidate()
  const [taskTypeId, setTaskTypeId] = useState<number | null>(null)
  const [customName, setCustomName] = useState('')
  const [cost, setCost] = useState('')
  const { data } = useQuery({ queryKey: ['equipment-service-task-types'], queryFn: globalMastersApi.getEquipmentServiceTaskTypes })
  const types = data?.data ?? []
  const mut = useMutation({
    mutationFn: () => equipmentApi.addTask(equipmentId, serviceId, {
      taskTypeId: taskTypeId ?? undefined,
      customName: customName || undefined,
      cost: cost ? Number(cost) : undefined,
    }),
    onSuccess: () => { invalidate(); toast.success('Task added'); onClose() },
    onError: () => toast.error('Failed to add task'),
  })
  function submit() {
    if (!taskTypeId && !customName.trim()) { toast.error('Pick a task type or enter a name'); return }
    mut.mutate()
  }
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Task Type</Label>
            <SearchableSelect value={taskTypeId != null ? String(taskTypeId) : ''} onValueChange={v => { setTaskTypeId(Number(v)); setCustomName('') }}
              options={types.map(t => ({ value: String(t.id), label: t.name }))} placeholder="Select task type" />
          </div>
          <div>
            <Label>Or custom task</Label>
            <Input value={customName} onChange={e => { setCustomName(e.target.value); setTaskTypeId(null) }} placeholder="Custom task name" className="mt-1" />
          </div>
          <div>
            <Label>Cost (optional)</Label>
            <Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={mut.isPending} onClick={submit} style={{ background: EQUIP }} className="text-white">Add Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaskRow({ task, equipmentId, serviceId }: { task: EquipmentServiceTask; equipmentId: number; serviceId: number }) {
  const invalidate = useInvalidate()
  const [assignOpen, setAssignOpen] = useState(false)
  const [partOpen, setPartOpen] = useState(false)
  const st = TASK_STATUS[task.status] ?? { label: task.status, cls: 'bg-gray-100 text-gray-600' }
  const parts = task.parts ?? []
  const removePart = useMutation({
    mutationFn: (partId: number) => equipmentApi.removePart(partId),
    onSuccess: () => { invalidate(); toast.success('Part removed') },
    onError: () => toast.error('Failed to remove'),
  })

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', st.cls)}>{st.label}</span>
            <span className="text-sm font-medium text-gray-800">{task.displayName ?? 'Task'}</span>
            {task.cost != null && <span className="text-xs text-gray-400">₹{task.cost}</span>}
          </div>
          {task.assignedMechanicName && (
            <p className="text-xs text-gray-500 mt-1"><UserCheck size={11} className="inline mr-1" />{task.assignedMechanicName}</p>
          )}
          {parts.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {parts.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs text-gray-500">
                  <Package size={11} />
                  <span>{p.sparePartName} × {p.quantityApproved ?? p.quantityRequested}</span>
                  <span className={PART_STATUS[p.status]}>{p.status}</span>
                  {p.status === 'REQUESTED' && (
                    <button onClick={() => removePart.mutate(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={11} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {task.status !== 'COMPLETED' && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPartOpen(true)}>
              <Plus size={11} /> Part
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1 text-white" style={{ background: EQUIP }} onClick={() => setAssignOpen(true)}>
              <UserCheck size={11} /> Assign
            </Button>
          </div>
        )}
      </div>
      {assignOpen && <AssignTechnicianDialog equipmentId={equipmentId} serviceId={serviceId} taskId={task.id} onClose={() => setAssignOpen(false)} />}
      {partOpen && <AddPartDialog equipmentId={equipmentId} serviceId={serviceId} taskId={task.id} onClose={() => setPartOpen(false)} />}
    </div>
  )
}

export function EquipmentServiceCard({ service }: { service: EquipmentServiceRecord }) {
  const invalidate = useInvalidate()
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const tasks = service.tasks ?? []
  const complete = useMutation({
    mutationFn: () => equipmentApi.completeService(service.equipmentId, service.id, {}),
    onSuccess: () => { invalidate(); toast.success('Service completed') },
    onError: () => toast.error('Failed to complete'),
  })

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-gray-50/50">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-gray-900">{service.equipmentName ?? service.equipmentIdentifier ?? 'Machine'}</span>
          {service.serviceNumber && <span className="ml-2 text-xs text-gray-400 font-mono">{service.serviceNumber}</span>}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddTaskOpen(true)}>
            <Plus size={12} /> Add Task
          </Button>
          {service.status !== 'COMPLETED' && (
            <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={complete.isPending} onClick={() => complete.mutate()}>
              <CheckCircle2 size={12} /> Complete
            </Button>
          )}
        </div>
      </div>
      <div className="p-3 space-y-2">
        {tasks.length === 0
          ? <p className="text-xs text-gray-400 text-center py-3">No tasks yet — click Add Task</p>
          : tasks.map(t => <TaskRow key={t.id} task={t} equipmentId={service.equipmentId} serviceId={service.id} />)}
      </div>
      {addTaskOpen && <AddTaskDialog equipmentId={service.equipmentId} serviceId={service.id} onClose={() => setAddTaskOpen(false)} />}
    </div>
  )
}
