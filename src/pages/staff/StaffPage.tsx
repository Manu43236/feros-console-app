import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
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
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// ── schema ────────────────────────────────────────────────────────────────────
const optionalNum = z.preprocess(
  v => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().positive().optional()
)

const profileSchema = z.object({
  designationId:      z.coerce.number().min(1, 'Select designation'),
  employmentTypeId:   optionalNum,
  dateOfBirth:        z.string().optional(),
  joiningDate:        z.string().optional(),
  address:            z.string().optional(),
  stateId:            optionalNum,
  cityId:             optionalNum,
  pincode:            z.string().optional(),
  emergencyContactName:  z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bankName:           z.string().optional(),
  accountNumber:      z.string().optional(),
  ifscCode:           z.string().optional(),
  accountHolderName:  z.string().optional(),
  licenseNumber:      z.string().optional(),
  licenseExpiryDate:  z.string().optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

const docSchema = z.object({
  documentTypeId: z.coerce.number().min(1, 'Select document type'),
  documentNumber: z.string().optional(),
  issueDate:      z.string().optional(),
  expiryDate:     z.string().optional(),
  remarks:        z.string().optional(),
})
type DocForm = z.infer<typeof docSchema>

// ── helpers ───────────────────────────────────────────────────────────────────
function getRoleColor(role: string) {
  if (role === 'ADMIN')        return 'bg-purple-50 text-purple-700'
  if (role === 'DRIVER')       return 'bg-blue-50 text-blue-700'
  if (role === 'SUPERVISOR')   return 'bg-orange-50 text-orange-700'
  if (role === 'OFFICE_STAFF') return 'bg-teal-50 text-teal-700'
  return 'bg-gray-50 text-gray-700'
}

// ── document section ──────────────────────────────────────────────────────────
function DocumentsSection({ userId }: { userId: number }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const { data: docsRes, isLoading } = useQuery({
    queryKey: ['staff-docs', userId],
    queryFn: () => staffApi.getDocuments(userId),
  })
  const { data: docTypesRes } = useQuery({
    queryKey: ['document-types'],
    queryFn: globalMastersApi.getDocumentTypes,
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<DocForm>({
    resolver: zodResolver(docSchema),
  })

  const addMutation = useMutation({
    mutationFn: (data: DocForm) => staffApi.addDocument(userId, data),
    onSuccess: () => {
      toast.success('Document added')
      qc.invalidateQueries({ queryKey: ['staff-docs', userId] })
      reset(); setAddOpen(false)
    },
    onError: () => toast.error('Failed to add document'),
  })

  const verifyMutation = useMutation({
    mutationFn: (docId: number) => staffApi.verifyDocument(docId, { isVerified: true }),
    onSuccess: () => {
      toast.success('Document verified')
      qc.invalidateQueries({ queryKey: ['staff-docs', userId] })
    },
  })

  const docs = docsRes?.data ?? []
  const staffDocTypes = (docTypesRes?.data ?? []).filter(t =>
    t.applicableFor === 'DRIVER' || t.applicableFor === 'BOTH'
  )

  function expiryBadge(expiryDate?: string) {
    if (!expiryDate) return null
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
    if (days < 0)  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">Expired</span>
    if (days <= 30) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{days}d left</span>
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">Valid</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800">Documents</h3>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1 text-xs">
          <Plus size={13} /> Add Document
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-6 animate-pulse">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-center text-gray-400 py-6 text-sm">No documents added yet</div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{doc.documentTypeName}</p>
                  {doc.documentNumber && <p className="text-xs text-gray-500">{doc.documentNumber}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expiryBadge(doc.expiryDate)}
                {doc.expiryDate && (
                  <span className="text-xs text-gray-400">{format(new Date(doc.expiryDate), 'dd MMM yyyy')}</span>
                )}
                {doc.isVerified ? (
                  <BadgeCheck size={16} className="text-green-500" />
                ) : (
                  <button
                    onClick={() => verifyMutation.mutate(doc.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Verify
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add document dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Document Type *</Label>
              <select {...register('documentTypeId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select type</option>
                {staffDocTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {errors.documentTypeId && <p className="text-red-500 text-xs">{errors.documentTypeId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Document Number</Label>
              <Input placeholder="DL-1234567890" {...register('documentNumber')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issue Date</Label>
                <Input type="date" {...register('issueDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date</Label>
                <Input type="date" {...register('expiryDate')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Input placeholder="Optional notes" {...register('remarks')} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addMutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                {addMutation.isPending ? 'Adding…' : 'Add Document'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── profile form ──────────────────────────────────────────────────────────────
function ProfileForm({ open, onClose, staff }: { open: boolean; onClose: () => void; staff: MergedStaff }) {
  const qc = useQueryClient()
  const p  = staff.profile
  const [selectedState, setSelectedState] = useState<number | undefined>(p?.stateId)

  const { data: designationsRes }    = useQuery({ queryKey: ['designations'],    queryFn: tenantMastersApi.getDesignations })
  const { data: employmentTypesRes } = useQuery({ queryKey: ['employment-types'],queryFn: globalMastersApi.getEmploymentTypes })
  const { data: statesRes }          = useQuery({ queryKey: ['states'],           queryFn: globalMastersApi.getStates })
  const { data: citiesRes }          = useQuery({
    queryKey: ['cities', selectedState],
    queryFn: () => globalMastersApi.getCities(selectedState),
    enabled: !!selectedState,
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  })

  // Reset form with current staff values every time the dialog opens
  useEffect(() => {
    if (open) {
      reset({
        designationId:         p?.designationId ?? ('' as unknown as number),
        employmentTypeId:      p?.employmentTypeId,
        dateOfBirth:           p?.dateOfBirth?.split('T')[0] ?? '',
        joiningDate:           p?.joiningDate?.split('T')[0] ?? '',
        address:               p?.address ?? '',
        stateId:               p?.stateId,
        cityId:                p?.cityId,
        pincode:               p?.pincode ?? '',
        emergencyContactName:  p?.emergencyContactName ?? '',
        emergencyContactPhone: p?.emergencyContactPhone ?? '',
        bankName:              p?.bankName ?? '',
        accountNumber:         p?.accountNumber ?? '',
        ifscCode:              p?.ifscCode ?? '',
        accountHolderName:     p?.accountHolderName ?? '',
        licenseNumber:         p?.licenseNumber ?? '',
        licenseExpiryDate:     p?.licenseExpiryDate?.split('T')[0] ?? '',
      })
      setSelectedState(p?.stateId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff.userId])

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => staffApi.upsert(staff.userId, data),
    onSuccess: () => {
      toast.success('Profile updated')
      qc.invalidateQueries({ queryKey: ['staff'] })
      onClose()
    },
    onError: () => toast.error('Failed to update profile'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile — {staff.userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 pt-2">
          {/* Role & Employment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Designation *</Label>
              <select {...register('designationId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select designation</option>
                {designationsRes?.data?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.designationId && <p className="text-red-500 text-xs">{errors.designationId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <select {...register('employmentTypeId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select type</option>
                {employmentTypesRes?.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" {...register('dateOfBirth')} />
            </div>
            <div className="space-y-1.5">
              <Label>Joining Date</Label>
              <Input type="date" {...register('joiningDate')} />
            </div>
          </div>

          {/* Address */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Street Address</Label>
                <Input placeholder="123, Main Street" {...register('address')} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <select
                  {...register('stateId')}
                  onChange={e => setSelectedState(Number(e.target.value) || undefined)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Select state</option>
                  {statesRes?.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <select {...register('cityId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="">Select city</option>
                  {citiesRes?.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Pincode</Label>
                <Input placeholder="400001" {...register('pincode')} />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="Ramesh Kumar" {...register('emergencyContactName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="9876543210" {...register('emergencyContactPhone')} />
              </div>
            </div>
          </div>

          {/* Bank */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Bank Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input placeholder="SBI" {...register('bankName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Holder Name</Label>
                <Input {...register('accountHolderName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input {...register('accountNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>IFSC Code</Label>
                <Input placeholder="SBIN0001234" {...register('ifscCode')} />
              </div>
            </div>
          </div>

          {/* License */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">License</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>License Number</Label>
                <Input placeholder="MH1234567890" {...register('licenseNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label>License Expiry</Label>
                <Input type="date" {...register('licenseExpiryDate')} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
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
    resolver: zodResolver(addStaffSchema),
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
          /* PIN reveal screen */
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
          /* Create form */
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
  profile?: StaffProfile
}

// ── staff detail drawer ───────────────────────────────────────────────────────
function StaffDetail({ staff, onClose, onEdit }: { staff: MergedStaff; onClose: () => void; onEdit: () => void }) {
  const qc = useQueryClient()
  const [newPin, setNewPin]         = useState<string | null>(null)
  const [pinVisible, setPinVisible] = useState(false)

  const resetMutation = useMutation({
    mutationFn: () => staffApi.resetPin(staff.userId),
    onSuccess: (res) => {
      setNewPin(res.data?.pin ?? null)
      setPinVisible(true)
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('PIN reset successfully')
    },
    onError: () => toast.error('Failed to reset PIN'),
  })

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => staffApi.toggleStatus(staff.userId, isActive),
    onSuccess: (_res, isActive) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`Staff ${isActive ? 'activated' : 'deactivated'}`)
      onClose()
    },
    onError: () => toast.error('Failed to update status'),
  })

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold',
              staff.isActive ? 'bg-feros-navy' : 'bg-gray-400'
            )}>
              {staff.userName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{staff.userName}</p>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                  staff.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                )}>
                  {staff.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{staff.userPhone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              title="Edit profile"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => {
                const action = staff.isActive ? 'deactivate' : 'activate'
                if (confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${staff.userName}?`))
                  statusMutation.mutate(!staff.isActive)
              }}
              disabled={statusMutation.isPending}
              className={cn('p-2 rounded-lg transition-colors text-xs font-medium px-3',
                staff.isActive
                  ? 'hover:bg-red-50 text-red-500'
                  : 'hover:bg-green-50 text-green-600'
              )}
              title={staff.isActive ? 'Deactivate' : 'Activate'}
            >
              {statusMutation.isPending ? '…' : staff.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Role',        value: staff.roleName },
              { label: 'Designation', value: staff.profile?.designationName ?? '—' },
              { label: 'Employment',  value: staff.profile?.employmentTypeName ?? '—' },
              { label: 'Joining',     value: staff.profile?.joiningDate ? format(new Date(staff.profile.joiningDate), 'dd MMM yyyy') : '—' },
              { label: 'DOB',         value: staff.profile?.dateOfBirth ? format(new Date(staff.profile.dateOfBirth), 'dd MMM yyyy') : '—' },
              { label: 'License',     value: staff.profile?.licenseNumber ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {!staff.profile && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              No profile set up yet. Click the edit button to complete this staff member's profile.
            </div>
          )}

          {/* Address */}
          {(staff.profile?.address || staff.profile?.cityName) && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <span>{[staff.profile.address, staff.profile.cityName, staff.profile.stateName].filter(Boolean).join(', ')}</span>
            </div>
          )}

          {/* Bank */}
          {staff.profile?.bankName && (
            <div className="border-t pt-4 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bank Details</p>
              <p className="text-sm text-gray-800">{staff.profile.bankName} — {staff.profile.accountNumber}</p>
              <p className="text-xs text-gray-500">IFSC: {staff.profile.ifscCode}</p>
            </div>
          )}

          {/* PIN management */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Login PIN</p>
              <button
                onClick={() => { if (confirm(`Reset PIN for ${staff.userName}? The old PIN will stop working.`)) resetMutation.mutate() }}
                disabled={resetMutation.isPending}
                className="text-xs text-feros-orange hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <KeyRound size={12} />
                {resetMutation.isPending ? 'Resetting…' : 'Reset PIN'}
              </button>
            </div>
            {newPin ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 mb-1">New PIN — share with staff</p>
                  <span className="font-mono text-2xl font-bold text-feros-navy tracking-widest">
                    {pinVisible ? newPin : '••••'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPinVisible(v => !v)} className="p-2 rounded-lg hover:bg-amber-100 text-amber-600">
                    {pinVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(newPin); toast.success('PIN copied!') }}
                    className="p-2 rounded-lg hover:bg-amber-100 text-amber-600"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Click "Reset PIN" to generate a new PIN for this staff member.</p>
            )}
          </div>

          {/* Documents */}
          {staff.profile && (
            <div className="border-t pt-4">
              <DocumentsSection userId={staff.userId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export function StaffPage() {
  const navigate = useNavigate()
  const [search, setSearch]             = useState('')
  const [addOpen, setAddOpen]           = useState(false)
  const [roleFilter, setRoleFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: profilesRes }          = useQuery({ queryKey: ['staff'],  queryFn: staffApi.getAll })
  const { data: usersRes, isLoading }  = useQuery({ queryKey: ['users'],  queryFn: staffApi.getUsers })

  // Build profile lookup by userId
  const profileMap = Object.fromEntries(
    (profilesRes?.data ?? []).map(p => [p.userId, p])
  )

  // Merge users + profiles (all roles shown, use filter to narrow down)
  const allStaff = (usersRes?.data ?? [])
    .map(u => ({
      userId:            u.id,
      userName:          u.name,
      userPhone:         u.phone,
      roleName:          u.role,
      isActive:          u.isActive,
      pin:               u.generatedPin,
      // profile fields (may be undefined if no profile yet)
      designationName:    u.designationName ?? profileMap[u.id]?.designationName,
      completedTripsCount: u.completedTripsCount ?? 0,
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
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr
                    key={s.userId}
                    onClick={() => navigate(`/staff/${s.userId}`)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-feros-navy/10 flex items-center justify-center text-feros-navy text-sm font-semibold shrink-0">
                          {s.userName[0]}
                        </div>
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
                      <Badge className={cn('text-xs', s.isActive ? 'bg-green-50 text-green-700 hover:bg-green-50' : 'bg-red-50 text-red-700 hover:bg-red-50')}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
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

      {/* Add staff modal */}
      <AddStaff open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
