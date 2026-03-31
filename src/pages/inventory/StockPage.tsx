import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockApi, sparePartsApi } from '@/api/inventory'
import { toast } from 'sonner'
import { Plus, Search, AlertTriangle, Boxes } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

// ── Stock In Dialog ────────────────────────────────────────────────────────────
function StockInDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    sparePartId: 0,
    quantity: 1,
    unitCost: '',
    supplierName: '',
    notes: '',
  })

  const { data: partsData } = useQuery({ queryKey: ['spare-parts'], queryFn: sparePartsApi.getAll })
  const parts = partsData?.data ?? []

  const mutation = useMutation({
    mutationFn: () => stockApi.stockIn({
      sparePartId: form.sparePartId,
      quantity: form.quantity,
      unitCost: form.unitCost ? Number(form.unitCost) : undefined,
      supplierName: form.supplierName || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Stock added successfully')
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to add stock')
    },
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Stock (Stock In)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Spare Part *</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={form.sparePartId}
              onChange={e => setForm(f => ({ ...f, sparePartId: Number(e.target.value) }))}
            >
              <option value={0}>Select part…</option>
              {parts.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.partNumber ? ` (${p.partNumber})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number" min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Unit Cost (₹)</Label>
              <Input
                type="number" min={0} placeholder="Optional"
                value={form.unitCost}
                onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Supplier Name</Label>
            <Input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || form.sparePartId === 0 || form.quantity < 1}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Adding…' : 'Add Stock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function StockPage() {
  const [search, setSearch] = useState('')
  const [showStockIn, setShowStockIn] = useState(false)
  const [filterLow, setFilterLow] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['stock'], queryFn: stockApi.getStock })
  const items = data?.data ?? []

  const lowStockCount = items.filter(i => i.isLowStock).length
  const filtered = items.filter(i => {
    const matchSearch = i.partName.toLowerCase().includes(search.toLowerCase()) ||
      (i.category ?? '').toLowerCase().includes(search.toLowerCase())
    const matchLow = filterLow ? i.isLowStock : true
    return matchSearch && matchLow
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-500">Current spare parts stock levels</p>
        </div>
        <Button onClick={() => setShowStockIn(true)} className="gap-2">
          <Plus size={16} /> Add Stock
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Total Items</p>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">In Stock</p>
          <p className="text-2xl font-bold text-green-600">{items.filter(i => i.quantity > 0).length}</p>
        </div>
        <div
          className="bg-white rounded-xl border p-4 cursor-pointer hover:border-red-300"
          onClick={() => setFilterLow(f => !f)}
        >
          <p className="text-xs text-gray-500">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
        </div>
      </div>

      {filterLow && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          <AlertTriangle size={15} />
          Showing low stock items only
          <button className="ml-auto underline" onClick={() => setFilterLow(false)}>Clear</button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input className="pl-9" placeholder="Search stock…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-2 text-gray-400">
            <Boxes size={36} />
            <p className="text-sm">No stock records found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Part Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Part No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Quantity</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Min Level</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(item => (
                <tr key={item.inventoryId} className={`hover:bg-gray-50 ${item.isLowStock ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.partName}</td>
                  <td className="px-4 py-3 text-gray-600">{item.partNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.minStockLevel}</td>
                  <td className="px-4 py-3">
                    {item.isLowStock ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertTriangle size={13} /> Low Stock
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-green-600">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showStockIn && <StockInDialog onClose={() => setShowStockIn(false)} />}
    </div>
  )
}
