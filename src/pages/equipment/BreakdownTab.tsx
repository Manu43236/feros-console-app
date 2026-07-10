import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Plus, Wrench, Calendar, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { equipmentApi } from '@/api/equipment'
import type { EquipmentBreakdown } from '@/api/equipment'
import { ServiceDialog } from './MachineDetailPage'

function fmtDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  REPORTED:  { label: '⚠ Open',       cls: 'bg-red-50 text-red-600 border-red-200' },
  IN_REPAIR: { label: '🔧 In Repair', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  RESOLVED:  { label: '✓ Resolved',   cls: 'bg-green-50 text-green-700 border-green-200' },
}

export function ReportBreakdownDialog({ open, onClose, equipmentId, machines }: {
  open: boolean; onClose: () => void
  equipmentId?: number
  machines?: { id: number; label: string }[]
}) {
  const qc = useQueryClient()
  const [machineId, setMachineId] = useState<number | null>(equipmentId ?? null)
  const [reason, setReason] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const targetId = equipmentId ?? machineId

  const mut = useMutation({
    mutationFn: () => equipmentApi.reportBreakdown(targetId!, { reason, location: location || null, notes: notes || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-breakdowns'] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Breakdown reported — machine marked Breakdown')
      setReason(''); setLocation(''); setNotes(''); if (!equipmentId) setMachineId(null)
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to report breakdown'),
  })

  function submit() {
    if (!targetId) { toast.error('Select a machine'); return }
    if (!reason.trim()) { toast.error('Reason is required'); return }
    mut.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Report Breakdown</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {machines && (
            <div>
              <Label>Machine <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={machineId != null ? String(machineId) : ''}
                onValueChange={v => setMachineId(Number(v))}
                options={machines.map(m => ({ value: String(m.id), label: m.label }))}
                placeholder="Select machine"
              />
            </div>
          )}
          <div>
            <Label>Reason <span className="text-red-500">*</span></Label>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder="What happened?"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-feros-equip-sidebar"
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Where is the machine?" className="mt-1" />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={mut.isPending}
            className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white">
            {mut.isPending ? 'Reporting…' : 'Report Breakdown'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BreakdownTab({ equipmentId, currentHmr }: { equipmentId: number; currentHmr?: number | null }) {
  const qc = useQueryClient()
  const [reportOpen, setReportOpen] = useState(false)
  const [serviceOpen, setServiceOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['eq-breakdowns', equipmentId],
    queryFn: () => equipmentApi.getBreakdowns(equipmentId),
  })
  const breakdowns = (data?.data ?? []) as EquipmentBreakdown[]

  const resolveMut = useMutation({
    mutationFn: (id: number) => equipmentApi.resolveBreakdown(equipmentId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-breakdowns'] })
      qc.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Breakdown resolved')
    },
    onError: () => toast.error('Failed to resolve'),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setReportOpen(true)}
          className="bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1.5 h-9 text-xs">
          <Plus size={13} /> Report Breakdown
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
      ) : breakdowns.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">No breakdowns recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {breakdowns.map(b => {
            const pill = STATUS_PILL[b.status] ?? { label: b.status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
            const isOpen = b.status === 'REPORTED'
            return (
              <div key={b.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', pill.cls)}>{pill.label}</span>
                    <p className="text-sm text-gray-700 mt-1.5">{b.reason}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      <span><Calendar size={11} className="inline mr-1" />{fmtDate(b.breakdownDate)}</span>
                      {b.location && <span><MapPin size={11} className="inline mr-1" />{b.location}</span>}
                      {b.reportedByName && <span>By {b.reportedByName}</span>}
                      {b.status === 'RESOLVED' && b.resolvedAt && <span>Resolved {fmtDate(b.resolvedAt)}</span>}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" onClick={() => setServiceOpen(true)}
                        className="h-7 text-xs bg-[#1C1400] hover:bg-[#1C1400]/90 text-white gap-1">
                        <Wrench size={12} /> Start Service
                      </Button>
                      <Button size="sm" variant="outline" disabled={resolveMut.isPending}
                        onClick={() => resolveMut.mutate(b.id)}
                        className="h-7 text-xs">
                        Resolve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ReportBreakdownDialog open={reportOpen} onClose={() => setReportOpen(false)} equipmentId={equipmentId} />
      <ServiceDialog open={serviceOpen} onClose={() => setServiceOpen(false)} equipmentId={equipmentId} editing={null} currentHmr={currentHmr} />
    </div>
  )
}
