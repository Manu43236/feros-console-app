import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { staffApi } from '@/api/staff'
import { globalMastersApi, tenantMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ArrowLeft, Eye, EyeOff, KeyRound, Copy, Plus,
  BadgeCheck, FileText, Pencil, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { StaffDocument } from '@/types'

// ── schema ────────────────────────────────────────────────────────────────────
const optionalNum = z.preprocess(
  v => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().positive().optional()
)

const profileSchema = z.object({
  designationId:         z.coerce.number().min(1, 'Select designation'),
  employmentTypeId:      optionalNum,
  dateOfBirth:           z.string().optional(),
  joiningDate:           z.string().optional(),
  address:               z.string().optional(),
  stateId:               optionalNum,
  cityId:                optionalNum,
  pincode:               z.string().optional(),
  emergencyContactName:  z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bankName:              z.string().optional(),
  accountNumber:         z.string().optional(),
  ifscCode:              z.string().optional(),
  accountHolderName:     z.string().optional(),
  licenseNumber:         z.string().optional(),
  licenseExpiryDate:     z.string().optional(),
})
type ProfileFormData = z.infer<typeof profileSchema>

const docSchema = z.object({
  documentTypeId: z.coerce.number().min(1, 'Select document type'),
  documentNumber: z.string().optional(),
  issueDate:      z.string().optional(),
  expiryDate:     z.string().optional(),
  remarks:        z.string().optional(),
})
type DocFormData = z.infer<typeof docSchema>

// ── pin display ───────────────────────────────────────────────────────────────
function PinDisplay({ pin, onReset, resetting }: {
  pin: string | null
  onReset: () => void
  resetting: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-lg font-bold text-feros-navy tracking-widest w-14">
        {visible ? (pin ?? '—') : '••••'}
      </span>
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-feros-navy"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      {pin && visible && (
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(pin); toast.success('PIN copied!') }}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-feros-navy"
        >
          <Copy size={15} />
        </button>
      )}
      <button
        type="button"
        onClick={onReset}
        disabled={resetting}
        className="ml-1 text-xs text-feros-orange hover:underline flex items-center gap-1 disabled:opacity-50"
      >
        <KeyRound size={12} />
        {resetting ? 'Resetting…' : 'Reset PIN'}
      </button>
    </div>
  )
}

// ── expiry badge ──────────────────────────────────────────────────────────────
function expiryBadge(expiryDate?: string) {
  if (!expiryDate) return null
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
  if (days < 0)   return <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Expired</span>
  if (days <= 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">{days}d left</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Valid</span>
}

// ── documents tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ userId }: { userId: number }) {
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

  const { register, handleSubmit, formState: { errors }, reset } = useForm<DocFormData>({
    resolver: zodResolver(docSchema) as Resolver<DocFormData>,
  })

  const addMutation = useMutation({
    mutationFn: (data: DocFormData) => staffApi.addDocument(userId, data),
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

  const docs: StaffDocument[] = docsRes?.data ?? []
  const staffDocTypes = (docTypesRes?.data ?? []).filter(t =>
    t.applicableFor === 'DRIVER' || t.applicableFor === 'BOTH'
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1 text-xs">
          <Plus size={13} /> Add Document
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-gray-400 animate-pulse">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-2 text-gray-400">
          <FileText size={32} className="text-gray-200" />
          <p className="text-sm">No documents added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  <FileText size={16} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{doc.documentTypeName}</p>
                  <p className="text-xs text-gray-500">
                    {doc.documentNumber ?? 'No number'}
                    {doc.expiryDate && ` · Exp: ${format(new Date(doc.expiryDate), 'dd MMM yyyy')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expiryBadge(doc.expiryDate)}
                {doc.isVerified ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <BadgeCheck size={14} /> Verified
                  </span>
                ) : (
                  <button
                    onClick={() => verifyMutation.mutate(doc.id)}
                    disabled={verifyMutation.isPending}
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
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
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
              <Input placeholder="e.g. DL-1234567890" {...register('documentNumber')} />
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

// ── main page ─────────────────────────────────────────────────────────────────
export function StaffDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const uid        = Number(userId)

  const [tab, setTab]               = useState<'info' | 'docs'>('info')
  const [selectedState, setSelectedState] = useState<number | undefined>()
  const [currentPin, setCurrentPin] = useState<string | null>(null)

  // Load this user from the cached users list
  const { data: usersRes } = useQuery({ queryKey: ['users'], queryFn: staffApi.getUsers })
  const user = usersRes?.data?.find(u => u.id === uid)

  // Load profile
  const { data: profileRes, isLoading: profileLoading } = useQuery({
    queryKey: ['staff-profile', uid],
    queryFn: () => staffApi.getByUserId(uid),
    enabled: !!uid,
  })
  const profile = profileRes?.data

  // Masters
  const { data: designationsRes }    = useQuery({ queryKey: ['designations'],     queryFn: tenantMastersApi.getDesignations })
  const { data: employmentTypesRes } = useQuery({ queryKey: ['employment-types'], queryFn: globalMastersApi.getEmploymentTypes })
  const { data: statesRes }          = useQuery({ queryKey: ['states'],           queryFn: globalMastersApi.getStates })
  const { data: citiesRes }          = useQuery({
    queryKey: ['cities', selectedState],
    queryFn: () => globalMastersApi.getCities(selectedState),
    enabled: !!selectedState,
  })

  const { register, handleSubmit, formState: { errors, isDirty }, reset, watch } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormData>,
  })

  // Seed form when profile loads
  useEffect(() => {
    if (profile) {
      setSelectedState(profile.stateId)
      reset({
        designationId:         profile.designationId ?? ('' as unknown as number),
        employmentTypeId:      profile.employmentTypeId,
        dateOfBirth:           profile.dateOfBirth?.split('T')[0] ?? '',
        joiningDate:           profile.joiningDate?.split('T')[0] ?? '',
        address:               profile.address ?? '',
        stateId:               profile.stateId,
        cityId:                profile.cityId,
        pincode:               profile.pincode ?? '',
        emergencyContactName:  profile.emergencyContactName ?? '',
        emergencyContactPhone: profile.emergencyContactPhone ?? '',
        bankName:              profile.bankName ?? '',
        accountNumber:         profile.accountNumber ?? '',
        ifscCode:              profile.ifscCode ?? '',
        accountHolderName:     profile.accountHolderName ?? '',
        licenseNumber:         profile.licenseNumber ?? '',
        licenseExpiryDate:     profile.licenseExpiryDate?.split('T')[0] ?? '',
      })
    }
  }, [profile, reset])

  // Set pin from user data
  useEffect(() => {
    if (user) setCurrentPin(user.generatedPin ?? null)
  }, [user])

  const saveMutation = useMutation({
    mutationFn: (data: ProfileFormData) => staffApi.upsert(uid, data),
    onSuccess: () => {
      toast.success('Profile saved')
      qc.invalidateQueries({ queryKey: ['staff-profile', uid] })
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to save profile'),
  })

  const resetPinMutation = useMutation({
    mutationFn: () => staffApi.resetPin(uid),
    onSuccess: (res) => {
      setCurrentPin(res.data?.pin ?? null)
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('PIN reset — share the new PIN with the staff member')
    },
    onError: () => toast.error('Failed to reset PIN'),
  })

  const stateIdWatch = watch('stateId')
  useEffect(() => {
    const val = Number(stateIdWatch)
    if (val) setSelectedState(val)
  }, [stateIdWatch])

  if (!user && !profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <p>Staff member not found.</p>
        <Button variant="outline" onClick={() => navigate('/staff')}>Back to Staff</Button>
      </div>
    )
  }

  const name   = user?.name ?? profile?.userName ?? '…'
  const role   = user?.role ?? profile?.roleName ?? ''
  const active = user?.isActive ?? profile?.isActive ?? true

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/staff')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg',
            active ? 'bg-feros-navy' : 'bg-gray-400'
          )}>
            {name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{name}</h1>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              )}>
                {active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-500">{role} · {user?.phone ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['info', 'docs'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-feros-navy text-feros-navy'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'info' ? 'Basic Info' : 'Documents'}
          </button>
        ))}
      </div>

      {/* ── Basic Info tab ── */}
      {tab === 'info' && (
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">

          {/* PIN row */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Login PIN</p>
              <PinDisplay
                pin={currentPin}
                onReset={() => {
                  if (confirm(`Reset PIN for ${name}? The old PIN will stop working.`))
                    resetPinMutation.mutate()
                }}
                resetting={resetPinMutation.isPending}
              />
            </div>
          </div>

          {/* Personal */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Pencil size={14} className="text-gray-400" /> Personal Details
            </p>
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

          {/* Address */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Street Address</Label>
                <Input placeholder="123, Main Street" {...register('address')} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <select
                  {...register('stateId')}
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

          {/* Emergency contact */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Emergency Contact</p>
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
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Bank Details</p>
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

          {/* Save button — enabled only when form is dirty */}
          <div className="flex justify-end pb-6">
            <Button
              type="submit"
              disabled={!isDirty || saveMutation.isPending}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2 px-6"
            >
              <Save size={15} />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}

      {/* ── Documents tab ── */}
      {tab === 'docs' && (
        <div className="pb-6">
          <DocumentsTab userId={uid} />
        </div>
      )}
    </div>
  )
}
