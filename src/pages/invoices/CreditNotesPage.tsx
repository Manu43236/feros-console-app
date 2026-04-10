import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { clientsApi } from '@/api/clients'
import { invoicesApi } from '@/api/invoices'
import { creditNotesApi } from '@/api/invoices'
import { toast } from 'sonner'
import { Plus, Search, Trash2, FileX, FileMinus, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CreditNote } from '@/types'
import { cn } from '@/lib/utils'

// ── schema ────────────────────────────────────────────────────────────────────
const schema = z.object({
  clientId:       z.coerce.number().min(1, 'Select a client'),
  invoiceId:      z.coerce.number().optional(),
  creditNoteDate: z.string().min(1, 'Date is required'),
  amount:         z.coerce.number().positive('Amount must be positive'),
  reason:         z.string().min(1, 'Reason is required'),
  remarks:        z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-700 border-gray-200',
  APPROVED:  'bg-blue-100 text-blue-700 border-blue-200',
  ADJUSTED:  'bg-green-100 text-green-700 border-green-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
}

// ── Add Dialog ────────────────────────────────────────────────────────────────
function AddCreditNoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)

  const { data: clientsRes } = useQuery({ queryKey: ['clients'], queryFn: clientsApi.getAll })
  const clients = clientsRes?.data ?? []

  const { data: invoicesRes } = useQuery({
    queryKey: ['invoices-by-client', selectedClientId],
    queryFn: () => invoicesApi.getAll(),
    enabled: selectedClientId != null,
  })
  const invoices = (invoicesRes?.data ?? []).filter(i => i.clientId === selectedClientId)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
  })

  const clientIdVal = watch('clientId')

  const mutation = useMutation({
    mutationFn: (data: FormData) => creditNotesApi.create({
      ...data,
      invoiceId: data.invoiceId || undefined,
    }),
    onSuccess: () => {
      toast.success('Credit note created')
      qc.invalidateQueries({ queryKey: ['credit-notes'] })
      reset()
      setSelectedClientId(null)
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create credit note')
    },
  })

  function handleClose() { reset(); setSelectedClientId(null); onClose() }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Credit Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div>
            <Label>Client *</Label>
            <select
              {...register('clientId')}
              onChange={e => {
                setValue('clientId', Number(e.target.value))
                setValue('invoiceId', undefined)
                setSelectedClientId(Number(e.target.value) || null)
              }}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
            >
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.clientName}</option>)}
            </select>
            {errors.clientId && <p className="text-xs text-red-500 mt-1">{errors.clientId.message}</p>}
          </div>

          <div>
            <Label>Linked Invoice (optional)</Label>
            <select {...register('invoiceId')} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white" disabled={!clientIdVal}>
              <option value="">None (standalone credit note)</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>{i.invoiceNumber} — ₹{i.totalAmount?.toLocaleString('en-IN')}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input type="date" {...register('creditNoteDate')} className="mt-1" />
              {errors.creditNoteDate && <p className="text-xs text-red-500 mt-1">{errors.creditNoteDate.message}</p>}
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} className="mt-1" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
          </div>

          <div>
            <Label>Reason *</Label>
            <Input placeholder="e.g. Freight overcharged, goods returned" {...register('reason')} className="mt-1" />
            {errors.reason && <p className="text-xs text-red-500 mt-1">{errors.reason.message}</p>}
          </div>

          <div>
            <Label>Remarks</Label>
            <Input placeholder="Optional notes" {...register('remarks')} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Credit Note'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Status Update Dialog ──────────────────────────────────────────────────────
function StatusDialog({
  cn: note, onClose,
}: { cn: CreditNote | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<string>('')

  const mutation = useMutation({
    mutationFn: ({ id, s }: { id: number; s: string }) =>
      creditNotesApi.updateStatus(id, s),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['credit-notes'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to update status')
    },
  })

  return (
    <Dialog open={!!note} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Status — {note?.creditNoteNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>New Status</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
            >
              <option value="">Select status</option>
              {['DRAFT', 'APPROVED', 'CANCELLED'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!status || mutation.isPending}
              onClick={() => note && mutation.mutate({ id: note.id, s: status })}
            >
              {mutation.isPending ? 'Saving…' : 'Update'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteDialog({ cn: note, onClose }: { cn: CreditNote | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: number) => creditNotesApi.delete(id),
    onSuccess: () => {
      toast.success('Credit note deleted')
      qc.invalidateQueries({ queryKey: ['credit-notes'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to delete')
    },
  })

  return (
    <Dialog open={!!note} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete Credit Note</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          Delete <strong>{note?.creditNoteNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={mutation.isPending}
            onClick={() => note && mutation.mutate(note.id)}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreditNotesPage() {
  const qc = useQueryClient()
  const [search, setSearch]       = useState('')
  const [addOpen, setAddOpen]     = useState(false)
  const [toStatus, setToStatus]   = useState<CreditNote | null>(null)
  const [toDelete, setToDelete]   = useState<CreditNote | null>(null)

  const approveMutation = useMutation({
    mutationFn: (id: number) => creditNotesApi.updateStatus(id, 'APPROVED'),
    onSuccess: () => { toast.success('Credit note approved'); qc.invalidateQueries({ queryKey: ['credit-notes'] }) },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to approve')
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['credit-notes'],
    queryFn:  creditNotesApi.getAll,
  })
  const notes = [...(data?.data ?? [])].sort((a, b) => b.id - a.id)

  const filtered = notes.filter(n =>
    n.clientName.toLowerCase().includes(search.toLowerCase()) ||
    n.creditNoteNumber.toLowerCase().includes(search.toLowerCase()) ||
    (n.invoiceNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalAmount   = notes.reduce((s, n) => s + n.amount, 0)
  const draftCount    = notes.filter(n => n.creditNoteStatus === 'DRAFT').length
  const approvedCount = notes.filter(n => n.creditNoteStatus === 'APPROVED').length

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Credit Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage credit notes issued to clients</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Create Credit Note
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-purple-50 rounded-lg"><FileMinus size={20} className="text-purple-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Total Amount</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalAmount)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-gray-50 rounded-lg"><FileX size={20} className="text-gray-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Draft</p>
            <p className="text-lg font-bold text-gray-900">{draftCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 rounded-lg"><CheckCircle size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-lg font-bold text-gray-900">{approvedCount}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <Search size={16} className="text-gray-400" />
          <Input
            placeholder="Search by client, credit note no. or invoice no.…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-sm"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileMinus size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {search ? 'No credit notes match your search' : 'No credit notes created yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">CN Number</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{n.creditNoteNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{n.clientName}</td>
                    <td className="px-4 py-3 text-gray-500">{n.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{n.creditNoteDate}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(n.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={n.reason}>{n.reason}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn('font-medium text-xs', STATUS_COLORS[n.creditNoteStatus] ?? '')}>
                        {n.creditNoteStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {n.creditNoteStatus === 'DRAFT' && (
                          <button
                            onClick={() => approveMutation.mutate(n.id)}
                            disabled={approveMutation.isPending}
                            className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors"
                            title="Approve"
                          >
                            Approve
                          </button>
                        )}
                        {n.creditNoteStatus !== 'ADJUSTED' && n.creditNoteStatus !== 'CANCELLED' && (
                          <button
                            onClick={() => setToStatus(n)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors text-xs font-medium"
                            title="Update status"
                          >
                            Status
                          </button>
                        )}
                        {n.creditNoteStatus !== 'ADJUSTED' && (
                          <button
                            onClick={() => setToDelete(n)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCreditNoteDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <StatusDialog cn={toStatus} onClose={() => setToStatus(null)} />
      <DeleteDialog cn={toDelete} onClose={() => setToDelete(null)} />
    </div>
  )
}
