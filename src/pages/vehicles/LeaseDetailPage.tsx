import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vehicleLeasesApi } from '@/api/vehicleLeases'
import { vehiclesApi } from '@/api/vehicles'
import { clientsApi } from '@/api/clients'
import { staffApi } from '@/api/staff'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Truck, CalendarDays, MapPin,
  X, Receipt, User, Gauge,
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
  DRAFT:  'bg-gray-100/80 text-gray-600',
  ACTIVE: 'bg-green-100/80 text-green-700',
  CLOSED: 'bg-slate-100/80 text-slate-500',
}
const STATUS_LABELS: Record<LeaseStatus, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', CLOSED: 'Closed',
}
const NEXT_STATUSES: Partial<Record<LeaseStatus, LeaseStatus[]>> = {
  DRAFT:  ['ACTIVE'],
  ACTIVE: ['CLOSED'],
}

// ── Add Vehicle Dialog ─────────────────────────────────────────────────────────
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
  const drivers = (staffRes?.data ?? []).filter(s => s.role === 'DRIVER')

  const vehicleOptions = vehicles.map(v => ({
    value: String(v.id),
    label: `${v.registrationNumber}${v.vehicleTypeName ? ` — ${v.vehicleTypeName}` : ''}`,
  }))
  const driverOptions = drivers.map(d => ({
    value: String(d.id),
    label: d.name,
  }))

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
              options={vehicleOptions}
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="Search by reg. number"
            />
          </div>

          <div>
            <Label>Driver (optional — leave blank if client provides driver)</Label>
            <SearchableSelect
              options={driverOptions}
              value={driverStaffId}
              onChange={setDriverStaffId}
              placeholder="Select driver"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rate per Vehicle *</Label>
              <Input
                type="number"
                value={ratePerVehicle}
                onChange={e => setRatePerVehicle(e.target.value)}
                placeholder="e.g. 18000"
              />
            </div>
            <div>
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Odometer at Start (km)</Label>
            <Input
              type="number"
              value={odometerAtStart}
              onChange={e => setOdometerAtStart(e.target.value)}
              placeholder="e.g. 45200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!vehicleId || !ratePerVehicle || mutation.isPending}
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

// ── Close Vehicle Dialog ───────────────────────────────────────────────────────
function CloseVehicleDialog({
  leaseId, assignment, open, onClose,
}: { leaseId: number; assignment: LeaseVehicleAssignment; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [odometer, setOdometer] = useState('')

  const mutation = useMutation({
    mutationFn: () => vehicleLeasesApi.closeVehicle(
      leaseId, assignment.id, odometer ? Number(odometer) : undefined
    ),
    onSuccess: () => {
      toast.success('Vehicle assignment closed')
      qc.invalidateQueries({ queryKey: ['lease-vehicles', leaseId] })
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
        <DialogHeader>
          <DialogTitle>Close Vehicle Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-gray-600">
            Closing <strong>{assignment.registrationNumber}</strong> from this lease.
            Record the odometer at return if available.
          </p>
          <div>
            <Label>Odometer at Return (km)</Label>
            <Input
              type="number"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              placeholder="e.g. 47800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white">
              {mutation.isPending ? 'Closing…' : 'Close Assignment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Vehicle Card ───────────────────────────────────────────────────────────────
function VehicleCard({
  assignment, leaseId, canEdit,
}: { assignment: LeaseVehicleAssignment; leaseId: number; canEdit: boolean }) {
  const [showClose, setShowClose] = useState(false)

  return (
    <div className={cn(
      'bg-white rounded-xl border p-4 space-y-3',
      assignment.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Truck size={14} className="text-feros-navy" />
            <span className="font-semibold text-gray-900 text-sm">{assignment.registrationNumber}</span>
            {!assignment.isActive && (
              <Badge className="text-xs bg-slate-100 text-slate-500 border-0">Closed</Badge>
            )}
          </div>
          {assignment.vehicleType && (
            <p className="text-xs text-gray-400 mt-0.5 ml-5">{assignment.vehicleType}</p>
          )}
        </div>
        {canEdit && assignment.isActive && (
          <Button
            size="sm" variant="ghost"
            onClick={() => setShowClose(true)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 -mr-1 h-7 px-2 text-xs">
            <X size={12} className="mr-1" /> Close
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          <User size={11} className="text-gray-400" />
          <span>{assignment.driverName ?? 'Client\'s driver'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <Receipt size={11} className="text-gray-400" />
          <span>₹{assignment.ratePerVehicle.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <CalendarDays size={11} className="text-gray-400" />
          <span>{assignment.startDate}{assignment.endDate ? ` → ${assignment.endDate}` : ''}</span>
        </div>
        {(assignment.odometerAtStart != null || assignment.odometerAtEnd != null) && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Gauge size={11} className="text-gray-400" />
            <span>
              {assignment.odometerAtStart ?? '—'} km
              {assignment.odometerAtEnd != null ? ` → ${assignment.odometerAtEnd} km` : ''}
            </span>
          </div>
        )}
      </div>

      {showClose && (
        <CloseVehicleDialog
          leaseId={leaseId}
          assignment={assignment}
          open={showClose}
          onClose={() => setShowClose(false)}
        />
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
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
      {/* Banner */}
      <div className="bg-gradient-to-r from-feros-navy to-feros-navy/80 rounded-2xl p-5 text-white">
        <button
          onClick={() => navigate('/vehicles/leases')}
          className="flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={14} /> Back to Leases
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{lease.leaseNumber}</h1>
              <Badge className={cn('text-xs font-medium border-0', STATUS_COLORS[lease.status])}>
                {STATUS_LABELS[lease.status]}
              </Badge>
            </div>
            <p className="text-white/80 mt-1 font-medium">{lease.clientName}</p>
            {lease.site && (
              <p className="text-white/60 text-sm flex items-center gap-1 mt-0.5">
                <MapPin size={12} /> {lease.site}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-white/70 text-sm">
              <span className="flex items-center gap-1">
                <CalendarDays size={13} />
                {lease.startDate}{lease.endDate ? ` → ${lease.endDate}` : ' (open-ended)'}
              </span>
              <span>·</span>
              <span>{lease.rateType === 'MONTHLY' ? 'Monthly rate' : 'Daily rate'}</span>
              <span>·</span>
              <span>{lease.vehicleCount} vehicle{lease.vehicleCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <Button
                size="sm" variant="outline"
                onClick={() => setShowExtend(true)}
                className="border-white/30 text-white hover:bg-white/10 bg-transparent h-8 text-xs">
                Extend
              </Button>
            )}
            {nextStatuses.map(s => (
              <Button key={s} size="sm"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
                className={cn('h-8 text-xs', s === 'CLOSED'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white text-feros-navy hover:bg-white/90')}>
                {s === 'ACTIVE' ? 'Activate' : 'Close Lease'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Extend dialog */}
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
                <Button
                  disabled={!extendDate || extendMutation.isPending}
                  onClick={() => extendMutation.mutate(extendDate)}
                  className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                  {extendMutation.isPending ? 'Extending…' : 'Extend'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {(['vehicles', 'billing'] as const).map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize -mb-px',
              activeTab === tab
                ? 'border-feros-navy text-feros-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {tab === 'vehicles' ? `Vehicles (${assignments.length})` : 'Billing'}
          </button>
        ))}
      </div>

      {/* Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          {canEdit && (
            <Button
              onClick={() => setShowAddVehicle(true)}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
              <Plus size={16} /> Add Vehicle
            </Button>
          )}

          {assignments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Truck size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No vehicles added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {assignments.map(a => (
                <VehicleCard key={a.id} assignment={a} leaseId={leaseId} canEdit={canEdit} />
              ))}
            </div>
          )}

          <AddVehicleDialog
            leaseId={leaseId}
            open={showAddVehicle}
            onClose={() => setShowAddVehicle(false)}
          />
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          {!billing ? (
            <div className="text-sm text-gray-400 py-8 text-center">Loading billing…</div>
          ) : billing.lines.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Receipt size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No vehicles — no billing to show</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Rate</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Days</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.lines.map(line => (
                    <tr key={line.assignmentId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{line.registrationNumber}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        ₹{line.ratePerVehicle.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{line.days}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{line.amount.toLocaleString('en-IN')}
                      </td>
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
    </div>
  )
}
