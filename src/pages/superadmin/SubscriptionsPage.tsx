import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeCheck, ToggleLeft, ToggleRight, History, FileText,
  Megaphone, CheckCircle, Lock, Calculator, Truck, ArrowUpCircle, X,
} from 'lucide-react'
import type { UpgradeRequest } from '@/types'
import { tenantsApi, subscriptionPlansApi, subscriptionsApi, notificationsApi } from '@/api/superadmin'
import type { SubscriptionPlan, SubscriptionHistory, SubscriptionInvoice } from '@/types'
import { SearchableSelect } from '@/components/ui/searchable-select'

type Tab = 'plans' | 'requests' | 'history' | 'invoices' | 'broadcast'

const GST_RATE    = 0.18
const ANNUAL_MTHS = 10  // pay 10 months, get 12

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n?: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
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
        {cycle === 'YEARLY' && !twoMonthsFree && (
          <p className="text-gray-500 text-xs mt-1">Annual — 12 months</p>
        )}
      </div>
    </div>
  )
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────
const FEATURE_LABELS: { key: keyof SubscriptionPlan; label: string }[] = [
  { key: 'hasFuelLogs',        label: 'Fuel Logs' },
  { key: 'hasMeterReadings',   label: 'Meter Readings' },
  { key: 'hasVehicleServices', label: 'Vehicle Services' },
  { key: 'hasAttendance',      label: 'Attendance' },
  { key: 'hasPayroll',         label: 'Payroll' },
  { key: 'hasInventory',       label: 'Inventory' },
  { key: 'hasReports',         label: 'Reports' },
  { key: 'hasCreditNotes',     label: 'Credit Notes' },
]

function PlansTab() {
  const qc = useQueryClient()
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null)
  const emptyForm = { pricePerVehicle: '', minVehicles: '', maxVehicles: '', maxUsers: '',
    hasFuelLogs: true, hasMeterReadings: true, hasVehicleServices: true,
    hasAttendance: true, hasPayroll: true, hasInventory: true, hasReports: true, hasCreditNotes: true }
  const [editForm, setEditForm] = useState(emptyForm)

  const { data: plansRes, isLoading } = useQuery({
    queryKey: ['sa-plans-all'],
    queryFn: () => subscriptionPlansApi.getAll(),
  })
  const allPlans: SubscriptionPlan[] = (plansRes?.data ?? []).slice().sort((a, b) => {
    const order = (p: SubscriptionPlan) =>
      p.name.toLowerCase() === 'trial' ? 0
      : p.name.toLowerCase() === 'free'  ? 1
      : (p.pricePerVehicle ?? 0)
    return order(a) - order(b)
  })
  const [showInactive, setShowInactive] = useState(false)
  const plans = showInactive ? allPlans : allPlans.filter(p => p.isActive)

  const toggleMutation = useMutation({
    mutationFn: (id: number) => subscriptionPlansApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-plans-all'] }),
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof editForm) => subscriptionPlansApi.update(editPlan!.id, {
      name: editPlan!.name,
      pricePerVehicle: data.pricePerVehicle ? Number(data.pricePerVehicle) : undefined,
      minVehicles: data.minVehicles ? Number(data.minVehicles) : undefined,
      maxVehicles: data.maxVehicles ? Number(data.maxVehicles) : undefined,
      maxUsers: data.maxUsers ? Number(data.maxUsers) : undefined,
      hasFuelLogs: data.hasFuelLogs, hasMeterReadings: data.hasMeterReadings,
      hasVehicleServices: data.hasVehicleServices, hasAttendance: data.hasAttendance,
      hasPayroll: data.hasPayroll, hasInventory: data.hasInventory,
      hasReports: data.hasReports, hasCreditNotes: data.hasCreditNotes,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-plans-all'] }); setEditPlan(null) },
  })

  function openEdit(p: SubscriptionPlan) {
    setEditPlan(p)
    setEditForm({
      pricePerVehicle: String(p.pricePerVehicle ?? ''),
      minVehicles: String(p.minVehicles ?? ''),
      maxVehicles: String(p.maxVehicles ?? ''),
      maxUsers: String(p.maxUsers ?? ''),
      hasFuelLogs: p.hasFuelLogs ?? true, hasMeterReadings: p.hasMeterReadings ?? true,
      hasVehicleServices: p.hasVehicleServices ?? true, hasAttendance: p.hasAttendance ?? true,
      hasPayroll: p.hasPayroll ?? true, hasInventory: p.hasInventory ?? true,
      hasReports: p.hasReports ?? true, hasCreditNotes: p.hasCreditNotes ?? true,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{allPlans.filter(p => p.isActive).length} active plans</p>
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {/* Edit dialog */}
      {editPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-lg">Edit — {editPlan.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">₹/vehicle/month</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={editForm.pricePerVehicle}
                  onChange={e => setEditForm(f => ({ ...f, pricePerVehicle: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Max Users (-1 = unlimited)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={editForm.maxUsers}
                  onChange={e => setEditForm(f => ({ ...f, maxUsers: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Min Vehicles</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={editForm.minVehicles}
                  onChange={e => setEditForm(f => ({ ...f, minVehicles: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Max Vehicles (-1 = unlimited)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={editForm.maxVehicles}
                  onChange={e => setEditForm(f => ({ ...f, maxVehicles: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-2 block">Features</label>
              <div className="grid grid-cols-2 gap-2">
                {FEATURE_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox"
                      checked={Boolean(editForm[key as keyof typeof editForm])}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending}
                className="flex-1 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditPlan(null)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading plans…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isPaid = !!(plan.pricePerVehicle && plan.pricePerVehicle > 0)
            return (
              <div key={plan.id} className={`bg-white rounded-xl border p-4 space-y-3 ${!plan.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                    {isPaid ? (
                      <p className="text-sm font-bold text-feros-navy mt-0.5">
                        {fmt(plan.pricePerVehicle)}<span className="text-xs font-normal text-gray-500">/vehicle/month</span>
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-blue-600 mt-0.5">
                        {plan.name.toLowerCase() === 'trial' ? '30-day Trial' : 'Free'}
                      </p>
                    )}
                  </div>
                  <button onClick={() => toggleMutation.mutate(plan.id)} className="text-gray-400 hover:text-gray-700">
                    {plan.isActive ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} />}
                  </button>
                </div>

                {/* Vehicle & user limits */}
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>
                    <Truck size={11} className="inline mr-1" />
                    {plan.minVehicles ?? 1}–{plan.maxVehicles === -1 ? '∞' : plan.maxVehicles} vehicles
                  </p>
                  <p>Users: {plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers}</p>
                  {isPaid && (() => {
                    const qualifies = (plan.minVehicles ?? 0) >= 250
                    const annualRate = qualifies ? ANNUAL_MTHS : 12
                    return (
                      <p className="text-blue-600">
                        Annual: {fmt((plan.pricePerVehicle ?? 0) * annualRate)}/vehicle
                        {qualifies ? ' (2 months free)' : ''}
                      </p>
                    )
                  })()}
                </div>

                {/* Feature flags */}
                <div className="flex flex-wrap gap-1">
                  {FEATURE_LABELS.map(({ key, label }) => (
                    <span key={key} className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                      plan[key] ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {plan[key] ? <CheckCircle size={9} /> : <Lock size={9} />}
                      {label}
                    </span>
                  ))}
                </div>

                <button onClick={() => openEdit(plan)} className="text-xs text-feros-navy hover:underline">Edit</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ preselectedTenantId }: { preselectedTenantId?: number | null }) {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(() => {
    if (preselectedTenantId) return preselectedTenantId
    const p = searchParams.get('tenantId')
    return p ? Number(p) : null
  })
  useEffect(() => {
    if (preselectedTenantId) { setSelectedTenantId(preselectedTenantId); return }
    const p = searchParams.get('tenantId')
    if (p) setSelectedTenantId(Number(p))
  }, [searchParams, preselectedTenantId])

  const [actionDialog, setActionDialog] = useState<{
    type: 'activate' | 'extend-trial' | 'extend' | 'suspend' | 'reactivate'
    tenantId: number
  } | null>(null)

  const emptyForm = { planId: '', billingCycle: 'MONTHLY', startDate: '', vehicleCount: '', newEndDate: '', amount: '', paymentRef: '', notes: '' }
  const emptyErrs = { planId: '', startDate: '', vehicleCount: '', newEndDate: '', notes: '' }
  const [actionForm, setActionForm] = useState(emptyForm)
  const [actionErrs, setActionErrs] = useState(emptyErrs)

  const { data: tenantsRes } = useQuery({ queryKey: ['sa-tenants'], queryFn: () => tenantsApi.getAll() })
  const { data: plansRes }   = useQuery({ queryKey: ['sa-plans-active'], queryFn: () => subscriptionPlansApi.getActive() })
  const tenants  = tenantsRes?.data ?? []
  // Exclude Trial from activate dropdown — Trial is auto-managed on signup
  const plans: SubscriptionPlan[] = (plansRes?.data ?? []).filter(p => p.name.toLowerCase() !== 'trial')

  const { data: historyRes, isLoading } = useQuery({
    queryKey: ['sa-sub-history', selectedTenantId],
    queryFn: () => subscriptionsApi.getHistory(selectedTenantId!),
    enabled: selectedTenantId != null,
  })
  const history: SubscriptionHistory[] = historyRes?.data ?? []

  const selectedPlan = plans.find(p => String(p.id) === actionForm.planId)
  const vehicleCount = Number(actionForm.vehicleCount) || 0

  // For extend: get current vehicleCount + pricePerVehicle from latest ACTIVE history
  const latestActive   = history.find(h => h.status === 'ACTIVE')
  const extendVehicles = Number(actionForm.vehicleCount) || latestActive?.vehicleCount || 0
  const extendRate     = latestActive?.pricePerVehicle ?? 0

  const actionMutation = useMutation({
    mutationFn: () => {
      if (!actionDialog) throw new Error()
      const type     = actionDialog.type
      const tenantId = actionDialog.tenantId
      if (type === 'activate') {
        return subscriptionsApi.activate(tenantId, {
          planId: Number(actionForm.planId),
          vehicleCount: Number(actionForm.vehicleCount),
          billingCycle: actionForm.billingCycle,
          startDate: actionForm.startDate,
          amount: actionForm.amount ? Number(actionForm.amount) : undefined,
          paymentRef: actionForm.paymentRef || undefined,
          notes: actionForm.notes || undefined,
        })
      }
      if (type === 'extend-trial') {
        return subscriptionsApi.extendTrial(tenantId, {
          newEndDate: actionForm.newEndDate,
          notes: actionForm.notes || undefined,
        })
      }
      if (type === 'extend') {
        return subscriptionsApi.extend(tenantId, {
          vehicleCount: actionForm.vehicleCount ? Number(actionForm.vehicleCount) : undefined,
          newEndDate: actionForm.newEndDate || undefined,
          amount: actionForm.amount ? Number(actionForm.amount) : undefined,
          paymentRef: actionForm.paymentRef || undefined,
          notes: actionForm.notes || undefined,
        })
      }
      if (type === 'suspend') return subscriptionsApi.suspend(tenantId, { notes: actionForm.notes })
      return subscriptionsApi.reactivate(tenantId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-sub-history', selectedTenantId] })
      qc.invalidateQueries({ queryKey: ['sa-tenants'] })
      setActionDialog(null)
    },
  })

  const selectedTenant = tenants.find(t => t.id === selectedTenantId)

  function openDialog(type: 'activate' | 'extend-trial' | 'extend' | 'suspend' | 'reactivate') {
    setActionForm(emptyForm)
    setActionErrs(emptyErrs)
    setActionDialog({ type, tenantId: selectedTenantId! })
  }

  function validate() {
    const e = { ...emptyErrs }
    const t = actionDialog ? actionDialog.type : null
    if (t === 'activate') {
      if (!actionForm.planId) e.planId = 'Select a plan'
      if (!actionForm.vehicleCount) e.vehicleCount = 'Vehicle count is required'
      if (!actionForm.startDate) e.startDate = 'Start date is required'
    }
    if (t === 'extend-trial') {
      if (!actionForm.newEndDate) e.newEndDate = 'New end date is required'
    }
    if (t === 'suspend' && !actionForm.notes.trim()) {
      e.notes = 'Reason is required for suspension'
    }
    setActionErrs(e)
    return !Object.values(e).some(Boolean)
  }

  return (
    <div className="space-y-4">
      {/* Tenant selector + action buttons */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Select Tenant</label>
          <SearchableSelect
            className="w-64"
            placeholder="— choose tenant —"
            value={selectedTenantId != null ? String(selectedTenantId) : ''}
            onValueChange={v => setSelectedTenantId(v ? Number(v) : null)}
            options={[
              ...tenants.map(t => ({
                value: String(t.id),
                label: `${t.companyName} (${t.subscriptionStatus})`,
              }))
            ]}
          />
        </div>

        {selectedTenant && (
          <div className="flex gap-2 flex-wrap">
            {(selectedTenant.subscriptionStatus === 'TRIAL' || selectedTenant.subscriptionStatus === 'EXPIRED') && (
              <button onClick={() => openDialog('activate')} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                Activate
              </button>
            )}
            {selectedTenant.subscriptionStatus === 'TRIAL' && (
              <button onClick={() => openDialog('extend-trial')} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Extend Trial
              </button>
            )}
            {selectedTenant.subscriptionStatus === 'ACTIVE' && (
              <button onClick={() => openDialog('extend')} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Renew
              </button>
            )}
            {(selectedTenant.subscriptionStatus === 'ACTIVE' || selectedTenant.subscriptionStatus === 'TRIAL') && (
              <button onClick={() => openDialog('suspend')} className="px-3 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium">
                Suspend
              </button>
            )}
            {selectedTenant.subscriptionStatus === 'SUSPENDED' && (
              <button onClick={() => { setActionDialog({ type: 'reactivate', tenantId: selectedTenant.id }) }} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                Reactivate
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Action Dialog ── */}
      {actionDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg capitalize">{actionDialog.type.replace('-', ' ')}</h3>

            {/* ACTIVATE */}
            {actionDialog.type === 'activate' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Plan <span className="text-red-500">*</span></label>
                  <select
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.planId ? 'border-red-400' : ''}`}
                    value={actionForm.planId}
                    onChange={e => setActionForm(f => ({ ...f, planId: e.target.value, vehicleCount: '' }))}
                  >
                    <option value="">— select plan —</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.pricePerVehicle ? `(₹${p.pricePerVehicle}/vehicle)` : '(Free)'}
                      </option>
                    ))}
                  </select>
                  {actionErrs.planId && <p className="text-red-500 text-xs mt-1">{actionErrs.planId}</p>}
                </div>

                {selectedPlan && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">
                          Vehicle Count <span className="text-red-500">*</span>
                          <span className="text-gray-400 ml-1">(min {selectedPlan.minVehicles ?? 1})</span>
                        </label>
                        <input
                          type="number"
                          min={selectedPlan.minVehicles ?? 1}
                          className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.vehicleCount ? 'border-red-400' : ''}`}
                          value={actionForm.vehicleCount}
                          onChange={e => { setActionForm(f => ({ ...f, vehicleCount: e.target.value })); setActionErrs(v => ({ ...v, vehicleCount: '' })) }}
                          placeholder={`Min ${selectedPlan.minVehicles ?? 1}`}
                        />
                        {actionErrs.vehicleCount && <p className="text-red-500 text-xs mt-1">{actionErrs.vehicleCount}</p>}
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Billing Cycle</label>
                        <select
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          value={actionForm.billingCycle}
                          onChange={e => setActionForm(f => ({ ...f, billingCycle: e.target.value }))}
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="THREE_MONTHS">3 Months</option>
                          <option value="SIX_MONTHS">6 Months</option>
                          <option value="YEARLY">Annual{(selectedPlan?.minVehicles ?? 0) >= 250 ? ' (2 months free)' : ''}</option>
                        </select>
                      </div>
                    </div>

                    {/* Live preview */}
                    {vehicleCount > 0 && selectedPlan.pricePerVehicle && (
                      <AmountPreview
                        pricePerVehicle={selectedPlan.pricePerVehicle}
                        vehicleCount={vehicleCount}
                        cycle={actionForm.billingCycle}
                        twoMonthsFree={(selectedPlan.minVehicles ?? 0) >= 250}
                      />
                    )}
                  </>
                )}

                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.startDate ? 'border-red-400' : ''}`}
                    value={actionForm.startDate}
                    onChange={e => { setActionForm(f => ({ ...f, startDate: e.target.value })); setActionErrs(v => ({ ...v, startDate: '' })) }}
                  />
                  {actionErrs.startDate && <p className="text-red-500 text-xs mt-1">{actionErrs.startDate}</p>}
                  {actionForm.startDate && (
                    <p className="text-xs text-gray-400 mt-1">
                      End date auto-calculated: {
                        actionForm.billingCycle === 'YEARLY' ? '12 months' :
                        actionForm.billingCycle === 'SIX_MONTHS' ? '6 months' :
                        actionForm.billingCycle === 'THREE_MONTHS' ? '3 months' : '1 month'
                      } from start
                    </p>
                  )}
                </div>

                {selectedPlan && (
                  <>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Amount override (₹, optional)</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={actionForm.amount}
                        onChange={e => setActionForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="Leave blank to auto-calculate"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Payment Reference</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={actionForm.paymentRef}
                        onChange={e => setActionForm(f => ({ ...f, paymentRef: e.target.value }))}
                        placeholder="UPI / bank transfer ref"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* EXTEND TRIAL */}
            {actionDialog.type === 'extend-trial' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">New End Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.newEndDate ? 'border-red-400' : ''}`}
                    value={actionForm.newEndDate}
                    onChange={e => { setActionForm(f => ({ ...f, newEndDate: e.target.value })); setActionErrs(v => ({ ...v, newEndDate: '' })) }}
                  />
                  {actionErrs.newEndDate && <p className="text-red-500 text-xs mt-1">{actionErrs.newEndDate}</p>}
                </div>
              </div>
            )}

            {/* EXTEND / RENEW */}
            {actionDialog.type === 'extend' && (
              <div className="space-y-3">
                {latestActive && (
                  <div className="bg-gray-50 border rounded-lg px-3 py-2 text-xs text-gray-600 space-y-0.5">
                    <p>Current: <strong>{latestActive.planName}</strong> · {latestActive.vehicleCount} vehicles · {fmt(latestActive.pricePerVehicle)}/vehicle</p>
                    <p>Billing: {latestActive.billingCycle} · Ends: {latestActive.endDate ?? 'N/A'}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">
                    Vehicle Count <span className="text-gray-400">(optional — keep {latestActive?.vehicleCount ?? '—'} if blank)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.vehicleCount}
                    onChange={e => setActionForm(f => ({ ...f, vehicleCount: e.target.value }))}
                    placeholder={String(latestActive?.vehicleCount ?? '')}
                  />
                </div>

                {/* Live preview for extend */}
                {extendRate > 0 && extendVehicles > 0 && latestActive?.billingCycle && (
                  <AmountPreview
                    pricePerVehicle={extendRate}
                    vehicleCount={extendVehicles}
                    cycle={latestActive.billingCycle}
                    twoMonthsFree={extendVehicles >= 250}
                  />
                )}

                <div>
                  <label className="text-xs text-gray-600 mb-1 block">
                    New End Date <span className="text-gray-400">(optional — auto-calculated if blank)</span>
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.newEndDate}
                    onChange={e => setActionForm(f => ({ ...f, newEndDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Amount override (₹, optional)</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.amount}
                    onChange={e => setActionForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="Leave blank to auto-calculate"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Payment Reference</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={actionForm.paymentRef}
                    onChange={e => setActionForm(f => ({ ...f, paymentRef: e.target.value }))}
                    placeholder="UPI / bank transfer ref"
                  />
                </div>
              </div>
            )}

            {/* SUSPEND */}
            {actionDialog.type === 'suspend' && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
                  This will immediately block the tenant from using FEROS.
                </div>
              </div>
            )}

            {/* Notes (all except reactivate) */}
            {actionDialog.type !== 'reactivate' && (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">
                  Notes {actionDialog.type === 'suspend' ? <span className="text-red-500">* (reason required)</span> : '(optional)'}
                </label>
                <textarea
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${actionErrs.notes ? 'border-red-400' : ''}`}
                  rows={2}
                  value={actionForm.notes}
                  onChange={e => { setActionForm(f => ({ ...f, notes: e.target.value })); setActionErrs(v => ({ ...v, notes: '' })) }}
                />
                {actionErrs.notes && <p className="text-red-500 text-xs mt-1">{actionErrs.notes}</p>}
              </div>
            )}

            {actionMutation.isError && (
              <p className="text-red-500 text-xs">Something went wrong. Please try again.</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { if (validate()) actionMutation.mutate() }}
                disabled={actionMutation.isPending}
                className="flex-1 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {actionMutation.isPending ? 'Processing…' : 'Confirm'}
              </button>
              <button
                onClick={() => setActionDialog(null)}
                className="flex-1 py-2 border rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Table ── */}
      {selectedTenantId == null ? (
        <div className="py-12 text-center text-gray-400 text-sm">Select a tenant to view subscription history</div>
      ) : isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No subscription history</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Vehicles</th>
                <th className="px-4 py-3 text-left">Cycle</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">End</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><StatusBadge status={h.status} /></td>
                  <td className="px-4 py-3 font-medium">{h.planName && h.planName !== '-' ? h.planName : (h.status === 'TRIAL' ? 'Trial' : '—')}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {h.vehicleCount ? `${h.vehicleCount} × ${fmt(h.pricePerVehicle)}` : h.status === 'TRIAL' ? <span className="text-blue-600">Unlimited</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{{MONTHLY:'Monthly',THREE_MONTHS:'3-Month',SIX_MONTHS:'6-Month',YEARLY:'Annual'}[h.billingCycle ?? ''] ?? h.billingCycle ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{h.startDate}</td>
                  <td className="px-4 py-3 text-gray-500">{h.endDate ?? '∞'}</td>
                  <td className="px-4 py-3 text-right">{fmt(h.totalAmount)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{h.paymentRef ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <SearchableSelect
          className="w-64"
          placeholder="— choose tenant —"
          value={selectedTenantId != null ? String(selectedTenantId) : ''}
          onValueChange={v => setSelectedTenantId(v ? Number(v) : null)}
          options={tenants.map(t => ({ value: String(t.id), label: t.companyName }))}
        />
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
                <th className="px-4 py-3 text-left">Date</th>
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
                  <td className="px-4 py-3 text-gray-400 text-xs">{inv.createdAt?.slice(0, 10)}</td>
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
        <SearchableSelect
          placeholder="All Tenants"
          value={form.tenantId}
          onValueChange={v => setForm(f => ({ ...f, tenantId: v }))}
          options={tenants.map(t => ({ value: String(t.id), label: t.companyName }))}
        />
      </div>
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Title</label>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title" />
      </div>
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Message</label>
        <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Write your message here…" />
      </div>
      <button
        onClick={() => mutation.mutate()}
        disabled={!form.title || !form.message || mutation.isPending}
        className="flex items-center gap-2 px-4 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        <Megaphone size={15} />
        {mutation.isPending ? 'Sending…' : 'Send Notification'}
      </button>
    </div>
  )
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────
function RequestsTab({ onActivate: _onActivate }: { onActivate: (tenantId: number) => void }) {
  const qc = useQueryClient()
  const { data: reqRes, isLoading } = useQuery({
    queryKey: ['sa-upgrade-requests'],
    queryFn: () => subscriptionsApi.getUpgradeRequests(),
  })
  const requests: UpgradeRequest[] = reqRes?.data ?? []
  const pending = requests.filter(r => r.status === 'PENDING')
  const others  = requests.filter(r => r.status !== 'PENDING')

  // Inline activate dialog state
  const [activating, setActivating] = useState<UpgradeRequest | null>(null)
  const [startDate,  setStartDate]  = useState('')
  const [paymentRef, setPaymentRef] = useState('')

  function openActivate(r: UpgradeRequest) {
    setActivating(r)
    setStartDate(new Date().toISOString().slice(0, 10))
    setPaymentRef('')
  }

  const activateMutation = useMutation({
    mutationFn: () => subscriptionsApi.activate(activating!.tenantId, {
      planId:       activating!.planId!,
      vehicleCount: activating!.vehicleCount!,
      billingCycle: activating!.billingCycle ?? 'MONTHLY',
      startDate,
      paymentRef:   paymentRef || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-upgrade-requests'] })
      qc.invalidateQueries({ queryKey: ['sa-sub-history'] })
      setActivating(null)
      import('sonner').then(({ toast }) => toast.success('Subscription activated'))
    },
    onError: () => import('sonner').then(({ toast }) => toast.error('Activation failed')),
  })

  const dismissMutation = useMutation({
    mutationFn: (id: number) => subscriptionsApi.dismissUpgradeRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-upgrade-requests'] }),
  })

  function RequestCard({ r }: { r: UpgradeRequest }) {
    return (
      <div className={`bg-white border rounded-xl p-4 space-y-2 ${r.status !== 'PENDING' ? 'opacity-50' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900">{r.companyName}</p>
            <p className="text-sm text-feros-navy font-medium mt-0.5">
              {r.planName} · {r.vehicleCount} vehicles · {{MONTHLY:'Monthly',THREE_MONTHS:'3-Month',SIX_MONTHS:'6-Month',YEARLY:'Annual'}[r.billingCycle ?? ''] ?? r.billingCycle}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
            r.status === 'PENDING'   ? 'bg-blue-100 text-blue-700' :
            r.status === 'FULFILLED' ? 'bg-green-100 text-green-700' :
                                       'bg-gray-100 text-gray-500'
          }`}>{r.status}</span>
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          <div className="flex justify-between">
            <span>Rate: {fmt(r.pricePerVehicle)}/vehicle</span>
            <span>Estimated: <strong className="text-gray-800">{fmt(r.estimatedTotal)}</strong> (incl. GST)</span>
          </div>
          {r.notes && <p className="text-gray-400 italic">"{r.notes}"</p>}
          <p className="text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        {r.status === 'PENDING' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => openActivate(r)}
              className="flex-1 py-1.5 bg-feros-navy text-white rounded-lg text-xs font-medium"
            >
              Activate
            </button>
            <button
              onClick={() => dismissMutation.mutate(r.id)}
              disabled={dismissMutation.isPending}
              className="px-3 py-1.5 border rounded-lg text-xs text-gray-500 hover:text-red-500"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Inline Activate Modal ──────────────────────────────────────────────
  const cycleLabel: Record<string, string> = { MONTHLY: 'Monthly', THREE_MONTHS: '3 Months', SIX_MONTHS: '6 Months', YEARLY: 'Annual' }

  if (isLoading) return <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <div className="space-y-6">
      {/* ── Activate Modal ── */}
      {activating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Activate Subscription</h3>
              <button onClick={() => setActivating(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="font-semibold text-gray-800">{activating.companyName}</div>
              <div className="text-gray-600">{activating.planName} · {activating.vehicleCount} vehicles · {cycleLabel[activating.billingCycle ?? ''] ?? activating.billingCycle}</div>
              <div className="text-gray-500 text-xs">Rate: {fmt(activating.pricePerVehicle)}/vehicle · Total: {fmt(activating.estimatedTotal)} (incl. GST)</div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy"
              />
            </div>

            {/* Payment Ref */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Reference (optional)</label>
              <input
                type="text"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="UTR / transaction ID"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setActivating(null)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => activateMutation.mutate()}
                disabled={!startDate || activateMutation.isPending}
                className="flex-1 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {activateMutation.isPending ? 'Activating…' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpCircle size={16} className="text-feros-navy" />
          <h3 className="font-semibold text-gray-800">Pending Requests</h3>
          {pending.length > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{pending.length}</span>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No pending upgrade requests</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pending.map(r => <RequestCard key={r.id} r={r} />)}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-500 text-sm mb-3">Fulfilled / Dismissed</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {others.map(r => <RequestCard key={r.id} r={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: typeof BadgeCheck }[] = [
  { id: 'plans',     label: 'Plans',     icon: BadgeCheck },
  { id: 'requests',  label: 'Requests',  icon: ArrowUpCircle },
  { id: 'history',   label: 'History',   icon: History },
  { id: 'invoices',  label: 'Invoices',  icon: FileText },
  { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
]

export function SubscriptionsPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => searchParams.get('tenantId') ? 'history' : 'plans')
  const [historyTenantId, setHistoryTenantId] = useState<number | null>(null)

  function goToActivate(tenantId: number) {
    setHistoryTenantId(tenantId)
    setTab('history')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 text-sm mt-1">Manage tenant plans and billing</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {tab === 'plans'     && <PlansTab />}
        {tab === 'requests'  && <RequestsTab onActivate={goToActivate} />}
        {tab === 'history'   && <HistoryTab preselectedTenantId={historyTenantId} />}
        {tab === 'invoices'  && <InvoicesTab />}
        {tab === 'broadcast' && <BroadcastTab />}
      </div>
    </div>
  )
}
