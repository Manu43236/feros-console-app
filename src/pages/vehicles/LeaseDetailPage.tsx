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
  X, Receipt, User, Gauge, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useAuthStore } from '@/store/authStore'
import type { LeaseStatus, LeaseVehicleAssignment } from '@/types'
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
            Closing <strong>{assignment.registrationNumber}</strong> from this lease.
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

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const leaseId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const role = useAuthStore(s => s.role)
  const [activeTab, setActiveTab] = useState<'vehicles' | 'billing'>('vehicles')
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [extendDate, setExtendDate] = useState('')
  const [showExtend, setShowExtend] = useState(false)
  const [closingAssignment, setClosingAssignment] = useState<LeaseVehicleAssignment | null>(null)
  const [assigningDivisionFor, setAssigningDivisionFor] = useState<LeaseVehicleAssignment | null>(null)

  const { data: leaseRes, isLoading } = useQuery({
    queryKey: ['vehicle-lease', leaseId],
    queryFn: () => vehicleLeasesApi.getById(leaseId),
  })
  const { data: vehiclesRes } = useQuery({
    queryKey: ['lease-vehicles', leaseId],
    queryFn: () => vehicleLeasesApi.getVehicles(leaseId),
  })
  const { data: billingRes } = useQuery({
    queryKey: ['lease-billing', leaseId],
    queryFn: () => vehicleLeasesApi.getBilling(leaseId),
    enabled: activeTab === 'billing',
  })

  const lease = leaseRes?.data
  const assignments = vehiclesRes?.data ?? []
  const billing = billingRes?.data
  const activeAssignments = assignments.filter(a => a.isActive)

  const statusMutation = useMutation({
    mutationFn: (status: LeaseStatus) => vehicleLeasesApi.updateStatus(leaseId, status),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['vehicle-lease', leaseId] })
      qc.invalidateQueries({ queryKey: ['vehicle-leases'] })
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
        {/* Ghost icon */}
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Truck size={180} />
        </div>
        <div className="relative px-6 py-6">
          {/* Top row: back + actions */}
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

          {/* Lease identity */}
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
          ...(role !== 'SUPERVISOR' ? [{ key: 'billing', label: 'Billing', icon: <Receipt size={14} /> }] : []),
        ] as { key: 'vehicles' | 'billing'; label: string; icon: React.ReactNode }[]).map(t => (
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
              {assignments.map(a => (
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

                  {/* Division row */}
                  <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Building2 size={12} />
                      {a.divisionName
                        ? <span className="font-medium text-feros-navy">{a.divisionName}</span>
                        : <span className="text-gray-400 italic">No division assigned</span>
                      }
                    </div>
                    {canEdit && a.isActive && (
                      <Button size="sm" variant="ghost"
                        className="text-xs h-6 px-2 text-feros-navy"
                        onClick={() => setAssigningDivisionFor(a)}>
                        {a.divisionName ? 'Change' : 'Assign Division'}
                      </Button>
                    )}
                  </div>

                  {/* Driver row */}
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
                </div>
              ))}
            </div>
          )}

          <AddVehicleDialog leaseId={leaseId} open={showAddVehicle} onClose={() => setShowAddVehicle(false)} />
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
    </div>
  )
}
