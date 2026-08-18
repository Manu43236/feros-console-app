import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, isValid } from 'date-fns'
import {
  Wrench, MapPin, Calendar, IndianRupee, FileText,
  CheckCircle, Clock, Circle, Package, User, Play, CheckCircle2,
  Upload, ExternalLink, FileImage,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { servicePartsApi } from '@/api/inventory'
import { vehicleServicesApi } from '@/api/vehicles'
import { toast } from 'sonner'
import type { VehicleServiceRecord, ServicePart } from '@/types'
import { cn } from '@/lib/utils'

function calcDuration(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  try {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
    if (mins < 1) return null
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60), m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  } catch { return null }
}

function fmtDt(d?: string | null) {
  if (!d) return null
  try {
    const parsed = parseISO(d)
    return isValid(parsed) ? format(parsed, 'dd MMM yyyy, hh:mm a') : null
  } catch { return null }
}

function fmtDate(d?: string | null) {
  if (!d) return null
  try {
    // handles both "yyyy-MM-dd" and ISO datetime
    const parsed = parseISO(d)
    return isValid(parsed) ? format(parsed, 'dd MMM yyyy') : null
  } catch { return null }
}

// ── Timeline ──────────────────────────────────────────────────────────────────
interface TimelineEvent {
  label: string
  sub?: string | null
  done: boolean
  active?: boolean
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative pl-6">
      {/* vertical line */}
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-200" />
      <div className="space-y-5">
        {events.map((e, i) => (
          <div key={i} className="relative flex items-start gap-3">
            <div className={cn(
              'absolute -left-6 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white shrink-0 mt-0.5',
              e.done && !e.active ? 'border-green-500' :
              e.active ? 'border-orange-400' :
              'border-gray-200'
            )}>
              {e.done && !e.active
                ? <CheckCircle size={12} className="text-green-500" />
                : e.active
                ? <Clock size={12} className="text-orange-400" />
                : <Circle size={12} className="text-gray-200" />
              }
            </div>
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', e.done ? 'text-gray-800' : 'text-gray-400')}>{e.label}</p>
              {e.sub && <p className="text-xs text-gray-400 mt-0.5">{e.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Part status chip ───────────────────────────────────────────────────────────
function partChip(s: ServicePart['status']) {
  const map = {
    REQUESTED: 'bg-yellow-50 text-yellow-700',
    APPROVED:  'bg-green-50 text-green-700',
    REJECTED:  'bg-red-50 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s]}`}>{s}</span>
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
interface Props {
  service: VehicleServiceRecord | null
  open: boolean
  onClose: () => void
}

function DocUploadCard({
  label, url, onUpload, uploading,
}: { label: string; url?: string; onUpload: (f: File) => void; uploading: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const isImage = url && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <FileImage size={12} /> {label}
      </p>
      {url ? (
        <div className="space-y-2">
          {isImage
            ? <img src={url} alt={label} className="w-full rounded max-h-40 object-contain bg-gray-50" />
            : (
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                <ExternalLink size={12} /> View {label}
              </a>
            )
          }
          <button
            onClick={() => ref.current?.click()}
            disabled={uploading}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <Upload size={11} /> Replace
          </button>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-3 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500 flex items-center justify-center gap-1.5">
          <Upload size={12} /> {uploading ? 'Uploading…' : `Upload ${label}`}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
    </div>
  )
}

export function ServiceDetailModal({ service, open, onClose }: Props) {
  const qc = useQueryClient()
  const [uploadingEstimate, setUploadingEstimate] = useState(false)
  const [uploadingBill, setUploadingBill]         = useState(false)

  const { data: partsData } = useQuery({
    queryKey: ['service-parts', service?.id],
    queryFn: () => servicePartsApi.getByService(service!.id),
    enabled: !!service,
  })
  const parts: ServicePart[] = partsData?.data ?? []

  async function handleUpload(type: 'estimate' | 'bill', file: File) {
    if (!service) return
    const setter = type === 'estimate' ? setUploadingEstimate : setUploadingBill
    setter(true)
    try {
      const fn = type === 'estimate' ? vehicleServicesApi.uploadEstimateDoc : vehicleServicesApi.uploadBillDoc
      await fn(service.id, file)
      qc.invalidateQueries({ queryKey: ['vehicle-services'] })
      toast.success(`${type === 'estimate' ? 'Estimate' : 'Bill'} document uploaded`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setter(false)
    }
  }

  if (!service) return null

  const isCompleted   = service.status === 'COMPLETED'
  const isInProgress  = service.status === 'IN_PROGRESS'

  const timelineEvents: TimelineEvent[] = [
    {
      label: 'Service Created',
      sub: fmtDt(service.createdAt),
      done: true,
    },
    {
      label: 'Work Started',
      sub: service.startedAt ? fmtDt(service.startedAt) : (isInProgress || isCompleted) ? 'Started' : null,
      done: isInProgress || isCompleted,
      active: isInProgress,
    },
    {
      label: 'Completed',
      sub: service.completedDate ? fmtDate(service.completedDate) : null,
      done: isCompleted,
    },
  ]

  const totalTaskCost = service.tasks.reduce((sum, t) => sum + (t.cost ?? 0), 0)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={16} className="text-feros-navy" />
            {service.serviceNumber}
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">{service.vehicleRegistrationNumber}</p>
        </DialogHeader>

        <div className="space-y-5 pt-1">

          {/* ── Info row ── */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <User size={13} className="text-gray-400 shrink-0" />
              <span>
                {service.serviceType === 'INTERNAL'   ? 'Internal (Self)' :
                 service.serviceType === 'OEM_CENTER'  ? `OEM: ${service.vendorName ?? 'Service Center'}` :
                 service.vendorName ?? '3rd Party'}
              </span>
            </div>
            {service.payerType && service.payerType !== 'OWN_EXPENSE' && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                  {service.payerType === 'WARRANTY_OEM' ? 'OEM Warranty' :
                   service.payerType === 'WARRANTY_ANC' ? 'ANC Warranty' :
                   service.payerType === 'INSURANCE'    ? 'Insurance' :
                   service.payerType === 'AMC'          ? 'AMC Contract' : service.payerType}
                </span>
              </div>
            )}
            {service.isEscalated && (
              <div className="col-span-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700">
                  ⚠ Escalated from internal to 3rd party
                </span>
              </div>
            )}
            {service.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={13} className="text-gray-400 shrink-0" />
                <span>{service.location}</span>
              </div>
            )}
            {service.serviceDate && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span>{fmtDate(service.serviceDate)}</span>
              </div>
            )}
            {service.odometer && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-gray-400 text-xs shrink-0">ODO</span>
                <span>{service.odometer.toLocaleString('en-IN')} km</span>
              </div>
            )}
            {service.dueAtOdometer && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-gray-400 text-xs shrink-0">Due at</span>
                <span>{service.dueAtOdometer.toLocaleString('en-IN')} km</span>
              </div>
            )}
          </div>

          {/* ── Insurance details ── */}
          {service.payerType === 'INSURANCE' && (service.insuranceClaimNo || service.insuranceClaimAmt) && (
            <div className="bg-blue-50 rounded-lg px-3 py-2.5 text-sm space-y-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Insurance Claim</p>
              {service.insuranceClaimNo && <p className="text-gray-700">Claim No: <span className="font-medium">{service.insuranceClaimNo}</span></p>}
              {service.insuranceClaimAmt != null && (
                <p className="text-gray-700">Claim Amount: <span className="font-medium flex items-center gap-0.5 inline-flex"><IndianRupee size={11} />{service.insuranceClaimAmt.toLocaleString('en-IN')}</span></p>
              )}
            </div>
          )}

          {/* ── Compliance certificate ── */}
          {service.triggeredBy === 'COMPLIANCE' && (service.certificateNumber || service.certificateValidUntil) && (
            <div className="bg-purple-50 rounded-lg px-3 py-2.5 text-sm space-y-1">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Compliance Certificate</p>
              {service.certificateNumber && <p className="text-gray-700">Certificate No: <span className="font-medium">{service.certificateNumber}</span></p>}
              {service.certificateValidUntil && <p className="text-gray-700">Valid Until: <span className="font-medium">{fmtDate(service.certificateValidUntil)}</span></p>}
            </div>
          )}

          {/* ── Timeline ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
            <Timeline events={timelineEvents} />
          </div>

          {/* ── Tasks ── */}
          {service.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tasks</p>
              <div className="space-y-2">
                {service.tasks.map(t => {
                  const duration = calcDuration(t.mechanicStartedAt, t.mechanicClosedAt)
                  return (
                    <div key={t.id} className="py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            t.status === 'COMPLETED' ? 'bg-green-500' :
                            t.status === 'MECHANIC_CLOSED' ? 'bg-purple-400' : 'bg-gray-300'
                          )} />
                          <span className="text-sm text-gray-700">{t.displayName}</span>
                          {t.isRecurring && t.frequencyKm && (
                            <span className="text-xs text-gray-400">🔄 {t.frequencyKm.toLocaleString('en-IN')} km</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {duration && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{duration}</span>
                          )}
                          {(t.cost ?? 0) > 0 && (
                            <span className="text-sm text-gray-600 flex items-center gap-0.5">
                              <IndianRupee size={11} />{t.cost?.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mechanic + timing */}
                      {(t.assignedMechanicName || t.mechanicStartedAt || t.mechanicClosedAt) && (
                        <div className="mt-1 ml-3.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {t.assignedMechanicName && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <User size={10} className="text-gray-400" /> {t.assignedMechanicName}
                            </span>
                          )}
                          {t.mechanicStartedAt && (
                            <span className="flex items-center gap-1 text-xs text-blue-500">
                              <Play size={9} /> {fmtDt(t.mechanicStartedAt)}
                            </span>
                          )}
                          {t.mechanicClosedAt && (
                            <span className="flex items-center gap-1 text-xs text-purple-500">
                              <CheckCircle2 size={9} /> {fmtDt(t.mechanicClosedAt)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {service.serviceCharges != null && service.serviceCharges > 0 && (
                  <div className="flex justify-between pt-1 text-sm text-gray-700 border-t border-gray-100">
                    <span>Service Charges</span>
                    <span className="flex items-center gap-0.5">
                      <IndianRupee size={11} />{service.serviceCharges.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                {(totalTaskCost > 0 || (service.serviceCharges ?? 0) > 0) && (
                  <div className="flex justify-between pt-1 text-sm font-semibold text-gray-800">
                    <span>Total Cost</span>
                    <span className="flex items-center gap-0.5 text-green-700">
                      <IndianRupee size={12} />
                      {(totalTaskCost + (service.serviceCharges ?? 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Documents ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <FileText size={12} /> Documents
            </p>
            <div className="grid grid-cols-2 gap-3">
              <DocUploadCard
                label="Estimate"
                url={service.estimateDocUrl}
                uploading={uploadingEstimate}
                onUpload={f => handleUpload('estimate', f)}
              />
              <DocUploadCard
                label="Final Bill"
                url={service.billDocUrl}
                uploading={uploadingBill}
                onUpload={f => handleUpload('bill', f)}
              />
            </div>
          </div>

          {/* ── Parts Used ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Package size={12} /> Parts Used
              {parts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                  {parts.length}
                </span>
              )}
            </p>
            {parts.length === 0 ? (
              <p className="text-xs text-gray-400">No parts used</p>
            ) : (
              <div className="space-y-1.5">
                {parts.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{p.partName}</span>
                      <span className="text-xs text-gray-400">{p.quantityRequested} {p.unit}</span>
                      {partChip(p.status)}
                    </div>
                    {p.status === 'REJECTED' && p.rejectionReason && (
                      <span className="text-xs text-red-500 max-w-[150px] truncate">{p.rejectionReason}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          {service.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <FileText size={12} /> Notes
              </p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{service.notes}</p>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}
