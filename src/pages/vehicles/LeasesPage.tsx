import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { vehicleLeasesApi } from '@/api/vehicleLeases'
import { clientsApi } from '@/api/clients'
import { toast } from 'sonner'
import { Plus, FileText } from 'lucide-react'
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
                  onChange={v => field.onChange(Number(v))}
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
                  onChange={v => field.onChange(v as RateType)}
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

const ALL_STATUSES: (LeaseStatus | 'ALL')[] = ['ALL', 'DRAFT', 'ACTIVE', 'CLOSED']

export default function LeasesPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<LeaseStatus | 'ALL'>('ALL')
  const [page] = useState(0)
  const [showNew, setShowNew] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vehicle-leases', statusFilter, page],
    queryFn: () => vehicleLeasesApi.getAll({
      page,
      size: 20,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    }),
  })
  const leases = data?.data?.content ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vehicle Leases</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vehicles deployed to client sites for internal movement</p>
        </div>
        <Button onClick={() => setShowNew(true)}
          className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
          <Plus size={16} /> New Lease
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {ALL_STATUSES.map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              statusFilter === s
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}>
            {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : leases.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No leases found</p>
          <p className="text-sm mt-1">Create a lease to deploy vehicles to a client site</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leases.map(lease => (
            <div key={lease.id}
              onClick={() => navigate(`/vehicles/leases/${lease.id}`)}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-feros-navy/30 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{lease.leaseNumber}</span>
                    <Badge className={cn('text-xs font-medium border-0', STATUS_COLORS[lease.status])}>
                      {STATUS_LABELS[lease.status]}
                    </Badge>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                      {lease.vehicleCount} vehicle{lease.vehicleCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 font-medium">{lease.clientName}</p>
                  {lease.site && <p className="text-xs text-gray-400 mt-0.5">{lease.site}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">{lease.startDate}</p>
                  {lease.endDate && <p className="text-xs text-gray-400">{lease.endDate}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {lease.rateType === 'MONTHLY' ? 'Per Month' : 'Per Day'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewLeaseDialog open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
