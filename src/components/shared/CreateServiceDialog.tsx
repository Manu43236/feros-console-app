import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wrench, Plus, X } from 'lucide-react'
import { vehicleServicesApi } from '@/api/vehicles'
import { globalMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import { getApiError } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { MasterItem } from '@/types'

interface TaskDraft {
  taskTypeId?: number
  customName?: string
  isRecurring: boolean
  frequencyKm?: number
  cost?: number
}

interface Props {
  vehicleId: number
  vehicleReg: string
  breakdownId?: number
  currentOdometer?: number
  open: boolean
  onClose: () => void
  /** Called after a successful creation — use to invalidate extra queries */
  onSuccess?: () => void
}

export function CreateServiceDialog({
  vehicleId, vehicleReg, breakdownId, currentOdometer, open, onClose, onSuccess,
}: Props) {
  const qc = useQueryClient()

  const [triggeredBy,         setTriggeredBy]         = useState<string>(breakdownId ? 'BREAKDOWN' : 'SCHEDULED')
  const [serviceType,         setServiceType]         = useState<'INTERNAL' | 'THIRD_PARTY' | 'OEM_CENTER'>('INTERNAL')
  const [payerType,           setPayerType]           = useState<string>('OWN_EXPENSE')
  const [vendorName,          setVendorName]          = useState('')
  const [location,            setLocation]            = useState('')
  const [serviceDate,         setServiceDate]         = useState('')
  const [odometer,            setOdometer]            = useState(currentOdometer ? String(currentOdometer) : '')
  const [notes,               setNotes]               = useState('')
  const [dueAtOdometer,       setDueAtOdometer]       = useState('')
  const [insuranceClaimNo,    setInsuranceClaimNo]    = useState('')
  const [insuranceClaimAmt,   setInsuranceClaimAmt]   = useState('')
  const [certificateNumber,   setCertificateNumber]   = useState('')
  const [certificateValidUntil, setCertificateValidUntil] = useState('')
  const [isEscalated,         setIsEscalated]         = useState(false)
  const [selectedTaskIds,     setSelectedTaskIds]     = useState<Set<number>>(new Set())
  const [taskDrafts,          setTaskDrafts]          = useState<Record<string | number, TaskDraft>>({})
  const [customTasks,         setCustomTasks]         = useState<TaskDraft[]>([])
  const [showCustom,          setShowCustom]          = useState(false)
  const [customTaskName,      setCustomTaskName]      = useState('')

  const { data: taskTypesRes } = useQuery({
    queryKey: ['service-task-types'],
    queryFn: globalMastersApi.getServiceTaskTypes,
  })
  const taskTypes: MasterItem[] = taskTypesRes?.data ?? []

  const mutation = useMutation({
    mutationFn: (data: unknown) => vehicleServicesApi.create(data),
    onSuccess: () => {
      toast.success('Service created')
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      qc.invalidateQueries({ queryKey: ['vehicle-breakdowns-history', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      onSuccess?.()
      handleClose()
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed to create service') ?? 'Failed to create service'),
  })

  function handleClose() {
    setTriggeredBy(breakdownId ? 'BREAKDOWN' : 'SCHEDULED')
    setServiceType('INTERNAL'); setPayerType('OWN_EXPENSE')
    setVendorName(''); setLocation('')
    setServiceDate(''); setOdometer(currentOdometer ? String(currentOdometer) : '')
    setNotes(''); setDueAtOdometer('')
    setInsuranceClaimNo(''); setInsuranceClaimAmt('')
    setCertificateNumber(''); setCertificateValidUntil('')
    setIsEscalated(false)
    setSelectedTaskIds(new Set()); setTaskDrafts({}); setCustomTasks([])
    setShowCustom(false); setCustomTaskName('')
    onClose()
  }

  function toggleTask(id: number) {
    setSelectedTaskIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id); setTaskDrafts(d => { const n = { ...d }; delete n[id]; return n }) }
      else { s.add(id); setTaskDrafts(d => ({ ...d, [id]: { taskTypeId: id, isRecurring: false } })) }
      return s
    })
  }

  function updateDraft(id: number | string, patch: Partial<TaskDraft>) {
    setTaskDrafts(d => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } as TaskDraft }))
  }

  function addCustomTask() {
    if (!customTaskName.trim()) return
    setCustomTasks(c => [...c, { customName: customTaskName.trim(), isRecurring: false }])
    setCustomTaskName('')
  }

  function removeCustomTask(i: number) {
    setCustomTasks(c => c.filter((_, j) => j !== i))
  }

  function buildTasks() {
    const masterTasks = Array.from(selectedTaskIds).map(id => taskDrafts[id] ?? { taskTypeId: id, isRecurring: false })
    return [...masterTasks, ...customTasks]
  }

  function handleSubmit() {
    const tasks = buildTasks()
    if (tasks.length === 0) { toast.error('Add at least one task'); return }
    if (payerType === 'INSURANCE' && !insuranceClaimNo.trim()) {
      toast.error('Insurance claim number is required'); return
    }
    if (triggeredBy === 'COMPLIANCE' && !certificateNumber.trim()) {
      toast.error('Certificate number is required for compliance service'); return
    }
    mutation.mutate({
      vehicleId,
      triggeredBy,
      breakdownId: breakdownId ?? null,
      serviceType,
      payerType,
      vendorName: serviceType === 'INTERNAL' ? (vendorName || 'Self') : vendorName,
      location: location || null,
      serviceDate: serviceDate || null,
      odometer: odometer ? Number(odometer) : null,
      dueAtOdometer: dueAtOdometer ? Number(dueAtOdometer) : null,
      notes: notes || null,
      insuranceClaimNo:     payerType === 'INSURANCE' ? insuranceClaimNo || null : null,
      insuranceClaimAmt:    payerType === 'INSURANCE' && insuranceClaimAmt ? Number(insuranceClaimAmt) : null,
      certificateNumber:    triggeredBy === 'COMPLIANCE' ? certificateNumber || null : null,
      certificateValidUntil: triggeredBy === 'COMPLIANCE' ? certificateValidUntil || null : null,
      isEscalated,
      tasks: tasks.map(t => ({
        taskTypeId:  t.taskTypeId ?? null,
        customName:  t.customName ?? null,
        isRecurring: t.isRecurring,
        frequencyKm: t.isRecurring && t.frequencyKm ? Number(t.frequencyKm) : null,
        cost:        t.cost ? Number(t.cost) : null,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={16} className="text-feros-navy" /> New Service
          </DialogTitle>
          <p className="text-xs text-gray-400 font-mono">{vehicleReg}</p>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Triggered By — hidden when breakdownId is pre-set */}
          {!breakdownId && (
            <div className="space-y-1.5">
              <Label>Reason / Trigger <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'SCHEDULED',  label: '📅 Scheduled' },
                  { v: 'BREAKDOWN',  label: '⚡ Breakdown' },
                  { v: 'ACCIDENT',   label: '💥 Accident' },
                  { v: 'COMPLIANCE', label: '📋 Compliance' },
                  { v: 'WARRANTY',   label: '🔒 Warranty' },
                ] as const).map(({ v, label }) => (
                  <button key={v} type="button"
                    onClick={() => {
                      setTriggeredBy(v)
                      if (v === 'WARRANTY')   { setServiceType('OEM_CENTER');  setPayerType('WARRANTY_OEM') }
                      if (v === 'COMPLIANCE') { setServiceType('THIRD_PARTY'); setPayerType('OWN_EXPENSE') }
                      if (v === 'ACCIDENT')   { setServiceType('THIRD_PARTY'); setPayerType('OWN_EXPENSE') }
                      if (v === 'SCHEDULED')  { setServiceType('INTERNAL');    setPayerType('OWN_EXPENSE') }
                      if (v === 'BREAKDOWN')  { setServiceType('INTERNAL');    setPayerType('OWN_EXPENSE') }
                    }}
                    className={cn('py-2 rounded-lg border-2 text-xs font-medium transition-colors',
                      triggeredBy === v
                        ? 'border-feros-navy bg-feros-navy/5 text-feros-navy'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Service Location Type */}
          <div className="space-y-1.5">
            <Label>Service Location <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'INTERNAL',    label: '🏭 Internal' },
                { v: 'THIRD_PARTY', label: '🔧 3rd Party' },
                { v: 'OEM_CENTER',  label: '🏢 OEM Center' },
              ] as const).map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setServiceType(v)}
                  className={cn('py-2 rounded-lg border-2 text-xs font-medium transition-colors',
                    serviceType === v
                      ? 'border-feros-navy bg-feros-navy/5 text-feros-navy'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Payer Type */}
          <div className="space-y-1.5">
            <Label>Who Pays? <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'OWN_EXPENSE',  label: '💰 Own Expense' },
                { v: 'WARRANTY_OEM', label: '🔒 OEM Warranty' },
                { v: 'WARRANTY_ANC', label: '🔐 ANC Warranty' },
                { v: 'INSURANCE',    label: '🏦 Insurance' },
                { v: 'AMC',          label: '📄 AMC' },
              ] as const).map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setPayerType(v)}
                  className={cn('py-2 rounded-lg border-2 text-xs font-medium transition-colors',
                    payerType === v
                      ? 'border-feros-navy bg-feros-navy/5 text-feros-navy'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Vendor Name */}
          {serviceType !== 'INTERNAL' && (
            <div className="space-y-1.5">
              <Label>{serviceType === 'OEM_CENTER' ? 'OEM Service Center Name' : 'Vendor / Workshop Name'}</Label>
              <Input
                placeholder={serviceType === 'OEM_CENTER' ? 'e.g. TATA Motors Service, Vizag' : 'e.g. Raju Tyre Works'}
                value={vendorName} onChange={e => setVendorName(e.target.value)}
              />
            </div>
          )}

          {/* Insurance fields */}
          {payerType === 'INSURANCE' && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-lg p-3">
              <div className="space-y-1.5">
                <Label>Claim Number <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. CLM/2026/001234" value={insuranceClaimNo} onChange={e => setInsuranceClaimNo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Claim Amount (₹)</Label>
                <Input type="number" placeholder="0" value={insuranceClaimAmt} onChange={e => setInsuranceClaimAmt(e.target.value)} />
              </div>
            </div>
          )}

          {/* Compliance fields */}
          {triggeredBy === 'COMPLIANCE' && (
            <div className="grid grid-cols-2 gap-3 bg-purple-50 rounded-lg p-3">
              <div className="space-y-1.5">
                <Label>Certificate Number <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. FC/AP/2026/00123" value={certificateNumber} onChange={e => setCertificateNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Until</Label>
                <Input type="date" value={certificateValidUntil} onChange={e => setCertificateValidUntil(e.target.value)} />
              </div>
            </div>
          )}

          {/* Escalation */}
          {serviceType === 'THIRD_PARTY' && triggeredBy === 'BREAKDOWN' && (
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isEscalated} onChange={e => setIsEscalated(e.target.checked)}
                className="w-4 h-4 accent-feros-navy" />
              Internal mechanic could not fix — escalated to 3rd party
            </label>
          )}

          <div className="space-y-1.5">
            <Label>Location <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="e.g. Vizag highway, Depot yard" value={location} onChange={e => setLocation(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Service Date</Label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Odometer (km)</Label>
              <Input type="number" placeholder="42300" value={odometer} onChange={e => setOdometer(e.target.value)} />
            </div>
          </div>

          {!breakdownId && triggeredBy === 'SCHEDULED' && (
            <div className="space-y-1.5">
              <Label>Due At Odometer <span className="text-gray-400 font-normal">(km)</span></Label>
              <Input type="number" placeholder="45000" value={dueAtOdometer} onChange={e => setDueAtOdometer(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="Any additional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            <Label>Tasks <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <select
                value=""
                onChange={e => { if (e.target.value) toggleTask(Number(e.target.value)) }}
                className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-feros-navy/20 focus:border-feros-navy"
              >
                <option value="">+ Select a task…</option>
                {taskTypes.filter(t => !selectedTaskIds.has(t.id)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs px-3 shrink-0"
                onClick={() => setShowCustom(v => !v)}>
                <Plus size={13} className="mr-1" /> Custom
              </Button>
            </div>

            {showCustom && (
              <div className="flex gap-2">
                <Input placeholder="Custom task name…" className="h-8 text-sm flex-1"
                  value={customTaskName} onChange={e => setCustomTaskName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTask())} />
                <Button type="button" size="sm" onClick={addCustomTask} className="h-8 bg-feros-navy text-white shrink-0">Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowCustom(false); setCustomTaskName('') }} className="h-8 shrink-0">✕</Button>
              </div>
            )}

            {(selectedTaskIds.size > 0 || customTasks.length > 0) && (
              <div className="space-y-2 pt-1">
                {Array.from(selectedTaskIds).map(id => {
                  const t = taskTypes.find(x => x.id === id)
                  const draft = taskDrafts[id]
                  return (
                    <div key={id} className="rounded-lg border border-feros-navy/20 bg-feros-navy/[0.03] px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-feros-navy">{t?.name}</span>
                        <button type="button" onClick={() => toggleTask(id)}
                          className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                          <X size={13} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Cost (₹)</p>
                          <Input type="number" placeholder="0" className="h-7 text-xs"
                            value={draft?.cost ?? ''}
                            onChange={e => updateDraft(id, { cost: e.target.value ? Number(e.target.value) : undefined })} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Recurring?</p>
                          <button type="button"
                            onClick={() => updateDraft(id, { isRecurring: !draft?.isRecurring })}
                            className={cn('h-7 w-full rounded-md border text-xs font-medium transition-colors',
                              draft?.isRecurring ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'
                            )}>
                            {draft?.isRecurring ? '🔄 Recurring' : 'One-time'}
                          </button>
                        </div>
                      </div>
                      {draft?.isRecurring && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Every (km)</p>
                          <Input type="number" placeholder="10000" className="h-7 text-xs"
                            value={draft?.frequencyKm ?? ''}
                            onChange={e => updateDraft(id, { frequencyKm: e.target.value ? Number(e.target.value) : undefined })} />
                        </div>
                      )}
                    </div>
                  )
                })}

                {customTasks.map((ct, i) => (
                  <div key={`custom-${i}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{ct.customName}</span>
                      <button type="button" onClick={() => removeCustomTask(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Cost (₹)</p>
                        <Input type="number" placeholder="0" className="h-7 text-xs"
                          value={ct.cost ?? ''}
                          onChange={e => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, cost: e.target.value ? Number(e.target.value) : undefined } : x))} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Recurring?</p>
                        <button type="button"
                          onClick={() => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, isRecurring: !x.isRecurring } : x))}
                          className={cn('h-7 w-full rounded-md border text-xs font-medium transition-colors',
                            ct.isRecurring ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500'
                          )}>
                          {ct.isRecurring ? '🔄 Recurring' : 'One-time'}
                        </button>
                      </div>
                    </div>
                    {ct.isRecurring && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Every (km)</p>
                        <Input type="number" placeholder="10000" className="h-7 text-xs"
                          value={ct.frequencyKm ?? ''}
                          onChange={e => setCustomTasks(c => c.map((x, j) => j === i ? { ...x, frequencyKm: e.target.value ? Number(e.target.value) : undefined } : x))} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Creating…' : 'Create Service'}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
