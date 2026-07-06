import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { subscriptionsApi } from '@/api/superadmin'
import { useAuthStore } from '@/store/authStore'
import { differenceInDays, parseISO } from 'date-fns'

export function SubscriptionExpiryBanner() {
  const role       = useAuthStore(s => s.role)
  const tenantId   = useAuthStore(s => s.tenantId)
  const companyName = useAuthStore(s => s.companyName)

  const dismissedKey = `feros_sub_dismissed_${tenantId}`

  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissedKey) === '1')

  const { data: subRes } = useQuery({
    queryKey: ['subscription-my'],
    queryFn: subscriptionsApi.getMy,
    enabled: role === 'ADMIN' && !dismissed,
  })

  if (role !== 'ADMIN' || dismissed) return null

  const sub = subRes?.data
  if (!sub?.endDate) return null

  const daysLeft = differenceInDays(parseISO(sub.endDate), new Date())
  if (daysLeft > 7) return null

  const isTrial    = sub.status === 'TRIAL'
  const typeLabel  = isTrial ? 'trial version' : 'subscription'
  const expired    = daysLeft < 0
  const daysLabel  = daysLeft === 0 ? 'today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`

  return (
    <div className="rounded-2xl bg-red-600 text-white px-4 py-3.5 flex items-center gap-4">
      <p className="flex-1 text-sm font-medium leading-snug">
        Dear <span className="font-bold">{companyName}</span>, your{' '}
        <span className="font-semibold">{typeLabel}</span>{' '}
        {expired
          ? <>has <span className="font-bold">expired</span>.</>
          : <>is expiring in <span className="font-bold">{daysLabel}</span>.</>
        }{' '}
        Contact <span className="font-semibold">FEROS Support</span> team to renew.
      </p>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => { localStorage.setItem(dismissedKey, '1'); setDismissed(true) }}
          className="text-white/80 hover:text-white p-1 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
