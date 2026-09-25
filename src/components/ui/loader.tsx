import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared modern loading indicator used across the app.
 *
 * `Spinner` is a drop-in replacement for the old inline `Loading…` text — it
 * renders a smooth brand-coloured spinner and centers itself inside whatever
 * wrapper it's placed in. Pass `label` to show text beside it.
 */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center justify-center gap-2 text-feros-navy', className)}
    >
      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
      {label && <span className="text-sm text-gray-500">{label}</span>}
      <span className="sr-only">Loading</span>
    </span>
  )
}

/** Full-height centered loader for whole-page / large-section loading states. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner label={label} />
    </div>
  )
}
