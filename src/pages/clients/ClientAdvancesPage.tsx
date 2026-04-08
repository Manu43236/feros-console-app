import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientsApi, clientAdvancesApi } from '@/api/clients'
import { toast } from 'sonner'
import {
  Plus, Search, Trash2, IndianRupee, CheckCircle, Clock, Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ClientAdvance } from '@/types'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  clientId:        z.coerce.number().min(1, 'Select a client'),
  receivedDate:    z.string().min(1, 'Date is required'),
  amount:          z.coerce.number().positive('Amount must be positive'),
  paymentMode:     z.enum(['CASH', 'CHEQUE', 'NEFT', 'UPI', 'RTGS'] as const, { error: 'Select payment mode' }),
  referenceNumber: z.string().optional(),
  remarks:         z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ── Add Advance Dialog ────────────────────────────────────────────────────────
function AddAdvanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: clientsRes } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.getAll })
  const clients = clientsRes?.data ?? []

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => clientAdvancesApi.create(data),
    onSuccess: () => {
      toast.success('Advance recorded successfully')
      qc.invalidateQueries({ queryKey: ['client-advances'] })
      reset()
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to record advance')
    },
  })

  function handleClose() { reset(); onClose() }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Client Advance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div>
            <Label>Client *</Label>
            <Controller
              name="clientId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ? String(field.value) : ''}
                  onValueChange={v => field.onChange(v ? Number(v) : undefined)}
                  options={clients.map(c => ({ value: String(c.id), label: c.clientName }))}
                  placeholder="Select client"
                  className="mt-1"
                />
              )}
            />
            {errors.clientId && <p className="text-xs text-red-500 mt-1">{errors.clientId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Received Date *</Label>
              <Input type="date" {...register('receivedDate')} className="mt-1" />
              {errors.receivedDate && <p className="text-xs text-red-500 mt-1">{errors.receivedDate.message}</p>}
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} className="mt-1" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment Mode *</Label>
              <Controller
                name="paymentMode"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onValueChange={v => field.onChange(v)}
                    options={['CASH', 'CHEQUE', 'NEFT', 'UPI', 'RTGS'].map(m => ({ value: m, label: m }))}
                    placeholder="Select mode"
                    className="mt-1"
                  />
                )}
              />
              {errors.paymentMode && <p className="text-xs text-red-500 mt-1">{errors.paymentMode.message}</p>}
            </div>
            <div>
              <Label>Reference No.</Label>
              <Input placeholder="UTR / Cheque no." {...register('referenceNumber')} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Remarks</Label>
            <Input placeholder="Optional notes" {...register('remarks')} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save Advance'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────
function DeleteDialog({
  advance, onClose,
}: { advance: ClientAdvance | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: number) => clientAdvancesApi.delete(id),
    onSuccess: () => {
      toast.success('Advance deleted')
      qc.invalidateQueries({ queryKey: ['client-advances'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to delete')
    },
  })

  return (
    <Dialog open={!!advance} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Advance</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete the advance of{' '}
          <strong>₹{advance?.amount?.toLocaleString('en-IN')}</strong> from{' '}
          <strong>{advance?.clientName}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => advance && mutation.mutate(advance.id)}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClientAdvancesPage() {
  const [search, setSearch]     = useState('')
  const [addOpen, setAddOpen]   = useState(false)
  const [toDelete, setToDelete] = useState<ClientAdvance | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['client-advances'],
    queryFn:  clientAdvancesApi.getAll,
  })
  const advances = [...(data?.data ?? [])].sort((a, b) => b.id - a.id)

  const filtered = advances.filter(a =>
    a.clientName.toLowerCase().includes(search.toLowerCase()) ||
    (a.referenceNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalAmount   = advances.reduce((s, a) => s + a.amount, 0)
  const pendingAmount = advances.filter(a => !a.isAdjusted).reduce((s, a) => s + a.pendingAmount, 0)
  const adjustedCount = advances.filter(a => a.isAdjusted).length

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Advances</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track advance payments received from clients</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Record Advance
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 rounded-lg"><IndianRupee size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Received</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalAmount)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-orange-50 rounded-lg"><Clock size={20} className="text-orange-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Pending Adjustment</p>
            <p className="text-lg font-bold text-gray-900">{fmt(pendingAmount)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-green-50 rounded-lg"><CheckCircle size={20} className="text-green-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Adjusted</p>
            <p className="text-lg font-bold text-gray-900">{adjustedCount} advances</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-gray-400" />
          <Input
            placeholder="Search by client or reference…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Banknote size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {search ? 'No advances match your search' : 'No client advances recorded yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-right px-4 py-3">Pending</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.clientName}</td>
                    <td className="px-4 py-3 text-gray-600">{a.receivedDate}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(a.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{a.paymentMode}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.referenceNumber || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-orange-600">{fmt(a.pendingAmount)}</td>
                    <td className="px-4 py-3">
                      {a.isAdjusted ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 font-medium">Adjusted</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-medium">Pending</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!a.isAdjusted && (
                        <button
                          onClick={() => setToDelete(a)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddAdvanceDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <DeleteDialog advance={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}
