import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wrench, AlertTriangle, CheckCircle2, Clock, User, ChevronDown, ChevronUp, Plus, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { serviceManagerApi } from '@/api/serviceManager'
import { vehicleServicesApi } from '@/api/vehicles'
import { servicePartsApi, sparePartsApi } from '@/api/inventory'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CreateServiceDialog } from '@/components/shared/CreateServiceDialog'
import type { SmServiceItem, SmTaskItem, SmBreakdownItem, MechanicSummary, ServiceTaskStatus } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function taskChip(status: ServiceTaskStatus) {
  const cfg: Record<ServiceTaskStatus, { label: string; cls: string }> = {
    PENDING:         { label: 'Pending',     cls: 'bg-gray-100 text-gray-600' },
    ASSIGNED:        { label: 'Assigned',    cls: 'bg-blue-50 text-blue-700' },
    IN_PROGRESS:     { label: 'Working',     cls: 'bg-amber-50 text-amber-700' },
    MECHANIC_CLOSED: { label: 'Closed',      cls: 'bg-purple-50 text-purple-700' },
    COMPLETED:       { label: 'Done',        cls: 'bg-green-50 text-green-700' },
  }
  const { label, cls } = cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cls)}>{label}</span>
}

function serviceStatusChip(s?: string) {
  if (!s) return null
  const map: Record<string, string> = {
    OPEN:        'bg-blue-50 text-blue-700',
    IN_PROGRESS: 'bg-amber-50 text-amber-700',
    COMPLETED:   'bg-green-50 text-green-700',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', map[s] ?? 'bg-gray-100 text-gray-600')}>
      {s.replace(/_/g, ' ')}
    </span>
  )
}


// ── Assign Mechanic Dialog ────────────────────────────────────────────────────
function AssignMechanicDialog({
  task, serviceId, mechanics, onClose,
}: {
  task: SmTaskItem
  serviceId: number
  mechanics: MechanicSummary[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<number | null>(task.assignedMechanicId ?? null)
  const [search, setSearch] = useState('')

  const filtered = mechanics.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.designation ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const mutation = useMutation({
    mutationFn: (mechanicId: number) => serviceManagerApi.assignMechanic(serviceId, task.taskId, mechanicId),
    onSuccess: () => {
      toast.success('Mechanic assigned')
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] })
      onClose()
    },
    onError: () => toast.error('Failed to assign mechanic'),
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign Mechanic</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-1">
          Task: <span className="font-medium text-gray-700">{task.displayName}</span>
        </p>

        <Input
          placeholder="Search by name or designation…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm"
        />

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {mechanics.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No mechanics registered</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No results</p>
          ) : filtered.map(m => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                selected === m.id
                  ? 'border-feros-navy bg-feros-navy/5'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-feros-navy/10 flex items-center justify-center text-feros-navy text-sm font-bold shrink-0">
                {m.name[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                {m.designation && <p className="text-xs text-gray-500">{m.designation}</p>}
              </div>
              {selected === m.id && <CheckCircle2 size={16} className="ml-auto text-feros-navy shrink-0" />}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selected || mutation.isPending}
            onClick={() => selected && mutation.mutate(selected)}
          >
            {mutation.isPending ? 'Assigning…' : task.assignedMechanicId ? 'Reassign' : 'Assign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Request Part Dialog ───────────────────────────────────────────────────────
function RequestPartDialog({
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

  const { data: partsRes } = useQuery({ queryKey: ['spare-parts'], queryFn: sparePartsApi.getAll })
  const parts = partsRes?.data ?? []

  const mutation = useMutation({
    mutationFn: () => servicePartsApi.request(serviceId, { sparePartId: sparePartId!, quantityRequested: qty, taskId }),
    onSuccess: () => {
      toast.success('Spare part request submitted')
      qc.invalidateQueries({ queryKey: ['sm-dashboard'] })
      onClose()
    },
    onError: () => toast.error('Failed to submit request'),
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Spare Part</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-1">
          Task: <span className="font-medium text-gray-700">{taskName}</span>
        </p>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Spare Part *</Label>
            <SearchableSelect
              value={sparePartId ? String(sparePartId) : ''}
              onValueChange={v => setSparePartId(Number(v))}
              options={parts.map(p => ({ value: String(p.id), label: p.partNumber ? `${p.name} — ${p.partNumber}` : p.name }))}
              placeholder="Select part…"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Quantity *</Label>
            <Input
              type="number" min={1}
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!sparePartId || qty < 1 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Requesting…' : 'Request Part'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Complete Service Dialog ───────────────────────────────────────────────────
function CompleteServiceDialog({ serviceId, onClose }: { serviceId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0])
  const [odometer, setOdometer] = useState('')

  const mutation = useMutation({
    mutationFn: () => vehicleServicesApi.complete(serviceId, {
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
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark Service Complete</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Completed Date *</Label>
            <Input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">Odometer (optional)</Label>
            <Input
              type="number" placeholder="km at completion"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Completing…' : 'Mark Complete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Task Row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, serviceId, mechanics }: { task: SmTaskItem; serviceId: number; mechanics: MechanicSummary[] }) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [partOpen,   setPartOpen]   = useState(false)

  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0 border-gray-50">
      <div className="flex items-center gap-2.5 min-w-0">
        {taskChip(task.status)}
        <span className="text-sm text-gray-800 font-medium truncate">{task.displayName}</span>
        {task.assignedMechanicName && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <User size={11} />
            {task.assignedMechanicName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-3">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 px-2"
          onClick={() => setPartOpen(true)}
        >
          <Plus size={11} /> Part
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 px-2 border-feros-navy/30 text-feros-navy hover:bg-feros-navy/5"
          onClick={() => setAssignOpen(true)}
        >
          <UserCheck size={11} />
          {task.assignedMechanicId ? 'Reassign' : 'Assign'}
        </Button>
      </div>

      {assignOpen && (
        <AssignMechanicDialog
          task={task} serviceId={serviceId} mechanics={mechanics}
          onClose={() => setAssignOpen(false)}
        />
      )}
      {partOpen && (
        <RequestPartDialog
          serviceId={serviceId} taskId={task.taskId} taskName={task.displayName}
          onClose={() => setPartOpen(false)}
        />
      )}
    </div>
  )
}

// ── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({
  service, mechanics, isBreakdownService = false,
}: {
  service: SmServiceItem
  mechanics: MechanicSummary[]
  isBreakdownService?: boolean
}) {
  const [expanded,      setExpanded]      = useState(true)
  const [completeOpen,  setCompleteOpen]  = useState(false)

  const allClosed = service.tasks.length > 0 &&
    service.tasks.every(t => t.status === 'MECHANIC_CLOSED' || t.status === 'COMPLETED')

  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', isBreakdownService && 'border-l-4 border-l-orange-300')}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {expanded
            ? <ChevronUp   size={14} className="text-gray-400 shrink-0" />
            : <ChevronDown size={14} className="text-gray-400 shrink-0" />
          }
          <Wrench size={14} className="text-feros-navy shrink-0" />
          <span className="font-semibold text-sm text-gray-900">{service.vehicleRegistrationNumber}</span>
          <span className="text-xs text-gray-400 font-mono">{service.serviceNumber}</span>
          {serviceStatusChip(service.serviceStatus)}
          {service.serviceType && <span className="text-xs text-gray-400 capitalize">{service.serviceType.replace(/_/g, ' ').toLowerCase()}</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
          {service.serviceStatus !== 'COMPLETED' && (
            <Button
              size="sm"
              variant={allClosed ? 'default' : 'outline'}
              className={cn('h-7 text-xs', allClosed && 'bg-green-600 hover:bg-green-700 border-green-600')}
              onClick={() => setCompleteOpen(true)}
            >
              <CheckCircle2 size={12} className="mr-1" />
              Complete
            </Button>
          )}
        </div>
      </div>

      {/* Task list */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100">
          {service.tasks.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">No tasks on this service</p>
          ) : (
            service.tasks.map(task => (
              <TaskRow key={task.taskId} task={task} serviceId={service.serviceId} mechanics={mechanics} />
            ))
          )}
        </div>
      )}

      {completeOpen && (
        <CompleteServiceDialog serviceId={service.serviceId} onClose={() => setCompleteOpen(false)} />
      )}
    </div>
  )
}

// ── Breakdown Card ────────────────────────────────────────────────────────────
function BreakdownCard({ breakdown, mechanics }: { breakdown: SmBreakdownItem; mechanics: MechanicSummary[] }) {
  const qc = useQueryClient()
  const [logOpen, setLogOpen] = useState(false)

  const statusCls: Record<string, string> = {
    REPORTED:         'bg-red-50 text-red-700',
    IN_REPAIR:        'bg-amber-50 text-amber-700',
    RESOLVED:         'bg-green-50 text-green-700',
    VEHICLE_REPLACED: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-2">
      {/* Breakdown header */}
      <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{breakdown.vehicleRegistrationNumber}</span>
              {breakdown.status && (
                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusCls[breakdown.status] ?? 'bg-gray-100 text-gray-600')}>
                  {breakdown.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {breakdown.breakdownType} · {fmtDate(breakdown.breakdownDate)}
              {breakdown.location && ` · ${breakdown.location}`}
            </p>
          </div>
        </div>

        {!breakdown.service && (
          <Button
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={() => setLogOpen(true)}
          >
            <Wrench size={12} className="mr-1" />
            Log Service
          </Button>
        )}
      </div>

      {/* Linked service */}
      {breakdown.service ? (
        <div className="ml-5">
          <ServiceCard service={breakdown.service} mechanics={mechanics} isBreakdownService />
        </div>
      ) : (
        <div className="ml-5 py-2">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-4 h-px bg-gray-300 inline-block" />
            No service logged yet — click <strong>Log Service</strong> to start repairs
          </p>
        </div>
      )}

      {logOpen && (
        <CreateServiceDialog
          vehicleId={breakdown.vehicleId}
          vehicleReg={breakdown.vehicleRegistrationNumber}
          breakdownId={breakdown.breakdownId}
          open={logOpen}
          onClose={() => setLogOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['sm-dashboard'] })}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServiceManagerPage() {
  const [tab, setTab] = useState<'breakdowns' | 'services'>('breakdowns')

  const { data: dashRes, isLoading } = useQuery({
    queryKey: ['sm-dashboard'],
    queryFn: serviceManagerApi.getDashboard,
    refetchInterval: 60_000,
  })

  const { data: mechanicsRes } = useQuery({
    queryKey: ['sm-mechanics'],
    queryFn: serviceManagerApi.getMechanics,
  })

  const dashboard = dashRes?.data
  const mechanics = mechanicsRes?.data ?? []

  const breakdownCount = dashboard?.breakdowns.length ?? 0
  const serviceCount   = dashboard?.generalServices.length ?? 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Service Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Examine breakdowns, log services, and assign mechanics</p>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-medium">
            <AlertTriangle size={13} /> {breakdownCount} breakdowns
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium">
            <Wrench size={13} /> {serviceCount} services
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium">
            <User size={13} /> {mechanics.length} mechanics
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'breakdowns', label: 'Breakdowns',       count: breakdownCount, icon: AlertTriangle },
          { key: 'services',   label: 'General Services', count: serviceCount,   icon: Wrench       },
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
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
          <Clock size={15} /> Loading…
        </div>
      ) : !dashboard ? (
        <div className="flex items-center justify-center h-40 text-red-500 text-sm gap-2">
          <AlertTriangle size={15} /> Failed to load
        </div>
      ) : tab === 'breakdowns' ? (
        <div className="space-y-4">
          {dashboard.breakdowns.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No active breakdowns" />
          ) : (
            dashboard.breakdowns.map(bd => (
              <BreakdownCard key={bd.breakdownId} breakdown={bd} mechanics={mechanics} />
            ))
          )}
        </div>
      ) : (
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
      <Icon size={36} className="mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
