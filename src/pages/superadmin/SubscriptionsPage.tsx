import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  History, FileText, Megaphone, Calculator, Truck,
  X, ChevronDown, ChevronUp, Users, AlertTriangle, Pencil,
} from 'lucide-react'
import type { Tenant } from '@/types'
import { tenantsApi, subscriptionsApi, notificationsApi } from '@/api/superadmin'
import type { SubscriptionHistory, SubscriptionInvoice } from '@/types'
import { SearchableSelect } from '@/components/ui/searchable-select'

type Tab = 'tenants' | 'invoices' | 'broadcast'
type FilterKey = 'all' | 'active' | 'trial' | 'expiring' | 'suspended' | 'expired'

const GST_RATE    = 0.18
const ANNUAL_MTHS = 10
const USERS_PER_VEHICLE = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n?: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function cycleLabel(cycle?: string | null) {
  const map: Record<string, string> = { MONTHLY: 'Monthly', THREE_MONTHS: '3-Month', SIX_MONTHS: '6-Month', YEARLY: 'Annual' }
  return cycle ? (map[cycle] ?? cycle) : '—'
}

function cycleMonths(cycle: string, twoMonthsFree: boolean) {
  if (cycle === 'YEARLY')       return twoMonthsFree ? ANNUAL_MTHS : 12
  if (cycle === 'SIX_MONTHS')   return 6
  if (cycle === 'THREE_MONTHS') return 3
  return 1
}

function calcAmounts(pricePerVehicle: number, vehicleCount: number, cycle: string, twoMonthsFree: boolean) {
  const months = cycleMonths(cycle, twoMonthsFree)
  const base   = pricePerVehicle * vehicleCount * months
  const gst    = base * GST_RATE
  return { base, gst, total: base + gst, months }
}

function isExpiringSoon(dateStr?: string | null) {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000
}

function isExpired(dateStr?: string | null) {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    TRIAL:     'bg-blue-100 text-blue-700',
    ACTIVE:    'bg-green-100 text-green-700',
    EXPIRED:   'bg-red-100 text-red-700',
    SUSPENDED: 'bg-yellow-100 text-yellow-700',
    RENEWED:   'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

// ─── Amount Preview ───────────────────────────────────────────────────────────
function AmountPreview({ pricePerVehicle, vehicleCount, cycle, twoMonthsFree }: {
  pricePerVehicle: number; vehicleCount: number; cycle: string; twoMonthsFree: boolean
}) {
  if (!pricePerVehicle || !vehicleCount) return null
  const { base, gst, total, months } = calcAmounts(pricePerVehicle, vehicleCount, cycle, twoMonthsFree)
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-2">
        <Calculator size={12} /> Amount Preview
      </div>
      <div className="text-xs text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span>{vehicleCount} vehicles × {fmt(pricePerVehicle)} × {months} month{months > 1 ? 's' : ''}</span>
          <span className="font-medium">{fmt(base)}</span>
        </div>
        <div className="flex justify-between">
          <span>GST 18%</span>
          <span className="font-medium">{fmt(gst)}</span>
        </div>
        <div className="flex justify-between font-semibold text-gray-900 border-t pt-1">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
        {cycle === 'YEARLY' && twoMonthsFree && (
          <p className="text-green-600 text-xs mt-1">Annual — pay 10 months, get 12 (2 months free for 250+ vehicles)</p>
        )}
      </div>
    </div>
  )
}

// ─── Expiry Cell ──────────────────────────────────────────────────────────────
function ExpiryCell({ date }: { date?: string | null }) {
  if (!date) return <span className="text-gray-400">—</span>
  const expired  = isExpired(date)
  const expiring = isExpiringSoon(date)
  const color = expired ? 'text-red-600 font-medium' : expiring ? 'text-amber-600 font-medium' : 'text-gray-600'
  return (
    <span className={`flex items-center gap-1 ${color}`}>
      {(expired || expiring) && <AlertTriangle size={11} />}
      {date}
    </span>
  )
}

// ─── Subscription Drawer ──────────────────────────────────────────────────────
function SubscriptionDrawer({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showCorrectForm, setShowCorrectForm] = useState(false)
  const [showUserLimitForm, setShowUserLimitForm] = useState(false)

  // Action dialog state
  const [actionDialog, setActionDialog] = useState<{
    type: 'activate' | 'extend-trial' | 'extend' | 'suspend' | 'reactivate'
  } | null>(null)

  const emptyForm = { planName: '', pricePerVehicle: '', billingCycle: 'MONTHLY', startDate: '', vehicleCount: '', newEndDate: '', amount: '', installationCharges: '', paymentRef: '', notes: '' }
  const emptyErrs = { planName: '', startDate: '', vehicleCount: '', newEndDate: '', notes: '' }
  const [actionForm, setActionForm] = useState(emptyForm)
  const [actionErrs, setActionErrs] = useState(emptyErrs)

  // Correction form
  const emptyCorrect = { planName: '', vehicleCount: '', pricePerVehicle: '', billingCycle: '', endDate: '', paymentRef: '', amount: '', notes: '' }
  const [correctForm, setCorrectForm] = useState(emptyCorrect)
  const [correctErrs, setCorrectErrs] = useState({ vehicleCount: '', notes: '' })

  // User limit form
  const [newLimit, setNewLimit] = useState('')

  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ['sa-sub-history', tenant.id],
    queryFn: () => subscriptionsApi.getHistory(tenant.id),
  })
  const history: SubscriptionHistory[] = historyRes?.data ?? []
  const latestActive = history.find(h => h.status === 'ACTIVE')

  const vehicleCount = Number(actionForm.vehicleCount) || 0
  const extendVehicles = Number(actionForm.vehicleCount) || latestActive?.vehicleCount || 0
  const extendRate = Number(actionForm.pricePerVehicle) || latestActive?.pricePerVehicle || 0

  // Default user limit display
  const defaultLimit = tenant.currentVehicleCount ? tenant.currentVehicleCount * USERS_PER_VEHICLE : null
  const effectiveLimit = tenant.effectiveUserLimit
  const activeUsers   = tenant.activeUserCount ?? 0
  const userPct = effectiveLimit ? Math.round((activeUsers / effectiveLimit) * 100) : 0
  const userWarning = effectiveLimit ? activeUsers >= effectiveLimit : false
  const userAmber   = effectiveLimit ? userPct >= 80 && userPct < 100 : false

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['sa-tenants'] })
    qc.invalidateQueries({ queryKey: ['sa-sub-history', tenant.id] })
  }

  // ── Action mutation ──
  const actionMutation = useMutation({
    mutationFn: () => {
      if (!actionDialog) throw new Error()
      const { type } = actionDialog
      if (type === 'activate') return subscriptionsApi.activate(tenant.id, {
        planName: actionForm.planName, vehicleCount: Number(actionForm.vehicleCount),
        pricePerVehicle: actionForm.pricePerVehicle ? Number(actionForm.pricePerVehicle) : undefined,
        billingCycle: actionForm.billingCycle, startDate: actionForm.startDate,
        amount: actionForm.amount ? Number(actionForm.amount) : undefined,
        installationCharges: actionForm.installationCharges ? Number(actionForm.installationCharges) : undefined,
        paymentRef: actionForm.paymentRef || undefined, notes: actionForm.notes || undefined,
      })
      if (type === 'extend-trial') return subscriptionsApi.extendTrial(tenant.id, {
        newEndDate: actionForm.newEndDate, notes: actionForm.notes || undefined,
      })
      if (type === 'extend') return subscriptionsApi.extend(tenant.id, {
        vehicleCount: actionForm.vehicleCount ? Number(actionForm.vehicleCount) : undefined,
        pricePerVehicle: actionForm.pricePerVehicle ? Number(actionForm.pricePerVehicle) : undefined,
        newEndDate: actionForm.newEndDate || undefined,
        amount: actionForm.amount ? Number(actionForm.amount) : undefined,
        paymentRef: actionForm.paymentRef || undefined, notes: actionForm.notes || undefined,
      })
      if (type === 'suspend') return subscriptionsApi.suspend(tenant.id, { notes: actionForm.notes })
      return subscriptionsApi.reactivate(tenant.id)
    },
    onSuccess: () => { invalidate(); setActionDialog(null) },
  })

  // ── Correction mutation ──
  const correctMutation = useMutation({
    mutationFn: () => subscriptionsApi.correct(tenant.id, {
      planName: correctForm.planName || undefined,
      vehicleCount: correctForm.vehicleCount ? Number(correctForm.vehicleCount) : undefined,
      pricePerVehicle: correctForm.pricePerVehicle ? Number(correctForm.pricePerVehicle) : undefined,
      billingCycle: correctForm.billingCycle || undefined,
      endDate: correctForm.endDate || undefined,
      paymentRef: correctForm.paymentRef || undefined,
      amount: correctForm.amount ? Number(correctForm.amount) : undefined,
      notes: correctForm.notes,
    }),
    onSuccess: () => { invalidate(); setShowCorrectForm(false); setCorrectForm(emptyCorrect) },
  })

  // ── User limit mutation ──
  const userLimitMutation = useMutation({
    mutationFn: () => tenantsApi.updateUserLimit(tenant.id, Number(newLimit)),
    onSuccess: () => { invalidate(); setShowUserLimitForm(false); setNewLimit('') },
  })

  function openAction(type: 'activate' | 'extend-trial' | 'extend' | 'suspend' | 'reactivate') {
    setActionForm(emptyForm)
    setActionErrs(emptyErrs)
    setActionDialog({ type })
  }

  function validateAction() {
    const e = { ...emptyErrs }
    const t = actionDialog?.type
    if (t === 'activate') {
      if (!actionForm.planName.trim()) e.planName = 'Plan name is required'
      if (!actionForm.vehicleCount) e.vehicleCount = 'Vehicle count is required'
      if (!actionForm.startDate) e.startDate = 'Start date is required'
    }
    if (t === 'extend-trial' && !actionForm.newEndDate) e.newEndDate = 'New end date is required'
    if (t === 'suspend' && !actionForm.notes.trim()) e.notes = 'Reason is required for suspension'
    setActionErrs(e)
    return !Object.values(e).some(Boolean)
  }

  function validateCorrect() {
    const e = { vehicleCount: '', notes: '' }
    if (!correctForm.notes.trim()) e.notes = 'Reason is required'
    setCorrectErrs(e)
    return !Object.values(e).some(Boolean)
  }

  const st = tenant.subscriptionStatus

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[500px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-lg text-gray-900">{tenant.companyName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={tenant.subscriptionStatus} />
              <span className="text-xs text-gray-400">{tenant.email}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── Current Subscription Card ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current Subscription</h3>
            {(tenant.currentPlanName || st === 'ACTIVE') ? (
              <div className="bg-gray-50 border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{tenant.currentPlanName ?? '—'}</p>
                    <p className="text-sm text-feros-navy font-medium">{fmt(tenant.currentPricePerVehicle)}/vehicle · {cycleLabel(tenant.currentBillingCycle)}</p>
                  </div>
                  {st === 'ACTIVE' && (
                    <button onClick={() => { setShowCorrectForm(v => !v); setShowUserLimitForm(false) }}
                      className="flex items-center gap-1 text-xs text-feros-navy border border-feros-navy rounded-lg px-2.5 py-1.5 hover:bg-blue-50">
                      <Pencil size={11} /> Correct
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div><span className="text-gray-400 block">Vehicles</span>{tenant.currentVehicleCount ?? '—'}</div>
                  <div>
                    <span className="text-gray-400 block">Expiry</span>
                    <ExpiryCell date={tenant.subscriptionEndDate} />
                  </div>
                  <div>
                    <span className="text-gray-400 block">Billing</span>
                    {st === 'ACTIVE' && tenant.subscriptionEndDate && new Date(tenant.subscriptionEndDate) >= new Date()
                      ? <span className="text-green-600 font-medium">Paid</span>
                      : '—'}
                  </div>
                </div>
              </div>
            ) : st === 'TRIAL' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-blue-700">Trial · Free</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div><span className="text-gray-400 block">Vehicles</span>{tenant.currentVehicleCount ?? '—'}</div>
                  <div><span className="text-gray-400 block">Expiry</span><ExpiryCell date={tenant.trialEndDate} /></div>
                  <div><span className="text-gray-400 block">Billing</span>—</div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border rounded-xl p-4">
                <p className="text-sm text-gray-500">No active subscription</p>
              </div>
            )}
          </section>

          {/* ── Correction Form ── */}
          {showCorrectForm && (
            <section className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Correct Subscription</h3>

              {/* Plan name */}
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Plan Name</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  value={correctForm.planName}
                  onChange={e => setCorrectForm(f => ({ ...f, planName: e.target.value }))}
                  placeholder={latestActive?.planName ?? 'e.g. Growth'} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Vehicle count */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">
                    Vehicles <span className="text-gray-400">(keep {latestActive?.vehicleCount ?? '—'} if blank)</span>
                  </label>
                  <input type="number" min={1}
                    className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${correctErrs.vehicleCount ? 'border-red-400' : ''}`}
                    value={correctForm.vehicleCount}
                    onChange={e => setCorrectForm(f => ({ ...f, vehicleCount: e.target.value }))}
                    placeholder={String(latestActive?.vehicleCount ?? '')} />
                  {correctErrs.vehicleCount && <p className="text-red-500 text-xs mt-1">{correctErrs.vehicleCount}</p>}
                </div>

                {/* Price per vehicle */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Price / Vehicle (₹)</label>
                  <input type="number" min={0}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={correctForm.pricePerVehicle}
                    onChange={e => setCorrectForm(f => ({ ...f, pricePerVehicle: e.target.value }))}
                    placeholder={String(latestActive?.pricePerVehicle ?? '0')} />
                </div>

                {/* Billing cycle */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Billing Cycle</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={correctForm.billingCycle}
                    onChange={e => setCorrectForm(f => ({ ...f, billingCycle: e.target.value }))}>
                    <option value="">Keep current</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="THREE_MONTHS">3 Months</option>
                    <option value="SIX_MONTHS">6 Months</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                {/* Expiry date */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Expiry Date</label>
                  <input type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={correctForm.endDate}
                    onChange={e => setCorrectForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>

                {/* Payment ref */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Payment Reference</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={correctForm.paymentRef}
                    onChange={e => setCorrectForm(f => ({ ...f, paymentRef: e.target.value }))}
                    placeholder={latestActive?.paymentRef ?? 'UPI / bank ref'} />
                </div>

                {/* Amount override */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Amount Override (₹)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={correctForm.amount}
                    onChange={e => setCorrectForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Auto-calculated if blank" />
                </div>
              </div>

              {/* Live preview */}
              {correctForm.vehicleCount && (correctForm.pricePerVehicle || latestActive?.pricePerVehicle) && (correctForm.billingCycle || latestActive?.billingCycle) && (
                <AmountPreview
                  pricePerVehicle={Number(correctForm.pricePerVehicle) || latestActive?.pricePerVehicle || 0}
                  vehicleCount={Number(correctForm.vehicleCount)}
                  cycle={(correctForm.billingCycle || latestActive?.billingCycle) as string}
                  twoMonthsFree={false}
                />
              )}

              <div>
                <label className="text-xs text-gray-600 mb-1 block">Reason <span className="text-red-500">*</span></label>
                <textarea rows={2}
                  className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${correctErrs.notes ? 'border-red-400' : ''}`}
                  value={correctForm.notes}
                  onChange={e => setCorrectForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Explain the correction…" />
                {correctErrs.notes && <p className="text-red-500 text-xs mt-1">{correctErrs.notes}</p>}
              </div>
              {correctMutation.isError && <p className="text-red-500 text-xs">Something went wrong. Please try again.</p>}
              <div className="flex gap-2">
                <button onClick={() => { if (validateCorrect()) correctMutation.mutate() }}
                  disabled={correctMutation.isPending}
                  className="flex-1 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {correctMutation.isPending ? 'Saving…' : 'Save Correction'}
                </button>
                <button onClick={() => setShowCorrectForm(false)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
              </div>
            </section>
          )}

          {/* ── Users Section ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Users</h3>
            <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-gray-500" />
                  <span className={`text-sm font-medium ${userWarning ? 'text-red-600' : userAmber ? 'text-amber-600' : 'text-gray-900'}`}>
                    {activeUsers} / {effectiveLimit ?? '—'}
                    {userWarning && <span className="ml-1 text-xs">(limit reached)</span>}
                  </span>
                </div>
                <button onClick={() => { setShowUserLimitForm(v => !v); setShowCorrectForm(false) }}
                  className="text-xs text-feros-navy border border-feros-navy rounded-lg px-2.5 py-1.5 hover:bg-blue-50">
                  Increase Limit
                </button>
              </div>
              {effectiveLimit && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${userWarning ? 'bg-red-500' : userAmber ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(userPct, 100)}%` }} />
                </div>
              )}
              <p className="text-xs text-gray-400">
                {tenant.customUserLimit
                  ? `Custom limit: ${tenant.customUserLimit} (default would be ${defaultLimit ?? '—'})`
                  : `Default: ${tenant.currentVehicleCount ?? '—'} vehicles × ${USERS_PER_VEHICLE} = ${defaultLimit ?? '—'} users`}
              </p>
            </div>

            {showUserLimitForm && (
              <div className="mt-3 border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-600">Current limit: <strong>{effectiveLimit ?? '—'}</strong> users. Enter new limit.</p>
                <div className="flex gap-2">
                  <input type="number" min={1}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
                    value={newLimit}
                    onChange={e => setNewLimit(e.target.value)}
                    placeholder="Enter user limit" />
                  <button onClick={() => userLimitMutation.mutate()}
                    disabled={!newLimit || Number(newLimit) < 1 || userLimitMutation.isPending}
                    className="px-4 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {userLimitMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setShowUserLimitForm(false)} className="px-3 py-2 border rounded-lg text-sm">✕</button>
                </div>
                {userLimitMutation.isError && <p className="text-red-500 text-xs">Something went wrong.</p>}
              </div>
            )}
          </section>

          {/* ── Actions ── */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</h3>
            <div className="flex flex-wrap gap-2">
              {(st === 'TRIAL' || st === 'EXPIRED') && (
                <button onClick={() => openAction('activate')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Activate</button>
              )}
              {st === 'TRIAL' && (
                <button onClick={() => openAction('extend-trial')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Extend Trial</button>
              )}
              {st === 'ACTIVE' && (
                <button onClick={() => openAction('extend')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Renew</button>
              )}
              {(st === 'ACTIVE' || st === 'TRIAL') && (
                <button onClick={() => openAction('suspend')} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium">Suspend</button>
              )}
              {st === 'SUSPENDED' && (
                <button onClick={() => openAction('reactivate')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Reactivate</button>
              )}
            </div>
          </section>

          {/* ── History ── */}
          <section>
            <button onClick={() => setHistoryOpen(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-full">
              <History size={13} />
              Subscription History
              {historyOpen ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
            </button>
            {historyOpen && (
              <div className="mt-3">
                {historyLoading ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">No history</p>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Plan</th>
                          <th className="px-3 py-2 text-left">Vehicles</th>
                          <th className="px-3 py-2 text-left">Period</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {history.map(h => (
                          <tr key={h.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2"><StatusBadge status={h.status} /></td>
                            <td className="px-3 py-2 font-medium">
                              {h.notes?.startsWith('[CORRECTION]')
                                ? <span className="text-amber-600">✎ {h.planName}</span>
                                : (h.planName && h.planName !== '-' ? h.planName : '—')}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {h.vehicleCount ? `${h.vehicleCount}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{h.startDate} → {h.endDate ?? '∞'}</td>
                            <td className="px-3 py-2 text-right">{fmt(h.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Action Dialog (full-screen overlay) ── */}
      {actionDialog && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg capitalize">{actionDialog.type.replace('-', ' ')}</h3>

            {/* ACTIVATE */}
            {actionDialog.type === 'activate' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Plan Name <span className="text-red-500">*</span></label>
                  <input className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.planName ? 'border-red-400' : ''}`}
                    value={actionForm.planName}
                    onChange={e => { setActionForm(f => ({ ...f, planName: e.target.value })); setActionErrs(v => ({ ...v, planName: '' })) }}
                    placeholder="e.g. Growth, Enterprise, Custom" />
                  {actionErrs.planName && <p className="text-red-500 text-xs mt-1">{actionErrs.planName}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Vehicle Count <span className="text-red-500">*</span></label>
                    <input type="number" min={1}
                      className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.vehicleCount ? 'border-red-400' : ''}`}
                      value={actionForm.vehicleCount}
                      onChange={e => { setActionForm(f => ({ ...f, vehicleCount: e.target.value })); setActionErrs(v => ({ ...v, vehicleCount: '' })) }} />
                    {actionErrs.vehicleCount && <p className="text-red-500 text-xs mt-1">{actionErrs.vehicleCount}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Price / Vehicle (₹) <span className="text-red-500">*</span></label>
                    <input type="number" min={0}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={actionForm.pricePerVehicle}
                      onChange={e => setActionForm(f => ({ ...f, pricePerVehicle: e.target.value }))}
                      placeholder="e.g. 700" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Billing Cycle</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.billingCycle}
                    onChange={e => setActionForm(f => ({ ...f, billingCycle: e.target.value }))}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="THREE_MONTHS">3 Months</option>
                    <option value="SIX_MONTHS">6 Months</option>
                    <option value="YEARLY">Annual</option>
                  </select>
                </div>
                {vehicleCount > 0 && actionForm.pricePerVehicle && (
                  <AmountPreview pricePerVehicle={Number(actionForm.pricePerVehicle)} vehicleCount={vehicleCount}
                    cycle={actionForm.billingCycle} twoMonthsFree={false} />
                )}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Start Date <span className="text-red-500">*</span></label>
                  <input type="date" className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.startDate ? 'border-red-400' : ''}`}
                    value={actionForm.startDate}
                    onChange={e => { setActionForm(f => ({ ...f, startDate: e.target.value })); setActionErrs(v => ({ ...v, startDate: '' })) }} />
                  {actionErrs.startDate && <p className="text-red-500 text-xs mt-1">{actionErrs.startDate}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Amount Override (₹, optional)</label>
                    <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={actionForm.amount} onChange={e => setActionForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="Auto-calculated" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Installation Charges (₹, optional)</label>
                    <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={actionForm.installationCharges}
                      onChange={e => setActionForm(f => ({ ...f, installationCharges: e.target.value }))}
                      placeholder="e.g. 29999" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Payment Reference</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.paymentRef} onChange={e => setActionForm(f => ({ ...f, paymentRef: e.target.value }))}
                    placeholder="UPI / bank transfer ref" />
                </div>
              </div>
            )}

            {/* EXTEND TRIAL */}
            {actionDialog.type === 'extend-trial' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">New End Date <span className="text-red-500">*</span></label>
                  <input type="date" className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.newEndDate ? 'border-red-400' : ''}`}
                    value={actionForm.newEndDate}
                    onChange={e => { setActionForm(f => ({ ...f, newEndDate: e.target.value })); setActionErrs(v => ({ ...v, newEndDate: '' })) }} />
                  {actionErrs.newEndDate && <p className="text-red-500 text-xs mt-1">{actionErrs.newEndDate}</p>}
                </div>
              </div>
            )}

            {/* RENEW */}
            {actionDialog.type === 'extend' && (
              <div className="space-y-3">
                {latestActive && (
                  <div className="bg-gray-50 border rounded-lg px-3 py-2 text-xs text-gray-600 space-y-0.5">
                    <p>Current: <strong>{latestActive.planName}</strong> · {latestActive.vehicleCount} vehicles · {fmt(latestActive.pricePerVehicle)}/vehicle</p>
                    <p>Billing: {cycleLabel(latestActive.billingCycle)} · Ends: {latestActive.endDate ?? 'N/A'}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Vehicle Count <span className="text-gray-400">(keep {latestActive?.vehicleCount ?? '—'} if blank)</span></label>
                    <input type="number" min={1} className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={actionForm.vehicleCount} onChange={e => setActionForm(f => ({ ...f, vehicleCount: e.target.value }))}
                      placeholder={String(latestActive?.vehicleCount ?? '')} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Price / Vehicle (₹) <span className="text-gray-400">(keep {fmt(latestActive?.pricePerVehicle)} if blank)</span></label>
                    <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={actionForm.pricePerVehicle} onChange={e => setActionForm(f => ({ ...f, pricePerVehicle: e.target.value }))}
                      placeholder={String(latestActive?.pricePerVehicle ?? '')} />
                  </div>
                </div>
                {extendVehicles > 0 && extendRate > 0 && latestActive?.billingCycle && (
                  <AmountPreview pricePerVehicle={extendRate} vehicleCount={extendVehicles}
                    cycle={latestActive.billingCycle} twoMonthsFree={false} />
                )}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">New End Date <span className="text-gray-400">(auto-calculated if blank)</span></label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.newEndDate} onChange={e => setActionForm(f => ({ ...f, newEndDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Amount Override (₹, optional)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.amount} onChange={e => setActionForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Leave blank to auto-calculate" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Payment Reference</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.paymentRef} onChange={e => setActionForm(f => ({ ...f, paymentRef: e.target.value }))}
                    placeholder="UPI / bank transfer ref" />
                </div>
              </div>
            )}

            {/* SUSPEND */}
            {actionDialog.type === 'suspend' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
                This will immediately block the tenant from using FEROS.
              </div>
            )}

            {/* Notes */}
            {actionDialog.type !== 'reactivate' && (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Notes {actionDialog.type === 'suspend' ? <span className="text-red-500">* (reason required)</span> : '(optional)'}
                </label>
                <textarea rows={2}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.notes ? 'border-red-400' : ''}`}
                  value={actionForm.notes}
                  onChange={e => { setActionForm(f => ({ ...f, notes: e.target.value })); setActionErrs(v => ({ ...v, notes: '' })) }} />
                {actionErrs.notes && <p className="text-red-500 text-xs mt-1">{actionErrs.notes}</p>}
              </div>
            )}

            {actionMutation.isError && (
              <p className="text-red-500 text-xs">Something went wrong. Please try again.</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => { if (validateAction()) actionMutation.mutate() }} disabled={actionMutation.isPending}
                className="flex-1 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {actionMutation.isPending ? 'Processing…' : 'Confirm'}
              </button>
              <button onClick={() => setActionDialog(null)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Tenants Tab ──────────────────────────────────────────────────────────────
function TenantsTab() {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [drawerTenant, setDrawerTenant] = useState<Tenant | null>(null)

  const { data: tenantsRes, isLoading } = useQuery({
    queryKey: ['sa-tenants'],
    queryFn: () => tenantsApi.getAll(),
    refetchInterval: 30_000,
  })
  const allTenants: Tenant[] = tenantsRes?.data ?? []

  const filtered = allTenants.filter(t => {
    const matchSearch = !search || t.companyName.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'all')      return true
    if (filter === 'active')   return t.subscriptionStatus === 'ACTIVE'
    if (filter === 'trial')    return t.subscriptionStatus === 'TRIAL'
    if (filter === 'suspended') return t.subscriptionStatus === 'SUSPENDED'
    if (filter === 'expired')  return t.subscriptionStatus === 'EXPIRED'
    if (filter === 'expiring') return t.subscriptionStatus === 'ACTIVE' && isExpiringSoon(t.subscriptionEndDate)
    return true
  })

  const counts: Record<FilterKey, number> = {
    all:       allTenants.length,
    active:    allTenants.filter(t => t.subscriptionStatus === 'ACTIVE').length,
    trial:     allTenants.filter(t => t.subscriptionStatus === 'TRIAL').length,
    expiring:  allTenants.filter(t => t.subscriptionStatus === 'ACTIVE' && isExpiringSoon(t.subscriptionEndDate)).length,
    suspended: allTenants.filter(t => t.subscriptionStatus === 'SUSPENDED').length,
    expired:   allTenants.filter(t => t.subscriptionStatus === 'EXPIRED').length,
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'active',    label: 'Active' },
    { key: 'trial',     label: 'Trial' },
    { key: 'expiring',  label: 'Expiring' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'expired',   label: 'Expired' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter pills + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === key ? 'bg-feros-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {label}
              {counts[key] > 0 && <span className={`ml-1.5 ${filter === key ? 'text-blue-200' : 'text-gray-400'}`}>{counts[key]}</span>}
            </button>
          ))}
        </div>
        <input
          className="border rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-feros-navy"
          placeholder="Search company…"
          value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading tenants…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No tenants match this filter</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Vehicles</th>
                <th className="px-4 py-3 text-left">Users</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(t => {
                const uLimit = t.effectiveUserLimit
                const uCount = t.activeUserCount ?? 0
                const uWarn  = uLimit ? uCount >= uLimit : false
                const uAmber = uLimit ? uCount / uLimit >= 0.8 && !uWarn : false
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.companyName}</p>
                      <p className="text-xs text-gray-400">{t.ownerName}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.subscriptionStatus} /></td>
                    <td className="px-4 py-3 text-gray-600">{t.currentPlanName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.currentVehicleCount != null ? (
                        <span className="flex items-center gap-1"><Truck size={11} className="text-gray-400" />{t.currentVehicleCount}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${uWarn ? 'text-red-600' : uAmber ? 'text-amber-600' : 'text-gray-600'}`}>
                        {uWarn && <AlertTriangle size={10} />}
                        {uCount} / {uLimit ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {t.subscriptionStatus === 'TRIAL'
                        ? <span className="text-blue-600">Trial: {t.trialEndDate ?? '—'}</span>
                        : <ExpiryCell date={t.subscriptionEndDate} />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDrawerTenant(t)}
                        className="px-3 py-1.5 border border-feros-navy text-feros-navy rounded-lg text-xs font-medium hover:bg-blue-50">
                        Manage
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {drawerTenant && (
        <SubscriptionDrawer
          tenant={drawerTenant}
          onClose={() => setDrawerTenant(null)}
        />
      )}
    </div>
  )
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────
function InvoicesTab() {
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null)
  const { data: tenantsRes } = useQuery({ queryKey: ['sa-tenants'], queryFn: () => tenantsApi.getAll() })
  const tenants = tenantsRes?.data ?? []

  const { data: invoicesRes, isLoading } = useQuery({
    queryKey: ['sa-invoices', selectedTenantId],
    queryFn: () => subscriptionsApi.getInvoices(selectedTenantId!),
    enabled: selectedTenantId != null,
  })
  const invoices: SubscriptionInvoice[] = invoicesRes?.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Select Tenant</label>
        <SearchableSelect className="w-64" placeholder="— choose tenant —"
          value={selectedTenantId != null ? String(selectedTenantId) : ''}
          onValueChange={v => setSelectedTenantId(v ? Number(v) : null)}
          options={tenants.map(t => ({ value: String(t.id), label: t.companyName }))} />
      </div>
      {selectedTenantId == null ? (
        <div className="py-12 text-center text-gray-400 text-sm">Select a tenant to view invoices</div>
      ) : isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No invoices yet</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Vehicles</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{inv.planName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {inv.vehicleCount && inv.pricePerVehicle ? `${inv.vehicleCount} × ${fmt(inv.pricePerVehicle)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{inv.periodStart} → {inv.periodEnd ?? '∞'}</td>
                  <td className="px-4 py-3 text-right">{fmt(inv.amount)}</td>
                  <td className="px-4 py-3 text-right">{fmt(inv.gstAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(inv.totalAmount)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{inv.paymentRef ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Broadcast Tab ────────────────────────────────────────────────────────────
function BroadcastTab() {
  const [form, setForm] = useState({ tenantId: '', title: '', message: '' })
  const [sent, setSent] = useState(false)
  const { data: tenantsRes } = useQuery({ queryKey: ['sa-tenants'], queryFn: () => tenantsApi.getAll() })
  const tenants = tenantsRes?.data ?? []

  const mutation = useMutation({
    mutationFn: () => notificationsApi.broadcast({ tenantId: form.tenantId ? Number(form.tenantId) : null, title: form.title, message: form.message }),
    onSuccess: () => { setSent(true); setForm({ tenantId: '', title: '', message: '' }); setTimeout(() => setSent(false), 3000) },
  })

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-gray-500">Send a notification to one or all tenants.</p>
      {sent && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">Notification sent successfully!</div>}
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Tenant (optional — leave blank for all)</label>
        <SearchableSelect placeholder="All Tenants" value={form.tenantId}
          onValueChange={v => setForm(f => ({ ...f, tenantId: v }))}
          options={tenants.map(t => ({ value: String(t.id), label: t.companyName }))} />
      </div>
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Title</label>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title" />
      </div>
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Message</label>
        <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={4} value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Write your message here…" />
      </div>
      <button onClick={() => mutation.mutate()}
        disabled={!form.title || !form.message || mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50">
        <Megaphone size={15} />
        {mutation.isPending ? 'Sending…' : 'Send Notification'}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'tenants',   label: 'Tenants',   icon: Users },
  { id: 'invoices',  label: 'Invoices',  icon: FileText },
  { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
]

export function SubscriptionsPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('tenants')

  useEffect(() => {
    if (searchParams.get('tenantId')) setTab('tenants')
  }, [searchParams])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 text-sm mt-1">Manage tenant plans and billing</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {tab === 'tenants'   && <TenantsTab />}
        {tab === 'invoices'  && <InvoicesTab />}
        {tab === 'broadcast' && <BroadcastTab />}
      </div>
    </div>
  )
}
