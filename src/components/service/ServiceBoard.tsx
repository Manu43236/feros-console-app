import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Wrench, AlertTriangle, CheckCircle2, Clock, User, ChevronDown, ChevronUp, Plus, UserCheck,
  MapPin, Calendar, StickyNote, Store, IndianRupee, Upload, ExternalLink, FileImage, Download, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { ServiceTaskStatus } from '@/types'

// ── Normalized board model (both vehicle + equipment map into this) ─────────────
export interface BoardPart {
  id: number; partName: string; partNumber?: string | null
  quantityRequested: number; quantityApproved?: number | null
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED'
}
export interface BoardTask {
  id: number; displayName: string; status: ServiceTaskStatus; cost?: number
  assignedMechanicId?: number | null; assignedMechanicName?: string | null
  mechanicStartedAt?: string | null; mechanicClosedAt?: string | null
  parts?: BoardPart[]
}
export interface BoardService {
  id: number; serviceNumber?: string; assetName: string
  status: string; serviceTypeLabel?: string; serviceType?: string; tasks: BoardTask[]
  serviceDate?: string; triggeredBy?: string
  vendorName?: string; location?: string; notes?: string
  estimatedCost?: number; completedCost?: number; totalCost?: number
  estimateDocUrl?: string; billDocUrl?: string
  vendorItems?: Array<{ id: number; description: string; cost?: number }>
}
export interface BoardBreakdown {
  id: number; assetId: number; assetName: string
  date?: string; location?: string; typeLabel?: string; status?: string
  reason?: string; notes?: string
  service?: BoardService
}

export interface ServiceBoardConfig {
  title: string
  subtitle: string
  meterLabel?: string
  technicians: { id: number; name: string; designation?: string }[]
  spareParts: { id: number; name: string; partNumber?: string }[]
  taskTypes: { id: number; name: string }[]
  onAssign: (serviceId: number, taskId: number, mechanicId: number) => Promise<unknown>
  onAddTask: (serviceId: number, body: { taskTypeId?: number; customName?: string }) => Promise<unknown>
  onRequestPart: (serviceId: number, taskId: number, body: { sparePartId: number; quantityRequested: number }) => Promise<unknown>
  onComplete: (serviceId: number, body: { completedDate: string; meterReading?: number }) => Promise<unknown>
  onLogService: (b: BoardBreakdown) => void
  onCreateGeneralService?: () => void
  onUploadDoc?: (serviceId: number, type: 'estimate' | 'bill', file: File) => Promise<void>
  onOpenPdf?: (serviceId: number) => void
  onAddVendorItem?: (serviceId: number, description: string, cost?: number) => Promise<unknown>
  onDeleteVendorItem?: (serviceId: number, itemId: number) => Promise<unknown>
  onChanged: () => void
  reportBreakdownSlot?: React.ReactNode
}

// ── Helpers (identical to vehicle) ──────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}
function fmtDateTime(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) } catch { return d }
}
function calcDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function taskChip(status: ServiceTaskStatus) {
  const cfg: Record<ServiceTaskStatus, { label: string; cls: string }> = {
    PENDING:         { label: 'Pending', cls: 'bg-gray-100 text-gray-600' },
    ASSIGNED:        { label: 'Assigned', cls: 'bg-blue-50 text-blue-700' },
    IN_PROGRESS:     { label: 'Working', cls: 'bg-amber-50 text-amber-700' },
    MECHANIC_CLOSED: { label: 'Closed', cls: 'bg-purple-50 text-purple-700' },
    COMPLETED:       { label: 'Done', cls: 'bg-green-50 text-green-700' },
  }
  const { label, cls } = cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cls)}>{label}</span>
}
function serviceStatusChip(s?: string) {
  if (!s) return null
  const map: Record<string, string> = { OPEN: 'bg-blue-50 text-blue-700', IN_PROGRESS: 'bg-amber-50 text-amber-700', COMPLETED: 'bg-green-50 text-green-700' }
  return <span className={cn('px-2 py-0.5 rounded text-xs font-medium', map[s] ?? 'bg-gray-100 text-gray-600')}>{s.replace(/_/g, ' ')}</span>
}
function partStatusBadge(status: BoardPart['status']) {
  const cfg: Record<BoardPart['status'], string> = { REQUESTED: 'bg-amber-50 text-amber-700', APPROVED: 'bg-green-50 text-green-700', REJECTED: 'bg-red-50 text-red-700' }
  return <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', cfg[status])}>{status}</span>
}

// ── Dialogs ─────────────────────────────────────────────────────────────────────
function AssignTechnicianDialog({ task, serviceId, cfg, onClose }: { task: BoardTask; serviceId: number; cfg: ServiceBoardConfig; onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(task.assignedMechanicId ?? null)
  const [search, setSearch] = useState('')
  const filtered = cfg.technicians.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  const mutation = useMutation({
    mutationFn: (id: number) => cfg.onAssign(serviceId, task.id, id),
    onSuccess: () => { toast.success('Technician assigned'); cfg.onChanged(); onClose() },
    onError: () => toast.error('Failed to assign technician'),
  })
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Technician</DialogTitle></DialogHeader>
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="mb-1" />
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No technicians</p>
          ) : filtered.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)}
              className={cn('w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                selected === m.id ? 'border-feros-navy bg-feros-navy/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}>
              <div className="w-8 h-8 rounded-full bg-feros-navy/10 flex items-center justify-center text-feros-navy text-sm font-bold shrink-0">{m.name[0]}</div>
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
          <Button disabled={!selected || mutation.isPending} onClick={() => selected && mutation.mutate(selected)}>
            {mutation.isPending ? 'Assigning…' : task.assignedMechanicId ? 'Reassign' : 'Assign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RequestPartDialog({ serviceId, taskId, taskName, cfg, onClose }: { serviceId: number; taskId: number; taskName: string; cfg: ServiceBoardConfig; onClose: () => void }) {
  const [sparePartId, setSparePartId] = useState<number | null>(null)
  const [qty, setQty] = useState(1)
  const mutation = useMutation({
    mutationFn: () => cfg.onRequestPart(serviceId, taskId, { sparePartId: sparePartId!, quantityRequested: qty }),
    onSuccess: () => { toast.success('Spare part request submitted'); cfg.onChanged(); onClose() },
    onError: () => toast.error('Failed to submit request'),
  })
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Request Spare Part</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500 -mt-1">Task: <span className="font-medium text-gray-700">{taskName}</span></p>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Spare Part *</Label>
            <SearchableSelect value={sparePartId ? String(sparePartId) : ''} onValueChange={v => setSparePartId(Number(v))}
              options={cfg.spareParts.map(p => ({ value: String(p.id), label: p.partNumber ? `${p.name} — ${p.partNumber}` : p.name }))} placeholder="Select part…" />
          </div>
          <div>
            <Label className="mb-1.5 block">Quantity *</Label>
            <Input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!sparePartId || qty < 1 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Requesting…' : 'Request Part'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CompleteServiceDialog({ serviceId, cfg, onClose }: { serviceId: number; cfg: ServiceBoardConfig; onClose: () => void }) {
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0])
  const [meter, setMeter] = useState('')
  const mutation = useMutation({
    mutationFn: () => cfg.onComplete(serviceId, { completedDate, meterReading: meter ? Number(meter) : undefined }),
    onSuccess: () => { toast.success('Service marked as completed'); cfg.onChanged(); onClose() },
    onError: () => toast.error('Failed to complete service'),
  })
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Mark Service Complete</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Completed Date *</Label>
            <Input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">{cfg.meterLabel ?? 'Odometer'} (optional)</Label>
            <Input type="number" placeholder={`${cfg.meterLabel ?? 'Odometer'} at completion`} value={meter} onChange={e => setMeter(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Completing…' : 'Mark Complete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AddTaskDialog({ serviceId, cfg, onClose }: { serviceId: number; cfg: ServiceBoardConfig; onClose: () => void }) {
  const [taskTypeId, setTaskTypeId] = useState<number | null>(null)
  const [customName, setCustomName] = useState('')
  const mutation = useMutation({
    mutationFn: () => cfg.onAddTask(serviceId, { taskTypeId: taskTypeId ?? undefined, customName: customName.trim() || undefined }),
    onSuccess: () => { toast.success('Task added'); cfg.onChanged(); onClose() },
    onError: () => toast.error('Failed to add task'),
  })
  const canSubmit = taskTypeId !== null || customName.trim().length > 0
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">Task Type</Label>
            <SearchableSelect value={taskTypeId ? String(taskTypeId) : ''} onValueChange={v => { setTaskTypeId(v ? Number(v) : null); setCustomName('') }}
              options={cfg.taskTypes.map(t => ({ value: String(t.id), label: t.name }))} placeholder="Select task type…" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" /><span className="text-xs text-gray-400">or</span><div className="h-px flex-1 bg-gray-200" />
          </div>
          <div>
            <Label className="mb-1.5 block">Custom Task Name</Label>
            <Input placeholder="e.g. Replace front brake pads" value={customName} onChange={e => { setCustomName(e.target.value); setTaskTypeId(null) }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Adding…' : 'Add Task'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Task Row ────────────────────────────────────────────────────────────────────
function TaskRow({ task, serviceId, cfg, isExternal }: { task: BoardTask; serviceId: number; cfg: ServiceBoardConfig; isExternal?: boolean }) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [partOpen, setPartOpen] = useState(false)
  return (
    <div className="py-2.5 border-b last:border-0 border-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {taskChip(task.status)}
          <span className="text-sm text-gray-800 font-medium truncate">{task.displayName}</span>
          {task.assignedMechanicName && <span className="flex items-center gap-1 text-xs text-gray-400"><User size={11} />{task.assignedMechanicName}</span>}
        </div>
        {!isExternal && (
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => setPartOpen(true)}><Plus size={11} /> Part</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 border-feros-navy/30 text-feros-navy hover:bg-feros-navy/5" onClick={() => setAssignOpen(true)}>
              <UserCheck size={11} />{task.assignedMechanicId ? 'Reassign' : 'Assign'}
            </Button>
          </div>
        )}
      </div>
      {(task.mechanicStartedAt || task.mechanicClosedAt) && (
        <div className="mt-1.5 flex items-center gap-3 text-xs flex-wrap">
          {task.mechanicStartedAt && <span className="flex items-center gap-1 text-blue-600"><span>▶</span> {fmtDateTime(task.mechanicStartedAt)}</span>}
          {task.mechanicClosedAt && <span className="flex items-center gap-1 text-purple-600"><span>✓</span> {fmtDateTime(task.mechanicClosedAt)}</span>}
          {calcDuration(task.mechanicStartedAt, task.mechanicClosedAt) && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{calcDuration(task.mechanicStartedAt, task.mechanicClosedAt)}</span>}
        </div>
      )}
      {task.parts && task.parts.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {task.parts.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
              <span className="font-medium text-gray-700">{p.partName}</span>
              {p.partNumber && <span className="text-gray-400">({p.partNumber})</span>}
              <span>×{p.quantityRequested}</span>
              {p.quantityApproved != null && p.quantityApproved !== p.quantityRequested && <span className="text-green-600">approved: {p.quantityApproved}</span>}
              {partStatusBadge(p.status)}
            </div>
          ))}
        </div>
      )}
      {assignOpen && <AssignTechnicianDialog task={task} serviceId={serviceId} cfg={cfg} onClose={() => setAssignOpen(false)} />}
      {partOpen && <RequestPartDialog serviceId={serviceId} taskId={task.id} taskName={task.displayName} cfg={cfg} onClose={() => setPartOpen(false)} />}
    </div>
  )
}

// ── Service Card ────────────────────────────────────────────────────────────────
function ServiceInlineDocs({ service, cfg }: { service: BoardService; cfg: ServiceBoardConfig }) {
  const estimateRef = useRef<HTMLInputElement>(null)
  const billRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<'estimate' | 'bill' | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemDesc, setNewItemDesc] = useState('')
  const [newItemCost, setNewItemCost] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  async function addVendorItem() {
    if (!newItemDesc.trim() || !cfg.onAddVendorItem) return
    setAddingItem(true)
    try {
      await cfg.onAddVendorItem(service.id, newItemDesc.trim(), newItemCost ? parseFloat(newItemCost) : undefined)
      setNewItemDesc(''); setNewItemCost(''); setShowAddItem(false)
      cfg.onChanged()
      toast.success('Part added')
    } catch { toast.error('Failed to add part') }
    finally { setAddingItem(false) }
  }

  async function deleteVendorItem(itemId: number) {
    if (!cfg.onDeleteVendorItem) return
    try {
      await cfg.onDeleteVendorItem(service.id, itemId)
      cfg.onChanged()
    } catch { toast.error('Failed to remove part') }
  }

  async function upload(type: 'estimate' | 'bill', file: File) {
    if (!cfg.onUploadDoc) return
    setUploading(type)
    try { await cfg.onUploadDoc(service.id, type, file) } finally { setUploading(null) }
  }

  const isThirdParty = service.serviceType === 'THIRD_PARTY' || service.serviceType === 'OEM_CENTER'
  const totalVendorCost = (service.vendorItems ?? []).reduce((s, i) => s + (i.cost ?? 0), 0)
  const totalTaskCost = service.tasks.reduce((s, t) => s + (t.cost ?? 0), 0)
  const hasAnyCost = (service.estimatedCost ?? 0) > 0 || totalVendorCost > 0 || totalTaskCost > 0 || (service.completedCost ?? 0) > 0

  function SmallDoc({ label, url, type, inputRef }: { label: string; url?: string; type: 'estimate' | 'bill'; inputRef: React.RefObject<HTMLInputElement | null> }) {
    const isImg = url && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)
    return (
      <div className="border border-gray-100 rounded-lg p-2.5 space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
          <FileImage size={10} /> {label}
        </p>
        {url ? (
          <>
            {isImg
              ? <img src={url} alt={label} className="w-full rounded max-h-32 object-contain bg-gray-50 cursor-pointer" onClick={() => window.open(url, '_blank')} />
              : <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={10} /> View {label}</a>
            }
            {cfg.onUploadDoc && (
              <button disabled={uploading === type} onClick={() => inputRef.current?.click()}
                className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                <Upload size={9} /> {uploading === type ? 'Uploading…' : 'Replace'}
              </button>
            )}
          </>
        ) : cfg.onUploadDoc ? (
          <button disabled={uploading === type} onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded py-2 text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-500 flex items-center justify-center gap-1">
            <Upload size={10} />{uploading === type ? 'Uploading…' : `Upload ${label}`}
          </button>
        ) : (
          <p className="text-[10px] text-gray-300">Not uploaded</p>
        )}
        <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(type, f); e.target.value = '' }} />
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-3 border-t border-gray-100 space-y-3">
      {/* Cost breakdown */}
      {hasAnyCost && (
        <div className="space-y-1">
          {(service.estimatedCost ?? 0) > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>Service Labor Charges</span>
              <span className="flex items-center gap-0.5"><IndianRupee size={10} />{service.estimatedCost!.toLocaleString('en-IN')}</span>
            </div>
          )}
          {isThirdParty && totalVendorCost > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>Parts / Items (Vendor Quote)</span>
              <span className="flex items-center gap-0.5"><IndianRupee size={10} />{totalVendorCost.toLocaleString('en-IN')}</span>
            </div>
          )}
          {totalTaskCost > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>Tasks Cost</span>
              <span className="flex items-center gap-0.5"><IndianRupee size={10} />{totalTaskCost.toLocaleString('en-IN')}</span>
            </div>
          )}
          {(service.totalCost ?? 0) > 0 && (
            <div className="flex justify-between text-xs font-semibold text-gray-800 border-t border-gray-100 pt-1">
              <span>Total Est. Cost</span>
              <span className="flex items-center gap-0.5 text-green-700"><IndianRupee size={10} />{service.totalCost!.toLocaleString('en-IN')}</span>
            </div>
          )}
          {(service.completedCost ?? 0) > 0 && (
            <div className="flex justify-between text-xs font-semibold text-blue-700">
              <span>Actual Bill</span>
              <span className="flex items-center gap-0.5"><IndianRupee size={10} />{service.completedCost!.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      )}

      {/* Vendor quote items */}
      {isThirdParty && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Parts / Items (Vendor Quote)</p>
            {cfg.onAddVendorItem && service.status !== 'COMPLETED' && !showAddItem && (
              <button onClick={() => setShowAddItem(true)}
                className="flex items-center gap-0.5 text-[10px] text-feros-navy hover:underline font-medium">
                <Plus size={9} /> Add Part
              </button>
            )}
          </div>
          {(service.vendorItems ?? []).map(item => (
            <div key={item.id} className="flex justify-between text-xs text-gray-600 py-0.5 border-b border-gray-50 last:border-0 group">
              <span className="flex-1 truncate">{item.description}</span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {item.cost != null && <span className="flex items-center gap-0.5"><IndianRupee size={9} />{item.cost.toLocaleString('en-IN')}</span>}
                {cfg.onDeleteVendorItem && service.status !== 'COMPLETED' && (
                  <button onClick={() => deleteVendorItem(item.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {showAddItem && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Input placeholder="Part / item name" value={newItemDesc} autoFocus
                onChange={e => setNewItemDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVendorItem() } }}
                className="flex-1 h-7 text-xs" />
              <Input placeholder="₹ cost" type="number" min="0" value={newItemCost}
                onChange={e => setNewItemCost(e.target.value)}
                className="w-20 h-7 text-xs" />
              <Button type="button" size="sm" className="h-7 bg-feros-navy text-white text-xs px-2 shrink-0"
                disabled={!newItemDesc.trim() || addingItem} onClick={addVendorItem}>
                {addingItem ? '…' : 'Add'}
              </Button>
              <button type="button" onClick={() => { setShowAddItem(false); setNewItemDesc(''); setNewItemCost('') }}
                className="text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            </div>
          )}
          {(service.vendorItems ?? []).length === 0 && !showAddItem && (
            <p className="text-[10px] text-gray-300">No parts added yet</p>
          )}
        </div>
      )}

      {/* Documents */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Documents</p>
          {cfg.onOpenPdf && (
            <button onClick={() => cfg.onOpenPdf!(service.id)}
              className="flex items-center gap-1 text-[10px] text-feros-navy border border-feros-navy/30 rounded px-2 py-0.5 hover:bg-feros-navy/5">
              <Download size={9} /> PDF
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SmallDoc label="Estimate" url={service.estimateDocUrl} type="estimate" inputRef={estimateRef} />
          <SmallDoc label="Final Bill" url={service.billDocUrl} type="bill" inputRef={billRef} />
        </div>
      </div>
    </div>
  )
}

function ServiceCard({ service, cfg, isBreakdownService = false }: { service: BoardService; cfg: ServiceBoardConfig; isBreakdownService?: boolean; }) {
  const [expanded, setExpanded] = useState(true)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const allClosed = service.tasks.length > 0 && service.tasks.every(t => t.status === 'MECHANIC_CLOSED' || t.status === 'COMPLETED')
  const isExternal = service.serviceType === 'THIRD_PARTY' || service.serviceType === 'OEM_CENTER'
  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', isBreakdownService && 'border-l-4 border-l-orange-300')}>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2.5 min-w-0">
          {expanded ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
          <Wrench size={14} className="text-feros-navy shrink-0" />
          <span className="font-semibold text-sm text-gray-900">{service.assetName}</span>
          {service.serviceNumber && <span className="text-xs text-gray-400 font-mono">{service.serviceNumber}</span>}
          {serviceStatusChip(service.status)}
          {service.serviceTypeLabel && <span className="text-xs text-gray-400 capitalize">{service.serviceTypeLabel}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
          {service.status !== 'COMPLETED' && (
            <>
              {!isExternal && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddTaskOpen(true)}><Plus size={11} /> Add Task</Button>
              )}
              <Button size="sm" variant={allClosed ? 'default' : 'outline'} className={cn('h-7 text-xs', allClosed && 'bg-green-600 hover:bg-green-700 border-green-600')} onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 size={12} className="mr-1" />Complete
              </Button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Context strip — location, vendor, date, notes */}
          {(service.location || service.vendorName || service.serviceDate || service.notes || service.triggeredBy) && (
            <div className="px-4 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-100">
              {service.triggeredBy && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Wrench size={10} className="shrink-0" />
                  {service.triggeredBy.replace(/_/g, ' ')}
                </span>
              )}
              {service.serviceDate && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar size={10} className="shrink-0" />{fmtDate(service.serviceDate)}
                </span>
              )}
              {service.location && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin size={10} className="shrink-0" />{service.location}
                </span>
              )}
              {service.vendorName && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Store size={10} className="shrink-0" />{service.vendorName}
                </span>
              )}
              {service.notes && (
                <span className="flex items-center gap-1 text-xs text-gray-500 w-full">
                  <StickyNote size={10} className="shrink-0" />{service.notes}
                </span>
              )}
            </div>
          )}
          <div className="px-4 py-3">
            {service.tasks.length === 0 ? <p className="text-xs text-gray-400 py-1">No tasks on this service</p>
              : service.tasks.map(task => <TaskRow key={task.id} task={task} serviceId={service.id} cfg={cfg} isExternal={isExternal} />)}
          </div>
          <ServiceInlineDocs service={service} cfg={cfg} />
        </div>
      )}
      {completeOpen && <CompleteServiceDialog serviceId={service.id} cfg={cfg} onClose={() => setCompleteOpen(false)} />}
      {addTaskOpen && <AddTaskDialog serviceId={service.id} cfg={cfg} onClose={() => setAddTaskOpen(false)} />}
    </div>
  )
}

// ── Breakdown Card ──────────────────────────────────────────────────────────────
function BreakdownCard({ breakdown, cfg }: { breakdown: BoardBreakdown; cfg: ServiceBoardConfig }) {
  const statusCls: Record<string, string> = {
    REPORTED: 'bg-red-50 text-red-700', IN_REPAIR: 'bg-amber-50 text-amber-700',
    RESOLVED: 'bg-green-50 text-green-700', VEHICLE_REPLACED: 'bg-gray-100 text-gray-500',
  }
  return (
    <div className="space-y-2">
      <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900">{breakdown.assetName}</span>
              {breakdown.status && <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusCls[breakdown.status] ?? 'bg-gray-100 text-gray-600')}>{breakdown.status.replace(/_/g, ' ')}</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {breakdown.typeLabel}{breakdown.typeLabel && ' · '}{fmtDate(breakdown.date)}{breakdown.location && ` · ${breakdown.location}`}
            </p>
            {breakdown.reason && (
              <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
                <span className="font-medium text-gray-500">Description: </span>{breakdown.reason}
              </p>
            )}
            {breakdown.notes && (
              <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">
                <span className="font-medium">Notes: </span>{breakdown.notes}
              </p>
            )}
          </div>
        </div>
        {!breakdown.service && (
          <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => cfg.onLogService(breakdown)}><Wrench size={12} className="mr-1" />Log Service</Button>
        )}
      </div>
      {breakdown.service ? (
        <div className="ml-5"><ServiceCard service={breakdown.service} cfg={cfg} isBreakdownService /></div>
      ) : (
        <div className="ml-5 py-2">
          <p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-4 h-px bg-gray-300 inline-block" />No service logged yet — click <strong>Log Service</strong> to start repairs</p>
        </div>
      )}
    </div>
  )
}

// ── Board ───────────────────────────────────────────────────────────────────────
export function ServiceBoard({ data, cfg }: {
  data: { breakdowns: BoardBreakdown[]; generalServices: BoardService[]; technicianCount: number }
  cfg: ServiceBoardConfig
}) {
  const [tab, setTab] = useState<'breakdowns' | 'services'>('breakdowns')
  const breakdownCount = data.breakdowns.length
  const serviceCount = data.generalServices.length
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{cfg.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cfg.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-medium"><AlertTriangle size={13} /> {breakdownCount} breakdowns</span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium"><Wrench size={13} /> {serviceCount} services</span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium"><User size={13} /> {data.technicianCount} technicians</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex">
          {([
            { key: 'breakdowns', label: 'Breakdowns', count: breakdownCount, icon: AlertTriangle },
            { key: 'services', label: 'General Services', count: serviceCount, icon: Wrench },
          ] as const).map(({ key, label, count, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn('flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === key ? 'border-feros-navy text-feros-navy' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              <Icon size={14} />{label}
              <span className={cn('inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-xs font-bold px-1', tab === key ? 'bg-feros-navy text-white' : 'bg-gray-100 text-gray-600')}>{count}</span>
            </button>
          ))}
        </div>
        <div className="pb-1">
          {tab === 'breakdowns' && cfg.reportBreakdownSlot}
          {tab === 'services' && cfg.onCreateGeneralService && (
            <Button size="sm" onClick={cfg.onCreateGeneralService} className="h-8 text-xs bg-feros-navy hover:bg-feros-navy/90 text-white">
              <Plus size={12} className="mr-1" /> New Service
            </Button>
          )}
        </div>
      </div>

      {tab === 'breakdowns' ? (
        <div className="space-y-4">
          {data.breakdowns.length === 0
            ? <div className="flex flex-col items-center justify-center py-16 text-gray-400"><CheckCircle2 size={36} className="mb-3 opacity-30" /><p className="text-sm">No active breakdowns</p></div>
            : data.breakdowns.map(bd => <BreakdownCard key={bd.id} breakdown={bd} cfg={cfg} />)}
        </div>
      ) : (
        <div className="space-y-4">
          {data.generalServices.length === 0
            ? <div className="flex flex-col items-center justify-center py-16 text-gray-400"><Clock size={36} className="mb-3 opacity-30" /><p className="text-sm">No general services</p></div>
            : data.generalServices.map(s => <ServiceCard key={s.id} service={s} cfg={cfg} />)}
        </div>
      )}
    </div>
  )
}
