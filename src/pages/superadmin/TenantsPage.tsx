import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import {
  Plus, Building2, CheckCircle, XCircle, Users, Pencil, Trash2,
  ChevronDown, ChevronRight, LogIn, Upload, Download, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import apiClient from '@/api/client'
import type { ApiResponse } from '@/types'
import { tenantsApi } from '@/api/superadmin'
import { useAuthStore } from '@/store/authStore'
import type { Tenant, SubscriptionStatus } from '@/types'

// ── Bulk Upload Result type ───────────────────────────────────────────────────
interface BulkUploadResult {
  totalRows: number
  successCount: number
  failureCount: number
  errors: string[]
}

const CSV_TEMPLATE_HEADERS = [
  'companyName', 'email', 'phone', 'address', 'city', 'state',
  'pincode', 'gstin', 'panNumber', 'ownerName', 'ownerPhone', 'ownerEmail',
]
const CSV_TEMPLATE_SAMPLE = [
  'Acme Logistics Pvt Ltd', 'acme@example.com', '9876543210',
  '123 MG Road', 'Mumbai', 'Maharashtra', '400001',
  '27AABCA1234Z1Z5', 'AABCA1234Z', 'Rajesh Kumar', '9876543211', 'rajesh@acme.com',
]

function downloadTemplate() {
  const rows = [CSV_TEMPLATE_HEADERS.join(','), CSV_TEMPLATE_SAMPLE.join(',')]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'tenant_bulk_upload_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Bulk Upload Dialog ────────────────────────────────────────────────────────
function BulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]     = useState<File | null>(null)
  const [result, setResult] = useState<BulkUploadResult | null>(null)

  const mutation = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      const res = await apiClient.post<ApiResponse<BulkUploadResult>>('/tenants/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['tenants'] })
      if (res.data.failureCount === 0) toast.success(`${res.data.successCount} tenants created successfully`)
      else toast.warning(`${res.data.successCount} created, ${res.data.failureCount} failed`)
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed'),
  })

  function handleClose() {
    setFile(null); setResult(null); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Bulk Tenant Upload</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Template download */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-start gap-3">
            <Download size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm text-blue-800">
              <p className="font-medium mb-1">Download CSV Template</p>
              <p className="text-xs text-blue-600 mb-2">
                Fill in the template and upload. Required columns: companyName, email, phone, ownerName, ownerPhone.
              </p>
              <button onClick={downloadTemplate} className="text-xs underline font-medium hover:text-blue-700">
                Download template.csv
              </button>
            </div>
          </div>

          {/* File picker */}
          {!result && (
            <div>
              <Label>Select CSV File *</Label>
              <div
                className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                {file ? (
                  <p className="text-sm font-medium text-gray-700">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">Click to select a CSV file</p>
                    <p className="text-xs text-gray-400 mt-1">Only .csv files supported</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
                />
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-50 border p-3 text-center">
                  <p className="text-xl font-bold text-gray-800">{result.totalRows}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total Rows</p>
                </div>
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{result.successCount}</p>
                  <p className="text-xs text-green-600 mt-0.5">Created</p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                  <p className="text-xl font-bold text-red-600">{result.failureCount}</p>
                  <p className="text-xs text-red-500 mt-0.5">Failed</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 max-h-40 overflow-y-auto">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle size={13} className="text-red-500" />
                    <p className="text-xs font-semibold text-red-700">Errors ({result.errors.length})</p>
                  </div>
                  <ul className="space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full" onClick={() => { setFile(null); setResult(null) }}>
                Upload Another File
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button
                onClick={() => file && mutation.mutate(file)}
                disabled={!file || mutation.isPending}
              >
                {mutation.isPending ? 'Uploading…' : 'Upload'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

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

const tenantSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  email:       z.string().email('Enter a valid email'),
  phone:       z.string().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit phone'),
  ownerName:   z.string().min(1, 'Owner name is required'),
  ownerPhone:  z.string().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit phone'),
  ownerEmail:  z.string().optional().or(z.literal('')),
  prefix: z.string().optional(), address: z.string().optional(),
  city: z.string().optional(), state: z.string().optional(), pincode: z.string().optional(),
  gstin: z.string().optional(), panNumber: z.string().optional(), tanNumber: z.string().optional(),
  cinNumber: z.string().optional(), transportLicenseNumber: z.string().optional(),
  bankName: z.string().optional(), accountNumber: z.string().optional(),
  ifscCode: z.string().optional(), branchName: z.string().optional(), accountHolderName: z.string().optional(),
})

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

  const { register, handleSubmit, formState: { errors }, reset } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema) as Resolver<TenantFormData>,
    defaultValues: EMPTY_FORM,
  })

  useEffect(() => {
    if (open) reset(tenant ? toForm(tenant) : EMPTY_FORM)
  }, [open, tenant?.id])

  const mutation = useMutation({
    mutationFn: (data: TenantFormData) => isEdit ? tenantsApi.update(tenant!.id, data) : tenantsApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Tenant updated' : 'Tenant created')
      qc.invalidateQueries({ queryKey: ['tenants'] })
      onClose()
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  // Helper for required fields (shows red * and error message)
  function Req({ label, fk, type = 'text' }: { label: string; fk: keyof TenantFormData; type?: string }) {
    return (
      <div>
        <Label>{label} <span className="text-red-500">*</span></Label>
        <Input type={type} {...register(fk)} className={`mt-1 ${errors[fk] ? 'border-red-400' : ''}`} placeholder={label} />
        {errors[fk] && <p className="text-red-500 text-xs mt-1">{errors[fk]?.message}</p>}
      </div>
    )
  }

  // Helper for optional fields
  function Field({ label, fk, type = 'text' }: { label: string; fk: keyof TenantFormData; type?: string }) {
    return (
      <div>
        <Label>{label}</Label>
        <Input type={type} {...register(fk)} className="mt-1" placeholder={label} />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Tenant' : 'Create Tenant'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="space-y-5 mt-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Basic Info</p>
            <div className="grid grid-cols-2 gap-3">
              <Req label="Company Name" fk="companyName" />
              <Field label="Prefix (e.g. ABC)" fk="prefix" />
              <Req label="Email" fk="email" type="email" />
              <Req label="Phone" fk="phone" />
              <div className="col-span-2"><Field label="Address" fk="address" /></div>
              <Field label="City" fk="city" />
              <Field label="State" fk="state" />
              <Field label="Pincode" fk="pincode" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Owner Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Req label="Owner Name" fk="ownerName" />
              <Req label="Owner Phone" fk="ownerPhone" />
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
  const [bulkOpen, setBulkOpen]     = useState(false)
  const [editTarget, setEditTarget] = useState<Tenant | undefined>()
  const [subTarget, setSubTarget]   = useState<Tenant | null>(null)
  const [search, setSearch]         = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: tenantsApi.getAll })
  const tenants: Tenant[] = [...(data?.data ?? [])].sort((a, b) => b.id - a.id)

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all FEROS tenants</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload size={14} className="mr-1.5" />Bulk Upload
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1.5" />New Tenant
          </Button>
        </div>
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

      <BulkUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <TenantDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editTarget && (
        <TenantDialog open={!!editTarget} onClose={() => setEditTarget(undefined)} tenant={editTarget} />
      )}
      <SubscriptionDialog open={!!subTarget} onClose={() => setSubTarget(null)} tenant={subTarget} />
    </div>
  )
}
