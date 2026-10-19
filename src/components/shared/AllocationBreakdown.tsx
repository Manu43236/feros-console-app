import type { AllocationSummary } from '@/types'

type Bucket = { key: keyof AllocationSummary; label: string; cls: string }

// Order matches the lifecycle: assigned → on trip → delivered → billed → cancelled.
const BUCKETS: Bucket[] = [
  { key: 'allocated', label: 'Allocated',       cls: 'bg-gray-100 text-gray-700' },
  { key: 'inTrip',    label: 'On Trip',         cls: 'bg-blue-100 text-blue-700' },
  { key: 'delivered', label: 'Delivered',       cls: 'bg-amber-100 text-amber-700' },
  { key: 'invoiced',  label: 'Billed',          cls: 'bg-green-100 text-green-700' },
  { key: 'cancelled', label: 'Cancelled',       cls: 'bg-red-100 text-red-700' },
]

interface Props {
  summary?: AllocationSummary
  /** compact = count-only pills (list rows); full = count + label (detail). */
  compact?: boolean
}

/** Vehicle allocation breakdown by stage. Zero buckets are hidden. */
export function AllocationBreakdown({ summary, compact = false }: Props) {
  if (!summary || summary.total === 0) {
    return <span className="text-sm text-gray-400">0</span>
  }

  const shown = BUCKETS.filter(b => (summary[b.key] ?? 0) > 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map(b => (
        <span
          key={b.key}
          title={b.label}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${b.cls}`}
        >
          <span className="font-semibold">{summary[b.key]}</span>
          {!compact && <span>{b.label}</span>}
        </span>
      ))}
    </div>
  )
}
