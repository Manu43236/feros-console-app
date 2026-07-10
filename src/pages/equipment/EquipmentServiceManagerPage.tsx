import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Wrench, Plus, Calendar, MapPin, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { equipmentApi } from '@/api/equipment'
import type { Equipment, EquipmentBreakdown, EquipmentServiceRecord } from '@/api/equipment'
import { ServiceDialog } from './MachineDetailPage'
import { ReportBreakdownDialog } from './BreakdownTab'
import { EquipmentServiceCard } from './EquipmentServiceCard'

function fmtDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const BD_PILL: Record<string, { label: string; cls: string }> = {
  REPORTED:  { label: '⚠ Open',       cls: 'bg-red-50 text-red-600 border-red-200' },
  IN_REPAIR: { label: '🔧 In Repair', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  RESOLVED:  { label: '✓ Resolved',   cls: 'bg-green-50 text-green-700 border-green-200' },
}

type ServiceTarget = { equipmentId: number; currentHmr: number | null; editing: EquipmentServiceRecord | null }

export function EquipmentServiceManagerPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'breakdowns' | 'services'>('breakdowns')
  const [reportOpen, setReportOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickMachine, setPickMachine] = useState<number | null>(null)
  const [serviceTarget, setServiceTarget] = useState<ServiceTarget | null>(null)

  const { data: machinesRes } = useQuery({ queryKey: ['equipment'], queryFn: equipmentApi.getAll })
  const machines: Equipment[] = (machinesRes?.data ?? []) as Equipment[]

  const { data: bdRes, isLoading: bdLoading } = useQuery({
    queryKey: ['eq-breakdowns', 'all'], queryFn: equipmentApi.getAllBreakdowns,
  })
  const breakdowns: EquipmentBreakdown[] = (bdRes?.data ?? []) as EquipmentBreakdown[]

  const { data: svcRes, isLoading: svcLoading } = useQuery({
    queryKey: ['eq-services', 'all'], queryFn: equipmentApi.getAllServices,
  })
  const services: EquipmentServiceRecord[] = (svcRes?.data ?? []) as EquipmentServiceRecord[]

  const openBreakdowns = breakdowns.filter(b => b.status !== 'RESOLVED').length
  const activeServices = services.filter(s => s.status !== 'COMPLETED').length

  const machineHmr = (id: number) => {
    const m = machines.find(x => x.id === id)
    return m?.currentMeterReading != null ? Number(m.currentMeterReading) : null
  }
  const machineOptions = machines.map(m => ({
    id: m.id,
    label: `${m.makeName} ${m.modelName}${m.serialNumber ? ` · ${m.serialNumber}` : ''}`,
  }))

  const resolveMut = useMutation({
    mutationFn: (b: EquipmentBreakdown) => equipmentApi.resolveBreakdown(b.equipmentId, b.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-breakdowns'] }); qc.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Breakdown resolved')
    },
    onError: () => toast.error('Failed to resolve'),
  })

  function logServiceFor(equipmentId: number) {
    setServiceTarget({ equipmentId, currentHmr: machineHmr(equipmentId), editing: null })
  }
  function confirmNewService() {
    if (!pickMachine) { toast.error('Select a machine'); return }
    const id = pickMachine
    setPickerOpen(false); setPickMachine(null)
    setServiceTarget({ equipmentId: id, currentHmr: machineHmr(id), editing: null })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Equipment Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">Examine breakdowns and log machine services</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-medium">
            <AlertTriangle size={13} /> {openBreakdowns} breakdowns
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium">
            <Wrench size={13} /> {activeServices} services
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {([
          { key: 'breakdowns', label: 'Breakdowns',       count: openBreakdowns, icon: AlertTriangle },
          { key: 'services',   label: 'General Services', count: activeServices, icon: Wrench },
        ] as const).map(({ key, label, count, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === key ? 'border-feros-equip-sidebar text-feros-equip-sidebar' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <Icon size={14} /> {label}
            <span className={cn('inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-xs font-bold px-1',
              tab === key ? 'bg-feros-equip-sidebar text-white' : 'bg-gray-100 text-gray-600')}>{count}</span>
          </button>
        ))}
      </div>

      {/* Breakdowns */}
      {tab === 'breakdowns' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setReportOpen(true)}
              className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1.5">
              <Plus size={14} /> Report Breakdown
            </Button>
          </div>
          {bdLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2"><Clock size={15} /> Loading…</div>
          ) : breakdowns.length === 0 ? (
            <div className="py-12 text-center text-gray-400"><CheckCircle2 size={32} className="mx-auto mb-3 text-gray-200" /><p className="text-sm font-medium text-gray-500">No breakdowns</p></div>
          ) : breakdowns.map(b => {
            const pill = BD_PILL[b.status] ?? { label: b.status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
            const isOpen = b.status !== 'RESOLVED'
            const openService = isOpen ? services.find(s => s.equipmentId === b.equipmentId && s.status !== 'COMPLETED') : undefined
            return (
              <div key={b.id} className="space-y-2">
                <div className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{b.equipmentName ?? b.equipmentIdentifier ?? 'Machine'}</span>
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', pill.cls)}>{pill.label}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1.5">{b.reason}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        <span><Calendar size={11} className="inline mr-1" />{fmtDate(b.breakdownDate)}</span>
                        {b.location && <span><MapPin size={11} className="inline mr-1" />{b.location}</span>}
                        {b.reportedByName && <span>By {b.reportedByName}</span>}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {!openService && (
                          <Button size="sm" onClick={() => logServiceFor(b.equipmentId)}
                            className="h-7 text-xs bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1"><Wrench size={12} /> Log Service</Button>
                        )}
                        <Button size="sm" variant="outline" disabled={resolveMut.isPending}
                          onClick={() => resolveMut.mutate(b)} className="h-7 text-xs">Resolve</Button>
                      </div>
                    )}
                  </div>
                </div>
                {openService && <EquipmentServiceCard service={openService} />}
              </div>
            )
          })}
        </div>
      )}

      {/* General Services */}
      {tab === 'services' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPickerOpen(true)}
              className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1.5">
              <Plus size={14} /> New Service
            </Button>
          </div>
          {svcLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2"><Clock size={15} /> Loading…</div>
          ) : services.length === 0 ? (
            <div className="py-12 text-center text-gray-400"><Wrench size={32} className="mx-auto mb-3 text-gray-200" /><p className="text-sm font-medium text-gray-500">No services</p></div>
          ) : services.map(s => <EquipmentServiceCard key={s.id} service={s} />)}
        </div>
      )}

      {/* Dialogs */}
      <ReportBreakdownDialog open={reportOpen} onClose={() => setReportOpen(false)} machines={machineOptions} />

      <Dialog open={pickerOpen} onOpenChange={o => !o && setPickerOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Service — Select Machine</DialogTitle></DialogHeader>
          <div>
            <Label>Machine <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={pickMachine != null ? String(pickMachine) : ''}
              onValueChange={v => setPickMachine(Number(v))}
              options={machineOptions.map(m => ({ value: String(m.id), label: m.label }))}
              placeholder="Select machine"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setPickerOpen(false); setPickMachine(null) }}>Cancel</Button>
            <Button size="sm" onClick={confirmNewService} className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white">Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {serviceTarget && (
        <ServiceDialog
          open={!!serviceTarget}
          onClose={() => { setServiceTarget(null); qc.invalidateQueries({ queryKey: ['eq-services'] }) }}
          equipmentId={serviceTarget.equipmentId}
          editing={serviceTarget.editing}
          currentHmr={serviceTarget.currentHmr}
        />
      )}
    </div>
  )
}
