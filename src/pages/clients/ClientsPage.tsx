import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientsApi } from '@/api/clients'
import { globalMastersApi, tenantMastersApi } from '@/api/masters'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Phone, MapPin, Building2, Upload, Download, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Client, BulkUploadResult } from '@/types'
import { cn } from '@/lib/utils'

// ── schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  clientName:           z.string().min(1, 'Name is required'),
  clientTypeId:         z.coerce.number().min(1, 'Select client type'),
  phone:                z.string().min(10, 'Enter valid phone'),
  email:                z.string().email('Invalid email').optional().or(z.literal('')),
  address:              z.string().optional(),
  stateId:              z.coerce.number().optional(),
  cityId:               z.coerce.number().optional(),
  pincode:              z.string().optional(),
  gstin:                z.string().optional(),
  panNumber:            z.string().optional(),
  contactPersonName:    z.string().optional(),
  contactPersonPhone:   z.string().optional(),
  paymentTermsId:       z.coerce.number().optional(),
  creditLimit:          z.coerce.number().optional(),
  openingBalance:       z.coerce.number().optional(),
})
type FormData = z.infer<typeof schema>

// ── bulk upload ───────────────────────────────────────────────────────────────
const CSV_TEMPLATE = [
  'clientName,clientType,phone,email,address,pincode,gstin,panNumber,contactPersonName,contactPersonPhone,paymentTerms,creditLimit,openingBalance',
  'ABC Logistics Pvt Ltd,Trader,9876543210,accounts@abc.com,123 Main Street,400001,22AAAAA0000A1Z5,AAAAA0000A,Ramesh Kumar,9123456789,Net 30,500000,0',
  'XYZ Freight Co,Transporter,9112233445,info@xyz.com,45 Park Road,560001,,,,,Net 15,200000,0',
].join('\n')

function ClientBulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<BulkUploadResult | null>(null)

  function handleClose() {
    setFile(null)
    setResult(null)
    onClose()
  }

  const mutation = useMutation({
    mutationFn: (f: File) => clientsApi.bulkUpload(f),
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['clients'] })
      if (res.data.failureCount === 0)
        toast.success(`${res.data.successCount} clients uploaded successfully`)
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
    a.download = 'clients_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Clients</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-medium">CSV Format</p>
            <p>Required: <code className="bg-blue-100 px-1 rounded">clientName</code>, <code className="bg-blue-100 px-1 rounded">clientType</code>, <code className="bg-blue-100 px-1 rounded">phone</code></p>
            <p>Optional: email, address, pincode, gstin, panNumber, contactPersonName, contactPersonPhone, paymentTerms, creditLimit, openingBalance</p>
            <p className="text-blue-600 text-xs mt-2">Client type and payment terms names must match exactly as configured in Masters.</p>
          </div>

          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 w-full">
            <Download size={14} /> Download Template
          </Button>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <div
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <Upload size={20} className={cn('mx-auto mb-2', file ? 'text-green-500' : 'text-gray-400')} />
              {file
                ? <p className="text-sm font-medium text-green-700">{file.name}</p>
                : <p className="text-sm text-gray-500">Click to select a CSV file</p>
              }
            </div>
          </div>

          {result && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle size={14} /> {result.successCount} succeeded
                </span>
                {result.failureCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-700">
                    <XCircle size={14} /> {result.failureCount} failed
                  </span>
                )}
                <span className="text-gray-500 ml-auto">Total: {result.totalRows}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button
                disabled={!file || mutation.isPending}
                onClick={() => file && mutation.mutate(file)}
                className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2"
              >
                <Upload size={14} />
                {mutation.isPending ? 'Uploading…' : 'Upload'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── form modal ────────────────────────────────────────────────────────────────
function ClientForm({
  open, onClose, client,
}: {
  open: boolean; onClose: () => void; client?: Client
}) {
  const qc = useQueryClient()
  const isEdit = !!client

  const { data: clientTypesRes } = useQuery({ queryKey: ['client-types'], queryFn: tenantMastersApi.getClientTypes })
  const { data: statesRes }      = useQuery({ queryKey: ['states'],        queryFn: globalMastersApi.getStates })
  const { data: payTermsRes }    = useQuery({ queryKey: ['payment-terms'], queryFn: tenantMastersApi.getPaymentTerms })

  const [selectedState, setSelectedState] = useState<number | undefined>(client?.stateId)
  const { data: citiesRes } = useQuery({
    queryKey: ['cities', selectedState],
    queryFn: () => globalMastersApi.getCities(selectedState),
    enabled: !!selectedState,
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: client ? {
      clientName: client.clientName, clientTypeId: client.clientTypeId,
      phone: client.phone, email: client.email ?? '',
      address: client.address ?? '', stateId: client.stateId, cityId: client.cityId,
      pincode: client.pincode ?? '', gstin: client.gstin ?? '', panNumber: client.panNumber ?? '',
      contactPersonName: client.contactPersonName ?? '', contactPersonPhone: client.contactPersonPhone ?? '',
      paymentTermsId: client.paymentTermsId, creditLimit: client.creditLimit, openingBalance: client.openingBalance,
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? clientsApi.update(client!.id, data) : clientsApi.create(data),
    onSuccess: () => {
      toast.success(`Client ${isEdit ? 'updated' : 'created'} successfully`)
      qc.invalidateQueries({ queryKey: ['clients'] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Something went wrong')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5 pt-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Client Name *</Label>
              <Input placeholder="ABC Logistics Pvt Ltd" {...register('clientName')} />
              {errors.clientName && <p className="text-red-500 text-xs">{errors.clientName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Client Type *</Label>
              <select {...register('clientTypeId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                <option value="">Select type</option>
                {clientTypesRes?.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {errors.clientTypeId && <p className="text-red-500 text-xs">{errors.clientTypeId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input placeholder="9876543210" {...register('phone')} />
              {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Email</Label>
              <Input placeholder="accounts@company.com" {...register('email')} />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
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

          {/* Tax */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Tax Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input placeholder="22AAAAA0000A1Z5" {...register('gstin')} />
              </div>
              <div className="space-y-1.5">
                <Label>PAN Number</Label>
                <Input placeholder="AAAAA0000A" {...register('panNumber')} />
              </div>
            </div>
          </div>

          {/* Contact person */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Contact Person</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="Ramesh Kumar" {...register('contactPersonName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="9876543210" {...register('contactPersonPhone')} />
              </div>
            </div>
          </div>

          {/* Credit */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Credit Settings</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <select {...register('paymentTermsId')} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="">Select terms</option>
                  {payTermsRes?.data?.map(t => <option key={t.id} value={t.id}>{t.name} ({t.creditDays}d)</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Credit Limit (₹)</Label>
                <Input type="number" placeholder="500000" {...register('creditLimit')} />
              </div>
              <div className="space-y-1.5">
                <Label>Opening Balance (₹)</Label>
                <Input type="number" placeholder="0" {...register('openingBalance')} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update Client' : 'Add Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export function ClientsPage() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState<Client | undefined>()
  const [bulkOpen, setBulkOpen] = useState(false)

  const { data: res, isLoading } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.getAll })

  const deleteMutation = useMutation({
    mutationFn: clientsApi.remove,
    onSuccess: () => { toast.success('Client deleted'); qc.invalidateQueries({ queryKey: ['clients'] }) },
    onError: () => toast.error('Failed to delete client'),
  })

  const clients = (res?.data ?? []).filter(c =>
    c.clientName.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  function openEdit(c: Client) { setEditing(c); setFormOpen(true) }
  function openCreate()        { setEditing(undefined); setFormOpen(true) }
  function onClose()           { setFormOpen(false); setEditing(undefined) }

  function handleDelete(c: Client) {
    if (!confirm(`Delete client "${c.clientName}"?`)) return
    deleteMutation.mutate(c.id)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{res?.data?.length ?? 0} total clients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
            <Upload size={16} /> Bulk Upload
          </Button>
          <Button onClick={openCreate} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
            <Plus size={16} /> Add Client
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading clients…</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <Building2 size={36} className="text-gray-200" />
            <p className="text-sm">{search ? 'No clients match your search' : 'No clients yet. Add your first client.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Credit Limit</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-gray-800">{c.clientName}</p>
                      {c.gstin && <p className="text-xs text-gray-400 mt-0.5">GST: {c.gstin}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">{c.clientTypeName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        {c.phone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {c.cityName ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin size={12} className="text-gray-400" />
                          {c.cityName}, {c.stateName}
                        </div>
                      ) : <span className="text-gray-300 text-sm">—</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {c.creditLimit ? `₹${c.creditLimit.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn('text-xs', c.isActive ? 'bg-green-50 text-green-700 hover:bg-green-50' : 'bg-red-50 text-red-700 hover:bg-red-50')}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-feros-navy hover:bg-blue-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientForm key={editing?.id ?? 'new'} open={formOpen} onClose={onClose} client={editing} />
      <ClientBulkUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  )
}
