import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import {
  UserCog, CheckCircle, XCircle, KeyRound, X, Eye, EyeOff,
  Plus, Upload, Download, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { staffApi } from '@/api/staff'
import { tenantsApi } from '@/api/superadmin'
import type { Tenant, BulkUploadResult } from '@/types'

type StaffUser = {
  id: number; name: string; phone: string; role: string
  tenantId: number | null; companyName: string | null
  isActive: boolean; designationName: string | null
  generatedPin: string | null
}

const ROLES = ['ADMIN', 'OFFICE_STAFF', 'SUPERVISOR', 'DRIVER', 'CLEANER']

const addUserSchema = z.object({
  tenantId: z.string().min(1, 'Select a tenant'),
  name:     z.string().min(1, 'Name is required'),
  phone:    z.string().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit phone'),
  role:     z.string().min(1, 'Select a role'),
})
type AddUserForm = z.infer<typeof addUserSchema>

const USER_CSV_HEADERS = ['name', 'phone', 'roleName']
const USER_CSV_SAMPLE  = ['John Doe', '9876543210', 'ADMIN']

function downloadUserTemplate() {
  const rows = [USER_CSV_HEADERS.join(','), USER_CSV_SAMPLE.join(',')]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'user_bulk_upload_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Add User Dialog ────────────────────────────────────────────────────────────
function AddUserDialog({ open, onClose, tenants }: {
  open: boolean; onClose: () => void; tenants: Tenant[]
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema) as Resolver<AddUserForm>,
  })

  const mutation = useMutation({
    mutationFn: (d: AddUserForm) => tenantsApi.createUser(Number(d.tenantId), { name: d.name, phone: d.phone, role: d.role }),
    onSuccess: (res: unknown) => {
      const pin = (res as { data?: { generatedPin?: string } })?.data?.generatedPin
      toast.success(`User created. PIN: ${pin ?? '—'}`, { duration: 10000 })
      qc.invalidateQueries({ queryKey: ['sa-users'] })
      handleClose()
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  function handleClose() { reset(); onClose() }

  const sorted = [...tenants].sort((a, b) => a.companyName.localeCompare(b.companyName))

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 mt-2">
          <div>
            <Label>Tenant <span className="text-red-500">*</span></Label>
            <select {...register('tenantId')} className={`w-full h-10 px-3 rounded-md border bg-background text-sm mt-1 ${errors.tenantId ? 'border-red-400' : 'border-input'}`}>
              <option value="">Select tenant</option>
              {sorted.map(t => (
                <option key={t.id} value={String(t.id)}>{t.companyName}</option>
              ))}
            </select>
            {errors.tenantId && <p className="text-red-500 text-xs mt-1">{errors.tenantId.message}</p>}
          </div>
          <div>
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input {...register('name')} className={`mt-1 ${errors.name ? 'border-red-400' : ''}`} placeholder="Full name" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label>Phone <span className="text-red-500">*</span></Label>
            <Input {...register('phone')} className={`mt-1 ${errors.phone ? 'border-red-400' : ''}`} placeholder="10-digit phone" maxLength={10} />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <Label>Role <span className="text-red-500">*</span></Label>
            <select {...register('role')} className={`w-full h-10 px-3 rounded-md border bg-background text-sm mt-1 ${errors.role ? 'border-red-400' : 'border-input'}`}>
              <option value="">Select role</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Bulk Upload Dialog ─────────────────────────────────────────────────────────
function BulkUploadUsersDialog({ open, onClose, tenants }: {
  open: boolean; onClose: () => void; tenants: Tenant[]
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tenantId, setTenantId] = useState('')
  const [file, setFile]         = useState<File | null>(null)
  const [result, setResult]     = useState<BulkUploadResult | null>(null)

  const mutation = useMutation({
    mutationFn: () => tenantsApi.bulkUploadUsers(Number(tenantId), file!),
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['sa-users'] })
      if (res.data.failureCount === 0) toast.success(`${res.data.successCount} users created`)
      else toast.warning(`${res.data.successCount} created, ${res.data.failureCount} failed`)
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed'),
  })

  function handleClose() {
    setTenantId(''); setFile(null); setResult(null); onClose()
  }

  const sorted = [...tenants].sort((a, b) => a.companyName.localeCompare(b.companyName))

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Bulk Upload Users</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Template */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-start gap-3">
            <Download size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm text-blue-800">
              <p className="font-medium mb-1">Download CSV Template</p>
              <p className="text-xs text-blue-600 mb-2">
                Columns: <span className="font-mono">name, phone, roleName</span>.
                Valid roles: ADMIN, OFFICE_STAFF, SUPERVISOR, DRIVER, CLEANER.
              </p>
              <button onClick={downloadUserTemplate} className="text-xs underline font-medium hover:text-blue-700">
                Download template.csv
              </button>
            </div>
          </div>

          {/* Tenant select */}
          {!result && (
            <div>
              <Label>Tenant *</Label>
              <SearchableSelect
                value={tenantId}
                onValueChange={setTenantId}
                options={sorted.map(t => ({ value: String(t.id), label: t.companyName }))}
                placeholder="Select tenant"
                className="mt-1"
              />
            </div>
          )}

          {/* File picker */}
          {!result && (
            <div>
              <Label>CSV File *</Label>
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
                onClick={() => {
                  if (!tenantId) return toast.error('Select a tenant')
                  if (!file) return toast.error('Select a CSV file')
                  mutation.mutate()
                }}
                disabled={mutation.isPending}
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export function SAUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [tenantFilter, setTenant]   = useState('all')
  const [roleFilter, setRole]       = useState('all')
  const [statusFilter, setStatus]   = useState('all')
  const [visiblePins, setVisiblePins] = useState<Set<number>>(new Set())
  const [addOpen, setAddOpen]       = useState(false)
  const [bulkOpen, setBulkOpen]     = useState(false)
  const [dlg, setDlg]               = useState<{ title: string; desc: string; onOk: () => void } | null>(null)

  function togglePin(id: number) {
    setVisiblePins(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const { data, isLoading } = useQuery({ queryKey: ['sa-users'], queryFn: staffApi.getUsers })
  const users: StaffUser[] = ([...(data?.data ?? [])] as unknown[] as StaffUser[]).sort((a, b) => b.id - a.id)

  const { data: tenantsData } = useQuery({ queryKey: ['tenants'], queryFn: tenantsApi.getAll })
  const tenants: Tenant[] = tenantsData?.data ?? []

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => staffApi.toggleStatus(id, isActive),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['sa-users'] }) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  const resetPinMutation = useMutation({
    mutationFn: (id: number) => staffApi.resetPin(id),
    onSuccess: (res) => {
      toast.success(`New PIN: ${res.data?.pin ?? '—'}`, { duration: 10000 })
      qc.invalidateQueries({ queryKey: ['sa-users'] })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  const tenantOptions = [...tenants].sort((a, b) => a.companyName.localeCompare(b.companyName))
  const roleOptions   = Array.from(new Set(users.map(u => u.role))).sort()

  const filtered = users.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) &&
        !u.phone.includes(search) && !u.role.toLowerCase().includes(search.toLowerCase())) return false
    if (tenantFilter !== 'all' && String(u.tenantId) !== tenantFilter) return false
    if (roleFilter   !== 'all' && u.role !== roleFilter) return false
    if (statusFilter !== 'all' && String(u.isActive) !== statusFilter) return false
    return true
  })

  const active   = users.filter(u => u.isActive).length
  const inactive = users.length - active

  const hasFilters = tenantFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all' || search

  function clearFilters() {
    setSearch(''); setTenant('all'); setRole('all'); setStatus('all')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">All users across all tenants</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload size={14} className="mr-1.5" />Bulk Upload
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={14} className="mr-1.5" />Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: users.length, icon: UserCog,     color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Active',   value: active,       icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Inactive', value: inactive,     icon: XCircle,     color: 'text-gray-500',  bg: 'bg-gray-100' },
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or phone…"
          className="w-52"
        />

        <SearchableSelect
          value={tenantFilter}
          onValueChange={setTenant}
          options={[{ value: 'all', label: 'All Tenants' }, ...tenantOptions.map(t => ({ value: String(t.id), label: t.companyName }))]}
          placeholder="All Tenants"
          className="w-52"
        />

        <SearchableSelect
          value={roleFilter}
          onValueChange={setRole}
          options={[{ value: 'all', label: 'All Roles' }, ...roleOptions.map(r => ({ value: r, label: r }))]}
          placeholder="All Roles"
          className="w-44"
        />

        <SearchableSelect
          value={statusFilter}
          onValueChange={setStatus}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          placeholder="All Status"
          className="w-36"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" className="text-gray-500 h-9" onClick={clearFilters}>
            <X size={13} className="mr-1" />Clear
          </Button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {users.length} users
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <UserCog size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No users match the filters</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tenant</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Designation</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">PIN</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.phone}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.companyName ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">{u.role}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.designationName ?? '—'}</td>
                  <td className="px-5 py-3">
                    {u.generatedPin ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm text-gray-700">
                          {visiblePins.has(u.id) ? u.generatedPin : '••••'}
                        </span>
                        <button onClick={() => togglePin(u.id)} className="text-gray-400 hover:text-gray-600">
                          {visiblePins.has(u.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                        disabled={toggleMutation.isPending}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-orange-500" title="Reset PIN"
                        onClick={() => setDlg({ title: 'Reset PIN', desc: `Reset PIN for ${u.name}? The current PIN will stop working.`, onOk: () => resetPinMutation.mutate(u.id) })}
                      >
                        <KeyRound size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} tenants={tenants} />
      <BulkUploadUsersDialog open={bulkOpen} onClose={() => setBulkOpen(false)} tenants={tenants} />
      <ConfirmDialog
        open={!!dlg}
        title={dlg?.title ?? ''}
        description={dlg?.desc ?? ''}
        confirmLabel="Reset PIN"
        variant="default"
        onConfirm={() => { dlg?.onOk(); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}
