import { useQuery } from '@tanstack/react-query'
import { format, parseISO, isValid } from 'date-fns'
import {
  Wrench, MapPin, Calendar, IndianRupee, FileText,
  CheckCircle, Clock, Circle, Package, User,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { servicePartsApi } from '@/api/inventory'
import type { VehicleServiceRecord, ServicePart } from '@/types'
import { cn } from '@/lib/utils'

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

export function ServiceDetailModal({ service, open, onClose }: Props) {
  const { data: partsData } = useQuery({
    queryKey: ['service-parts', service?.id],
    queryFn: () => servicePartsApi.getByService(service!.id),
    enabled: !!service,
  })
  const parts: ServicePart[] = partsData?.data ?? []

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
            {service.serviceType === 'EXTERNAL' && service.vendorName && (
              <div className="flex items-center gap-2 text-gray-600">
                <User size={13} className="text-gray-400 shrink-0" />
                <span>{service.vendorName}</span>
              </div>
            )}
            {service.serviceType === 'INTERNAL' && (
              <div className="flex items-center gap-2 text-gray-600">
                <User size={13} className="text-gray-400 shrink-0" />
                <span>Internal (Self)</span>
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

          {/* ── Timeline ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
            <Timeline events={timelineEvents} />
          </div>

          {/* ── Tasks ── */}
          {service.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tasks</p>
              <div className="space-y-1.5">
                {service.tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        t.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-300'
                      )} />
                      <span className="text-sm text-gray-700">{t.displayName}</span>
                      {t.isRecurring && t.frequencyKm && (
                        <span className="text-xs text-gray-400">🔄 {t.frequencyKm.toLocaleString('en-IN')} km</span>
                      )}
                    </div>
                    {(t.cost ?? 0) > 0 && (
                      <span className="text-sm text-gray-600 flex items-center gap-0.5">
                        <IndianRupee size={11} />{t.cost?.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                ))}
                {totalTaskCost > 0 && (
                  <div className="flex justify-between pt-1 text-sm font-semibold text-gray-800">
                    <span>Total Cost</span>
                    <span className="flex items-center gap-0.5 text-green-700">
                      <IndianRupee size={12} />{totalTaskCost.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

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
