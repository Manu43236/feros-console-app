import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehiclesApi } from '@/api/vehicles'
import { tenantMastersApi, globalMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import { format, parseISO, differenceInDays, isValid } from 'date-fns'
import {
  ArrowLeft, Truck, Shield, MapPin, Fuel,
  AlertTriangle, CheckCircle, Clock, Pencil, Power,
  ClipboardList, Route, FileText, Plus, BadgeCheck, Wrench, Droplets, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { VehicleDocument, VehicleStatusType } from '@/types'
import { VehicleForm } from './VehiclesPage'

// ── helpers ───────────────────────────────────────────────────────────────────
type ExpiryLevel = 'expired' | 'critical' | 'warning' | 'ok' | 'none'

function expiryLevel(dateStr?: string): ExpiryLevel {
  if (!dateStr) return 'none'
  const d = parseISO(dateStr)
  if (!isValid(d)) return 'none'
  const days = differenceInDays(d, new Date())
  if (days < 0)   return 'expired'
  if (days <= 7)  return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

// ── compliance row ────────────────────────────────────────────────────────────
function ComplianceRow({ label, docNumber, expiryDate }: { label: string; docNumber?: string; expiryDate?: string }) {
  const level = expiryLevel(expiryDate)
  const days  = expiryDate && isValid(parseISO(expiryDate))
    ? differenceInDays(parseISO(expiryDate), new Date()) : null

  const chip: Record<ExpiryLevel, string> = {
    expired:  'text-red-600 bg-red-50 border-red-200',
    critical: 'text-orange-600 bg-orange-50 border-orange-200',
    warning:  'text-yellow-700 bg-yellow-50 border-yellow-200',
    ok:       'text-green-700 bg-green-50 border-green-200',
    none:     'text-gray-400 bg-gray-50 border-gray-200',
  }

  const icon = level === 'expired' || level === 'critical'
    ? <AlertTriangle size={13} />
    : level === 'ok' ? <CheckCircle size={13} />
    : level === 'warning' ? <Clock size={13} />
    : null

  const text =
    level === 'none'    ? 'Not recorded' :
    level === 'expired' ? `Expired ${Math.abs(days!)}d ago` :
    level === 'ok'      ? `Valid · ${days}d left` : `${days}d left`

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {docNumber && <p className="text-xs text-gray-400 mt-0.5">{docNumber}</p>}
        <p className="text-xs text-gray-400 mt-0.5">Expiry: {fmtDate(expiryDate)}</p>
      </div>
      <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border', chip[level])}>
        {icon}{text}
      </span>
    </div>
  )
}

// ── info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

// ── tabs ─────────────────────────────────────────────────────────────────────
const TABS = ['Basic Info', 'Compliance', 'Documents', 'Service', 'Fuel', 'GPS & Notes', 'Order History', 'Trip History'] as const
type Tab = typeof TABS[number]

// ── add document form ─────────────────────────────────────────────────────────
const docSchema = z.object({
  documentTypeId: z.coerce.number().min(1, 'Select document type'),
  documentNumber: z.string().optional(),
  issueDate:      z.string().optional(),
  expiryDate:     z.string().optional(),
  remarks:        z.string().optional(),
})
type DocForm = z.infer<typeof docSchema>

function AddDocumentDialog({ vehicleId, open, onClose }: { vehicleId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: docTypesRes } = useQuery({ queryKey: ['document-types'], queryFn: globalMastersApi.getDocumentTypes })

  const vehicleDocTypes = (docTypesRes?.data ?? []).filter(d =>
    d.applicableFor === 'VEHICLE' || d.applicableFor === 'BOTH'
  )

  const { register, handleSubmit, formState: { errors }, reset } = useForm<DocForm>({
    resolver: zodResolver(docSchema) as Resolver<DocForm>,
  })

  const mutation = useMutation({
    mutationFn: (data: DocForm) => vehiclesApi.addDocument(vehicleId, data),
    onSuccess: () => {
      toast.success('Document added')
      qc.invalidateQueries({ queryKey: ['vehicle-docs', vehicleId] })
      reset(); onClose()
    },
    onError: () => toast.error('Failed to add document'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Document Type *</Label>
            <select {...register('documentTypeId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Select type</option>
              {vehicleDocTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {errors.documentTypeId && <p className="text-red-500 text-xs">{errors.documentTypeId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Document Number</Label>
            <Input placeholder="DOC123456" {...register('documentNumber')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Issue Date</Label>
              <Input type="date" {...register('issueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" {...register('expiryDate')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Input placeholder="Optional remarks" {...register('remarks')} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Adding…' : 'Add Document'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const vehicleStatusBadge: Record<VehicleStatusType, string> = {
  AVAILABLE:  'bg-green-500/20 border-green-400/40 text-green-300',
  ASSIGNED:   'bg-blue-500/20 border-blue-400/40 text-blue-300',
  ON_TRIP:    'bg-orange-500/20 border-orange-400/40 text-orange-300',
  IN_REPAIR:  'bg-yellow-500/20 border-yellow-400/40 text-yellow-300',
  BREAKDOWN:  'bg-red-500/20 border-red-400/40 text-red-300',
  OTHER:      'bg-white/10 border-white/20 text-white',
}

// ── page ─────────────────────────────────────────────────────────────────────
export function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate      = useNavigate()
  const qc            = useQueryClient()
  const [tab, setTab]         = useState<Tab>('Basic Info')
  const [editOpen, setEditOpen] = useState(false)
  const [addDocOpen, setAddDocOpen] = useState(false)

  const { data: res, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn:  () => vehiclesApi.getById(Number(vehicleId)),
    enabled:  !!vehicleId,
  })
  const { data: statusRes } = useQuery({
    queryKey: ['vehicle-statuses'],
    queryFn:  tenantMastersApi.getVehicleStatuses,
  })
  const { data: docsRes } = useQuery({
    queryKey: ['vehicle-docs', vehicleId],
    queryFn:  () => vehiclesApi.getDocuments(Number(vehicleId)),
    enabled:  !!vehicleId,
  })

  const toggleActiveMutation = useMutation({
    mutationFn: () => vehiclesApi.toggleActive(Number(vehicleId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Vehicle status updated')
    },
    onError: () => toast.error('Status update failed'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: (statusId: number) => vehiclesApi.updateStatus(Number(vehicleId), statusId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Status update failed'),
  })

  const v = res?.data

  if (isLoading) return <div className="p-12 text-center text-gray-400 animate-pulse">Loading vehicle…</div>
  if (!v) return (
    <div className="p-12 text-center text-gray-400">
      <p>Vehicle not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/vehicles')}>Back to Fleet</Button>
    </div>
  )

  const complianceItems = [
    { label: 'Registration Certificate (RC)', docNumber: v.rcNumber,                                                  expiryDate: v.rcExpiryDate },
    { label: 'Insurance',                     docNumber: v.insurancePolicyNumber,                                     expiryDate: v.insuranceExpiryDate },
    { label: 'Permit',                        docNumber: v.permitNumber ? `${v.permitNumber} · ${v.permitType ?? ''}` : undefined, expiryDate: v.permitExpiryDate },
    { label: 'Fitness Certificate',           docNumber: v.fitnessCertificateNumber,                                  expiryDate: v.fitnessExpiryDate },
    { label: 'Pollution (PUC)',               docNumber: v.pucNumber,                                                 expiryDate: v.pollutionExpiryDate },
    { label: 'Road Tax',                      docNumber: v.roadTaxPaidDate ? `Paid: ${fmtDate(v.roadTaxPaidDate)}` : undefined, expiryDate: v.roadTaxExpiryDate },
  ]

  const alertCount = complianceItems.filter(c => ['expired', 'critical'].includes(expiryLevel(c.expiryDate))).length
  const isHired    = v.ownershipTypeName && !v.ownershipTypeName.toUpperCase().includes('OWN')

  return (
    <div className="space-y-0">

      {/* ── Banner ── */}
      <div className="relative bg-gradient-to-br from-feros-navy via-feros-navy to-blue-900 rounded-xl overflow-hidden mb-5">
        {/* decorative truck silhouette */}
        <div className="absolute right-0 top-0 bottom-0 w-64 opacity-5 flex items-center justify-end pr-6 pointer-events-none">
          <Truck size={180} />
        </div>

        <div className="relative px-6 py-6">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4">
            <button
              onClick={() => navigate('/vehicles')}
              className="flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition-colors mt-0.5"
            >
              <ArrowLeft size={15} /> Fleet
            </button>

            <div className="flex items-center gap-2">
              {/* Status select */}
              <div className="flex flex-col items-end gap-1">
                {v.isAssigned && (
                  <span className="text-xs text-yellow-300 font-mono">{v.assignedOrderNumber}</span>
                )}
                <div className="relative flex items-center">
                  <select
                    value={v.isAssigned ? 'assigned' : (v.currentStatusId ?? '')}
                    onChange={e => { const id = Number(e.target.value); if (id) updateStatusMutation.mutate(id) }}
                    disabled={updateStatusMutation.isPending || !!v.isAssigned}
                    className={cn(
                      'h-8 pl-2 pr-6 rounded-lg text-xs border appearance-none transition-colors',
                      v.isAssigned
                        ? 'bg-blue-500/20 border-blue-400/40 text-blue-200 cursor-not-allowed'
                        : cn('cursor-pointer', v.currentStatusType ? vehicleStatusBadge[v.currentStatusType] : 'bg-white/10 border-white/20 text-white hover:bg-white/20'),
                      updateStatusMutation.isPending && 'opacity-60 cursor-wait'
                    )}
                  >
                    {v.isAssigned
                      ? <option value="assigned" className="text-gray-800">Assigned to Order</option>
                      : <>
                          <option value="" className="text-gray-800">No Status</option>
                          {statusRes?.data?.map(s => (
                            <option key={s.id} value={s.id} className="text-gray-800">{s.name}</option>
                          ))}
                        </>
                    }
                  </select>
                  <ChevronDown size={12} className="absolute right-1.5 pointer-events-none text-current opacity-70" />
                </div>
                {v.isAssigned && (
                  <span className="text-xs text-blue-300/70">Unassign from order to change</span>
                )}
              </div>

              {/* Active toggle */}
              <button
                onClick={() => toggleActiveMutation.mutate()}
                disabled={toggleActiveMutation.isPending || (!!v.isActive && !!v.isAssigned)}
                title={v.isActive && v.isAssigned ? 'Unassign from order before deactivating' : undefined}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
                  v.isActive && v.isAssigned
                    ? 'bg-green-500/10 border-green-400/20 text-green-400/50 cursor-not-allowed'
                    : v.isActive
                    ? 'bg-green-500/20 border-green-400/40 text-green-300 hover:bg-green-500/30'
                    : 'bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30'
                )}
              >
                <Power size={12} />
                {v.isActive ? 'Active' : 'Inactive'}
              </button>

            </div>
          </div>

          {/* Vehicle identity */}
          <div className="mt-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white font-mono tracking-wider">{v.registrationNumber}</h1>
              {alertCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-300 bg-red-500/20 border border-red-400/30 px-2 py-1 rounded-full">
                  <AlertTriangle size={11} />
                  {alertCount} compliance alert{alertCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-blue-200 text-sm mt-1.5">
              {[v.brandName, v.vehicleTypeName, v.capacityInTons ? `${v.capacityInTons}T` : null, v.fuelTypeName, v.color]
                .filter(Boolean).join(' · ')}
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Type',       value: v.vehicleTypeName ?? '—' },
              { label: 'Capacity',   value: v.capacityInTons ? `${v.capacityInTons} tons` : '—' },
              { label: 'Ownership',  value: v.ownershipTypeName ?? '—' },
              { label: 'Odometer',   value: v.currentOdometerReading ? `${v.currentOdometerReading.toLocaleString('en-IN')} km` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-300">{label}</p>
                <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t
                  ? 'border-feros-navy text-feros-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
              )}
            >
              {t === 'Basic Info'     && <Truck size={14} />}
              {t === 'Compliance'     && <Shield size={14} />}
              {t === 'Fuel'           && <Fuel size={14} />}
              {t === 'GPS & Notes'    && <MapPin size={14} />}
              {t === 'Documents'      && <FileText size={14} />}
              {t === 'Service'        && <Wrench size={14} />}
              {t === 'Fuel'           && <Droplets size={14} />}
              {t === 'Order History'  && <ClipboardList size={14} />}
              {t === 'Trip History'   && <Route size={14} />}
              {t}
              {t === 'Compliance' && alertCount > 0 && (
                <span className="ml-1 text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-semibold">
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">

          {/* ── Basic Info ── */}
          {tab === 'Basic Info' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic Information</p>
                <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Pencil size={13} /> Edit
                </Button>
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle Details</p>
                <InfoRow label="Brand"         value={v.brandName} />
                <InfoRow label="Vehicle Type"  value={v.vehicleTypeName} />
                <InfoRow label="Fuel Type"     value={v.fuelTypeName} />
                <InfoRow label="Ownership"     value={v.ownershipTypeName} />
                <InfoRow label="Capacity"      value={v.capacityInTons ? `${v.capacityInTons} tons` : null} />
                <InfoRow label="Mfg. Year"     value={v.manufactureYear} />
                <InfoRow label="Color"         value={v.color} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identification</p>
                <InfoRow label="Chassis No."   value={v.chassisNumber} />
                <InfoRow label="Engine No."    value={v.engineNumber} />
                <InfoRow label="RC Number"     value={v.rcNumber} />
                <InfoRow label="Permit No."    value={v.permitNumber} />
                <InfoRow label="Permit Type"   value={v.permitType} />
                <InfoRow label="PUC No."       value={v.pucNumber} />
                <InfoRow label="Fitness Cert." value={v.fitnessCertificateNumber} />
              </div>
              {isHired && (
                <div className="sm:col-span-2 border-t pt-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Owner / Hired Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    <InfoRow label="Owner Name"       value={v.ownerName} />
                    <InfoRow label="Phone"            value={v.ownerPhone} />
                    <InfoRow label="PAN Number"       value={v.ownerPan} />
                    <InfoRow label="Address"          value={v.ownerAddress} />
                    <InfoRow label="Agreement Start"  value={fmtDate(v.agreementStartDate)} />
                    <InfoRow label="Agreement End"    value={fmtDate(v.agreementEndDate)} />
                    <InfoRow label="Agreement Amount" value={v.agreementAmount ? `₹${v.agreementAmount.toLocaleString('en-IN')}` : null} />
                  </div>
                </div>
              )}
            </div>
            </div>
          )}

          {/* ── Compliance ── */}
          {tab === 'Compliance' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Compliance & Documents</p>
                <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Pencil size={13} /> Edit
                </Button>
              </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Document Status</p>
                {complianceItems.map(c => <ComplianceRow key={c.label} {...c} />)}
              </div>
              <div className="space-y-5">
                {/* Insurance detail */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Insurance Details</p>
                  <InfoRow label="Company"     value={v.insuranceCompanyName} />
                  <InfoRow label="Policy No."  value={v.insurancePolicyNumber} />
                  <InfoRow label="Start Date"  value={fmtDate(v.insuranceStartDate)} />
                  <InfoRow label="Expiry Date" value={fmtDate(v.insuranceExpiryDate)} />
                </div>
                {/* Permit detail */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Permit Details</p>
                  <InfoRow label="Permit No."  value={v.permitNumber} />
                  <InfoRow label="Type"        value={v.permitType} />
                  <InfoRow label="Start Date"  value={fmtDate(v.permitStartDate)} />
                  <InfoRow label="Expiry Date" value={fmtDate(v.permitExpiryDate)} />
                </div>
                {/* Road Tax */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Road Tax</p>
                  <InfoRow label="Paid Date"   value={fmtDate(v.roadTaxPaidDate)} />
                  <InfoRow label="Expiry Date" value={fmtDate(v.roadTaxExpiryDate)} />
                </div>
              </div>
            </div>
            </div>
          )}

          {/* ── Service ── */}
          {tab === 'Service' && (
            <div className="py-10 text-center text-gray-400">
              <Wrench size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Service History</p>
              <p className="text-xs mt-1">Maintenance records, tyre changes, and service logs will appear here.</p>
            </div>
          )}

          {/* ── Fuel ── */}
          {tab === 'Fuel' && (
            <div className="py-10 text-center text-gray-400">
              <Droplets size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Fuel Log</p>
              <p className="text-xs mt-1">Fuel fill-ups, quantity, cost, and mileage tracking will appear here.</p>
            </div>
          )}

          {/* ── GPS & Notes ── */}
          {tab === 'GPS & Notes' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GPS & Notes</p>
                <Button size="sm" onClick={() => setEditOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Pencil size={13} /> Edit
                </Button>
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">GPS Tracking</p>
                <InfoRow label="Device No."   value={v.gpsDeviceNumber} />
                <InfoRow label="IMEI"         value={v.gpsDeviceImei} />
                <InfoRow label="Provider"     value={v.gpsProvider} />
                <InfoRow label="Odometer"     value={v.currentOdometerReading ? `${v.currentOdometerReading.toLocaleString('en-IN')} km` : null} />
              </div>
              {v.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">{v.notes}</p>
                </div>
              )}
            </div>
            </div>
          )}

          {/* ── Documents ── */}
          {tab === 'Documents' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Uploaded Documents</p>
                <Button size="sm" onClick={() => setAddDocOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5 h-8 text-xs">
                  <Plus size={13} /> Add Document
                </Button>
              </div>
              {(docsRes?.data ?? []).length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <FileText size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(docsRes?.data ?? []).map((doc: VehicleDocument) => {
                    const level = expiryLevel(doc.expiryDate)
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-3.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <FileText size={15} className="text-feros-navy" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{doc.documentTypeName ?? `Document #${doc.id}`}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {doc.documentNumber && `${doc.documentNumber} · `}
                              {doc.issueDate && `Issued: ${fmtDate(doc.issueDate)}`}
                              {doc.expiryDate && ` · Expires: ${fmtDate(doc.expiryDate)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {level !== 'none' && (
                            <span className={cn('text-xs px-2 py-1 rounded-full', {
                              'bg-red-50 text-red-600':    level === 'expired',
                              'bg-orange-50 text-orange-600': level === 'critical',
                              'bg-yellow-50 text-yellow-700': level === 'warning',
                              'bg-green-50 text-green-700':   level === 'ok',
                            })}>
                              {level === 'expired' ? 'Expired' : level === 'ok' ? 'Valid' : `${differenceInDays(parseISO(doc.expiryDate!), new Date())}d left`}
                            </span>
                          )}
                          {doc.isVerified ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              <BadgeCheck size={12} /> Verified
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Pending</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Order History ── */}
          {tab === 'Order History' && (
            <div className="py-10 text-center text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Order History</p>
              <p className="text-xs mt-1">Orders assigned to this vehicle will appear here.</p>
            </div>
          )}

          {/* ── Trip History ── */}
          {tab === 'Trip History' && (
            <div className="py-10 text-center text-gray-400">
              <Route size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-500">Trip History</p>
              <p className="text-xs mt-1">Completed trips and LRs for this vehicle will appear here.</p>
            </div>
          )}

        </div>
      </div>

      <VehicleForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        vehicle={v}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })}
      />
      <AddDocumentDialog vehicleId={v.id} open={addDocOpen} onClose={() => setAddDocOpen(false)} />
    </div>
  )
}
