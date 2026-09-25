import { cn } from '@/lib/utils'

const BAR_COUNT = 5
// Staggered start times give the left-to-right "wave" motion.
const BAR_DELAYS = ['-0.4s', '-0.3s', '-0.2s', '-0.1s', '0s']

/**
 * Shared modern loading indicator used across the app — animated pulsing bars
 * (equalizer style). `Spinner` centers itself inside whatever wrapper it's
 * placed in; pass `label` to show text beside it.
 */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center justify-center gap-2 text-feros-navy', className)}
    >
      <span className="flex items-end gap-[3px] h-5" aria-hidden>
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            className="w-[3px] h-full rounded-full bg-current origin-bottom"
            style={{ animation: 'feros-bar 1s ease-in-out infinite', animationDelay: BAR_DELAYS[i] }}
          />
        ))}
      </span>
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
