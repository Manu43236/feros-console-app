import { useState, useRef } from 'react'
import { useSubscription } from '@/context/SubscriptionContext'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { staffApi } from '@/api/staff'
import { attendanceApi } from '@/api/attendance'
import { globalMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import {
  Plus, Search, UserCheck, Phone, ChevronRight, Copy, KeyRound, Eye, EyeOff,
  Upload, Download, FileText, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { StaffProfile, BulkUploadResult } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────
function getRoleColor(role: string) {
  if (role === 'ADMIN')        return 'bg-purple-50 text-purple-700'
  if (role === 'DRIVER')       return 'bg-blue-50 text-blue-700'
  if (role === 'SUPERVISOR')   return 'bg-orange-50 text-orange-700'
  if (role === 'OFFICE_STAFF') return 'bg-teal-50 text-teal-700'
  if (role === 'SERVICE_MEN')  return 'bg-red-50 text-red-700'
  if (role === 'STORE_KEEPER') return 'bg-emerald-50 text-emerald-700'
  return 'bg-gray-50 text-gray-700'
}

// ── pin cell ──────────────────────────────────────────────────────────────────
function PinCell({ pin }: { pin: string | null }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <span className="font-mono text-sm text-gray-700 w-10">
        {visible ? (pin ?? '—') : '••••'}
      </span>
      <button
        onClick={() => setVisible(v => !v)}
        className="p-1 rounded text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
        title={visible ? 'Hide PIN' : 'Show PIN'}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

// ── add staff form ────────────────────────────────────────────────────────────
const addStaffSchema = z.object({
  name:  z.string().min(2, 'Name is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit phone number'),
  role:  z.string().min(1, 'Select role'),
})
type AddStaffForm = z.infer<typeof addStaffSchema>


function AddStaff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [createdPin, setCreatedPin] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')

  const { data: rolesData } = useQuery({ queryKey: ['roles'], queryFn: globalMastersApi.getRoles })

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<AddStaffForm>({
    resolver: zodResolver(addStaffSchema) as Resolver<AddStaffForm>,
  })

  const roleOptions = (rolesData?.data?.filter(r => r.name !== 'SUPER_ADMIN') ?? []).map(r => ({
    value: r.name,
    label: r.description || r.name,
  }))

  const mutation = useMutation({
    mutationFn: (data: AddStaffForm) => staffApi.createUser(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      setCreatedPin(res.data?.generatedPin ?? '????')
      setCreatedName(res.data?.name ?? '')
      reset()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create staff')
    },
  })

  function handleClose() {
    setCreatedPin(null)
    setCreatedName('')
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>

        {createdPin ? (
          <div className="space-y-5 pt-2">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <KeyRound size={22} className="text-green-600" />
              </div>
              <p className="font-semibold text-gray-900">{createdName} added successfully!</p>
              <p className="text-sm text-gray-600">Share this login PIN with the staff member.</p>
              <div className="bg-white border border-green-200 rounded-lg p-4 flex items-center justify-between gap-3">
                <span className="text-3xl font-bold tracking-widest text-feros-navy">{createdPin}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(createdPin); toast.success('PIN copied!') }}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <Copy size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-400">Staff will use their phone number + this PIN to log in.</p>
            </div>
            <Button onClick={handleClose} className="w-full bg-feros-navy hover:bg-feros-navy/90 text-white">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input placeholder="Ramesh Kumar" {...register('name')} />
              {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number *</Label>
              <Input placeholder="9876543210" inputMode="numeric" maxLength={10} {...register('phone')} />
              {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <SearchableSelect
                placeholder="Select role"
                options={roleOptions}
                value={watch('role') ?? ''}
                onValueChange={v => setValue('role', v, { shouldValidate: true })}
                triggerClassName={errors.role ? 'border-red-400' : ''}
              />
              {errors.role && <p className="text-red-500 text-xs">{errors.role.message}</p>}
            </div>
            <p className="text-xs text-gray-400">A login PIN will be auto-generated and shown after creation.</p>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                {mutation.isPending ? 'Creating…' : 'Create Staff'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── staff bulk upload dialog ──────────────────────────────────────────────────
const CSV_TEMPLATE = `name,phone,role,joiningDate,licenseNumber,licenseExpiryDate
Ramesh Kumar,9876543210,DRIVER,2024-01-15,DL0123456789,2027-01-14
Suresh Yadav,9876543211,CLEANER,2024-02-01,,
Priya Sharma,9876543212,OFFICE_STAFF,2024-03-10,,
`

function StaffBulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<BulkUploadResult | null>(null)

  function handleClose() { setFile(null); setResult(null); onClose() }

  const mutation = useMutation({
    mutationFn: (f: File) => staffApi.staffBulkUpload(f),
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      if (res.data.failureCount === 0)
        toast.success(`${res.data.successCount} staff members uploaded successfully`)
      else
        toast.warning(`${res.data.successCount} uploaded, ${res.data.failureCount} failed`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Upload failed')
    },
  })

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'staff_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Staff</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-medium">CSV Format</p>
            <p>Required: <code className="bg-blue-100 px-1 rounded">name</code>, <code className="bg-blue-100 px-1 rounded">phone</code>, <code className="bg-blue-100 px-1 rounded">role</code></p>
            <p>Optional: <code className="bg-blue-100 px-1 rounded">joiningDate</code>, <code className="bg-blue-100 px-1 rounded">licenseNumber</code>, <code className="bg-blue-100 px-1 rounded">licenseExpiryDate</code></p>
            <p className="text-blue-600 text-xs mt-1">Roles: DRIVER, CLEANER, SUPERVISOR, OFFICE_STAFF, SERVICE_MEN, STORE_KEEPER · Dates: YYYY-MM-DD</p>
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadTemplate}>
            <Download size={14} /> Download Template
          </Button>

          {/* File picker */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
            />
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                file ? 'border-feros-orange bg-orange-50' : 'border-gray-200 hover:border-feros-orange hover:bg-orange-50/30'
              )}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-feros-orange font-medium">
                  <FileText size={16} />
                  {file.name}
                </div>
              ) : (
                <div className="text-gray-400">
                  <Upload size={24} className="mx-auto mb-2" />
                  <p className="text-sm">Click to select CSV file</p>
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-lg border overflow-hidden text-sm">
              <div className="flex gap-4 p-3 bg-gray-50 border-b">
                <span className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 size={14} /> {result.successCount} success
                </span>
                <span className="flex items-center gap-1.5 text-red-600">
                  <AlertCircle size={14} /> {result.failureCount} failed
                </span>
                <span className="text-gray-400 text-xs ml-auto">{result.totalRows} total rows</span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto p-3 space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button
                className="flex-1"
                disabled={!file || mutation.isPending}
                onClick={() => file && mutation.mutate(file)}
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

// ── merged staff type ─────────────────────────────────────────────────────────
interface MergedStaff {
  userId: number; userName: string; userPhone: string
  roleName: string; isActive: boolean; pin: string | null
  designationName?: string; completedTripsCount: number
  isAssigned: boolean; activeOrderNumber: string | null
  profile?: StaffProfile
}

// ── main page ─────────────────────────────────────────────────────────────────
export function StaffPage() {
  const { locked } = useSubscription()
  const navigate = useNavigate()
  const logoUrl = useAuthStore(s => s.logoUrl)
  const role    = useAuthStore(s => s.role)
  const isSupervisor = role === 'SUPERVISOR'
  const PAGE_SIZE = 20
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(0)
  const [addOpen, setAddOpen]           = useState(false)
  const [bulkOpen, setBulkOpen]         = useState(false)
  const [roleFilter, setRoleFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const { data: profilesRes }          = useQuery({ queryKey: ['staff'],  queryFn: staffApi.getAll })
  const { data: usersRes, isLoading }  = useQuery({ queryKey: ['users'],  queryFn: () => staffApi.getUsers() })
  const { data: attendanceRes }        = useQuery({ queryKey: ['attendance-today', today], queryFn: () => attendanceApi.getByDate(today) })

  // Map userId → attendance border color based on status
  const attendanceBorderMap = new Map<number, string>(
    (attendanceRes?.data ?? []).map(a => {
      let color: string
      if (a.approvalStatus === 'REJECTED') color = 'ring-2 ring-red-500'
      else if (a.approvalStatus === 'PENDING') color = 'ring-2 ring-amber-400'
      else if (a.approvalStatus === 'APPROVED' && a.attendanceTypeName?.toUpperCase().includes('PRESENT')) color = 'ring-2 ring-green-500'
      else color = 'ring-2 ring-gray-400'
      return [a.userId, color]
    })
  )

  const profileMap = Object.fromEntries(
    (profilesRes?.data ?? []).map(p => [p.userId, p])
  )

  const allStaff: MergedStaff[] = [...(usersRes?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map(u => ({
    userId:             u.id,
    userName:           u.name,
    userPhone:          u.phone,
    roleName:           u.role,
    isActive:           u.isActive,
    pin:                u.generatedPin,
    designationName:    u.designationName ?? profileMap[u.id]?.designationName,
    completedTripsCount: u.completedTripsCount ?? 0,
    isAssigned:          u.isAssigned ?? false,
    activeOrderNumber:   u.activeOrderNumber ?? null,
    profile:            profileMap[u.id],
  }))

  const staff = allStaff.filter(s => {
    const matchSearch  = s.userName.toLowerCase().includes(search.toLowerCase()) ||
                         s.userPhone.includes(search)
    const matchRole    = !roleFilter || s.roleName === roleFilter
    const matchStatus  = !statusFilter || (statusFilter === 'active' ? s.isActive : !s.isActive)
    const matchCrew    = !isSupervisor || s.roleName === 'DRIVER' || s.roleName === 'CLEANER'
    return matchSearch && matchRole && matchStatus && matchCrew
  })
  const totalPages = Math.max(1, Math.ceil(staff.length / PAGE_SIZE))
  const pageRows   = staff.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const roles = isSupervisor
    ? ['DRIVER', 'CLEANER']
    : [...new Set(allStaff.map(s => s.roleName))]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500 text-sm mt-0.5">{allStaff.length} total staff members</p>
        </div>
        {!locked && !isSupervisor && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
              <Upload size={16} /> Bulk Upload
            </Button>
            <Button onClick={() => setAddOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
              <Plus size={16} /> Add Staff
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name or phone…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} className="pl-9" />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(0) }}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Pagination — top */}
        <div className="px-4 py-3 border-b flex items-center justify-between text-sm text-gray-500">
          <span>{staff.length} total staff members</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-xs">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading staff…</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <UserCheck size={36} className="text-gray-200" />
            <p className="text-sm">No staff members found</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-18rem)]">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Staff</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Designation</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Phone</th>
                  {!isSupervisor && <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">PIN</th>}
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Trips</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Current</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(s => (
                  <tr
                    key={s.userId}
                    onClick={() => navigate(`/staff/${s.userId}`)}
                    className={cn(
                      'border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer',
                      !s.isActive && 'opacity-50'
                    )}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img src={logoUrl} alt="logo" className={cn('w-8 h-8 rounded-full object-contain shrink-0', attendanceBorderMap.get(s.userId) ?? 'ring-2 ring-gray-400')} />
                        ) : (
                          <div className={cn('w-8 h-8 rounded-full bg-feros-navy/10 flex items-center justify-center text-feros-navy text-sm font-semibold shrink-0', attendanceBorderMap.get(s.userId) ?? 'ring-2 ring-gray-400')}>
                            {s.userName[0]}
                          </div>
                        )}
                        <p className="text-sm font-semibold text-gray-800">{s.userName}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full', getRoleColor(s.roleName))}>
                        {s.roleName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">{s.designationName ?? '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        {s.userPhone}
                      </div>
                    </td>
                    {!isSupervisor && (
                      <td className="py-3 px-4 whitespace-nowrap">
                        <PinCell pin={s.pin ?? null} />
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                      {s.completedTripsCount}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {!s.isActive ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500 w-fit">Inactive</span>
                      ) : s.isAssigned ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-50 text-orange-700 w-fit">On Trip</span>
                          {s.activeOrderNumber && (
                            <span className="text-xs text-gray-400 font-mono">{s.activeOrderNumber}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Available</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight size={16} className="text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddStaff open={addOpen} onClose={() => setAddOpen(false)} />
      <StaffBulkUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  )
}
