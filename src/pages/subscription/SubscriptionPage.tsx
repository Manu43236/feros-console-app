import { useQuery } from '@tanstack/react-query'
import {
  BadgeCheck, Calendar, CreditCard, Truck, Users,
  FileText, AlertTriangle, CheckCircle, Clock,
} from 'lucide-react'
import { subscriptionsApi } from '@/api/superadmin'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import type { SubscriptionInvoice } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n?: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function daysLeft(endDate?: string) {
  if (!endDate) return null
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  ACTIVE:    { bg: 'bg-green-50 border-green-200',  text: 'text-green-700',  icon: CheckCircle },
  TRIAL:     { bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-700',   icon: Clock },
  EXPIRED:   { bg: 'bg-red-50 border-red-200',      text: 'text-red-700',    icon: AlertTriangle },
  SUSPENDED: { bg: 'bg-yellow-50 border-yellow-200',text: 'text-yellow-700', icon: AlertTriangle },
}

// ─── Usage Bar ────────────────────────────────────────────────────────────────
function UsageBar({ label, icon: Icon, current, max }: {
  label: string; icon: React.ElementType; current: number; max: number
}) {
  const unlimited = max === -1
  const pct = unlimited ? 0 : Math.min((current / max) * 100, 100)
  const near = !unlimited && pct >= 80
  const full = !unlimited && pct >= 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">
          <Icon size={14} className="text-gray-400" />
          {label}
        </span>
        <span className={`font-semibold ${full ? 'text-red-600' : near ? 'text-orange-500' : 'text-gray-800'}`}>
          {current} / {unlimited ? '∞' : max}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${full ? 'bg-red-500' : near ? 'bg-orange-400' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {unlimited && (
        <p className="text-xs text-gray-400">Unlimited</p>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SubscriptionPage() {
  const { data: subRes, isLoading: subLoading } = useQuery({
    queryKey: ['my-subscription-detail'],
    queryFn: () => subscriptionsApi.getMy(),
    retry: false,
  })
  const { data: invoicesRes } = useQuery({
    queryKey: ['my-subscription-invoices'],
    queryFn: () => subscriptionsApi.getMyInvoices(),
    retry: false,
  })
  const { data: vehiclesRes } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehiclesApi.getAll(),
    retry: false,
  })
  const { data: usersRes } = useQuery({
    queryKey: ['sa-users'],
    queryFn: () => staffApi.getUsers(),
    retry: false,
  })

  const sub = subRes?.data
  const invoices: SubscriptionInvoice[] = invoicesRes?.data ?? []
  const vehicleCount = (vehiclesRes?.data ?? []).filter((v: { isActive?: boolean }) => v.isActive !== false).length
  const userCount = (usersRes?.data ?? []).filter((u: { isActive?: boolean }) => u.isActive !== false).length

  const days = daysLeft(sub?.endDate)
  const statusStyle = STATUS_STYLES[sub?.status ?? 'TRIAL'] ?? STATUS_STYLES.TRIAL
  const StatusIcon = statusStyle.icon

  if (subLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading subscription…
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <BadgeCheck size={40} className="mb-3 text-gray-300" />
        <p className="text-sm">No active subscription found.</p>
        <p className="text-xs mt-1">Please contact FEROS support to activate your plan.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Subscription</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your plan details, usage, and billing history</p>
      </div>

      {/* ── Status card ── */}
      <div className={`rounded-xl border p-5 ${statusStyle.bg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStyle.bg}`}>
              <StatusIcon size={20} className={statusStyle.text} />
            </div>
            <div>
              <p className={`text-lg font-bold ${statusStyle.text}`}>{sub.planName || 'Trial'}</p>
              <p className={`text-sm font-medium ${statusStyle.text} opacity-80`}>{sub.status}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {sub.billingCycle && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <CreditCard size={14} />
                <span className="capitalize">{sub.billingCycle.toLowerCase()} billing</span>
              </div>
            )}
            {sub.endDate && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar size={14} />
                <span>
                  {sub.status === 'TRIAL' ? 'Trial ends' : 'Renews'}: {sub.endDate}
                  {days !== null && (
                    <span className={`ml-1.5 font-semibold ${days <= 7 ? 'text-red-600' : days <= 30 ? 'text-orange-500' : 'text-gray-700'}`}>
                      ({days > 0 ? `${days} days left` : 'Expired'})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Usage ── */}
      {(sub.maxLorries != null || sub.maxUsers != null) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Plan Usage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {sub.maxLorries != null && (
              <UsageBar
                label="Vehicles"
                icon={Truck}
                current={vehicleCount}
                max={sub.maxLorries}
              />
            )}
            {sub.maxUsers != null && (
              <UsageBar
                label="Users"
                icon={Users}
                current={userCount}
                max={sub.maxUsers}
              />
            )}
          </div>
          {((sub.maxLorries != null && sub.maxLorries !== -1 && vehicleCount >= sub.maxLorries) ||
            (sub.maxUsers != null && sub.maxUsers !== -1 && userCount >= sub.maxUsers)) && (
            <p className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              You have reached your plan limit. Contact FEROS support to upgrade.
            </p>
          )}
        </div>
      )}

      {/* ── Invoice history ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <FileText size={15} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Billing History</h2>
          <span className="ml-auto text-xs text-gray-400">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
        </div>

        {invoices.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No invoices yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Invoice #</th>
                <th className="px-5 py-3 text-left">Plan</th>
                <th className="px-5 py-3 text-left">Period</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">GST (18%)</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-blue-700">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{inv.planName ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {inv.periodStart} → {inv.periodEnd}
                  </td>
                  <td className="px-5 py-3 text-right">{fmt(inv.amount)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{fmt(inv.gstAmount)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{fmt(inv.totalAmount)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{inv.createdAt?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
