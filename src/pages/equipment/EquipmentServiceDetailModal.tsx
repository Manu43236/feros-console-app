import { useEffect, useRef, useState } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import {
  Wrench, MapPin, Calendar, IndianRupee, FileText,
  CheckCircle, Clock, Circle, Package, User, Play, CheckCircle2,
  Upload, Trash2, Plus, FileDown, Paperclip,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { equipmentApi, type EquipmentServiceRecord } from '@/api/equipment'
import { serviceManagerApi } from '@/api/serviceManager'
import { sparePartsApi } from '@/api/inventory'
import { globalMastersApi } from '@/api/masters'
import { AddTaskDialog, AssignTechnicianDialog, RequestPartDialog, type ServiceBoardConfig, type BoardTask } from '@/components/service/ServiceBoard'
import { EquipmentServicePdfDialog } from './EquipmentServicePdfDialog'
import { cn } from '@/lib/utils'

function calcDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  try {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
    if (mins < 1) return null
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  } catch { return null }
}
function fmtDt(d?: string | null) {
  if (!d) return null
  try { const p = parseISO(d); return isValid(p) ? format(p, 'dd MMM yyyy, hh:mm a') : null } catch { return null }
}
function fmtDate(d?: string | null) {
  if (!d) return null
  try { const p = parseISO(d); return isValid(p) ? format(p, 'dd MMM yyyy') : null } catch { return null }
}

interface TimelineEvent { label: string; sub?: string | null; done: boolean; active?: boolean }
function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-200" />
      <div className="space-y-5">
        {events.map((e, i) => (
          <div key={i} className="relative flex items-start gap-3">
            <div className={cn('absolute -left-6 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white shrink-0 mt-0.5',
              e.done && !e.active ? 'border-green-500' : e.active ? 'border-orange-400' : 'border-gray-200')}>
              {e.done && !e.active ? <CheckCircle size={12} className="text-green-500" />
                : e.active ? <Clock size={12} className="text-orange-400" /> : <Circle size={12} className="text-gray-200" />}
            </div>
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', e.done ? 'text-gray-800' : 'text-gray-400')}>{e.label}</p>
              {e.sub && <p className="text-xs text-gray-400 mt-0.5">{e.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function partChip(s: string) {
  const map: Record<string, string> = { REQUESTED: 'bg-yellow-50 text-yellow-700', APPROVED: 'bg-green-50 text-green-700', REJECTED: 'bg-red-50 text-red-700' }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
}

export function EquipmentServiceDetailModal({ service, open, onClose, onChanged }: {
  service: EquipmentServiceRecord | null
  open: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const [svc, setSvc] = useState<EquipmentServiceRecord | null>(service)
  const [estInput, setEstInput] = useState('')
  const [vendorDesc, setVendorDesc] = useState('')
  const [vendorCost, setVendorCost] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [assignTask, setAssignTask] = useState<BoardTask | null>(null)
  const [partTask, setPartTask] = useState<{ id: number; name: string } | null>(null)
  const estFileRef = useRef<HTMLInputElement>(null)
  const billFileRef = useRef<HTMLInputElement>(null)

  const manageable = !!service && service.status !== 'COMPLETED'
  const { data: techRes } = useQuery({ queryKey: ['sm-technicians'], queryFn: serviceManagerApi.getTechnicians, enabled: open && manageable })
  const { data: partsRes } = useQuery({ queryKey: ['spare-parts'], queryFn: sparePartsApi.getAll, enabled: open && manageable })
  const { data: taskTypesRes } = useQuery({ queryKey: ['equipment-service-task-types'], queryFn: globalMastersApi.getEquipmentServiceTaskTypes, enabled: open && manageable })

  useEffect(() => {
    setSvc(service)
    setEstInput(service?.estimatedCost != null ? String(service.estimatedCost) : '')
  }, [service])

  async function reload(id: number, serviceId: number) {
    const res = await equipmentApi.getServices(id)
    const fresh = (res.data ?? []).find(s => s.id === serviceId) ?? null
    if (fresh) { setSvc(fresh); setEstInput(fresh.estimatedCost != null ? String(fresh.estimatedCost) : '') }
    onChanged?.()
  }

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    if (!svc) return
    setBusy(true)
    try {
      await fn()
      await reload(svc.equipmentId, svc.id)
      toast.success(okMsg)
    } catch {
      toast.error('Something went wrong')
    } finally { setBusy(false) }
  }

  if (!svc) return null
  const parts = (svc.tasks ?? []).flatMap(t => t.parts ?? [])
  const isCompleted = svc.status === 'COMPLETED'
  const isInProgress = svc.status === 'IN_PROGRESS'

  const timelineEvents: TimelineEvent[] = [
    { label: 'Service Created', sub: fmtDt(svc.createdAt), done: true },
    { label: 'Work Started', sub: svc.startedAt ? fmtDt(svc.startedAt) : (isInProgress || isCompleted) ? 'Started' : null, done: isInProgress || isCompleted, active: isInProgress },
    { label: 'Completed', sub: svc.completedDate ? fmtDate(svc.completedDate) : null, done: isCompleted },
  ]
  const totalTaskCost = (svc.tasks ?? []).reduce((sum, t) => sum + (t.cost ?? 0), 0)
  const canManage = svc.status !== 'COMPLETED'

  const cfg: ServiceBoardConfig = {
    title: '', subtitle: '',
    technicians: techRes?.data ?? [],
    spareParts: partsRes?.data ?? [],
    taskTypes: taskTypesRes?.data ?? [],
    onAssign: (serviceId, taskId, mechanicId) => equipmentApi.assignTaskTechnician(svc.equipmentId, serviceId, taskId, mechanicId),
    onAddTask: (serviceId, body) => equipmentApi.addTask(svc.equipmentId, serviceId, body),
    onRequestPart: (serviceId, taskId, body) => equipmentApi.requestPart(svc.equipmentId, serviceId, { ...body, taskId }),
    onComplete: () => Promise.resolve(),
    onLogService: () => {},
    onChanged: () => { reload(svc.equipmentId, svc.id) },
  }

  const saveEstimate = () => run(
    () => equipmentApi.updateServiceCharges(svc.equipmentId, svc.id, estInput.trim() === '' ? null : Number(estInput)),
    'Estimated cost saved')

  const uploadDoc = (type: 'ESTIMATE' | 'BILL', file?: File) => {
    if (!file) return
    run(() => equipmentApi.addServiceAttachment(svc.equipmentId, svc.id, type, file), 'Document uploaded')
  }
  const deleteAttachment = (attId: number) =>
    run(() => equipmentApi.deleteServiceAttachment(svc.equipmentId, svc.id, attId), 'Attachment deleted')

  const addVendorItem = () => {
    if (!vendorDesc.trim()) { toast.error('Enter a description'); return }
    run(() => equipmentApi.addServiceVendorItem(svc.equipmentId, svc.id, vendorDesc.trim(), vendorCost.trim() === '' ? undefined : Number(vendorCost)),
      'Item added').then(() => { setVendorDesc(''); setVendorCost('') })
  }
  const deleteVendorItem = (itemId: number) =>
    run(() => equipmentApi.deleteServiceVendorItem(svc.equipmentId, svc.id, itemId), 'Item removed')

  const attachmentBlock = (label: string, type: 'ESTIMATE' | 'BILL', list: typeof svc.estimateAttachments, ref: React.RefObject<HTMLInputElement | null>) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <input ref={ref} type="file" className="hidden" onChange={e => { uploadDoc(type, e.target.files?.[0]); e.target.value = '' }} />
        <button disabled={busy} onClick={() => ref.current?.click()} className="text-xs text-feros-navy hover:underline flex items-center gap-1 disabled:opacity-50"><Upload size={11} /> Upload</button>
      </div>
      {(list ?? []).length === 0 ? <p className="text-xs text-gray-400">No documents</p> : (
        <div className="space-y-1">
          {(list ?? []).map((a, i) => (
            <div key={a.id ?? `legacy-${i}`} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
              <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-feros-navy hover:underline truncate">
                <Paperclip size={11} /> {a.label || `${label} ${i + 1}`}
              </a>
              {a.id != null && <button disabled={busy} onClick={() => deleteAttachment(a.id!)} className="text-gray-400 hover:text-red-500 disabled:opacity-50"><Trash2 size={12} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={16} className="text-feros-navy" />
            {svc.serviceNumber}
          </DialogTitle>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 mt-0.5">{svc.equipmentName ?? svc.equipmentIdentifier}</p>
            <button onClick={() => setPdfOpen(true)} className="text-xs text-feros-navy hover:underline flex items-center gap-1"><FileDown size={12} /> PDF</button>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <User size={13} className="text-gray-400 shrink-0" />
              <span>{svc.serviceType === 'INTERNAL' ? 'Internal (Self)' : svc.serviceType === 'OEM_CENTER' ? `OEM: ${svc.vendorName ?? 'Service Center'}` : svc.vendorName ?? '3rd Party'}</span>
            </div>
            {svc.payerType && svc.payerType !== 'OWN_EXPENSE' && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                  {svc.payerType === 'WARRANTY_OEM' ? 'OEM Warranty' : svc.payerType === 'WARRANTY_ANC' ? 'ANC Warranty' : svc.payerType === 'INSURANCE' ? 'Insurance' : svc.payerType === 'AMC' ? 'AMC Contract' : svc.payerType}
                </span>
              </div>
            )}
            {svc.isEscalated && (
              <div className="col-span-2"><span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700">⚠ Escalated from internal to 3rd party</span></div>
            )}
            {svc.location && <div className="flex items-center gap-2 text-gray-600"><MapPin size={13} className="text-gray-400 shrink-0" /><span>{svc.location}</span></div>}
            {svc.serviceDate && <div className="flex items-center gap-2 text-gray-600"><Calendar size={13} className="text-gray-400 shrink-0" /><span>{fmtDate(svc.serviceDate)}</span></div>}
            {svc.hmrAtService != null && <div className="flex items-center gap-2 text-gray-600"><span className="text-gray-400 text-xs shrink-0">HMR</span><span>{svc.hmrAtService.toLocaleString('en-IN')} hrs</span></div>}
            {svc.dueAtHmr != null && <div className="flex items-center gap-2 text-gray-600"><span className="text-gray-400 text-xs shrink-0">Due at</span><span>{svc.dueAtHmr.toLocaleString('en-IN')} hrs</span></div>}
          </div>

          {svc.payerType === 'INSURANCE' && (svc.insuranceClaimNo || svc.insuranceClaimAmt) && (
            <div className="bg-blue-50 rounded-lg px-3 py-2.5 text-sm space-y-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Insurance Claim</p>
              {svc.insuranceClaimNo && <p className="text-gray-700">Claim No: <span className="font-medium">{svc.insuranceClaimNo}</span></p>}
              {svc.insuranceClaimAmt != null && <p className="text-gray-700">Claim Amount: <span className="font-medium inline-flex items-center gap-0.5"><IndianRupee size={11} />{svc.insuranceClaimAmt.toLocaleString('en-IN')}</span></p>}
            </div>
          )}
          {svc.triggeredBy === 'COMPLIANCE' && (svc.certificateNumber || svc.certificateValidUntil) && (
            <div className="bg-purple-50 rounded-lg px-3 py-2.5 text-sm space-y-1">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Compliance Certificate</p>
              {svc.certificateNumber && <p className="text-gray-700">Certificate No: <span className="font-medium">{svc.certificateNumber}</span></p>}
              {svc.certificateValidUntil && <p className="text-gray-700">Valid Until: <span className="font-medium">{fmtDate(svc.certificateValidUntil)}</span></p>}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
            <Timeline events={timelineEvents} />
          </div>

          {(svc.tasks.length > 0 || canManage) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tasks</p>
                {canManage && (
                  <button onClick={() => setAddTaskOpen(true)} className="text-xs text-feros-navy hover:underline flex items-center gap-1"><Plus size={11} /> Add Task</button>
                )}
              </div>
              {svc.tasks.length === 0 && <p className="text-xs text-gray-400">No tasks yet</p>}
              <div className="space-y-2">
                {svc.tasks.map(t => {
                  const duration = calcDuration(t.mechanicStartedAt, t.mechanicClosedAt)
                  return (
                    <div key={t.id} className="py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', t.status === 'COMPLETED' ? 'bg-green-500' : t.status === 'MECHANIC_CLOSED' ? 'bg-purple-400' : 'bg-gray-300')} />
                          <span className="text-sm text-gray-700">{t.displayName}</span>
                          {t.isRecurring && t.frequencyHmr && <span className="text-xs text-gray-400">🔄 {t.frequencyHmr.toLocaleString('en-IN')} hrs</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {duration && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{duration}</span>}
                          {(t.cost ?? 0) > 0 && <span className="text-sm text-gray-600 flex items-center gap-0.5"><IndianRupee size={11} />{t.cost?.toLocaleString('en-IN')}</span>}
                        </div>
                      </div>
                      {(t.assignedMechanicName || t.mechanicStartedAt || t.mechanicClosedAt) && (
                        <div className="mt-1 ml-3.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {t.assignedMechanicName && <span className="flex items-center gap-1 text-xs text-gray-500"><User size={10} className="text-gray-400" /> {t.assignedMechanicName}</span>}
                          {t.mechanicStartedAt && <span className="flex items-center gap-1 text-xs text-blue-500"><Play size={9} /> {fmtDt(t.mechanicStartedAt)}</span>}
                          {t.mechanicClosedAt && <span className="flex items-center gap-1 text-xs text-purple-500"><CheckCircle2 size={9} /> {fmtDt(t.mechanicClosedAt)}</span>}
                        </div>
                      )}
                      {canManage && (
                        <div className="mt-1.5 ml-3.5 flex items-center gap-3">
                          <button onClick={() => setAssignTask({ id: t.id, displayName: t.displayName ?? '', status: t.status, assignedMechanicId: t.assignedMechanicId })}
                            className="text-xs text-feros-navy hover:underline">{t.assignedMechanicId ? 'Reassign' : 'Assign'}</button>
                          <button onClick={() => setPartTask({ id: t.id, name: t.displayName ?? 'Task' })}
                            className="text-xs text-feros-navy hover:underline">Request Part</button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {totalTaskCost > 0 && (
                  <div className="flex justify-between pt-1 text-sm font-semibold text-gray-800">
                    <span>Task Cost</span>
                    <span className="flex items-center gap-0.5 text-green-700"><IndianRupee size={12} />{totalTaskCost.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package size={12} /> Parts Used
              {parts.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">{parts.length}</span>}
            </p>
            {parts.length === 0 ? <p className="text-xs text-gray-400">No parts used</p> : (
              <div className="space-y-1.5">
                {parts.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{p.sparePartName}</span>
                      <span className="text-xs text-gray-400">{p.quantityRequested} {p.unit ?? ''}</span>
                      {partChip(p.status)}
                    </div>
                    {p.status === 'REJECTED' && p.rejectionReason && <span className="text-xs text-red-500 max-w-[150px] truncate">{p.rejectionReason}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Cost ─────────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><IndianRupee size={12} /> Cost</p>
            <div className="flex items-end gap-2">
              <label className="flex-1 text-xs text-gray-500">
                Estimated / Labour cost
                <input type="number" value={estInput} onChange={e => setEstInput(e.target.value)} placeholder="0"
                  className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
              </label>
              <Button size="sm" variant="outline" disabled={busy} onClick={saveEstimate}>Save</Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 rounded px-2 py-1.5">
                <p className="text-[11px] text-gray-400">Total (est.)</p>
                <p className="font-semibold text-gray-800 flex items-center gap-0.5"><IndianRupee size={11} />{(svc.totalCost ?? 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-gray-50 rounded px-2 py-1.5">
                <p className="text-[11px] text-gray-400">Actual bill</p>
                <p className="font-semibold text-blue-700 flex items-center gap-0.5"><IndianRupee size={11} />{svc.completedCost != null ? svc.completedCost.toLocaleString('en-IN') : '—'}</p>
              </div>
            </div>
          </div>

          {/* ── Vendor items ─────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Vendor / External Items</p>
            {(svc.vendorItems ?? []).length > 0 && (
              <div className="space-y-1 mb-2">
                {(svc.vendorItems ?? []).map(i => (
                  <div key={i.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
                    <span className="text-gray-700 truncate">{i.description}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-600 flex items-center gap-0.5"><IndianRupee size={11} />{(i.cost ?? 0).toLocaleString('en-IN')}</span>
                      <button disabled={busy} onClick={() => deleteVendorItem(i.id)} className="text-gray-400 hover:text-red-500 disabled:opacity-50"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input value={vendorDesc} onChange={e => setVendorDesc(e.target.value)} placeholder="Description"
                className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm" />
              <input type="number" value={vendorCost} onChange={e => setVendorCost(e.target.value)} placeholder="Cost"
                className="w-24 border border-gray-200 rounded px-2 py-1.5 text-sm" />
              <Button size="sm" variant="outline" disabled={busy} onClick={addVendorItem}><Plus size={14} /></Button>
            </div>
          </div>

          {/* ── Attachments ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><FileText size={12} /> Documents</p>
            {attachmentBlock('Estimate', 'ESTIMATE', svc.estimateAttachments, estFileRef)}
            {attachmentBlock('Bill', 'BILL', svc.billAttachments, billFileRef)}
          </div>

          {svc.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1.5"><FileText size={12} /> Notes</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{svc.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <EquipmentServicePdfDialog service={pdfOpen ? svc : null} onClose={() => setPdfOpen(false)} />
    {addTaskOpen && <AddTaskDialog serviceId={svc.id} cfg={cfg} onClose={() => setAddTaskOpen(false)} />}
    {assignTask && <AssignTechnicianDialog task={assignTask} serviceId={svc.id} cfg={cfg} onClose={() => setAssignTask(null)} />}
    {partTask && <RequestPartDialog serviceId={svc.id} taskId={partTask.id} taskName={partTask.name} cfg={cfg} onClose={() => setPartTask(null)} />}
    </>
  )
}
