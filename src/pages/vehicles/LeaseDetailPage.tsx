import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vehicleLeasesApi } from '@/api/vehicleLeases'
import { leaseInvoicesApi } from '@/api/leaseInvoices'
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
import type { LeaseDailyLog, LeaseInvoice, LeaseInvoiceStatus, LeaseStatus, LeaseVehicleAssignment, LeaseVehicleSession } from '@/types'
import { cn } from '@/lib/utils'
import { GenerateLeaseInvoiceDialog } from './GenerateLeaseInvoiceDialog'

const INV_STATUS_COLORS: Record<LeaseInvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}
const INV_STATUS_LABELS: Record<LeaseInvoiceStatus, string> = {
  DRAFT: 'Draft', SENT: 'Sent', PARTIALLY_PAID: 'Partially Paid', PAID: 'Paid', CANCELLED: 'Cancelled',
}

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

function nowLocal() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtTime(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours.toFixed(2)} hrs`
}

// ── Add Vehicle Dialog ──────────────────────────────────────────────────────────
function AddVehicleDialog({ leaseId, open, onClose }: { leaseId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId] = useState('')
  const [ratePerVehicle, setRatePerVehicle] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [odometerAtStart, setOdometerAtStart] = useState('')

  function reset() {
    setVehicleId(''); setRatePerVehicle('')
    setStartDate(new Date().toISOString().slice(0, 10)); setOdometerAtStart('')
  }

  const { data: vehiclesRes } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll(),
    enabled: open,
  })

  const vehicles = vehiclesRes?.data ?? []

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.addVehicle(leaseId, {
      vehicleId: Number(vehicleId),
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
            Closing <strong>{assignment.registrationNumber}</strong>. Any active session will be auto-closed.
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
function StartSessionDialog({ leaseId, clientId, assignment, lastOdometer, open, onClose }: {
  leaseId: number; clientId: number; assignment: LeaseVehicleAssignment | null
  lastOdometer: number | null; open: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [clientDriver, setClientDriver] = useState(true)
  const [driverStaffId, setDriverStaffId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [odometerStart, setOdometerStart] = useState('')
  const [startTime, setStartTime] = useState(nowLocal())
  const [notes, setNotes] = useState('')

  // Pre-fill division + odometer when dialog opens
  useEffect(() => {
    if (open) {
      setDivisionId(assignment?.divisionId ? String(assignment.divisionId) : '')
      setOdometerStart(lastOdometer != null ? String(lastOdometer) : '')
      setStartTime(nowLocal())
    }
  }, [open, assignment?.divisionId, lastOdometer])

  function reset() {
    setClientDriver(true); setDriverStaffId('')
    setDivisionId(assignment?.divisionId ? String(assignment.divisionId) : '')
    setOdometerStart(lastOdometer != null ? String(lastOdometer) : '')
    setStartTime(nowLocal()); setNotes('')
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

  const divisions = divRes?.data ?? []
  const hasDivisions = divisions.length > 0
  const drivers = (staffRes?.data ?? []).filter(s => s.roleName === 'DRIVER')

  const driverOk = clientDriver || !!driverStaffId
  const divisionOk = !hasDivisions || !!divisionId
  const canSubmit = driverOk && divisionOk

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.startSession(leaseId, assignment!.id, {
      startTime,
      driverStaffId: clientDriver ? null : (driverStaffId ? Number(driverStaffId) : null),
      divisionId: divisionId ? Number(divisionId) : null,
      odometerStart: odometerStart ? Number(odometerStart) : null,
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start Session — {assignment?.registrationNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">

          {/* Driver — required */}
          <div>
            <Label>Driver *</Label>
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
                  placeholder="Select driver *"
                />
                {!driverStaffId && (
                  <p className="text-xs text-red-500 mt-1">Select a driver from staff.</p>
                )}
              </div>
            )}
          </div>

          {/* Division — required if client has divisions */}
          <div>
            <Label>Division {hasDivisions ? '*' : '(client has no divisions)'}</Label>
            {hasDivisions ? (
              <select className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                value={divisionId} onChange={e => setDivisionId(e.target.value)}>
                <option value="">— Select division —</option>
                {divisions.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
            ) : (
              <p className="text-xs text-gray-400 mt-1 italic">Session will be recorded without a division.</p>
            )}
          </div>

          {/* Odometer start */}
          <div>
            <Label>Odometer Start (km) <span className="text-gray-400 font-normal">— optional</span></Label>
            <Input type="number" value={odometerStart}
              onChange={e => setOdometerStart(e.target.value)}
              placeholder="e.g. 45200" className="mt-1" />
            {lastOdometer != null && (
              <p className="text-xs text-gray-400 mt-1">Pre-filled from last reading: {lastOdometer.toLocaleString('en-IN')} km</p>
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
  const [odometerEnd, setOdometerEnd] = useState('')
  const [notes, setNotes] = useState('')

  // Pre-fill odometer end from session's odometerStart
  useEffect(() => {
    if (open) {
      setOdometerEnd(activeSession?.odometerStart != null ? String(activeSession.odometerStart) : '')
      setEndTime(nowLocal())
    }
  }, [open, activeSession?.odometerStart])

  function reset() { setEndTime(nowLocal()); setOdometerEnd(''); setNotes('') }

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.endSession(leaseId, assignment!.id, {
      endTime,
      odometerEnd: odometerEnd ? Number(odometerEnd) : null,
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
            <div className="rounded-lg p-3 text-xs bg-green-50 border border-green-200 text-green-700 space-y-0.5">
              <p className="font-semibold">Working session active</p>
              {activeSession.divisionName && <p>Division: {activeSession.divisionName}</p>}
              <p>Driver: {activeSession.driverName ?? "Client's driver"}</p>
              <p className="opacity-75">Started: {fmtDateTime(activeSession.startTime)}</p>
            </div>
          )}
          <div>
            <Label>End Time *</Label>
            <Input type="datetime-local" value={endTime} max={nowLocal()}
              onChange={e => setEndTime(e.target.value)} className="mt-1" />
            <p className="text-xs text-gray-400 mt-1">Cannot be a future time.</p>
          </div>
          <div>
            <Label>Odometer End (km) <span className="text-gray-400 font-normal">— optional</span></Label>
            <Input type="number" value={odometerEnd}
              onChange={e => setOdometerEnd(e.target.value)}
              placeholder="e.g. 45400" className="mt-1" />
            {activeSession?.odometerStart != null && odometerEnd && Number(odometerEnd) > activeSession.odometerStart && (
              <p className="text-xs text-green-600 mt-1">
                {(Number(odometerEnd) - activeSession.odometerStart).toLocaleString('en-IN')} km this session
              </p>
            )}
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
  const [activeTab, setActiveTab] = useState<'vehicles' | 'sessions' | 'daily-logs' | 'billing'>('vehicles')
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
  const { data: invoicesRes } = useQuery({
    queryKey: ['lease-invoices', leaseId],
    queryFn: () => leaseInvoicesApi.getByLease(leaseId),
    enabled: activeTab === 'billing',
  })
  const { data: dailyLogsRes } = useQuery({
    queryKey: ['lease-daily-logs', leaseId],
    queryFn: () => vehicleLeasesApi.getDailyLogs(leaseId),
    enabled: activeTab === 'daily-logs',
  })

  const lease = leaseRes?.data
  const assignments = vehiclesRes?.data ?? []
  const sessions = sessionsRes?.data ?? []
  const invoices = invoicesRes?.data ?? []
  const dailyLogs = dailyLogsRes?.data ?? []
  const activeAssignments = assignments.filter(a => a.isActive)

  const [showAddLog, setShowAddLog] = useState(false)
  const [addLogAssignmentId, setAddLogAssignmentId] = useState('')
  const [addLogDate, setAddLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false)
  const qcRef = qc

  const createLogMutation = useMutation({
    mutationFn: () => vehicleLeasesApi.createDailyLog(leaseId, Number(addLogAssignmentId), addLogDate),
    onSuccess: () => {
      toast.success('Daily log created')
      qcRef.invalidateQueries({ queryKey: ['lease-daily-logs', leaseId] })
      setShowAddLog(false)
      setAddLogAssignmentId('')
      setAddLogDate(new Date().toISOString().slice(0, 10))
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create daily log')
    },
  })

  // Map of assignmentId → active session (for vehicle card indicators)
  const activeSessionMap = new Map<number, LeaseVehicleSession>(
    sessions.filter(s => s.isActive).map(s => [s.assignmentId, s])
  )

  // Last known odometer: last session's odometerEnd → assignment odometerAtStart → vehicle current odometer
  function lastOdometerFor(a: typeof assignments[0]): number | null {
    const completed = sessions
      .filter(s => s.assignmentId === a.id && !s.isActive && s.odometerEnd != null)
      .sort((x, y) => new Date(y.startTime).getTime() - new Date(x.startTime).getTime())
    if (completed.length > 0) return completed[0].odometerEnd
    return a.odometerAtStart ?? a.vehicleCurrentOdometer ?? null
  }

  // Total working hours across all sessions
  const totalHours = sessions
    .filter(s => s.hoursWorked != null)
    .reduce((sum, s) => sum + (s.hoursWorked ?? 0), 0)

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
          { key: 'daily-logs', label: 'Daily Logs', icon: <CalendarDays size={14} /> },
          ...(role !== 'SUPERVISOR' ? [{ key: 'billing', label: 'Billing', icon: <Receipt size={14} /> }] : []),
        ] as { key: 'vehicles' | 'sessions' | 'daily-logs' | 'billing'; label: string; icon: React.ReactNode }[]).map(t => (
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
                      <div className="mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs bg-green-50 border border-green-200 text-green-700">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                        <span className="font-semibold">Working</span>
                        {activeSession.divisionName && <span>· {activeSession.divisionName}</span>}
                        <span className="opacity-60">·</span>
                        <User size={10} />
                        <span>{activeSession.driverName ?? "Client's driver"}</span>
                        <span className="ml-auto opacity-60">
                          since {new Date(activeSession.startTime).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                        </span>
                      </div>
                    )}

                    {/* Division + driver info row */}
                    <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 size={12} />
                          {(activeSession?.divisionName ?? a.divisionName)
                            ? <span className="font-medium text-feros-navy">{activeSession?.divisionName ?? a.divisionName}</span>
                            : <span className="text-gray-400 italic">No division</span>
                          }
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {(activeSession !== null ? activeSession.driverName : a.driverName)
                            ? <span className="font-medium text-gray-700">{activeSession !== null ? activeSession.driverName : a.driverName}</span>
                            : <span className="text-gray-400 italic">Client's driver</span>
                          }
                        </span>
                        {a.odometerAtStart != null && (
                          <span className="flex items-center gap-1">
                            <Gauge size={12} />
                            <span>{a.odometerAtStart} km{a.odometerAtEnd != null ? ` → ${a.odometerAtEnd} km` : ''}</span>
                          </span>
                        )}
                      </div>
                      {canEdit && a.isActive && (
                        <Button size="sm" variant="ghost"
                          className="text-xs h-6 px-2 text-feros-navy"
                          onClick={() => setAssigningDivisionFor(a)}>
                          {a.divisionName ? 'Change Division' : 'Assign Division'}
                        </Button>
                      )}
                    </div>

                    {/* Session action buttons */}
                    {canEdit && a.isActive && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" variant="outline"
                          className="text-xs text-green-700 border-green-200 hover:bg-green-50 gap-1"
                          onClick={() => setStartingSessionFor(a)}>
                          <Play size={10} /> {activeSession ? 'New Session' : 'Start Session'}
                        </Button>
                        {activeSession && (
                          <Button size="sm" variant="outline"
                            className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                            onClick={() => setEndingSessionFor(a)}>
                            <Square size={10} /> End Session
                          </Button>
                        )}
                      </div>
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
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Driver</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Division</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Start</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">End</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Km</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.registrationNumber}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {s.driverName ?? <span className="italic text-gray-400">Client's driver</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {s.divisionName ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(s.startTime)}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {s.endTime
                          ? <span className="text-gray-600">{fmtDateTime(s.endTime)}</span>
                          : <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                              Active
                            </span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">
                        {s.kmDriven != null
                          ? `${Number(s.kmDriven).toLocaleString('en-IN')} km`
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-xs">
                        {s.hoursWorked != null
                          ? <span className="text-gray-700">{fmtTime(Number(s.hoursWorked))}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totalHours > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={6} className="px-4 py-3 font-semibold text-gray-700 text-right">Total Working Time</td>
                      <td className="px-4 py-3 text-right font-bold text-feros-navy">{fmtTime(totalHours)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Daily Logs Tab ── */}
      {activeTab === 'daily-logs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{dailyLogs.length} log{dailyLogs.length !== 1 ? 's' : ''}</p>
            {role !== 'SUPERVISOR' && (
              <Button size="sm" onClick={() => setShowAddLog(true)}
                className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
                <Plus size={14} /> Add Log
              </Button>
            )}
          </div>

          {dailyLogs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              No daily logs yet. Logs are auto-generated at 11:59 PM from sessions.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Sessions</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Hours</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">KM</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyLogs.map((log: LeaseDailyLog) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {new Date(log.logDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{log.registrationNumber}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.sessionCount}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {log.totalHours != null ? fmtTime(Number(log.totalHours)) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {log.kmDriven != null
                          ? `${Number(log.kmDriven).toLocaleString('en-IN')} km`
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          log.source === 'AUTO'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-amber-50 text-amber-700')}>
                          {log.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Log Dialog */}
          <Dialog open={showAddLog} onOpenChange={v => !v && setShowAddLog(false)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Daily Log</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Vehicle *</Label>
                  <select
                    value={addLogAssignmentId}
                    onChange={e => setAddLogAssignmentId(e.target.value)}
                    className="w-full mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy/30">
                    <option value="">Select vehicle…</option>
                    {assignments.map(a => (
                      <option key={a.id} value={a.id}>{a.registrationNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={addLogDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setAddLogDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddLog(false)}>Cancel</Button>
                  <Button size="sm"
                    disabled={!addLogAssignmentId || !addLogDate || createLogMutation.isPending}
                    onClick={() => createLogMutation.mutate()}
                    className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                    {createLogMutation.isPending ? 'Creating…' : 'Create Log'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── Billing Tab ── */}
      {activeTab === 'billing' && lease && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowGenerateInvoice(true)}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
              <Plus size={13} /> Generate Invoice
            </Button>
          </div>

          {invoices.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              No invoices yet. Click "Generate Invoice" to create one.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: LeaseInvoice) => (
                    <tr key={inv.id}
                      onClick={() => navigate(`/vehicles/leases/invoices/${inv.id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-feros-navy">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {inv.billingPeriodStart} → {inv.billingPeriodEnd}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{inv.invoiceDate}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', INV_STATUS_COLORS[inv.status])}>
                          {INV_STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{Number(inv.totalAmount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showGenerateInvoice && (
            <GenerateLeaseInvoiceDialog
              open={showGenerateInvoice}
              onClose={() => setShowGenerateInvoice(false)}
              lease={lease}
            />
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
        lastOdometer={startingSessionFor ? lastOdometerFor(startingSessionFor) : null}
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
