import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vehiclesApi } from '@/api/vehicles'
import { globalMastersApi, tenantMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import { format, parseISO, differenceInDays, isValid } from 'date-fns'
import {
  ArrowLeft, Truck, Shield, MapPin, Fuel,
  AlertTriangle, CheckCircle, Clock, Pencil, Power,
  ClipboardList, Route,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Vehicle } from '@/types'

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
const TABS = ['Basic Info', 'Compliance', 'Owner Details', 'GPS & Notes', 'Order History', 'Trip History'] as const
type Tab = typeof TABS[number]

// ── page ─────────────────────────────────────────────────────────────────────
export function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate      = useNavigate()
  const qc            = useQueryClient()
  const [tab, setTab] = useState<Tab>('Basic Info')

  const { data: res, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn:  () => vehiclesApi.getById(Number(vehicleId)),
    enabled:  !!vehicleId,
  })
  const { data: statusRes } = useQuery({
    queryKey: ['vehicle-statuses'],
    queryFn:  tenantMastersApi.getVehicleStatuses,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Vehicle>) => vehiclesApi.update(Number(vehicleId), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] })
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Vehicle updated')
    },
    onError: () => toast.error('Update failed'),
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
              <select
                value={v.currentStatusId ?? ''}
                onChange={e => updateMutation.mutate({ currentStatusId: Number(e.target.value) || undefined })}
                className="h-8 px-2 rounded-lg text-xs bg-white/10 border border-white/20 text-white appearance-none cursor-pointer hover:bg-white/20 transition-colors"
              >
                <option value="" className="text-gray-800">No Status</option>
                {statusRes?.data?.map(s => (
                  <option key={s.id} value={s.id} className="text-gray-800">{s.name}</option>
                ))}
              </select>

              {/* Active toggle */}
              <button
                onClick={() => updateMutation.mutate({ isActive: !v.isActive })}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
                  v.isActive
                    ? 'bg-green-500/20 border-green-400/40 text-green-300 hover:bg-green-500/30'
                    : 'bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30'
                )}
              >
                <Power size={12} />
                {v.isActive ? 'Active' : 'Inactive'}
              </button>

              {/* Edit */}
              <button
                onClick={() => navigate('/vehicles', { state: { editId: v.id } })}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              >
                <Pencil size={12} /> Edit
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
              {t === 'Owner Details'  && <Fuel size={14} />}
              {t === 'GPS & Notes'    && <MapPin size={14} />}
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
            </div>
          )}

          {/* ── Compliance ── */}
          {tab === 'Compliance' && (
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
          )}

          {/* ── Owner Details ── */}
          {tab === 'Owner Details' && (
            isHired ? (
              <div className="max-w-lg">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Hired / Attached Owner</p>
                <InfoRow label="Owner Name"       value={v.ownerName} />
                <InfoRow label="Phone"            value={v.ownerPhone} />
                <InfoRow label="PAN Number"       value={v.ownerPan} />
                <InfoRow label="Address"          value={v.ownerAddress} />
                <InfoRow label="Agreement Start"  value={fmtDate(v.agreementStartDate)} />
                <InfoRow label="Agreement End"    value={fmtDate(v.agreementEndDate)} />
                <InfoRow label="Agreement Amount" value={v.agreementAmount ? `₹${v.agreementAmount.toLocaleString('en-IN')}` : null} />
              </div>
            ) : (
              <div className="py-10 text-center text-gray-400">
                <Fuel size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm">This is an own vehicle — no hired owner details.</p>
              </div>
            )
          )}

          {/* ── GPS & Notes ── */}
          {tab === 'GPS & Notes' && (
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
    </div>
  )
}
