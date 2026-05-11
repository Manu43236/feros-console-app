import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck, Calendar, CreditCard, Truck, Users,
  FileText, AlertTriangle, CheckCircle, Clock, Lock,
  TrendingUp, ArrowUpCircle, Calculator, Printer,
} from 'lucide-react'
import { subscriptionsApi, subscriptionPlansApi } from '@/api/superadmin'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import type { SubscriptionInvoice, SubscriptionPlan } from '@/types'

const GST_RATE    = 0.18
const ANNUAL_MTHS = 10

const BILLING_CYCLES = [
  { value: 'MONTHLY',      label: 'Monthly',             months: 1 },
  { value: 'THREE_MONTHS', label: '3 Months',            months: 3 },
  { value: 'SIX_MONTHS',   label: '6 Months',            months: 6 },
  { value: 'YEARLY',       label: 'Annual',              months: 12 },
]

function cycleMonths(cycle: string, twoFree: boolean) {
  if (cycle === 'YEARLY') return twoFree ? ANNUAL_MTHS : 12
  const found = BILLING_CYCLES.find(c => c.value === cycle)
  return found?.months ?? 1
}

function calcEstimate(plan: SubscriptionPlan, vehicles: number, cycle: string) {
  const twoFree = (plan.minVehicles ?? 0) >= 250
  const months  = cycleMonths(cycle, twoFree)
  const base    = (plan.pricePerVehicle ?? 0) * vehicles * months
  const gst     = base * GST_RATE
  return { base, gst, total: base + gst, months }
}

function autoSelectPlan(plans: SubscriptionPlan[], count: number): SubscriptionPlan | null {
  if (!count || count <= 0) return null
  return plans.find(p =>
    count >= (p.minVehicles ?? 0) && (p.maxVehicles === -1 || count <= (p.maxVehicles ?? Infinity))
  ) ?? plans[plans.length - 1] ?? null
}

function fmtINR(n?: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n?: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function daysLeft(endDate?: string | null) {
  if (!endDate) return null
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  ACTIVE:    { bg: 'bg-green-50 border-green-200',   text: 'text-green-700',  icon: CheckCircle },
  TRIAL:     { bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',   icon: Clock },
  EXPIRED:   { bg: 'bg-red-50 border-red-200',       text: 'text-red-700',    icon: AlertTriangle },
  SUSPENDED: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: AlertTriangle },
}

// ─── Usage Bar ────────────────────────────────────────────────────────────────
function UsageBar({ label, icon: Icon, current, max }: {
  label: string; icon: React.ElementType; current: number; max: number
}) {
  const unlimited = max === -1
  const pct  = unlimited ? 0 : Math.min((current / max) * 100, 100)
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
      {unlimited && <p className="text-xs text-gray-400">Unlimited</p>}
    </div>
  )
}

// ─── Feature Badge ────────────────────────────────────────────────────────────
function FeatureBadge({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
      enabled
        ? 'bg-green-50 border-green-200 text-green-700'
        : 'bg-gray-50 border-gray-200 text-gray-400'
    }`}>
      {enabled ? <CheckCircle size={11} /> : <Lock size={11} />}
      {label}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SubscriptionPage() {
  const qc = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [vehicles, setVehicles]             = useState('')
  const [cycle, setCycle]                   = useState('MONTHLY')
  const [reqNotes, setReqNotes]             = useState('')
  const [reqSent, setReqSent]               = useState(false)

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
  const { data: plansRes } = useQuery({
    queryKey: ['active-plans-public'],
    queryFn: () => subscriptionPlansApi.getActive(),
  })
  const paidPlans: SubscriptionPlan[] = (plansRes?.data ?? [])
    .filter(p => p.pricePerVehicle && p.pricePerVehicle > 0)
    .sort((a, b) => (a.minVehicles ?? 0) - (b.minVehicles ?? 0))

  const upgradeMutation = useMutation({
    mutationFn: () => subscriptionsApi.submitUpgradeRequest({
      planId: selectedPlanId,
      vehicleCount: Number(vehicles),
      billingCycle: cycle,
      notes: reqNotes || undefined,
    }),
    onSuccess: () => {
      setReqSent(true)
      qc.invalidateQueries({ queryKey: ['my-subscription-detail'] })
    },
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

  const sub      = subRes?.data
  const invoices: SubscriptionInvoice[] = invoicesRes?.data ?? []
  const vehicleCount = (vehiclesRes?.data ?? []).filter((v: { isActive?: boolean }) => v.isActive !== false).length
  const userCount    = (usersRes?.data ?? []).filter((u: { isActive?: boolean }) => u.isActive !== false).length

  const isTrial     = sub?.status === 'TRIAL'
  const days        = daysLeft(sub?.endDate)
  const statusStyle = STATUS_STYLES[sub?.status ?? 'TRIAL'] ?? STATUS_STYLES.TRIAL
  const StatusIcon  = statusStyle.icon
  const isFree      = !isTrial && (sub?.pricePerVehicle === 0 || (sub?.pricePerVehicle == null && sub?.amount === 0))

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

  const vehicleLimit = sub.maxLorries ?? sub.vehicleCount ?? -1
  const userLimit    = sub.maxUsers ?? -1

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
              <p className={`text-lg font-bold ${statusStyle.text}`}>{sub.planName || 'Free'}</p>
              <p className={`text-sm font-medium ${statusStyle.text} opacity-80`}>{sub.status}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {/* Pricing display */}
            {sub.pricePerVehicle != null && sub.pricePerVehicle > 0 && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <TrendingUp size={14} />
                <span className="font-semibold">
                  {sub.vehicleCount} vehicles × {fmt(sub.pricePerVehicle)}/vehicle
                </span>
              </div>
            )}
            {isTrial && (
              <div className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <Clock size={14} />
                Trial Period — Full Access
              </div>
            )}
            {isFree && (
              <div className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <BadgeCheck size={14} />
                Free Plan
              </div>
            )}
            {sub.billingCycle && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <CreditCard size={14} />
                <span>{{
                  MONTHLY: 'Monthly', THREE_MONTHS: '3-Month',
                  SIX_MONTHS: '6-Month', YEARLY: 'Annual',
                }[sub.billingCycle] ?? sub.billingCycle} billing</span>
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
            {!sub.endDate && !isFree && (
              <div className="flex items-center gap-1.5 text-green-600">
                <Calendar size={14} />
                <span className="font-medium">Never expires</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Usage ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Plan Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <UsageBar label="Vehicles" icon={Truck}  current={vehicleCount} max={vehicleLimit} />
          <UsageBar label="Users"    icon={Users}   current={userCount}    max={userLimit} />
        </div>

        {/* Limit warnings */}
        {vehicleLimit > 0 && vehicleCount >= vehicleLimit && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Vehicle limit reached</p>
              <p className="text-xs text-red-600 mt-0.5">
                You've used all {vehicleLimit} vehicle slots. Contact FEROS support to add more vehicles to your plan.
              </p>
            </div>
          </div>
        )}
        {userLimit !== -1 && userCount >= userLimit && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
            <AlertTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-700">User limit reached</p>
              <p className="text-xs text-orange-600 mt-0.5">
                Upgrade to a paid plan for unlimited users.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Features ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Included Features</h2>
        <div className="flex flex-wrap gap-2">
          <FeatureBadge label="Clients & Orders"   enabled={true} />
          <FeatureBadge label="LR Register"        enabled={true} />
          <FeatureBadge label="Invoices"           enabled={true} />
          <FeatureBadge label="Credit Notes"       enabled={sub.hasCreditNotes} />
          <FeatureBadge label="Fuel Logs"          enabled={sub.hasFuelLogs} />
          <FeatureBadge label="Meter Readings"     enabled={sub.hasMeterReadings} />
          <FeatureBadge label="Vehicle Services"   enabled={sub.hasVehicleServices} />
          <FeatureBadge label="Attendance"         enabled={sub.hasAttendance} />
          <FeatureBadge label="Payroll"            enabled={sub.hasPayroll} />
          <FeatureBadge label="Inventory"          enabled={sub.hasInventory} />
          <FeatureBadge label="Reports"            enabled={sub.hasReports} />
        </div>
        {!isTrial && [sub.hasFuelLogs, sub.hasPayroll, sub.hasInventory, sub.hasReports].some(f => !f) && (
          <p className="mt-3 text-xs text-gray-500 flex items-center gap-1.5">
            <Lock size={11} />
            Upgrade to a paid plan to unlock all features — starting at ₹499/vehicle/month.
          </p>
        )}
      </div>

      {/* ── Upgrade / Request Plan ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowUpCircle size={16} className="text-feros-navy" />
          <h2 className="text-sm font-semibold text-gray-700">Upgrade Your Plan</h2>
        </div>

        {reqSent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4 text-center space-y-1">
            <CheckCircle size={24} className="text-green-600 mx-auto" />
            <p className="font-semibold text-green-700 text-sm">Request Sent!</p>
            <p className="text-xs text-green-600">We've received your upgrade request. Our team will contact you shortly to confirm and activate your plan.</p>
            <button onClick={() => { setReqSent(false); setSelectedPlanId(null); setVehicles('') }}
              className="mt-2 text-xs text-green-700 underline">Submit another request</button>
          </div>
        ) : (
          <>
            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paidPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlanId(plan.id)
                    setVehicles(String(plan.minVehicles ?? 1))
                  }}
                  className={`text-left border rounded-xl p-3 transition-all ${
                    selectedPlanId === plan.id
                      ? 'border-feros-navy bg-feros-navy/5 ring-1 ring-feros-navy'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">{plan.name}</p>
                  <p className="text-feros-navy font-bold text-sm mt-0.5">
                    {fmtINR(plan.pricePerVehicle)}<span className="text-xs font-normal text-gray-500">/vehicle/month</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {plan.minVehicles}–{plan.maxVehicles === -1 ? '∞' : plan.maxVehicles} vehicles
                  </p>
                </button>
              ))}
            </div>

            {/* Request form */}
            {selectedPlanId && (() => {
              const plan = paidPlans.find(p => p.id === selectedPlanId)!
              const v    = Number(vehicles) || 0
              const twoFree = (plan.minVehicles ?? 0) >= 250
              const est  = v > 0 ? calcEstimate(plan, v, cycle) : null
              return (
                <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
                  <p className="text-sm font-medium text-gray-700">Configure your <strong>{plan.name}</strong> plan</p>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">
                      Number of Vehicles <span className="text-gray-400">(range: {plan.minVehicles}–{plan.maxVehicles === -1 ? '∞' : plan.maxVehicles})</span>
                    </label>
                    <input
                      type="number" min={plan.minVehicles ?? 1}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      value={vehicles}
                      onChange={e => {
                        const val = e.target.value
                        setVehicles(val)
                        const count = Number(val)
                        if (count > 0) {
                          const matched = autoSelectPlan(paidPlans, count)
                          if (matched) setSelectedPlanId(matched.id)
                        }
                      }}
                      placeholder={`e.g. ${plan.minVehicles ?? 1}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Billing Cycle</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {BILLING_CYCLES.map(bc => (
                        <button
                          key={bc.value}
                          type="button"
                          onClick={() => setCycle(bc.value)}
                          className={`text-center border rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                            cycle === bc.value
                              ? 'border-feros-navy bg-feros-navy/5 text-feros-navy ring-1 ring-feros-navy'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {bc.label}
                          {bc.value === 'YEARLY' && twoFree && (
                            <span className="block text-green-600 text-xs font-normal">2 months free</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {est && (
                    <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-1.5">
                        <Calculator size={12} /> Estimated Amount
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div className="flex justify-between">
                          <span>{vehicles} vehicles × {fmtINR(plan.pricePerVehicle)} × {est.months} month{est.months > 1 ? 's' : ''}</span>
                          <span className="font-medium">{fmtINR(est.base)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST 18%</span>
                          <span className="font-medium">{fmtINR(est.gst)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-gray-900 border-t pt-1">
                          <span>Total</span>
                          <span>{fmtINR(est.total)}</span>
                        </div>
                        {cycle === 'YEARLY' && twoFree && (
                          <p className="text-green-600 text-xs pt-0.5">Annual — pay 10 months, get 12 (2 months free)</p>
                        )}
                        <p className="text-gray-400 text-xs pt-0.5">GST paid is claimable as Input Tax Credit (ITC) for GST-registered businesses.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Notes (optional)</label>
                    <textarea className="w-full border rounded-lg px-3 py-2 text-sm bg-white" rows={2}
                      value={reqNotes} onChange={e => setReqNotes(e.target.value)}
                      placeholder="Any specific requirements or questions…" />
                  </div>

                  {upgradeMutation.isError && (
                    <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
                  )}

                  <button
                    onClick={() => upgradeMutation.mutate()}
                    disabled={!vehicles || Number(vehicles) < (plan.minVehicles ?? 1) || upgradeMutation.isPending}
                    className="w-full py-2.5 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {upgradeMutation.isPending ? 'Sending…' : `Request ${plan.name} Plan`}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    We'll contact you to confirm payment and activate your plan.
                  </p>
                </div>
              )
            })()}
          </>
        )}
      </div>

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
                <th className="px-5 py-3 text-left">Vehicles</th>
                <th className="px-5 py-3 text-left">Period</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">GST (18%)</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-blue-700">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{inv.planName ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600 text-xs">
                    {inv.vehicleCount && inv.pricePerVehicle
                      ? <span>{inv.vehicleCount} × {fmt(inv.pricePerVehicle)}</span>
                      : '—'
                    }
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {inv.periodStart} → {inv.periodEnd ?? '∞'}
                  </td>
                  <td className="px-5 py-3 text-right">{fmt(inv.amount)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{fmt(inv.gstAmount)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{fmt(inv.totalAmount)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => window.open(`/subscription/invoice/${inv.id}/print`, '_blank')}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      title="View Invoice PDF"
                    >
                      <Printer size={13} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 text-xs text-gray-400 border-t">
              <tr>
                <td colSpan={8} className="px-5 py-2.5">
                  GST paid on subscription is claimable as Input Tax Credit (ITC) for GST-registered businesses.
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
