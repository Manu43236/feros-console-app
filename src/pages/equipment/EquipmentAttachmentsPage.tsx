import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Boxes, ToggleLeft, ToggleRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { equipmentAttachmentsApi } from '@/api/machines'
import type { EquipmentAttachment, EquipmentAttachmentInput, AttachmentType, OwnershipType, HireRateUnit } from '@/api/machines'

const EQUIP = '#1C1400'

function fmtDate(s?: string | null) {
  if (!s) return '—'
  try { return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return s }
}
function fmtMoney(n?: number | null) {
  return n != null ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'
}

const TYPE_LABELS: Record<AttachmentType, string> = {
  BUCKET: 'Bucket', BREAKER: 'Breaker', AUGER: 'Auger',
  RIPPER: 'Ripper', GRAPPLE: 'Grapple', HAMMER: 'Hammer', OTHER: 'Other',
}
const RATE_LABELS: Record<HireRateUnit, string> = {
  PER_DAY: 'Per Day', PER_HOUR: 'Per Hour', PER_MONTH: 'Per Month',
}

function AttachmentDialog({
  open, onClose, editing,
}: { open: boolean; onClose: () => void; editing: EquipmentAttachment | null }) {
  const qc = useQueryClient()
  const isEdit = !!editing
  const [form, setForm] = useState<EquipmentAttachmentInput>(() =>
    editing ? {
      name: editing.name, type: editing.type, serialNumber: editing.serialNumber ?? undefined,
      ownershipType: editing.ownershipType, hiredFrom: editing.hiredFrom ?? undefined,
      hireStartDate: editing.hireStartDate ?? undefined, hireEndDate: editing.hireEndDate ?? undefined,
      defaultRate: editing.defaultRate ?? undefined, rateUnit: editing.rateUnit ?? undefined,
      notes: editing.notes ?? undefined,
    } : { name: '', type: 'BUCKET', ownershipType: 'OWNED' }
  )

  const set = (patch: Partial<EquipmentAttachmentInput>) => setForm(f => ({ ...f, ...patch }))

  const mut = useMutation({
    mutationFn: (data: EquipmentAttachmentInput) =>
      isEdit ? equipmentAttachmentsApi.update(editing!.id, data) : equipmentAttachmentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eq-attachments'] })
      toast.success(isEdit ? 'Attachment updated' : 'Attachment added')
      onClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Attachment' : 'Add Attachment'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="e.g. 600mm Bucket" value={form.name} onChange={e => set({ name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => set({ type: v as AttachmentType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <Input placeholder="S/N" value={form.serialNumber ?? ''} onChange={e => set({ serialNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ownership *</Label>
              <Select value={form.ownershipType} onValueChange={v => set({ ownershipType: v as OwnershipType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNED">Owned</SelectItem>
                  <SelectItem value="HIRED_IN">Hired In</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.ownershipType === 'HIRED_IN' && (
            <>
              <div className="space-y-1.5">
                <Label>Hired From</Label>
                <Input placeholder="Vendor name" value={form.hiredFrom ?? ''} onChange={e => set({ hiredFrom: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Hire Start</Label>
                  <Input type="date" value={form.hireStartDate ?? ''} onChange={e => set({ hireStartDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hire End</Label>
                  <Input type="date" value={form.hireEndDate ?? ''} onChange={e => set({ hireEndDate: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Default Rate (₹)</Label>
              <Input type="number" placeholder="0" value={form.defaultRate ?? ''} onChange={e => set({ defaultRate: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div className="space-y-1.5">
              <Label>Rate Unit</Label>
              <Select value={form.rateUnit ?? ''} onValueChange={v => set({ rateUnit: v as HireRateUnit })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RATE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional notes" value={form.notes ?? ''} onChange={e => set({ notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button
            onClick={() => { if (!form.name.trim()) { toast.error('Name is required'); return }; mut.mutate(form) }}
            disabled={mut.isPending}
            style={{ backgroundColor: EQUIP }}
            className="text-white hover:opacity-90"
          >
            {mut.isPending ? 'Saving…' : isEdit ? 'Update' : 'Add Attachment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EquipmentAttachmentsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentAttachment | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['eq-attachments'],
    queryFn: () => equipmentAttachmentsApi.getAll(),
  })
  const attachments = (data?.data ?? []) as EquipmentAttachment[]

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => equipmentAttachmentsApi.setActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eq-attachments'] }),
    onError: () => toast.error('Failed to update'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => equipmentAttachmentsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-attachments'] }); toast.success('Deleted'); setDeleteId(null) },
    onError: () => toast.error('Failed to delete'),
  })

  const filtered = attachments.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase()) ||
    (a.serialNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attachments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage buckets, breakers, and other attachments in your inventory</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }}
          style={{ backgroundColor: EQUIP }} className="text-white hover:opacity-90 gap-1.5 h-9 text-sm">
          <Plus size={14} /> Add Attachment
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Input
          placeholder="Search attachments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-3 h-9"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-400 animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Boxes size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm">{search ? 'No attachments match your search' : 'No attachments yet'}</p>
          {!search && <p className="text-xs text-gray-300 mt-1">Add buckets, breakers, or other attachments you own or hire in</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Name', 'Type', 'Serial No.', 'Ownership', 'Hired From', 'Hire Period', 'Default Rate', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(a => (
                <tr key={a.id} className={cn('hover:bg-gray-50 transition-colors', !a.isActive && 'opacity-50')}>
                  <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[a.type] ?? a.type}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.serialNumber ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                      a.ownershipType === 'OWNED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                      {a.ownershipType === 'OWNED' ? 'Owned' : 'Hired In'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{a.hiredFrom ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {a.hireStartDate ? `${fmtDate(a.hireStartDate)} – ${fmtDate(a.hireEndDate)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">
                    {a.defaultRate != null ? `${fmtMoney(a.defaultRate)} ${a.rateUnit ? RATE_LABELS[a.rateUnit] : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMut.mutate({ id: a.id, isActive: !a.isActive })}
                      className="text-gray-400 hover:text-gray-700 transition-colors">
                      {a.isActive ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(a); setDialogOpen(true) }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteId(a.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AttachmentDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        editing={editing}
      />

      <Dialog open={deleteId !== null} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Attachment?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">This cannot be undone. Existing WO links will be cleared.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
              className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
