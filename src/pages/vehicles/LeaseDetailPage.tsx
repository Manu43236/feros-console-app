import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vehicleLeasesApi } from '@/api/vehicleLeases'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import { clientsApi } from '@/api/clients'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Truck, CalendarDays, MapPin,
  X, Receipt, User, Gauge, Building2, Clock, Play, Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useAuthStore } from '@/store/authStore'
import type { LeaseStatus, LeaseVehicleAssignment, LeaseVehicleSession, LeaseSessionStatus } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<LeaseStatus, string> = {
  DRAFT:  'bg-gray-200/80 text-gray-700',
  ACTIVE: 'bg-green-400/20 text-green-300',
  CLOSED: 'bg-slate-200/60 text-slate-400',
}
const STATUS_LABELS: Record<LeaseStatus, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', CLOSED: 'Closed',
}
const NEXT_STATUSES: Partial<Record<LeaseStatus, LeaseStatus[]>> = {
  DRAFT:  ['ACTIVE'],
  ACTIVE: ['CLOSED'],
}
const SESSION_COLORS: Record<LeaseSessionStatus, { dot: string; text: string; pill: string; tabBtn: string }> = {
  WORKING:   { dot: 'bg-green-500',  text: 'text-green-700',  pill: 'bg-green-50 border border-green-200 text-green-700',  tabBtn: 'border-green-200 text-green-700 hover:bg-green-50' },
  IDLE:      { dot: 'bg-yellow-400', text: 'text-yellow-600', pill: 'bg-yellow-50 border border-yellow-200 text-yellow-700', tabBtn: 'border-yellow-200 text-yellow-700 hover:bg-yellow-50' },
  BREAKDOWN: { dot: 'bg-red-500',    text: 'text-red-700',    pill: 'bg-red-50 border border-red-200 text-red-700',         tabBtn: 'border-red-200 text-red-700 hover:bg-red-50' },
}

function nowLocal() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

// ── Add Vehicle Dialog ──────────────────────────────────────────────────────────
function AddVehicleDialog({ leaseId, open, onClose }: { leaseId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId] = useState('')
  const [driverStaffId, setDriverStaffId] = useState('')
  const [ratePerVehicle, setRatePerVehicle] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [odometerAtStart, setOdometerAtStart] = useState('')

  function reset() {
    setVehicleId(''); setDriverStaffId(''); setRatePerVehicle('')
    setStartDate(new Date().toISOString().slice(0, 10)); setOdometerAtStart('')
  }

  const { data: vehiclesRes } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll(),
    enabled: open,
  })
  const { data: staffRes } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.getAll(),
    enabled: open,
  })

  const vehicles = vehiclesRes?.data ?? []
  const drivers = (staffRes?.data ?? []).filter(s => s.roleName === 'DRIVER')

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.addVehicle(leaseId, {
      vehicleId: Number(vehicleId),
      driverStaffId: driverStaffId ? Number(driverStaffId) : undefined,
      ratePerVehicle: Number(ratePerVehicle),
      startDate,
      odometerAtStart: odometerAtStart ? Number(odometerAtStart) : undefined,
    }),
    onSuccess: () => {
      toast.success('Vehicle added to lease')
      qc.invalidateQueries({ queryKey: ['vehicle-lease', leaseId] })
      qc.invalidateQueries({ queryKey: ['lease-vehicles', leaseId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to add vehicle')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Vehicle to Lease</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Vehicle *</Label>
            <SearchableSelect
              options={vehicles.map(v => ({
                value: String(v.id),
                label: `${v.registrationNumber}${v.vehicleTypeName ? ` — ${v.vehicleTypeName}` : ''}`,
              }))}
              value={vehicleId}
              onValueChange={setVehicleId}
              placeholder="Search by reg. number"
            />
          </div>
          <div>
            <Label>Driver (optional — leave blank if client provides driver)</Label>
            <SearchableSelect
              options={drivers.map(d => ({ value: String(d.userId), label: d.userName }))}
              value={driverStaffId}
              onValueChange={setDriverStaffId}
              placeholder="Select driver"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rate per Vehicle *</Label>
              <Input type="number" value={ratePerVehicle}
                onChange={e => setRatePerVehicle(e.target.value)} placeholder="e.g. 18000" />
            </div>
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Odometer at Start (km)</Label>
            <Input type="number" value={odometerAtStart}
              onChange={e => setOdometerAtStart(e.target.value)} placeholder="e.g. 45200" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!vehicleId || !ratePerVehicle || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Adding…' : 'Add Vehicle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Close Vehicle Dialog ────────────────────────────────────────────────────────
function CloseVehicleDialog({
  leaseId, assignment, open, onClose,
}: { leaseId: number; assignment: LeaseVehicleAssignment; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [odometer, setOdometer] = useState('')

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.closeVehicle(leaseId, assignment.id, odometer ? Number(odometer) : undefined),
    onSuccess: () => {
      toast.success('Vehicle assignment closed')
      qc.invalidateQueries({ queryKey: ['lease-vehicles', leaseId] })
      qc.invalidateQueries({ queryKey: ['vehicle-lease', leaseId] })
      qc.invalidateQueries({ queryKey: ['lease-sessions', leaseId] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to close assignment')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Close Vehicle Assignment</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-gray-600">
            Closing <strong>{assignment.registrationNumber}</strong> from this lease. Any active session will be auto-closed.
          </p>
          <div>
            <Label>Odometer at Return (km)</Label>
            <Input type="number" value={odometer}
              onChange={e => setOdometer(e.target.value)} placeholder="e.g. 47800" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white">
              {mutation.isPending ? 'Closing…' : 'Close Assignment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Assign Division Dialog ──────────────────────────────────────────────────────
function AssignDivisionDialog({ leaseId, clientId, assignment, open, onClose }: {
  leaseId: number; clientId: number; assignment: LeaseVehicleAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [divisionId, setDivisionId] = useState('')

  const { data: divRes } = useQuery({
    queryKey: ['client-divisions', clientId],
    queryFn: () => clientsApi.getDivisions(clientId),
    enabled: open && !!clientId,
  })
  const options = (divRes?.data ?? []).map(d => ({ value: String(d.id), label: d.name }))

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.assignDivision(leaseId, assignment!.id, divisionId ? Number(divisionId) : null),
    onSuccess: () => {
      toast.success(divisionId ? 'Division assigned' : 'Division removed')
      qc.invalidateQueries({ queryKey: ['lease-vehicles', leaseId] })
      setDivisionId(''); onClose()
    },
    onError: () => toast.error('Failed to assign division'),
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setDivisionId(''); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Assign Division</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-gray-500">Vehicle: <strong>{assignment?.registrationNumber}</strong></p>
          {options.length === 0 ? (
            <p className="text-sm text-gray-400 italic">This client has no divisions set up.</p>
          ) : (
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Division / Site</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={divisionId || (assignment?.divisionId ? String(assignment.divisionId) : '')}
                onChange={e => setDivisionId(e.target.value)}>
                <option value="">— Select division —</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {assignment?.divisionId && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { setDivisionId(''); mutation.mutate() }}
                disabled={mutation.isPending}>Remove</Button>
            )}
            <Button className="flex-1 bg-feros-navy hover:bg-feros-navy/90 text-white"
              disabled={!divisionId || mutation.isPending || options.length === 0}
              onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Saving…' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Start Session Dialog ────────────────────────────────────────────────────────
function StartSessionDialog({ leaseId, clientId, assignment, open, onClose }: {
  leaseId: number; clientId: number; assignment: LeaseVehicleAssignment | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<LeaseSessionStatus>('WORKING')
  const [divisionId, setDivisionId] = useState('')
  const [clientDriver, setClientDriver] = useState(true)
  const [driverStaffId, setDriverStaffId] = useState('')
  const [startTime, setStartTime] = useState(nowLocal())
  const [notes, setNotes] = useState('')

  function reset() {
    setStatus('WORKING'); setDivisionId(''); setClientDriver(true)
    setDriverStaffId(''); setStartTime(nowLocal()); setNotes('')
  }

  const { data: divRes } = useQuery({
    queryKey: ['client-divisions', clientId],
    queryFn: () => clientsApi.getDivisions(clientId),
    enabled: open && !!clientId,
  })
  const { data: staffRes } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.getAll(),
    enabled: open && !clientDriver,
  })

  const divisions = (divRes?.data ?? []).map(d => ({ value: String(d.id), label: d.name }))
  const drivers = (staffRes?.data ?? []).filter(s => s.roleName === 'DRIVER')

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.startSession(leaseId, assignment!.id, {
      status,
      startTime,
      driverStaffId: clientDriver ? null : (driverStaffId ? Number(driverStaffId) : null),
      divisionId: status === 'WORKING' && divisionId ? Number(divisionId) : null,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Session started')
      qc.invalidateQueries({ queryKey: ['lease-sessions', leaseId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to start session')
    },
  })

  const canSubmit = status !== 'WORKING' || !!divisionId

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Session — {assignment?.registrationNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">

          {/* Status selector */}
          <div>
            <Label>Status *</Label>
            <div className="flex gap-2 mt-1.5">
              {(['WORKING', 'IDLE', 'BREAKDOWN'] as LeaseSessionStatus[]).map(s => (
                <button key={s}
                  onClick={() => { setStatus(s); if (s !== 'WORKING') setDivisionId('') }}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    status === s ? SESSION_COLORS[s].pill : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Division — required for WORKING */}
          {status === 'WORKING' && (
            <div>
              <Label>Division *</Label>
              {divisions.length === 0 ? (
                <p className="text-xs text-red-500 mt-1">No divisions set up for this client.</p>
              ) : (
                <select className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                  value={divisionId} onChange={e => setDivisionId(e.target.value)}>
                  <option value="">— Select division —</option>
                  {divisions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Driver */}
          <div>
            <Label>Driver</Label>
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => { setClientDriver(true); setDriverStaffId('') }}
                className={cn('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                  clientDriver ? 'bg-feros-navy text-white border-feros-navy' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                Client's Driver
              </button>
              <button
                onClick={() => setClientDriver(false)}
                className={cn('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                  !clientDriver ? 'bg-feros-navy text-white border-feros-navy' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                Own Staff
              </button>
            </div>
            {!clientDriver && (
              <div className="mt-2">
                <SearchableSelect
                  options={drivers.map(d => ({ value: String(d.userId), label: d.userName }))}
                  value={driverStaffId}
                  onValueChange={setDriverStaffId}
                  placeholder="Select driver"
                />
              </div>
            )}
          </div>

          {/* Start time */}
          <div>
            <Label>Start Time *</Label>
            <Input type="datetime-local" value={startTime} max={nowLocal()}
              onChange={e => setStartTime(e.target.value)} className="mt-1" />
            <p className="text-xs text-gray-400 mt-1">Cannot be a future time.</p>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}
              className="bg-green-600 hover:bg-green-700 text-white">
              {mutation.isPending ? 'Starting…' : 'Start Session'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── End Session Dialog ──────────────────────────────────────────────────────────
function EndSessionDialog({ leaseId, assignment, activeSession, open, onClose }: {
  leaseId: number; assignment: LeaseVehicleAssignment | null
  activeSession: LeaseVehicleSession | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [endTime, setEndTime] = useState(nowLocal())
  const [notes, setNotes] = useState('')

  function reset() { setEndTime(nowLocal()); setNotes('') }

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.endSession(leaseId, assignment!.id, {
      endTime,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Session ended')
      qc.invalidateQueries({ queryKey: ['lease-sessions', leaseId] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to end session')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>End Session — {assignment?.registrationNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {activeSession && (
            <div className={cn('rounded-lg p-3 text-xs', SESSION_COLORS[activeSession.status].pill)}>
              <span className="font-semibold">{activeSession.status}</span>
              {activeSession.divisionName && <span> in {activeSession.divisionName}</span>}
              {activeSession.driverName && <span> · {activeSession.driverName}</span>}
              <br />
              <span className="opacity-80">Active since {fmtDateTime(activeSession.startTime)}</span>
            </div>
          )}
          <div>
            <Label>End Time *</Label>
            <Input type="datetime-local" value={endTime} max={nowLocal()}
              onChange={e => setEndTime(e.target.value)} className="mt-1" />
            <p className="text-xs text-gray-400 mt-1">Cannot be a future time.</p>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white">
              {mutation.isPending ? 'Ending…' : 'End Session'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const leaseId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = useAuthStore(s => s.role)
  const [activeTab, setActiveTab] = useState<'vehicles' | 'sessions' | 'billing'>('vehicles')
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [extendDate, setExtendDate] = useState('')
  const [showExtend, setShowExtend] = useState(false)
  const [closingAssignment, setClosingAssignment] = useState<LeaseVehicleAssignment | null>(null)
  const [assigningDivisionFor, setAssigningDivisionFor] = useState<LeaseVehicleAssignment | null>(null)
  const [startingSessionFor, setStartingSessionFor] = useState<LeaseVehicleAssignment | null>(null)
  const [endingSessionFor, setEndingSessionFor] = useState<LeaseVehicleAssignment | null>(null)

  const { data: leaseRes, isLoading } = useQuery({
    queryKey: ['vehicle-lease', leaseId],
    queryFn: () => vehicleLeasesApi.getById(leaseId),
  })
  const { data: vehiclesRes } = useQuery({
    queryKey: ['lease-vehicles', leaseId],
    queryFn: () => vehicleLeasesApi.getVehicles(leaseId),
  })
  const { data: sessionsRes } = useQuery({
    queryKey: ['lease-sessions', leaseId],
    queryFn: () => vehicleLeasesApi.getSessions(leaseId),
  })
  const { data: billingRes } = useQuery({
    queryKey: ['lease-billing', leaseId],
    queryFn: () => vehicleLeasesApi.getBilling(leaseId),
    enabled: activeTab === 'billing',
  })

  const lease = leaseRes?.data
  const assignments = vehiclesRes?.data ?? []
  const sessions = sessionsRes?.data ?? []
  const billing = billingRes?.data
  const activeAssignments = assignments.filter(a => a.isActive)

  // Map of assignmentId → active session (for vehicle card indicators)
  const activeSessionMap = new Map<number, LeaseVehicleSession>(
    sessions.filter(s => s.isActive).map(s => [s.assignmentId, s])
  )

  const statusMutation = useMutation({
    mutationFn: (status: LeaseStatus) => vehicleLeasesApi.updateStatus(leaseId, status),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['vehicle-lease', leaseId] })
      qc.invalidateQueries({ queryKey: ['vehicle-leases'] })
      qc.invalidateQueries({ queryKey: ['lease-sessions', leaseId] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to update status')
    },
  })

  const extendMutation = useMutation({
    mutationFn: (date: string) => vehicleLeasesApi.extend(leaseId, date),
    onSuccess: () => {
      toast.success('Lease extended')
      qc.invalidateQueries({ queryKey: ['vehicle-lease', leaseId] })
      setShowExtend(false)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to extend')
    },
  })

  if (isLoading || !lease) {
    return <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
  }

  const nextStatuses = NEXT_STATUSES[lease.status] ?? []
  const canEdit = lease.status !== 'CLOSED' && role !== 'SUPERVISOR'

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-feros-navy/80 rounded-xl overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Truck size={180} />
        </div>
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <button
              onClick={() => navigate('/vehicles/leases')}
              className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mt-0.5">
              <ArrowLeft size={15} /> Leases
            </button>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setShowExtend(true)}
                  className="text-blue-200 border-blue-300/40 hover:bg-white/10 bg-transparent gap-1.5">
                  <CalendarDays size={14} /> Extend
                </Button>
              )}
              {nextStatuses.map(s => (
                <Button key={s} size="sm" variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(s)}
                  className={s === 'CLOSED'
                    ? 'text-red-300 border-red-400/40 hover:bg-red-500/20 bg-transparent gap-1.5'
                    : 'text-white border-white/30 hover:bg-white/20 bg-white/10 gap-1.5'
                  }>
                  {s === 'ACTIVE' ? 'Activate' : 'Close Lease'}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white">{lease.leaseNumber}</h1>
              <Badge className={cn('text-xs', STATUS_COLORS[lease.status])}>{STATUS_LABELS[lease.status]}</Badge>
            </div>
            <p className="text-blue-200 text-sm mt-1.5">
              {lease.clientName}{lease.site ? ` · ${lease.site}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <CalendarDays size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Period</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{lease.startDate}</p>
          {lease.endDate
            ? <p className="text-xs text-gray-400 mt-0.5">→ {lease.endDate}</p>
            : <p className="text-xs text-gray-400 mt-0.5">Open-ended</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Truck size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Vehicles</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">{lease.vehicleCount} assigned</p>
          <p className="text-xs text-gray-400 mt-0.5">{activeAssignments.length} active</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Receipt size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Rate Type</span>
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {lease.rateType === 'MONTHLY' ? 'Per Month' : 'Per Day'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">billing cycle</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <MapPin size={13} />
            <span className="text-xs font-medium uppercase tracking-wide">Site</span>
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{lease.site ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">location</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'vehicles', label: 'Vehicles', icon: <Truck size={14} /> },
          { key: 'sessions', label: 'Sessions', icon: <Clock size={14} /> },
          ...(role !== 'SUPERVISOR' ? [{ key: 'billing', label: 'Billing', icon: <Receipt size={14} /> }] : []),
        ] as { key: 'vehicles' | 'sessions' | 'billing'; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.key
                ? 'border-feros-navy text-feros-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Vehicles Tab ── */}
      {activeTab === 'vehicles' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {assignments.length} vehicle{assignments.length !== 1 ? 's' : ''} assigned
            </p>
            {canEdit && (
              <Button size="sm" onClick={() => setShowAddVehicle(true)}
                className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
                <Plus size={13} /> Add Vehicle
              </Button>
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              No vehicles assigned yet
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map(a => {
                const activeSession = activeSessionMap.get(a.id) ?? null
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    {/* Main row */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {a.registrationNumber}
                          {a.vehicleType && <span className="text-gray-400 font-normal ml-2">· {a.vehicleType}</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          From {a.startDate}{a.endDate ? ` → ${a.endDate}` : ''}
                          <span className="ml-2 text-feros-navy font-medium">
                            ₹{a.ratePerVehicle.toLocaleString('en-IN')}/{lease.rateType === 'MONTHLY' ? 'mo' : 'day'}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={a.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {a.isActive ? 'Active' : 'Closed'}
                        </Badge>
                        {canEdit && a.isActive && (
                          <Button size="sm" variant="outline"
                            className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setClosingAssignment(a)}>
                            <X size={11} className="mr-1" /> Close
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Active session indicator */}
                    {activeSession && (
                      <div className={cn('mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs', SESSION_COLORS[activeSession.status].pill)}>
                        <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', SESSION_COLORS[activeSession.status].dot)} />
                        <span className="font-semibold">{activeSession.status}</span>
                        {activeSession.divisionName && <span>in {activeSession.divisionName}</span>}
                        {activeSession.driverName
                          ? <><span className="opacity-50">·</span><User size={10} /><span>{activeSession.driverName}</span></>
                          : <><span className="opacity-50">·</span><span className="opacity-70">Client's driver</span></>
                        }
                        <span className="opacity-50 ml-auto">since {new Date(activeSession.startTime).toLocaleTimeString('en-IN', { timeStyle: 'short' })}</span>
                      </div>
                    )}

                    {/* Session action buttons + division + driver */}
                    {canEdit && a.isActive && (
                      <>
                        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="outline"
                            className="text-xs text-green-700 border-green-200 hover:bg-green-50 gap-1"
                            onClick={() => setStartingSessionFor(a)}>
                            <Play size={10} /> {activeSession ? 'Change Session' : 'Start Session'}
                          </Button>
                          {activeSession && (
                            <Button size="sm" variant="outline"
                              className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                              onClick={() => setEndingSessionFor(a)}>
                              <Square size={10} /> End Session
                            </Button>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Building2 size={12} />
                            {a.divisionName
                              ? <span className="font-medium text-feros-navy">{a.divisionName}</span>
                              : <span className="text-gray-400 italic">No division assigned</span>
                            }
                          </div>
                          <Button size="sm" variant="ghost"
                            className="text-xs h-6 px-2 text-feros-navy"
                            onClick={() => setAssigningDivisionFor(a)}>
                            {a.divisionName ? 'Change' : 'Assign Division'}
                          </Button>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                          <User size={12} />
                          {a.driverName
                            ? <span className="font-medium text-gray-700">{a.driverName}</span>
                            : <span className="text-gray-400 italic">Client's driver</span>
                          }
                          {a.odometerAtStart != null && (
                            <>
                              <span className="text-gray-300 mx-1">·</span>
                              <Gauge size={12} />
                              <span>{a.odometerAtStart} km{a.odometerAtEnd != null ? ` → ${a.odometerAtEnd} km` : ''}</span>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* Driver row (when not canEdit or not active) */}
                    {(!canEdit || !a.isActive) && (
                      <>
                        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Building2 size={12} />
                            {a.divisionName
                              ? <span className="font-medium text-feros-navy">{a.divisionName}</span>
                              : <span className="text-gray-400 italic">No division assigned</span>
                            }
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                          <User size={12} />
                          {a.driverName
                            ? <span className="font-medium text-gray-700">{a.driverName}</span>
                            : <span className="text-gray-400 italic">Client's driver</span>
                          }
                          {a.odometerAtStart != null && (
                            <>
                              <span className="text-gray-300 mx-1">·</span>
                              <Gauge size={12} />
                              <span>{a.odometerAtStart} km{a.odometerAtEnd != null ? ` → ${a.odometerAtEnd} km` : ''}</span>
                            </>
                          )}
                        </div>
                      </>
                    )}

                  </div>
                )
              })}
            </div>
          )}

          <AddVehicleDialog leaseId={leaseId} open={showAddVehicle} onClose={() => setShowAddVehicle(false)} />
        </div>
      )}

      {/* ── Sessions Tab ── */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              No sessions recorded yet. Start a session from the Vehicles tab.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Driver</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Division</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Start</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">End</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.registrationNumber}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border', SESSION_COLORS[s.status].pill)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', SESSION_COLORS[s.status].dot)} />
                          {s.status}
                        </span>
                        {s.isActive && (
                          <span className="ml-1.5 text-xs text-green-600 font-medium">● Live</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {s.driverName ?? <span className="italic text-gray-400">Client</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {s.divisionName ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(s.startTime)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {s.endTime ? fmtDateTime(s.endTime) : <span className="text-green-600 font-medium">Active</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium text-xs">
                        {s.hoursWorked != null ? `${s.hoursWorked} hrs` : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Billing Tab ── */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          {!billing ? (
            <div className="text-sm text-gray-400 py-8 text-center">Loading billing…</div>
          ) : billing.lines.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              No vehicles — no billing to show
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Days</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.lines.map(line => (
                    <tr key={line.assignmentId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{line.registrationNumber}</td>
                      <td className="px-4 py-3 text-right text-gray-600">₹{line.ratePerVehicle.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{line.days}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{line.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700 text-right">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-feros-navy text-base">
                      ₹{billing.totalAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Extend Dialog ── */}
      {showExtend && (
        <Dialog open onOpenChange={v => !v && setShowExtend(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Extend Lease</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>New End Date</Label>
                <Input type="date" value={extendDate} onChange={e => setExtendDate(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExtend(false)}>Cancel</Button>
                <Button disabled={!extendDate || extendMutation.isPending}
                  onClick={() => extendMutation.mutate(extendDate)}
                  className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                  {extendMutation.isPending ? 'Extending…' : 'Extend'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modals ── */}
      {closingAssignment && (
        <CloseVehicleDialog
          leaseId={leaseId}
          assignment={closingAssignment}
          open={!!closingAssignment}
          onClose={() => setClosingAssignment(null)}
        />
      )}
      <AssignDivisionDialog
        leaseId={leaseId}
        clientId={lease.clientId}
        assignment={assigningDivisionFor}
        open={!!assigningDivisionFor}
        onClose={() => setAssigningDivisionFor(null)}
      />
      <StartSessionDialog
        leaseId={leaseId}
        clientId={lease.clientId}
        assignment={startingSessionFor}
        open={!!startingSessionFor}
        onClose={() => setStartingSessionFor(null)}
      />
      <EndSessionDialog
        leaseId={leaseId}
        assignment={endingSessionFor}
        activeSession={endingSessionFor ? (activeSessionMap.get(endingSessionFor.id) ?? null) : null}
        open={!!endingSessionFor}
        onClose={() => setEndingSessionFor(null)}
      />
    </div>
  )
}
