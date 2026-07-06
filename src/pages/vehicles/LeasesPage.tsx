import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehicleLeasesApi } from '@/api/vehicleLeases'
import { clientsApi } from '@/api/clients'
import { toast } from 'sonner'
import { Plus, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { LeaseStatus, RateType } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<LeaseStatus, string> = {
  DRAFT:  'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-50 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-500',
}
const STATUS_LABELS: Record<LeaseStatus, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', CLOSED: 'Closed',
}

const schema = z.object({
  clientId:  z.coerce.number().min(1, 'Select client'),
  site:      z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate:   z.string().optional(),
  rateType:  z.enum(['HOURLY', 'DAILY_SHIFT', 'MONTHLY'] as const),
  notes:     z.string().optional(),
})
type FormData = z.infer<typeof schema>

function NewLeaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()

  const { data: clientsRes } = useQuery({
    queryKey: ['clients', 0, ''],
    queryFn: () => clientsApi.getAll({ page: 0, size: 100 }),
  })
  const clients = clientsRes?.data?.content ?? []

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { rateType: 'DAILY_SHIFT' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => vehicleLeasesApi.create({
      ...data,
      endDate: data.endDate || undefined,
    }),
    onSuccess: () => {
      toast.success('Lease created')
      qc.invalidateQueries({ queryKey: ['vehicle-leases'] })
      reset(); onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create lease')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Lease</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 mt-2">
          <div>
            <Label>Client *</Label>
            <Controller
              name="clientId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={clients.map(c => ({ value: String(c.id), label: c.clientName }))}
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(v: string) => field.onChange(Number(v))}
                  placeholder="Select client"
                />
              )}
            />
            {errors.clientId && <p className="text-xs text-red-500 mt-1">{errors.clientId.message}</p>}
          </div>

          <div>
            <Label>Site / Location</Label>
            <Input {...register('site')} placeholder="e.g. Maa Maha Maya Port — Gate 3" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date *</Label>
              <Input type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" {...register('endDate')} />
            </div>
          </div>

          <div>
            <Label>Rate Type *</Label>
            <Controller
              name="rateType"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={[
                    { value: 'DAILY_SHIFT', label: 'Per Day' },
                    { value: 'MONTHLY',     label: 'Per Month' },
                  ]}
                  value={field.value}
                  onValueChange={(v: string) => field.onChange(v as RateType)}
                  placeholder="Select rate type"
                />
              )}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Input {...register('notes')} placeholder="Any terms or remarks" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Creating…' : 'Create Lease'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const ALL_STATUSES: LeaseStatus[] = ['DRAFT', 'ACTIVE', 'CLOSED']

export default function LeasesPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<LeaseStatus | ''>('')
  const [clientFilter, setClientFilter] = useState<number | ''>('')
  const [page, setPage] = useState(0)
  const [showNew, setShowNew] = useState(false)

  const { data: clientsRes } = useQuery({
    queryKey: ['clients', 0, ''],
    queryFn: () => clientsApi.getAll({ page: 0, size: 200 }),
  })
  const clients = clientsRes?.data?.content ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-leases', statusFilter, clientFilter, page],
    queryFn: () => vehicleLeasesApi.getAll({
      page,
      size: 20,
      status: statusFilter || undefined,
      clientId: clientFilter || undefined,
    }),
  })
  const leases = data?.data?.content ?? []
  const totalPages = data?.data?.totalPages ?? 1
  const totalElements = data?.data?.totalElements ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Leases</h1>
          <p className="text-gray-500 text-sm mt-0.5">{totalElements} total</p>
        </div>
        <Button onClick={() => setShowNew(true)}
          className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
          <Plus size={16} /> New Lease
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setStatusFilter(''); setPage(0) }}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              statusFilter === ''
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            )}>
            All
          </button>
          {ALL_STATUSES.map(s => (
            <button key={s}
              onClick={() => { setStatusFilter(s); setPage(0) }}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {/* Client filter */}
        <SearchableSelect
          value={clientFilter === '' ? '' : String(clientFilter)}
          onValueChange={v => { setClientFilter(v ? Number(v) : ''); setPage(0) }}
          options={[
            { value: '', label: 'All Clients' },
            ...clients.map(c => ({ value: String(c.id), label: c.clientName })),
          ]}
          placeholder="All Clients"
          className="w-52"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between text-sm text-gray-500">
          <span>{totalElements} leases</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-xs">{page + 1} / {Math.max(1, totalPages)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">Loading leases…</div>
        ) : leases.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <KeyRound size={36} className="text-gray-200" />
            <p className="text-sm">No leases found. Create one to deploy vehicles to a client site.</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Lease #</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Site</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicles</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Dates</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Rate</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {leases.map(lease => (
                  <tr key={lease.id}
                    onClick={() => navigate(`/vehicles/leases/${lease.id}`)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="py-3 px-4 text-sm font-mono font-medium text-gray-800">{lease.leaseNumber}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{lease.clientName}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{lease.site ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{lease.vehicleCount}</td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-600">{lease.startDate}</div>
                      {lease.endDate && <div className="text-xs text-gray-400">→ {lease.endDate}</div>}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {lease.rateType === 'MONTHLY' ? 'Per Month' : 'Per Day'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn('text-xs', STATUS_COLORS[lease.status])}>
                        {STATUS_LABELS[lease.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewLeaseDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
