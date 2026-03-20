import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Plus, ToggleLeft, ToggleRight, History, FileText, Megaphone } from 'lucide-react'
import { tenantsApi, subscriptionPlansApi, subscriptionsApi, notificationsApi } from '@/api/superadmin'
import type { SubscriptionPlan, SubscriptionHistory, SubscriptionInvoice } from '@/types'

type Tab = 'plans' | 'history' | 'invoices' | 'broadcast'

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    TRIAL: 'bg-blue-100 text-blue-700',
    ACTIVE: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-red-100 text-red-700',
    SUSPENDED: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function fmt(n?: number | null) {
  if (n == null) return '—'
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────
function PlansTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState({ name: '', maxLorries: '', maxUsers: '', priceMonthly: '', priceYearly: '', features: '' })

  const { data: plansRes, isLoading } = useQuery({
    queryKey: ['sa-plans-all'],
    queryFn: () => subscriptionPlansApi.getAll(),
  })
  const plans = plansRes?.data ?? []

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => editing
      ? subscriptionPlansApi.update(editing.id, data)
      : subscriptionPlansApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-plans-all'] }); closeForm() },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: number) => subscriptionPlansApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-plans-all'] }),
  })

  function openAdd() { setEditing(null); setForm({ name: '', maxLorries: '', maxUsers: '', priceMonthly: '', priceYearly: '', features: '' }); setShowForm(true) }
  function openEdit(p: SubscriptionPlan) { setEditing(p); setForm({ name: p.name, maxLorries: String(p.maxLorries), maxUsers: String(p.maxUsers), priceMonthly: String(p.priceMonthly), priceYearly: String(p.priceYearly), features: p.features ?? '' }); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{plans.length} plans configured</p>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium hover:bg-feros-navy/90">
          <Plus size={15} /> Add Plan
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">{editing ? 'Edit Plan' : 'New Plan'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-600 mb-1 block">Plan Name</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starter" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Max Lorries (-1 = unlimited)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.maxLorries} onChange={e => setForm(f => ({ ...f, maxLorries: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Max Users (-1 = unlimited)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.maxUsers} onChange={e => setForm(f => ({ ...f, maxUsers: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Price Monthly (₹)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.priceMonthly} onChange={e => setForm(f => ({ ...f, priceMonthly: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Price Yearly (₹)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.priceYearly} onChange={e => setForm(f => ({ ...f, priceYearly: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 mb-1 block">Features (JSON or text)</label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="px-4 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeForm} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading plans…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className={`bg-white rounded-xl border p-4 space-y-3 ${!plan.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {plan.maxLorries === -1 ? 'Unlimited' : plan.maxLorries} lorries · {plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers} users
                  </p>
                </div>
                <button onClick={() => toggleMutation.mutate(plan.id)} className="text-gray-400 hover:text-gray-700">
                  {plan.isActive ? <ToggleRight size={22} className="text-green-500" /> : <ToggleLeft size={22} />}
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly</span>
                  <span className="font-semibold">{fmt(plan.priceMonthly)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Yearly</span>
                  <span className="font-semibold">{fmt(plan.priceYearly)}</span>
                </div>
              </div>
              <button onClick={() => openEdit(plan)} className="text-xs text-feros-navy hover:underline">Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab() {
  const qc = useQueryClient()
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null)
  const [actionDialog, setActionDialog] = useState<{ type: 'activate' | 'extend-trial' | 'extend' | 'suspend' | 'reactivate'; tenantId: number } | null>(null)
  const [actionForm, setActionForm] = useState({ planId: '', billingCycle: 'MONTHLY', startDate: '', endDate: '', newEndDate: '', amount: '', paymentRef: '', notes: '' })

  const { data: tenantsRes } = useQuery({ queryKey: ['sa-tenants'], queryFn: () => tenantsApi.getAll() })
  const { data: plansRes } = useQuery({ queryKey: ['sa-plans-active'], queryFn: () => subscriptionPlansApi.getActive() })
  const tenants = tenantsRes?.data ?? []
  const plans = plansRes?.data ?? []

  const { data: historyRes, isLoading } = useQuery({
    queryKey: ['sa-sub-history', selectedTenantId],
    queryFn: () => subscriptionsApi.getHistory(selectedTenantId!),
    enabled: selectedTenantId != null,
  })
  const history: SubscriptionHistory[] = historyRes?.data ?? []

  const actionMutation = useMutation({
    mutationFn: () => {
      if (!actionDialog) throw new Error()
      const { type, tenantId } = actionDialog
      if (type === 'activate') return subscriptionsApi.activate(tenantId, { planId: Number(actionForm.planId), billingCycle: actionForm.billingCycle, startDate: actionForm.startDate, endDate: actionForm.endDate, amount: actionForm.amount ? Number(actionForm.amount) : undefined, paymentRef: actionForm.paymentRef, notes: actionForm.notes })
      if (type === 'extend-trial') return subscriptionsApi.extendTrial(tenantId, { newEndDate: actionForm.newEndDate, notes: actionForm.notes })
      if (type === 'extend') return subscriptionsApi.extend(tenantId, { newEndDate: actionForm.newEndDate, notes: actionForm.notes })
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Select Tenant</label>
          <select
            className="border rounded-lg px-3 py-2 text-sm w-64"
            value={selectedTenantId ?? ''}
            onChange={e => setSelectedTenantId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— choose tenant —</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.companyName} ({t.subscriptionStatus})</option>
            ))}
          </select>
        </div>

        {selectedTenant && (
          <div className="flex gap-2 flex-wrap">
            {(selectedTenant.subscriptionStatus === 'TRIAL' || selectedTenant.subscriptionStatus === 'EXPIRED') && (
              <button onClick={() => { setActionForm(f => ({ ...f, startDate: '', endDate: '', planId: '', billingCycle: 'MONTHLY' })); setActionDialog({ type: 'activate', tenantId: selectedTenant.id }) }} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                Activate Subscription
              </button>
            )}
            {selectedTenant.subscriptionStatus === 'TRIAL' && (
              <button onClick={() => { setActionForm(f => ({ ...f, newEndDate: '', notes: '' })); setActionDialog({ type: 'extend-trial', tenantId: selectedTenant.id }) }} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Extend Trial
              </button>
            )}
            {selectedTenant.subscriptionStatus === 'ACTIVE' && (
              <button onClick={() => { setActionForm(f => ({ ...f, newEndDate: '', notes: '' })); setActionDialog({ type: 'extend', tenantId: selectedTenant.id }) }} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Extend
              </button>
            )}
            {(selectedTenant.subscriptionStatus === 'ACTIVE' || selectedTenant.subscriptionStatus === 'TRIAL') && (
              <button onClick={() => { setActionForm(f => ({ ...f, notes: '' })); setActionDialog({ type: 'suspend', tenantId: selectedTenant.id }) }} className="px-3 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium">
                Suspend
              </button>
            )}
            {selectedTenant.subscriptionStatus === 'SUSPENDED' && (
              <button onClick={() => setActionDialog({ type: 'reactivate', tenantId: selectedTenant.id })} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                Reactivate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action Dialog */}
      {actionDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-lg capitalize">{actionDialog.type.replace('-', ' ')}</h3>
            {actionDialog.type === 'activate' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Plan</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.planId} onChange={e => setActionForm(f => ({ ...f, planId: e.target.value }))}>
                    <option value="">— select plan —</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Billing Cycle</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.billingCycle} onChange={e => setActionForm(f => ({ ...f, billingCycle: e.target.value }))}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Start Date</label>
                    <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.startDate} onChange={e => setActionForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">End Date</label>
                    <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.endDate} onChange={e => setActionForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Amount (₹, optional override)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.amount} onChange={e => setActionForm(f => ({ ...f, amount: e.target.value }))} placeholder="Leave blank to use plan price" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Payment Reference</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.paymentRef} onChange={e => setActionForm(f => ({ ...f, paymentRef: e.target.value }))} />
                </div>
              </div>
            )}
            {(actionDialog.type === 'extend-trial' || actionDialog.type === 'extend') && (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">New End Date</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={actionForm.newEndDate} onChange={e => setActionForm(f => ({ ...f, newEndDate: e.target.value }))} />
              </div>
            )}
            {actionDialog.type !== 'reactivate' && (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Notes {actionDialog.type === 'suspend' ? '(reason, required)' : '(optional)'}</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={actionForm.notes} onChange={e => setActionForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => actionMutation.mutate()} disabled={actionMutation.isPending} className="flex-1 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {actionMutation.isPending ? 'Processing…' : 'Confirm'}
              </button>
              <button onClick={() => setActionDialog(null)} className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
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
                  <td className="px-4 py-3 font-medium">{h.planName}</td>
                  <td className="px-4 py-3 text-gray-500">{h.billingCycle ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{h.startDate}</td>
                  <td className="px-4 py-3 text-gray-500">{h.endDate}</td>
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
        <select
          className="border rounded-lg px-3 py-2 text-sm w-64"
          value={selectedTenantId ?? ''}
          onChange={e => setSelectedTenantId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— choose tenant —</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.companyName}</option>)}
        </select>
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
                  <td className="px-4 py-3 text-gray-500 text-xs">{inv.periodStart} → {inv.periodEnd}</td>
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
      <p className="text-sm text-gray-500">Send a notification to one or all tenants. Leave tenant blank to broadcast to everyone.</p>
      {sent && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">Notification sent successfully!</div>}
      <div>
        <label className="text-xs text-gray-600 mb-1 block">Tenant (optional — leave blank for all)</label>
        <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}>
          <option value="">All Tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.companyName}</option>)}
        </select>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: typeof BadgeCheck }[] = [
  { id: 'plans',     label: 'Plans',     icon: BadgeCheck },
  { id: 'history',   label: 'History',   icon: History },
  { id: 'invoices',  label: 'Invoices',  icon: FileText },
  { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
]

export function SubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('plans')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 text-sm mt-1">Manage tenant plans and billing</p>
      </div>

      {/* Tabs */}
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

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {tab === 'plans'     && <PlansTab />}
        {tab === 'history'   && <HistoryTab />}
        {tab === 'invoices'  && <InvoicesTab />}
        {tab === 'broadcast' && <BroadcastTab />}
      </div>
    </div>
  )
}
