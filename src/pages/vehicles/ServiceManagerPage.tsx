import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wrench, AlertTriangle, CheckCircle2, Clock, User, ChevronDown, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { serviceManagerApi } from '@/api/serviceManager'
import { vehicleServicesApi } from '@/api/vehicles'
import { servicePartsApi } from '@/api/inventory'
import { sparePartsApi } from '@/api/inventory'
import { toast } from 'sonner'
import type { SmServiceItem, SmTaskItem, SmBreakdownItem, MechanicSummary, ServiceTaskStatus } from '@/types'

// ─── Task status badge ────────────────────────────────────────────────────────
function TaskStatusBadge({ status }: { status: ServiceTaskStatus }) {
  const cfg: Record<ServiceTaskStatus, { label: string; cls: string }> = {
    PENDING:        { label: 'Pending',        cls: 'bg-gray-100 text-gray-600' },
    ASSIGNED:       { label: 'Assigned',       cls: 'bg-blue-100 text-blue-700' },
    IN_PROGRESS:    { label: 'In Progress',    cls: 'bg-amber-100 text-amber-700' },
    MECHANIC_CLOSED:{ label: 'Closed',         cls: 'bg-purple-100 text-purple-700' },
    COMPLETED:      { label: 'Completed',      cls: 'bg-green-100 text-green-700' },
  }
  const { label, cls } = cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cls)}>{label}</span>
}

// ─── Assign Mechanic Modal ────────────────────────────────────────────────────
function AssignMechanicModal({
  task, serviceId, mechanics, onClose,
}: {
  task: SmTaskItem
  serviceId: number
  mechanics: MechanicSummary[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number | null>(task.assignedMechanicId ?? null)

  const assignMutation = useMutation({
    mutationFn: (mechanicId: number) =>
      serviceManagerApi.assignMechanic(serviceId, task.taskId, mechanicId),
    onSuccess: () => {
      toast.success('Mechanic assigned')
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] })
      onClose()
    },
    onError: () => toast.error('Failed to assign mechanic'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Assign Mechanic</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Task: <span className="font-medium text-gray-700">{task.displayName}</span></p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {mechanics.map(m => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                selected === m.id
                  ? 'border-feros-navy bg-feros-navy/5'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-feros-navy/10 flex items-center justify-center text-feros-navy text-sm font-semibold shrink-0">
                {m.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-500">{m.phone} · {m.userNumber}</p>
              </div>
            </button>
          ))}
          {mechanics.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No mechanics available</p>
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={!selected || assignMutation.isPending}
            onClick={() => selected && assignMutation.mutate(selected)}
            className="flex-1 px-4 py-2 text-sm bg-feros-navy text-white rounded-lg hover:bg-feros-navy/90 disabled:opacity-50"
          >
            {assignMutation.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Request Spare Part Modal ─────────────────────────────────────────────────
function RequestPartModal({
  serviceId, taskId, taskName, onClose,
}: {
  serviceId: number
  taskId: number
  taskName: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [sparePartId, setSparePartId] = useState<number | null>(null)
  const [qty, setQty] = useState(1)

  const { data: partsRes } = useQuery({
    queryKey: ['spare-parts'],
    queryFn: () => sparePartsApi.getAll(),
  })
  const parts = partsRes?.data ?? []

  const requestMutation = useMutation({
    mutationFn: () =>
      servicePartsApi.request(serviceId, { sparePartId: sparePartId!, quantityRequested: qty, taskId }),
    onSuccess: () => {
      toast.success('Spare part request submitted')
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] })
      onClose()
    },
    onError: () => toast.error('Failed to submit request'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Request Spare Part</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Task: <span className="font-medium text-gray-700">{taskName}</span></p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Spare Part</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy/30"
              value={sparePartId ?? ''}
              onChange={e => setSparePartId(Number(e.target.value) || null)}
            >
              <option value="">Select part…</option>
              {parts.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.partNumber ?? '—'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number" min={1}
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy/30"
            />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            disabled={!sparePartId || requestMutation.isPending}
            onClick={() => requestMutation.mutate()}
            className="flex-1 px-4 py-2 text-sm bg-feros-navy text-white rounded-lg hover:bg-feros-navy/90 disabled:opacity-50"
          >
            {requestMutation.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Complete Service Modal ───────────────────────────────────────────────────
function CompleteServiceModal({ serviceId, onClose }: { serviceId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0])
  const [odometer, setOdometer] = useState('')

  const completeMutation = useMutation({
    mutationFn: () =>
      vehicleServicesApi.complete(serviceId, {
        completedDate,
        odometer: odometer ? Number(odometer) : undefined,
      }),
    onSuccess: () => {
      toast.success('Service marked as completed')
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] })
      onClose()
    },
    onError: () => toast.error('Failed to complete service'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Mark Service Complete</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Completed Date</label>
            <input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Odometer (optional)</label>
            <input type="number" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="km"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy/30" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
            className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {completeMutation.isPending ? 'Completing…' : 'Complete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({
  task, serviceId, mechanics,
}: {
  task: SmTaskItem
  serviceId: number
  mechanics: MechanicSummary[]
}) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [partOpen, setPartOpen] = useState(false)

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 border-gray-100">
      <div className="flex items-center gap-2 min-w-0">
        <TaskStatusBadge status={task.status} />
        <span className="text-sm text-gray-700 truncate">{task.displayName}</span>
        {task.assignedMechanicName && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <User size={11} />
            {task.assignedMechanicName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button
          onClick={() => setPartOpen(true)}
          className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
        >
          + Part
        </button>
        <button
          onClick={() => setAssignOpen(true)}
          className="px-2 py-1 text-xs text-feros-navy border border-feros-navy/30 rounded hover:bg-feros-navy/5"
        >
          {task.assignedMechanicId ? 'Reassign' : 'Assign'}
        </button>
      </div>
      {assignOpen && (
        <AssignMechanicModal
          task={task}
          serviceId={serviceId}
          mechanics={mechanics}
          onClose={() => setAssignOpen(false)}
        />
      )}
      {partOpen && (
        <RequestPartModal
          serviceId={serviceId}
          taskId={task.taskId}
          taskName={task.displayName}
          onClose={() => setPartOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({
  service, mechanics, label,
}: {
  service: SmServiceItem
  mechanics: MechanicSummary[]
  label?: string
}) {
  const [expanded, setExpanded] = useState(true)
  const [completeOpen, setCompleteOpen] = useState(false)

  const allClosed = service.tasks.length > 0 &&
    service.tasks.every(t => t.status === 'MECHANIC_CLOSED' || t.status === 'COMPLETED')

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
          <Wrench size={15} className="text-feros-navy shrink-0" />
          <span className="font-medium text-sm text-gray-900 truncate">{service.vehicleRegistrationNumber}</span>
          <span className="text-xs text-gray-500">{service.serviceNumber}</span>
          {label && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{label}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded',
            service.serviceStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
            service.serviceStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {service.serviceStatus}
          </span>
          {service.serviceStatus !== 'COMPLETED' && (
            <button
              onClick={e => { e.stopPropagation(); setCompleteOpen(true) }}
              className={cn(
                'px-3 py-1 text-xs rounded-lg font-medium transition-colors',
                allClosed
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Complete
            </button>
          )}
        </div>
      </div>

      {/* Tasks */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100">
          {service.tasks.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No tasks assigned</p>
          ) : (
            service.tasks.map(task => (
              <TaskRow key={task.taskId} task={task} serviceId={service.serviceId} mechanics={mechanics} />
            ))
          )}
        </div>
      )}

      {completeOpen && (
        <CompleteServiceModal serviceId={service.serviceId} onClose={() => setCompleteOpen(false)} />
      )}
    </div>
  )
}

// ─── Breakdown Card ───────────────────────────────────────────────────────────
function BreakdownCard({ breakdown, mechanics }: { breakdown: SmBreakdownItem; mechanics: MechanicSummary[] }) {
  const statusColor: Record<string, string> = {
    REPORTED:  'bg-red-100 text-red-700',
    IN_REPAIR: 'bg-amber-100 text-amber-700',
    RESOLVED:  'bg-green-100 text-green-700',
    VEHICLE_REPLACED: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-2">
      {/* Breakdown info header */}
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <span className="font-medium text-sm text-gray-900">{breakdown.vehicleRegistrationNumber}</span>
          <span className="text-xs text-gray-500">{breakdown.breakdownType} · {breakdown.breakdownDate}</span>
          {breakdown.location && <span className="text-xs text-gray-400">@ {breakdown.location}</span>}
        </div>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded', statusColor[breakdown.status] ?? 'bg-gray-100 text-gray-600')}>
          {breakdown.status}
        </span>
      </div>
      {/* Associated service */}
      {breakdown.service ? (
        <div className="ml-4">
          <ServiceCard service={breakdown.service} mechanics={mechanics} />
        </div>
      ) : (
        <div className="ml-4 text-xs text-gray-400 py-1">No service linked yet</div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ServiceManagerPage() {
  const [tab, setTab] = useState<'breakdowns' | 'services'>('breakdowns')

  const { data: dashRes, isLoading, error } = useQuery({
    queryKey: ['sm-dashboard'],
    queryFn: () => serviceManagerApi.getDashboard(),
    refetchInterval: 60_000,
  })

  const { data: mechanicsRes } = useQuery({
    queryKey: ['sm-mechanics'],
    queryFn: () => serviceManagerApi.getMechanics(),
  })

  const dashboard = dashRes?.data
  const mechanics = mechanicsRes?.data ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        <Clock size={16} className="mr-2" /> Loading…
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        <AlertTriangle size={16} className="mr-2" /> Failed to load dashboard
      </div>
    )
  }

  const breakdownCount = dashboard.breakdowns.length
  const serviceCount   = dashboard.generalServices.length

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Service Manager</h1>
          <p className="text-sm text-gray-500">Manage breakdowns, services, and mechanic assignments</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <AlertTriangle size={14} className="text-red-400" />
            {breakdownCount} breakdowns
          </span>
          <span className="flex items-center gap-1">
            <Wrench size={14} className="text-blue-400" />
            {serviceCount} services
          </span>
          <span className="flex items-center gap-1">
            <User size={14} className="text-green-400" />
            {mechanics.length} mechanics
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'breakdowns', label: 'Breakdowns', count: breakdownCount, icon: AlertTriangle },
          { key: 'services',   label: 'General Services', count: serviceCount, icon: Wrench },
        ] as const).map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-feros-navy text-feros-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon size={14} />
            {label}
            <span className={cn(
              'inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-xs font-bold px-1',
              tab === key ? 'bg-feros-navy text-white' : 'bg-gray-100 text-gray-600'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'breakdowns' && (
        <div className="space-y-4">
          {dashboard.breakdowns.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No active breakdowns" />
          ) : (
            dashboard.breakdowns.map(bd => (
              <BreakdownCard key={bd.breakdownId} breakdown={bd} mechanics={mechanics} />
            ))
          )}
        </div>
      )}

      {tab === 'services' && (
        <div className="space-y-3">
          {dashboard.generalServices.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No active general services" />
          ) : (
            dashboard.generalServices.map(svc => (
              <ServiceCard key={svc.serviceId} service={svc} mechanics={mechanics} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Icon size={36} className="mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
