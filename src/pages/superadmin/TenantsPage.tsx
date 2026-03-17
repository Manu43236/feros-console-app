import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Plus, Building2, CheckCircle, XCircle, Users, Pencil, Trash2, ChevronDown, ChevronRight, LogIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tenantsApi } from '@/api/superadmin'
import { useAuthStore } from '@/store/authStore'
import type { Tenant, SubscriptionStatus } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────
const SUB_COLORS: Record<SubscriptionStatus, string> = {
  TRIAL:     'bg-yellow-50 text-yellow-700 border-yellow-200',
  ACTIVE:    'bg-green-50 text-green-700 border-green-200',
  EXPIRED:   'bg-red-50 text-red-700 border-red-200',
  SUSPENDED: 'bg-gray-100 text-gray-600 border-gray-300',
}

function SubBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SUB_COLORS[status]}`}>
      {status}
    </span>
  )
}

type TenantFormData = {
  companyName: string; email: string; phone: string
  ownerName: string; ownerPhone: string; ownerEmail: string
  prefix: string; address: string; city: string; state: string; pincode: string
  gstin: string; panNumber: string; tanNumber: string; cinNumber: string; transportLicenseNumber: string
  bankName: string; accountNumber: string; ifscCode: string; branchName: string; accountHolderName: string
}

const EMPTY_FORM: TenantFormData = {
  companyName: '', email: '', phone: '', ownerName: '', ownerPhone: '', ownerEmail: '',
  prefix: '', address: '', city: '', state: '', pincode: '',
  gstin: '', panNumber: '', tanNumber: '', cinNumber: '', transportLicenseNumber: '',
  bankName: '', accountNumber: '', ifscCode: '', branchName: '', accountHolderName: '',
}

function toForm(t: Tenant): TenantFormData {
  return {
    companyName: t.companyName, email: t.email, phone: t.phone,
    ownerName: t.ownerName, ownerPhone: t.ownerPhone, ownerEmail: t.ownerEmail ?? '',
    prefix: t.prefix ?? '', address: t.address ?? '', city: t.city ?? '',
    state: t.state ?? '', pincode: t.pincode ?? '',
    gstin: t.gstin ?? '', panNumber: t.panNumber ?? '', tanNumber: t.tanNumber ?? '',
    cinNumber: t.cinNumber ?? '', transportLicenseNumber: t.transportLicenseNumber ?? '',
    bankName: t.bankName ?? '', accountNumber: t.accountNumber ?? '',
    ifscCode: t.ifscCode ?? '', branchName: t.branchName ?? '', accountHolderName: t.accountHolderName ?? '',
  }
}

// ── Tenant Form Dialog ────────────────────────────────────────────────────────
function TenantDialog({ open, onClose, tenant }: {
  open: boolean; onClose: () => void; tenant?: Tenant
}) {
  const qc = useQueryClient()
  const isEdit = !!tenant
  const [form, setForm] = useState<TenantFormData>(() => tenant ? toForm(tenant) : EMPTY_FORM)

  const set = (k: keyof TenantFormData, v: string) => setForm(p => ({ ...p, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => isEdit ? tenantsApi.update(tenant!.id, form) : tenantsApi.create(form),
    onSuccess: () => {
      toast.success(isEdit ? 'Tenant updated' : 'Tenant created')
      qc.invalidateQueries({ queryKey: ['tenants'] })
      onClose()
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.companyName || !form.email || !form.phone || !form.ownerName || !form.ownerPhone) {
      return toast.error('Required fields missing')
    }
    mutation.mutate()
  }

  function Field({ label, fk, type = 'text' }: { label: string; fk: keyof TenantFormData; type?: string }) {
    return (
      <div>
        <Label>{label}</Label>
        <Input type={type} value={form[fk]} onChange={e => set(fk, e.target.value)} className="mt-1" placeholder={label} />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Tenant' : 'Create Tenant'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Basic Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Company Name *</Label><Input value={form.companyName} onChange={e => set('companyName', e.target.value)} className="mt-1" placeholder="Company Name" /></div>
              <Field label="Prefix (e.g. ABC)" fk="prefix" />
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="mt-1" placeholder="Email" /></div>
              <div><Label>Phone *</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1" placeholder="10-digit phone" /></div>
              <div className="col-span-2"><Field label="Address" fk="address" /></div>
              <Field label="City" fk="city" />
              <Field label="State" fk="state" />
              <Field label="Pincode" fk="pincode" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Owner Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Owner Name *</Label><Input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} className="mt-1" placeholder="Owner Name" /></div>
              <div><Label>Owner Phone *</Label><Input value={form.ownerPhone} onChange={e => set('ownerPhone', e.target.value)} className="mt-1" placeholder="10-digit phone" /></div>
              <Field label="Owner Email" fk="ownerEmail" type="email" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Legal / Tax</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GSTIN" fk="gstin" />
              <Field label="PAN Number" fk="panNumber" />
              <Field label="TAN Number" fk="tanNumber" />
              <Field label="CIN Number" fk="cinNumber" />
              <Field label="Transport License" fk="transportLicenseNumber" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Bank Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name" fk="bankName" />
              <Field label="Account Number" fk="accountNumber" />
              <Field label="IFSC Code" fk="ifscCode" />
              <Field label="Branch Name" fk="branchName" />
              <Field label="Account Holder Name" fk="accountHolderName" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Subscription Edit Dialog ──────────────────────────────────────────────────
function SubscriptionDialog({ open, onClose, tenant }: {
  open: boolean; onClose: () => void; tenant: Tenant | null
}) {
  const qc = useQueryClient()
  const [status, setStatus]       = useState<SubscriptionStatus>(tenant?.subscriptionStatus ?? 'TRIAL')
  const [subStart, setSubStart]   = useState(tenant?.subscriptionStartDate ?? '')
  const [subEnd, setSubEnd]       = useState(tenant?.subscriptionEndDate ?? '')
  const [trialStart, setTrialStart] = useState(tenant?.trialStartDate ?? '')
  const [trialEnd, setTrialEnd]     = useState(tenant?.trialEndDate ?? '')

  const mutation = useMutation({
    mutationFn: () => tenantsApi.update(tenant!.id, {
      ...toForm(tenant!),
      subscriptionStatus: status,
      subscriptionStartDate: subStart || undefined,
      subscriptionEndDate: subEnd || undefined,
      trialStartDate: trialStart || undefined,
      trialEndDate: trialEnd || undefined,
    }),
    onSuccess: () => {
      toast.success('Subscription updated')
      qc.invalidateQueries({ queryKey: ['tenants'] })
      onClose()
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Manage Subscription</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {tenant && <p className="text-sm font-semibold text-gray-700">{tenant.companyName}</p>}
          <div>
            <Label>Status *</Label>
            <Select value={status} onValueChange={v => setStatus(v as SubscriptionStatus)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED'] as SubscriptionStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === 'TRIAL' && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Trial Start</Label><Input type="date" value={trialStart} onChange={e => setTrialStart(e.target.value)} className="mt-1" /></div>
              <div><Label>Trial End</Label><Input type="date" value={trialEnd} onChange={e => setTrialEnd(e.target.value)} className="mt-1" /></div>
            </div>
          )}
          {(status === 'ACTIVE' || status === 'EXPIRED') && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sub Start</Label><Input type="date" value={subStart} onChange={e => setSubStart(e.target.value)} className="mt-1" /></div>
              <div><Label>Sub End</Label><Input type="date" value={subEnd} onChange={e => setSubEnd(e.target.value)} className="mt-1" /></div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tenant Row ────────────────────────────────────────────────────────────────
function TenantRow({ tenant, onEdit, onSubscription, onDelete, onImpersonate }: {
  tenant: Tenant
  onEdit: (t: Tenant) => void
  onSubscription: (t: Tenant) => void
  onDelete: (t: Tenant) => void
  onImpersonate: (t: Tenant) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const t = tenant
  const endDate = t.subscriptionEndDate || t.trialEndDate
  const daysLeft = endDate
    ? Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
    : null

  return (
    <>
      <tr className="hover:bg-gray-50 border-b">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-4 py-3">
          <button
            className="text-left hover:text-blue-600 group"
            onClick={() => onImpersonate(t)}
            title="Open as Admin"
          >
            <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600">{t.companyName}</p>
            <p className="text-xs text-gray-400">{t.email}</p>
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{t.phone}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{t.ownerName}</td>
        <td className="px-4 py-3">
          <SubBadge status={t.subscriptionStatus} />
          {daysLeft !== null && (
            <p className={`text-xs mt-0.5 ${daysLeft < 7 ? 'text-red-500' : 'text-gray-400'}`}>
              {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
            </p>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${t.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {t.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
            {t.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{t.createdAt?.split('T')[0]}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Open as Admin" onClick={() => onImpersonate(t)}>
              <LogIn size={12} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => onEdit(t)}>
              <Pencil size={12} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" title="Subscription" onClick={() => onSubscription(t)}>
              <CheckCircle size={12} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Delete" onClick={() => onDelete(t)}>
              <Trash2 size={12} />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b">
          <td colSpan={8} className="px-8 py-4">
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Contact</p>
                <div className="space-y-1 text-gray-600">
                  {t.address && <p>{t.address}</p>}
                  {(t.city || t.state) && <p>{[t.city, t.state, t.pincode].filter(Boolean).join(', ')}</p>}
                  <p>Owner: {t.ownerName} · {t.ownerPhone}</p>
                  {t.ownerEmail && <p>{t.ownerEmail}</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Legal</p>
                <div className="space-y-1 text-gray-600">
                  {t.gstin && <p>GSTIN: {t.gstin}</p>}
                  {t.panNumber && <p>PAN: {t.panNumber}</p>}
                  {t.tanNumber && <p>TAN: {t.tanNumber}</p>}
                  {t.cinNumber && <p>CIN: {t.cinNumber}</p>}
                  {t.transportLicenseNumber && <p>Transport License: {t.transportLicenseNumber}</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Bank</p>
                <div className="space-y-1 text-gray-600">
                  {t.bankName && <p>{t.bankName}</p>}
                  {t.accountNumber && <p>A/C: {t.accountNumber}</p>}
                  {t.ifscCode && <p>IFSC: {t.ifscCode}</p>}
                  {t.branchName && <p>Branch: {t.branchName}</p>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TenantsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const impersonateStore = useAuthStore(s => s.impersonate)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Tenant | undefined>()
  const [subTarget, setSubTarget]   = useState<Tenant | null>(null)
  const [search, setSearch]         = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: tenantsApi.getAll })
  const tenants: Tenant[] = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tenantsApi.delete(id),
    onSuccess: () => { toast.success('Tenant deleted'); qc.invalidateQueries({ queryKey: ['tenants'] }) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  const impersonateMutation = useMutation({
    mutationFn: (id: number) => tenantsApi.impersonate(id),
    onSuccess: (res) => {
      impersonateStore(res.data)
      navigate('/dashboard', { replace: true })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to switch'),
  })

  const filtered = tenants.filter(t =>
    !search ||
    t.companyName.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase()) ||
    t.phone.includes(search)
  )

  const active   = tenants.filter(t => t.isActive).length
  const inactive = tenants.length - active
  const subActive  = tenants.filter(t => t.subscriptionStatus === 'ACTIVE').length
  const subTrial   = tenants.filter(t => t.subscriptionStatus === 'TRIAL').length
  const subExpired = tenants.filter(t => t.subscriptionStatus === 'EXPIRED' || t.subscriptionStatus === 'SUSPENDED').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all FEROS tenants</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" />New Tenant
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total',    value: tenants.length,        icon: Building2,   color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Active',   value: active,                icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Inactive', value: inactive,              icon: XCircle,     color: 'text-gray-500',   bg: 'bg-gray-100' },
          { label: 'On Subscription', value: subActive,      icon: Users,       color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Trial / Expired', value: subTrial + subExpired, icon: Building2, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone…" className="max-w-xs" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">{search ? 'No matching tenants' : 'No tenants yet'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Subscription</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <TenantRow
                  key={t.id}
                  tenant={t}
                  onEdit={setEditTarget}
                  onSubscription={setSubTarget}
                  onDelete={tr => {
                    if (confirm(`Delete ${tr.companyName}? This cannot be undone.`)) deleteMutation.mutate(tr.id)
                  }}
                  onImpersonate={tr => impersonateMutation.mutate(tr.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TenantDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editTarget && (
        <TenantDialog open={!!editTarget} onClose={() => setEditTarget(undefined)} tenant={editTarget} />
      )}
      <SubscriptionDialog open={!!subTarget} onClose={() => setSubTarget(null)} tenant={subTarget} />
    </div>
  )
}
