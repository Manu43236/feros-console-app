import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  User, Building2, Pencil, Save, X,
  Phone, Mail, MapPin, CreditCard, AlertTriangle, BadgeCheck,
  Shield, KeyRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { staffApi } from '@/api/staff'
import { tenantsApi } from '@/api/superadmin'
import { tenantMastersApi, globalMastersApi } from '@/api/masters'
import type { SubscriptionStatus } from '@/types'

// ── schemas ──────────────────────────────────────────────────────────────────
const optionalNum = z.preprocess(
  v => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().positive().optional()
)

const accountSchema = z.object({
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
type AccountFormData = z.infer<typeof accountSchema>

const companySchema = z.object({
  companyName:               z.string().min(1, 'Company name is required'),
  email:                     z.string().email('Invalid email'),
  phone:                     z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
  address:                   z.string().optional(),
  city:                      z.string().optional(),
  state:                     z.string().optional(),
  pincode:                   z.string().optional(),
  gstin:                     z.string().optional(),
  panNumber:                 z.string().optional(),
  tanNumber:                 z.string().optional(),
  cinNumber:                 z.string().optional(),
  transportLicenseNumber:    z.string().optional(),
  bankName:                  z.string().optional(),
  accountNumber:             z.string().optional(),
  ifscCode:                  z.string().optional(),
  branchName:                z.string().optional(),
  accountHolderName:         z.string().optional(),
  ownerName:                 z.string().min(1, 'Owner name is required'),
  ownerPhone:                z.string().regex(/^[0-9]{10}$/, 'Owner phone must be 10 digits'),
  ownerEmail:                z.string().email('Invalid email').optional().or(z.literal('')),
})
type CompanyFormData = z.infer<typeof companySchema>

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-l-4 border-feros-navy pl-3 mb-4">
      <p className="text-xs font-bold text-feros-navy uppercase tracking-wider">{title}</p>
    </div>
  )
}

function subStatusConfig(status?: SubscriptionStatus) {
  if (status === 'ACTIVE')    return { label: 'Active',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' }
  if (status === 'TRIAL')     return { label: 'Trial',     color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' }
  if (status === 'EXPIRED')   return { label: 'Expired',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' }
  if (status === 'SUSPENDED') return { label: 'Suspended', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' }
  return { label: '—', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' }
}

// ── Account Details Tab ───────────────────────────────────────────────────────
function AccountTab({ userId, role }: { userId: number; role: string | null }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: profileRes, isLoading } = useQuery({
    queryKey: ['staff-profile', userId],
    queryFn: () => staffApi.getByUserId(userId),
  })
  const { data: designationsRes } = useQuery({
    queryKey: ['designations'],
    queryFn: tenantMastersApi.getDesignations,
    enabled: editing,
  })
  const { data: empTypesRes } = useQuery({
    queryKey: ['employment-types'],
    queryFn: globalMastersApi.getEmploymentTypes,
    enabled: editing,
  })
  const { data: statesRes } = useQuery({
    queryKey: ['states'],
    queryFn: globalMastersApi.getStates,
    enabled: editing,
  })
  const { data: citiesRes } = useQuery({
    queryKey: ['cities'],
    queryFn: globalMastersApi.getCities,
    enabled: editing,
  })

  const profile = profileRes?.data

  const { register, handleSubmit, formState: { errors }, reset } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema) as Resolver<AccountFormData>,
    values: profile ? {
      designationId:         profile.designationId ?? 0,
      employmentTypeId:      profile.employmentTypeId,
      dateOfBirth:           profile.dateOfBirth ?? '',
      joiningDate:           profile.joiningDate ?? '',
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
      licenseExpiryDate:     profile.licenseExpiryDate ?? '',
    } : undefined,
  })

  const saveMutation = useMutation({
    mutationFn: (data: AccountFormData) => staffApi.upsert(userId, data),
    onSuccess: () => {
      toast.success('Account details updated')
      qc.invalidateQueries({ queryKey: ['staff-profile', userId] })
      setEditing(false)
    },
    onError: (e: unknown) => toast.error(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update'
    ),
  })

  const canEdit = role === 'ADMIN' || role === 'OFFICE_STAFF' || role === 'SUPERVISOR' || role === 'DRIVER' || role === 'CLEANER'

  if (isLoading) return <div className="py-12 text-center text-gray-400 animate-pulse">Loading…</div>

  if (editing) {
    return (
      <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { reset(); setEditing(false) }}>
            <X size={14} className="mr-1" /> Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saveMutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90">
            <Save size={14} className="mr-1" /> {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>

        {/* Role & Employment */}
        <div>
          <SectionHeader title="Role & Employment" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Designation *</Label>
              <select {...register('designationId')} className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select</option>
                {(designationsRes?.data ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.designationId && <p className="text-xs text-red-500 mt-1">{errors.designationId.message}</p>}
            </div>
            <div>
              <Label>Employment Type</Label>
              <select {...register('employmentTypeId')} className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select</option>
                {(empTypesRes?.data ?? []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" {...register('dateOfBirth')} />
            </div>
            <div>
              <Label>Joining Date</Label>
              <Input type="date" {...register('joiningDate')} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <SectionHeader title="Address" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input {...register('address')} placeholder="Street address" />
            </div>
            <div>
              <Label>State</Label>
              <select {...register('stateId')} className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select</option>
                {(statesRes?.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>City</Label>
              <select {...register('cityId')} className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select</option>
                {(citiesRes?.data ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Pincode</Label>
              <Input {...register('pincode')} placeholder="6-digit pincode" />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div>
          <SectionHeader title="Emergency Contact" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input {...register('emergencyContactName')} placeholder="Contact name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input {...register('emergencyContactPhone')} placeholder="10-digit number" />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div>
          <SectionHeader title="Bank Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Bank Name</Label>
              <Input {...register('bankName')} placeholder="Bank name" />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input {...register('accountNumber')} placeholder="Account number" />
            </div>
            <div>
              <Label>IFSC Code</Label>
              <Input {...register('ifscCode')} placeholder="IFSC code" />
            </div>
            <div>
              <Label>Account Holder Name</Label>
              <Input {...register('accountHolderName')} placeholder="As per bank records" />
            </div>
          </div>
        </div>

        {/* License */}
        <div>
          <SectionHeader title="License" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>License Number</Label>
              <Input {...register('licenseNumber')} placeholder="DL number" />
            </div>
            <div>
              <Label>License Expiry Date</Label>
              <Input type="date" {...register('licenseExpiryDate')} />
            </div>
          </div>
        </div>
      </form>
    )
  }

  // ── view mode ──
  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} className="mr-1" /> Edit
          </Button>
        </div>
      )}

      {/* Role & Employment */}
      <div>
        <SectionHeader title="Role & Employment" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Designation"      value={profile?.designationName} />
          <Field label="Employment Type"  value={profile?.employmentTypeName} />
          <Field label="Date of Birth"    value={fmtDate(profile?.dateOfBirth)} />
          <Field label="Joining Date"     value={fmtDate(profile?.joiningDate)} />
        </div>
      </div>

      {/* Address */}
      <div>
        <SectionHeader title="Address" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Address"  value={profile?.address} />
          <Field label="City"     value={profile?.cityName} />
          <Field label="State"    value={profile?.stateName} />
          <Field label="Pincode"  value={profile?.pincode} />
        </div>
      </div>

      {/* Emergency Contact */}
      <div>
        <SectionHeader title="Emergency Contact" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Name"   value={profile?.emergencyContactName} />
          <Field label="Phone"  value={profile?.emergencyContactPhone} />
        </div>
      </div>

      {/* Bank Details */}
      <div>
        <SectionHeader title="Bank Details" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Bank Name"           value={profile?.bankName} />
          <Field label="Account Number"      value={profile?.accountNumber} />
          <Field label="IFSC Code"           value={profile?.ifscCode} />
          <Field label="Account Holder"      value={profile?.accountHolderName} />
        </div>
      </div>

      {/* License */}
      {(profile?.licenseNumber || profile?.licenseExpiryDate) && (
        <div>
          <SectionHeader title="License" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="License Number"  value={profile?.licenseNumber} />
            <Field label="Expiry Date"     value={fmtDate(profile?.licenseExpiryDate)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Company Profile Tab ───────────────────────────────────────────────────────
function CompanyTab({ role }: { role: string | null }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const canEdit = role === 'ADMIN'

  const { data: tenantRes, isLoading } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: () => tenantsApi.getMy(),
  })
  const tenant = tenantRes?.data

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema) as Resolver<CompanyFormData>,
    values: tenant ? {
      companyName:            tenant.companyName,
      email:                  tenant.email,
      phone:                  tenant.phone,
      address:                tenant.address ?? '',
      city:                   tenant.city ?? '',
      state:                  tenant.state ?? '',
      pincode:                tenant.pincode ?? '',
      gstin:                  tenant.gstin ?? '',
      panNumber:              tenant.panNumber ?? '',
      tanNumber:              tenant.tanNumber ?? '',
      cinNumber:              tenant.cinNumber ?? '',
      transportLicenseNumber: tenant.transportLicenseNumber ?? '',
      bankName:               tenant.bankName ?? '',
      accountNumber:          tenant.accountNumber ?? '',
      ifscCode:               tenant.ifscCode ?? '',
      branchName:             tenant.branchName ?? '',
      accountHolderName:      tenant.accountHolderName ?? '',
      ownerName:              tenant.ownerName,
      ownerPhone:             tenant.ownerPhone,
      ownerEmail:             tenant.ownerEmail ?? '',
    } : undefined,
  })

  const saveMutation = useMutation({
    mutationFn: (data: CompanyFormData) => tenantsApi.updateMy(data),
    onSuccess: () => {
      toast.success('Company profile updated')
      qc.invalidateQueries({ queryKey: ['my-tenant'] })
      setEditing(false)
    },
    onError: (e: unknown) => toast.error(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update'
    ),
  })

  // Subscription info
  const status = tenant?.subscriptionStatus
  const cfg = subStatusConfig(status)
  const expiryDate = status === 'TRIAL' ? tenant?.trialEndDate : tenant?.subscriptionEndDate
  const daysLeft = expiryDate
    ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
    : null

  if (isLoading) return <div className="py-12 text-center text-gray-400 animate-pulse">Loading…</div>

  if (editing && canEdit) {
    return (
      <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-6">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { reset(); setEditing(false) }}>
            <X size={14} className="mr-1" /> Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saveMutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90">
            <Save size={14} className="mr-1" /> {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>

        {/* Basic Info */}
        <div>
          <SectionHeader title="Company Info" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Company Name *</Label>
              <Input {...register('companyName')} placeholder="Company name" />
              {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName.message}</p>}
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" {...register('email')} placeholder="company@email.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Phone *</Label>
              <Input {...register('phone')} placeholder="10-digit number" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <SectionHeader title="Address" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Street Address</Label>
              <Input {...register('address')} placeholder="Street address" />
            </div>
            <div>
              <Label>City</Label>
              <Input {...register('city')} placeholder="City" />
            </div>
            <div>
              <Label>State</Label>
              <Input {...register('state')} placeholder="State" />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input {...register('pincode')} placeholder="6-digit pincode" />
            </div>
          </div>
        </div>

        {/* Legal */}
        <div>
          <SectionHeader title="Legal / Tax" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>GSTIN</Label>
              <Input {...register('gstin')} placeholder="15-character GST number" />
            </div>
            <div>
              <Label>PAN Number</Label>
              <Input {...register('panNumber')} placeholder="10-character PAN" />
            </div>
            <div>
              <Label>TAN Number</Label>
              <Input {...register('tanNumber')} placeholder="TAN number" />
            </div>
            <div>
              <Label>CIN Number</Label>
              <Input {...register('cinNumber')} placeholder="CIN number" />
            </div>
            <div>
              <Label>Transport License Number</Label>
              <Input {...register('transportLicenseNumber')} placeholder="License number" />
            </div>
          </div>
        </div>

        {/* Owner */}
        <div>
          <SectionHeader title="Owner Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Owner Name *</Label>
              <Input {...register('ownerName')} placeholder="Owner name" />
              {errors.ownerName && <p className="text-xs text-red-500 mt-1">{errors.ownerName.message}</p>}
            </div>
            <div>
              <Label>Owner Phone *</Label>
              <Input {...register('ownerPhone')} placeholder="10-digit number" />
              {errors.ownerPhone && <p className="text-xs text-red-500 mt-1">{errors.ownerPhone.message}</p>}
            </div>
            <div>
              <Label>Owner Email</Label>
              <Input type="email" {...register('ownerEmail')} placeholder="owner@email.com" />
            </div>
          </div>
        </div>

        {/* Bank */}
        <div>
          <SectionHeader title="Bank Details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Bank Name</Label>
              <Input {...register('bankName')} placeholder="Bank name" />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input {...register('accountNumber')} placeholder="Account number" />
            </div>
            <div>
              <Label>IFSC Code</Label>
              <Input {...register('ifscCode')} placeholder="IFSC code" />
            </div>
            <div>
              <Label>Branch Name</Label>
              <Input {...register('branchName')} placeholder="Branch name" />
            </div>
            <div>
              <Label>Account Holder Name</Label>
              <Input {...register('accountHolderName')} placeholder="As per bank records" />
            </div>
          </div>
        </div>
      </form>
    )
  }

  // ── view mode ──
  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} className="mr-1" /> Edit
          </Button>
        </div>
      )}

      {/* Subscription Status */}
      <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BadgeCheck size={20} className={cfg.color} />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Subscription</p>
              <p className={cn('text-base font-bold', cfg.color)}>{cfg.label}</p>
            </div>
          </div>
          {expiryDate && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Valid Until</p>
              <p className={cn('text-sm font-semibold', cfg.color)}>{fmtDate(expiryDate)}</p>
              {daysLeft !== null && (
                <p className={cn('text-xs font-medium', daysLeft <= 7 ? 'text-red-600' : daysLeft <= 30 ? 'text-orange-600' : 'text-gray-500')}>
                  {daysLeft <= 0 ? 'Expired' : `${daysLeft} days remaining`}
                </p>
              )}
            </div>
          )}
        </div>
        {(status === 'EXPIRED' || status === 'SUSPENDED') && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <AlertTriangle size={13} />
            To renew or reactivate, contact FEROS support.
          </div>
        )}
        {(status === 'TRIAL' || status === 'ACTIVE') && daysLeft !== null && daysLeft <= 30 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <AlertTriangle size={13} />
            Subscription expiring soon. Contact FEROS support to renew.
          </div>
        )}
      </div>

      {/* Company Info */}
      <div>
        <SectionHeader title="Company Info" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Company Name"  value={tenant?.companyName} />
          <Field label="Email"         value={tenant?.email} />
          <Field label="Phone"         value={tenant?.phone} />
        </div>
      </div>

      {/* Address */}
      <div>
        <SectionHeader title="Address" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Street Address" value={tenant?.address} />
          <Field label="City"           value={tenant?.city} />
          <Field label="State"          value={tenant?.state} />
          <Field label="Pincode"        value={tenant?.pincode} />
        </div>
      </div>

      {/* Legal */}
      <div>
        <SectionHeader title="Legal / Tax" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="GSTIN"                    value={tenant?.gstin} />
          <Field label="PAN Number"               value={tenant?.panNumber} />
          <Field label="TAN Number"               value={tenant?.tanNumber} />
          <Field label="CIN Number"               value={tenant?.cinNumber} />
          <Field label="Transport License"        value={tenant?.transportLicenseNumber} />
        </div>
      </div>

      {/* Owner */}
      <div>
        <SectionHeader title="Owner Details" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Owner Name"   value={tenant?.ownerName} />
          <Field label="Owner Phone"  value={tenant?.ownerPhone} />
          <Field label="Owner Email"  value={tenant?.ownerEmail} />
        </div>
      </div>

      {/* Bank */}
      <div>
        <SectionHeader title="Bank Details" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Bank Name"          value={tenant?.bankName} />
          <Field label="Account Number"     value={tenant?.accountNumber} />
          <Field label="IFSC Code"          value={tenant?.ifscCode} />
          <Field label="Branch Name"        value={tenant?.branchName} />
          <Field label="Account Holder"     value={tenant?.accountHolderName} />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function ProfilePage() {
  const userId      = useAuthStore(s => s.userId)
  const name        = useAuthStore(s => s.name)
  const phone       = useAuthStore(s => s.phone)
  const role        = useAuthStore(s => s.role)
  const companyName = useAuthStore(s => s.companyName)

  const [tab, setTab] = useState<'account' | 'company'>('account')

  const showCompanyTab = role === 'ADMIN' || role === 'OFFICE_STAFF'

  const initials = (name ?? phone ?? 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  const tabs = [
    { key: 'account' as const, label: 'Account Details', icon: User },
    ...(showCompanyTab ? [{ key: 'company' as const, label: 'Company Profile', icon: Building2 }] : []),
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-feros-navy flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{name ?? phone}</h1>
          {companyName && <p className="text-sm text-gray-500 truncate">{companyName}</p>}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-feros-navy bg-blue-50 px-2.5 py-1 rounded-full">
              <Shield size={11} />
              {role?.replace('_', ' ')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Phone size={11} />
              {phone}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 px-6 py-3.5 text-sm font-medium border-b-2 transition-colors',
                tab === key
                  ? 'border-feros-navy text-feros-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'account' && userId != null && (
            <AccountTab userId={userId} role={role} />
          )}
          {tab === 'company' && showCompanyTab && (
            <CompanyTab role={role} />
          )}
        </div>
      </div>
    </div>
  )
}
