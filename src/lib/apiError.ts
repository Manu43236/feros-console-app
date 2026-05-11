/**
 * Extracts a user-friendly error message from an API error.
 * Returns null if the error was already handled (e.g. subscription block —
 * the interceptor in client.ts already showed a toast for those).
 */
export function getApiError(e: unknown, fallback = 'Something went wrong'): string | null {
  const err = e as Record<string, unknown>
  if (err?.isSubscriptionBlock) return null
  const msg = (err?.response as Record<string, unknown>)?.data as Record<string, unknown>
  return (msg?.message as string) ?? fallback
}
