import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { vehiclesApi } from '@/api/vehicles'
import { format, parseISO, differenceInDays, isValid } from 'date-fns'
import {
  ArrowLeft, Truck, Shield, FileCheck, Gauge, MapPin,
  AlertTriangle, CheckCircle, Clock, Fuel,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── expiry helpers ─────────────────────────────────────────────────────────────
type ExpiryLevel = 'expired' | 'critical' | 'warning' | 'ok' | 'none'

function expiryLevel(dateStr?: string): ExpiryLevel {
  if (!dateStr) return 'none'
  const d = parseISO(dateStr)
  if (!isValid(d)) return 'none'
  const days = differenceInDays(d, new Date())
  if (days < 0)  return 'expired'
  if (days <= 7)  return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

function ComplianceRow({
  label, docNumber, expiryDate,
}: {
  label: string; docNumber?: string; expiryDate?: string
}) {
  const level = expiryLevel(expiryDate)
  const days  = expiryDate && isValid(parseISO(expiryDate))
    ? differenceInDays(parseISO(expiryDate), new Date())
    : null

  const colors: Record<ExpiryLevel, string> = {
    expired:  'text-red-600 bg-red-50 border-red-100',
    critical: 'text-orange-600 bg-orange-50 border-orange-100',
    warning:  'text-yellow-700 bg-yellow-50 border-yellow-100',
    ok:       'text-green-700 bg-green-50 border-green-100',
    none:     'text-gray-400 bg-gray-50 border-gray-100',
  }
  const icon = level === 'expired' || level === 'critical'
    ? <AlertTriangle size={14} />
    : level === 'ok'
    ? <CheckCircle size={14} />
    : level === 'warning'
    ? <Clock size={14} />
    : null

  const statusText =
    level === 'none'    ? 'No date recorded' :
    level === 'expired' ? `Expired ${Math.abs(days!)}d ago` :
    level === 'ok'      ? `Valid · ${days}d left` :
                          `${days}d left`

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {docNumber && <p className="text-xs text-gray-400 mt-0.5">{docNumber}</p>}
        <p className="text-xs text-gray-500 mt-0.5">Expiry: {fmtDate(expiryDate)}</p>
      </div>
      <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border', colors[level])}>
        {icon}
        {statusText}
      </span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────
export function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const navigate = useNavigate()

  const { data: res, isLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => vehiclesApi.getById(Number(vehicleId)),
    enabled: !!vehicleId,
  })

  const v = res?.data

  if (isLoading) {
    return <div className="p-12 text-center text-gray-400 animate-pulse">Loading vehicle…</div>
  }
  if (!v) {
    return (
      <div className="p-12 text-center text-gray-400">
        <p>Vehicle not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/vehicles')}>Back to Fleet</Button>
      </div>
    )
  }

  const complianceItems = [
    { label: 'Registration Certificate (RC)', docNumber: v.rcNumber, expiryDate: v.rcExpiryDate },
    { label: 'Insurance', docNumber: v.insurancePolicyNumber, expiryDate: v.insuranceExpiryDate },
    { label: 'Permit', docNumber: v.permitNumber ? `${v.permitNumber} · ${v.permitType ?? ''}` : undefined, expiryDate: v.permitExpiryDate },
    { label: 'Fitness Certificate', docNumber: v.fitnessCertificateNumber, expiryDate: v.fitnessExpiryDate },
    { label: 'Pollution (PUC)', docNumber: v.pucNumber, expiryDate: v.pollutionExpiryDate },
    { label: 'Road Tax', docNumber: v.roadTaxPaidDate ? `Paid: ${fmtDate(v.roadTaxPaidDate)}` : undefined, expiryDate: v.roadTaxExpiryDate },
  ]

  const alertCount = complianceItems.filter(c =>
    ['expired', 'critical'].includes(expiryLevel(c.expiryDate))
  ).length

  const isHired = v.ownershipTypeName && !v.ownershipTypeName.toUpperCase().includes('OWN')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/vehicles')} className="mt-0.5">
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{v.registrationNumber}</h1>
            <Badge className={cn('text-xs', v.isActive
              ? 'bg-green-50 text-green-700 hover:bg-green-50'
              : 'bg-red-50 text-red-700 hover:bg-red-50'
            )}>
              {v.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {v.currentStatusName && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{v.currentStatusName}</span>
            )}
            {alertCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                <AlertTriangle size={12} />
                {alertCount} compliance alert{alertCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {[v.brandName, v.vehicleTypeName, v.capacityInTons ? `${v.capacityInTons}T` : null]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column: basic info + owner */}
        <div className="space-y-5">
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={16} className="text-feros-navy" />
              <h2 className="font-semibold text-gray-800">Vehicle Info</h2>
            </div>
            <InfoRow label="Brand"         value={v.brandName} />
            <InfoRow label="Type"          value={v.vehicleTypeName} />
            <InfoRow label="Fuel"          value={v.fuelTypeName} />
            <InfoRow label="Ownership"     value={v.ownershipTypeName} />
            <InfoRow label="Capacity"      value={v.capacityInTons ? `${v.capacityInTons} tons` : null} />
            <InfoRow label="Mfg. Year"     value={v.manufactureYear} />
            <InfoRow label="Color"         value={v.color} />
            <InfoRow label="Chassis No."   value={v.chassisNumber} />
            <InfoRow label="Engine No."    value={v.engineNumber} />
          </div>

          {/* GPS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-feros-navy" />
              <h2 className="font-semibold text-gray-800">GPS & Odometer</h2>
            </div>
            <InfoRow label="GPS Device"   value={v.gpsDeviceNumber} />
            <InfoRow label="GPS IMEI"     value={v.gpsDeviceImei} />
            <InfoRow label="GPS Provider" value={v.gpsProvider} />
            <InfoRow label="Odometer"     value={v.currentOdometerReading ? `${v.currentOdometerReading.toLocaleString('en-IN')} km` : null} />
          </div>

          {/* Owner Info (hired) */}
          {isHired && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Fuel size={16} className="text-feros-orange" />
                <h2 className="font-semibold text-gray-800">Owner / Hired Details</h2>
              </div>
              <InfoRow label="Owner Name"   value={v.ownerName} />
              <InfoRow label="Phone"        value={v.ownerPhone} />
              <InfoRow label="PAN"          value={v.ownerPan} />
              <InfoRow label="Address"      value={v.ownerAddress} />
              <InfoRow label="Agr. Start"   value={fmtDate(v.agreementStartDate)} />
              <InfoRow label="Agr. End"     value={fmtDate(v.agreementEndDate)} />
              <InfoRow label="Agr. Amount"  value={v.agreementAmount ? `₹${v.agreementAmount.toLocaleString('en-IN')}` : null} />
            </div>
          )}

          {/* Notes */}
          {v.notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
              <p className="text-sm text-gray-600">{v.notes}</p>
            </div>
          )}
        </div>

        {/* Right column: compliance */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-feros-navy" />
              <h2 className="font-semibold text-gray-800">Compliance & Document Status</h2>
              <span className="ml-auto text-xs text-gray-400">{complianceItems.length} documents tracked</span>
            </div>
            <div>
              {complianceItems.map(c => (
                <ComplianceRow key={c.label} {...c} />
              ))}
            </div>
          </div>

          {/* Insurance detail */}
          {(v.insuranceCompanyName || v.insurancePolicyNumber) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-5">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck size={16} className="text-feros-navy" />
                <h2 className="font-semibold text-gray-800">Insurance Details</h2>
              </div>
              <InfoRow label="Company"       value={v.insuranceCompanyName} />
              <InfoRow label="Policy No."    value={v.insurancePolicyNumber} />
              <InfoRow label="Start Date"    value={fmtDate(v.insuranceStartDate)} />
              <InfoRow label="Expiry Date"   value={fmtDate(v.insuranceExpiryDate)} />
            </div>
          )}

          {/* Permit detail */}
          {v.permitNumber && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-5">
              <div className="flex items-center gap-2 mb-4">
                <Gauge size={16} className="text-feros-navy" />
                <h2 className="font-semibold text-gray-800">Permit Details</h2>
              </div>
              <InfoRow label="Permit No."    value={v.permitNumber} />
              <InfoRow label="Type"          value={v.permitType} />
              <InfoRow label="Start Date"    value={fmtDate(v.permitStartDate)} />
              <InfoRow label="Expiry Date"   value={fmtDate(v.permitExpiryDate)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
