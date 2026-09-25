import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a spare-part number only if it's a real, human-entered one.
 * Auto-generated numbers look like `ASLR_PART_20260708145424354` ({PREFIX}_PART_{digits})
 * and are noise to users, so we hide them.
 */
export function realPartNumber(partNumber?: string | null): string | null {
  if (!partNumber) return null
  return /_PART_\d+$/.test(partNumber) ? null : partNumber
}
