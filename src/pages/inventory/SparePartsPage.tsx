import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sparePartsApi } from '@/api/inventory'
import type { SparePart } from '@/types'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

// ── Form Dialog ────────────────────────────────────────────────────────────────
function SparePartDialog({ part, onClose }: { part?: SparePart | null; onClose: () => void }) {
  const qc = useQueryClient()
  const isEdit = !!part
  const [form, setForm] = useState({
    name: part?.name ?? '',
    partNumber: part?.partNumber ?? '',
    category: part?.category ?? '',
    unit: part?.unit ?? 'Pieces',
    minStockLevel: part?.minStockLevel ?? 0,
  })

  const mutation = useMutation({
    mutationFn: (data: typeof form) => isEdit
      ? sparePartsApi.update(part!.id, data)
      : sparePartsApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Spare part updated' : 'Spare part created')
      qc.invalidateQueries({ queryKey: ['spare-parts'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to save')
    },
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Spare Part' : 'Add Spare Part'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Engine Oil Filter" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Part Number</Label>
              <Input value={form.partNumber} onChange={e => setForm(f => ({ ...f, partNumber: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Engine" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              >
                {['Pieces', 'Litres', 'Kg', 'Metres', 'Sets', 'Pairs'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Min Stock Alert</Label>
              <Input
                type="number" min={0}
                value={form.minStockLevel}
                onChange={e => setForm(f => ({ ...f, minStockLevel: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !form.name.trim()}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Dialog ──────────────────────────────────────────────────────────────
function DeleteDialog({ part, onClose }: { part: SparePart | null; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: number) => sparePartsApi.delete(id),
    onSuccess: () => {
      toast.success('Spare part deleted')
      qc.invalidateQueries({ queryKey: ['spare-parts'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to delete')
    },
  })

  return (
    <Dialog open={!!part} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete Spare Part</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">Delete <strong>{part?.name}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={mutation.isPending}
            onClick={() => part && mutation.mutate(part.id)}>
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SparePartsPage() {
  const [search, setSearch] = useState('')
  const [formPart, setFormPart] = useState<SparePart | null | undefined>(undefined) // undefined = closed, null = new
  const [deletePart, setDeletePart] = useState<SparePart | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['spare-parts'],
    queryFn: sparePartsApi.getAll,
  })
  const parts = data?.data ?? []
  const filtered = parts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.partNumber ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Spare Parts</h1>
          <p className="text-sm text-gray-500">Master list of spare parts for your fleet</p>
        </div>
        <Button onClick={() => setFormPart(null)} className="gap-2">
          <Plus size={16} /> Add Part
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total Parts</p>
          <p className="text-2xl font-bold text-gray-900">{parts.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{parts.filter(p => p.isActive).length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Categories</p>
          <p className="text-2xl font-bold text-blue-600">{new Set(parts.map(p => p.category).filter(Boolean)).size}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input className="pl-9" placeholder="Search parts…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-2 text-gray-400">
            <Package size={36} />
            <p className="text-sm">No spare parts found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Part No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Min Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.partNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{p.minStockLevel}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setFormPart(p)} className="text-gray-400 hover:text-blue-600">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeletePart(p)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formPart !== undefined && <SparePartDialog part={formPart} onClose={() => setFormPart(undefined)} />}
      <DeleteDialog part={deletePart} onClose={() => setDeletePart(null)} />
    </div>
  )
}
