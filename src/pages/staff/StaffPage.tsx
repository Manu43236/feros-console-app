import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { staffApi } from '@/api/staff'
import { toast } from 'sonner'
import {
  Plus, Search, UserCheck, Phone, ChevronRight, Copy, KeyRound, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { StaffProfile } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────
function getRoleColor(role: string) {
  if (role === 'ADMIN')        return 'bg-purple-50 text-purple-700'
  if (role === 'DRIVER')       return 'bg-blue-50 text-blue-700'
  if (role === 'SUPERVISOR')   return 'bg-orange-50 text-orange-700'
  if (role === 'OFFICE_STAFF') return 'bg-teal-50 text-teal-700'
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
  phone: z.string().min(10, 'Enter valid phone'),
  role:  z.string().min(1, 'Select role'),
})
type AddStaffForm = z.infer<typeof addStaffSchema>

const STAFF_ROLES = [
  { value: 'DRIVER',       label: 'Driver' },
  { value: 'CLEANER',      label: 'Cleaner' },
  { value: 'SUPERVISOR',   label: 'Supervisor' },
  { value: 'OFFICE_STAFF', label: 'Office Staff' },
]

function AddStaff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [createdPin, setCreatedPin] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')

  const { register, handleSubmit, formState: { errors }, reset } = useForm<AddStaffForm>({
    resolver: zodResolver(addStaffSchema) as Resolver<AddStaffForm>,
  })

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
              <Input placeholder="9876543210" inputMode="numeric" {...register('phone')} />
              {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <select {...register('role')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select role</option>
                {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
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
  const navigate = useNavigate()
  const logoUrl = useAuthStore(s => s.logoUrl)
  const [search, setSearch]             = useState('')
  const [addOpen, setAddOpen]           = useState(false)
  const [roleFilter, setRoleFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: profilesRes }          = useQuery({ queryKey: ['staff'],  queryFn: staffApi.getAll })
  const { data: usersRes, isLoading }  = useQuery({ queryKey: ['users'],  queryFn: staffApi.getUsers })

  const profileMap = Object.fromEntries(
    (profilesRes?.data ?? []).map(p => [p.userId, p])
  )

  const allStaff: MergedStaff[] = [...(usersRes?.data ?? [])].sort((a, b) => b.id - a.id).map(u => ({
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
    return matchSearch && matchRole && matchStatus
  })

  const roles = [...new Set(allStaff.map(s => s.roleName))]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500 text-sm mt-0.5">{allStaff.length} total staff members</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
          <Plus size={16} /> Add Staff
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading staff…</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <UserCheck size={36} className="text-gray-200" />
            <p className="text-sm">No staff members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Staff</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Designation</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">PIN</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Trips</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Current</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr
                    key={s.userId}
                    onClick={() => navigate(`/staff/${s.userId}`)}
                    className={cn(
                      'border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer',
                      !s.isActive && 'opacity-50'
                    )}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img src={logoUrl} alt="logo" className="w-8 h-8 rounded-full object-contain shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-feros-navy/10 flex items-center justify-center text-feros-navy text-sm font-semibold shrink-0">
                            {s.userName[0]}
                          </div>
                        )}
                        <p className="text-sm font-semibold text-gray-800">{s.userName}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full', getRoleColor(s.roleName))}>
                        {s.roleName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{s.designationName ?? '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        {s.userPhone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <PinCell pin={s.pin ?? null} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-medium">
                      {s.completedTripsCount}
                    </td>
                    <td className="py-3 px-4">
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
    </div>
  )
}
