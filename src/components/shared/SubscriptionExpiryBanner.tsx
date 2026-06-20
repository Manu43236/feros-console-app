import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, CheckCircle2 } from 'lucide-react'
import { subscriptionsApi } from '@/api/superadmin'
import { useAuthStore } from '@/store/authStore'
import { differenceInDays, parseISO } from 'date-fns'
import { toast } from 'sonner'

export function SubscriptionExpiryBanner() {
  const role       = useAuthStore(s => s.role)
  const tenantId   = useAuthStore(s => s.tenantId)
  const companyName = useAuthStore(s => s.companyName)

  const dismissedKey = `feros_sub_dismissed_${tenantId}`
  const requestedKey = `feros_sub_requested_${tenantId}`

  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissedKey) === '1')
  const [requested, setRequested] = useState(() => localStorage.getItem(requestedKey) === '1')

  const { data: subRes } = useQuery({
    queryKey: ['subscription-my'],
    queryFn: subscriptionsApi.getMy,
    enabled: role === 'ADMIN' && !dismissed,
  })

  const requestMutation = useMutation({
    mutationFn: () => subscriptionsApi.submitUpgradeRequest({
      planId: subRes?.data?.planId,
      vehicleCount: subRes?.data?.vehicleCount,
      billingCycle: subRes?.data?.billingCycle,
      notes: `Subscription renewal request from ${companyName}`,
    }),
    onSuccess: () => {
      localStorage.setItem(requestedKey, '1')
      setRequested(true)
      toast.success('Renewal request sent to FEROS support!')
    },
    onError: () => toast.error('Failed to send request. Please try again.'),
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
    <div className="rounded-2xl bg-red-600 text-white px-4 py-3.5 flex gap-3 items-start">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">
          Dear <span className="font-bold">{companyName}</span>, your{' '}
          <span className="font-semibold">{typeLabel}</span>{' '}
          {expired
            ? <>has <span className="font-bold">expired</span>.</>
            : <>is expiring in <span className="font-bold">{daysLabel}</span>.</>
          }{' '}
          Contact <span className="font-semibold">FEROS Support</span> team to renew.
        </p>

        <div className="flex items-center gap-2 mt-2.5">
          {requested ? (
            <div className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={12} />
              <span>Requested</span>
            </div>
          ) : (
            <button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              className="bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-70"
            >
              {requestMutation.isPending ? 'Sending…' : 'Request Renewal'}
            </button>
          )}

          <button
            onClick={() => { localStorage.setItem(dismissedKey, '1'); setDismissed(true) }}
            className="text-white/80 hover:text-white p-1 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
