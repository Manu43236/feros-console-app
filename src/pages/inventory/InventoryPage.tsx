import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockApi, sparePartsApi, servicePartsApi, inventoryTransactionsApi } from '@/api/inventory'
import type { ServicePart, StockTransactionType, BulkUploadResult } from '@/types'
import { toast } from 'sonner'
import {
  AlertTriangle, Boxes, ArrowDownCircle, ArrowUpCircle,
  AlertOctagon, CheckCircle2, ClipboardList, Plus, Search,
  Upload, Download, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Tab = 'stock' | 'requests' | 'transactions'


// ─── Stock In Dialog ──────────────────────────────────────────────────────────
function StockInDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ sparePartId: 0, quantity: 1, unitCost: '', supplierName: '', notes: '' })

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
            <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm" value={form.sparePartId} onChange={e => setForm(f => ({ ...f, sparePartId: Number(e.target.value) }))}>
              <option value={0}>Select part…</option>
              {parts.map(p => <option key={p.id} value={p.id}>{p.name}{p.partNumber ? ` (${p.partNumber})` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity *</Label>
              <Input className="mt-1" type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Unit Cost (₹)</Label>
              <Input className="mt-1" type="number" min={0} placeholder="Optional" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Supplier Name</Label>
            <Input className="mt-1" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <Label>Notes</Label>
            <Input className="mt-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending || form.sparePartId === 0 || form.quantity < 1} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Adding…' : 'Add Stock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Approval Dialog ──────────────────────────────────────────────────────────
function ApprovalDialog({ part, onClose }: { part: ServicePart; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [qtyApproved, setQtyApproved] = useState(part.quantityRequested)
  const [rejectionReason, setRejectionReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => servicePartsApi.approve(part.id, {
      status: action,
      quantityApproved: action === 'APPROVED' ? qtyApproved : undefined,
      rejectionReason: action === 'REJECTED' ? rejectionReason : undefined,
    }),
    onSuccess: () => {
      toast.success(action === 'APPROVED' ? 'Part approved, stock deducted' : 'Part request rejected')
      qc.invalidateQueries({ queryKey: ['part-requests'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to process')
    },
  })

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Process Part Request</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p><span className="text-gray-500">Part:</span> <strong>{part.partName}</strong>{part.partNumber ? ` (${part.partNumber})` : ''}</p>
            <p><span className="text-gray-500">Service:</span> {part.serviceNumber}</p>
            <p><span className="text-gray-500">Vehicle:</span> {part.vehicleRegistrationNumber}</p>
            <p><span className="text-gray-500">Requested by:</span> {part.requestedByName}</p>
            <p><span className="text-gray-500">Qty Requested:</span> <strong>{part.quantityRequested} {part.unit}</strong></p>
          </div>
          <div className="flex gap-3">
            {(['APPROVED', 'REJECTED'] as const).map(a => (
              <button key={a} onClick={() => setAction(a)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${action === a
                  ? a === 'APPROVED' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {a === 'APPROVED' ? '✓ Approve' : '✗ Reject'}
              </button>
            ))}
          </div>
          {action === 'APPROVED' && (
            <div>
              <Label>Quantity to Approve *</Label>
              <Input className="mt-1" type="number" min={1} max={part.quantityRequested} value={qtyApproved} onChange={e => setQtyApproved(Number(e.target.value))} />
            </div>
          )}
          {action === 'REJECTED' && (
            <div>
              <Label>Rejection Reason *</Label>
              <Input className="mt-1" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Reason for rejection…" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || (action === 'REJECTED' && !rejectionReason.trim())}
            className={action === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Processing…' : action === 'APPROVED' ? 'Approve & Deduct Stock' : 'Reject Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Bulk Stock In Dialog ─────────────────────────────────────────────────────
const STOCK_IN_TEMPLATE = [
  'partName,quantity,unitCost,supplierName,notes',
  'Engine Oil Filter,10,150,Ram Auto Parts,Monthly purchase',
  'Air Filter,5,200,Ram Auto Parts,',
].join('\n')

function BulkStockInDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<BulkUploadResult | null>(null)

  function handleClose() { setFile(null); setResult(null); onClose() }

  const mutation = useMutation({
    mutationFn: (f: File) => stockApi.bulkStockIn(f),
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] })
      if (res.data.failureCount === 0) toast.success(`${res.data.successCount} rows uploaded`)
      else toast.warning(`${res.data.successCount} uploaded, ${res.data.failureCount} failed`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Upload failed')
    },
  })

  function downloadTemplate() {
    const blob = new Blob([STOCK_IN_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'stock_in_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Bulk Stock In</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800 space-y-1">
            <p className="font-medium">CSV Format</p>
            <p>Required: <code className="bg-blue-100 px-1 rounded">partName</code>, <code className="bg-blue-100 px-1 rounded">quantity</code></p>
            <p>Optional: unitCost, supplierName, notes</p>
            <p className="text-blue-600 text-xs mt-1">Part name must exactly match a spare part in your masters.</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 w-full"><Download size={14} /> Download Template</Button>
          <div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <div onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <Upload size={20} className={`mx-auto mb-2 ${file ? 'text-green-500' : 'text-gray-400'}`} />
              {file ? <p className="text-sm font-medium text-green-700">{file.name}</p> : <p className="text-sm text-gray-500">Click to select a CSV file</p>}
            </div>
          </div>
          {result && (
            <div className="border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex gap-4">
                <span className="text-gray-500">Total: <strong>{result.totalRows}</strong></span>
                <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={13} />{result.successCount} success</span>
                {result.failureCount > 0 && <span className="text-red-600 flex items-center gap-1"><XCircle size={13} />{result.failureCount} failed</span>}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded p-2 max-h-32 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={handleClose}>Close</Button>
          {!result && <Button disabled={!file || mutation.isPending} onClick={() => file && mutation.mutate(file)} className="gap-2">
            <Upload size={14} />{mutation.isPending ? 'Uploading…' : 'Upload'}
          </Button>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────
function StockTab() {
  const [search, setSearch] = useState('')
  const [showStockIn, setShowStockIn] = useState(false)
  const [showBulkIn, setShowBulkIn] = useState(false)
  const [filterLow, setFilterLow] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['stock'], queryFn: stockApi.getStock })
  const items = data?.data ?? []
  const lowStockCount = items.filter(i => i.isLowStock).length
  const filtered = items.filter(i => {
    const matchSearch = i.partName.toLowerCase().includes(search.toLowerCase()) || (i.category ?? '').toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filterLow ? i.isLowStock : true)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total Items</p>
            <p className="text-xl font-bold text-gray-900">{items.length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">In Stock</p>
            <p className="text-xl font-bold text-green-600">{items.filter(i => i.quantity > 0).length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-red-50" onClick={() => setFilterLow(f => !f)}>
            <p className="text-xs text-gray-500">Low Stock</p>
            <p className="text-xl font-bold text-red-600">{lowStockCount}</p>
          </div>
        </div>
        <div className="ml-4 flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setShowBulkIn(true)} className="gap-2"><Upload size={15} /> Bulk Upload</Button>
          <Button onClick={() => setShowStockIn(true)} className="gap-2"><Plus size={15} /> Add Stock</Button>
        </div>
      </div>

      {filterLow && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          <AlertTriangle size={14} /> Showing low stock only
          <button className="ml-auto underline text-xs" onClick={() => setFilterLow(false)}>Clear</button>
        </div>
      )}

      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input className="pl-9" placeholder="Search stock…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 flex flex-col items-center gap-2 text-gray-400"><Boxes size={32} /><p className="text-sm">No stock records</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Part</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Unit</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Min</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(item => (
                <tr key={item.inventoryId} className={`hover:bg-gray-50 ${item.isLowStock ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.partName}</p>
                    {item.partNumber && <p className="text-xs text-gray-400">{item.partNumber}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-right font-semibold">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.minStockLevel}</td>
                  <td className="px-4 py-3">
                    {item.isLowStock
                      ? <span className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle size={12} />Low</span>
                      : <span className="text-xs font-medium text-green-600">OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showStockIn && <StockInDialog onClose={() => setShowStockIn(false)} />}
      {showBulkIn  && <BulkStockInDialog onClose={() => setShowBulkIn(false)} />}
    </div>
  )
}

// ─── Part Requests Tab ────────────────────────────────────────────────────────
function PartRequestsTab() {
  const [selected, setSelected] = useState<ServicePart | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['part-requests'],
    queryFn: servicePartsApi.getPending,
    refetchInterval: 30_000,
  })
  const requests = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-3 inline-block">
        <p className="text-xs text-gray-500">Pending Requests</p>
        <p className="text-xl font-bold text-orange-600">{requests.length}</p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="p-8 flex flex-col items-center gap-2 text-gray-400"><ClipboardList size={32} /><p className="text-sm">No pending requests</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Part</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Vehicle</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Requested By</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Qty</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.partName}</p>
                    {r.partNumber && <p className="text-xs text-gray-400">{r.partNumber}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.serviceNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{r.vehicleRegistrationNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{r.requestedByName}</td>
                  <td className="px-4 py-3 text-right font-semibold">{r.quantityRequested} {r.unit}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(r)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100">
                      <CheckCircle2 size={13} /> Process
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <ApprovalDialog part={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function txChip(type: StockTransactionType) {
  if (type === 'IN')  return <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded"><ArrowDownCircle size={11} />IN</span>
  if (type === 'OUT') return <span className="flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded"><ArrowUpCircle size={11} />OUT</span>
  return <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded"><AlertOctagon size={11} />DMG</span>
}
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function TransactionsTab() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<StockTransactionType | 'ALL'>('ALL')

  const { data, isLoading } = useQuery({ queryKey: ['inventory-transactions'], queryFn: inventoryTransactionsApi.getAll })
  const transactions = data?.data ?? []

  const filtered = transactions.filter(t => {
    const matchSearch = t.partName.toLowerCase().includes(search.toLowerCase()) ||
      (t.serviceNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.vehicleRegistrationNumber ?? '').toLowerCase().includes(search.toLowerCase())
    return matchSearch && (typeFilter === 'ALL' || t.transactionType === typeFilter)
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Stock In</p><p className="text-xl font-bold text-green-600">{transactions.filter(t => t.transactionType === 'IN').length}</p></div>
        <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Stock Out</p><p className="text-xl font-bold text-orange-600">{transactions.filter(t => t.transactionType === 'OUT').length}</p></div>
        <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Damage</p><p className="text-xl font-bold text-red-600">{transactions.filter(t => t.transactionType === 'DAMAGE').length}</p></div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9 w-56" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'IN', 'OUT', 'DAMAGE'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${typeFilter === t ? 'bg-feros-navy text-white border-feros-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No transactions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Part</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Reference</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">By</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                  <td className="px-4 py-3">{txChip(t.transactionType)}</td>
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{t.partName}</p><p className="text-xs text-gray-400">{t.unit}</p></td>
                  <td className="px-4 py-3 text-right font-semibold">{t.quantity}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {t.serviceNumber ? <div><p>{t.serviceNumber}</p><p className="text-xs text-gray-400">{t.vehicleRegistrationNumber}</p></div>
                      : t.supplierName ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.createdByName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{t.totalCost ? `₹${t.totalCost.toLocaleString('en-IN')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string }[] = [
  { key: 'stock',        label: 'Stock' },
  { key: 'requests',     label: 'Part Requests' },
  { key: 'transactions', label: 'Transactions' },
]

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('stock')

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
        <p className="text-sm text-gray-500">Spare parts stock management and tracking</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-feros-orange text-feros-orange'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'stock'        && <StockTab />}
      {tab === 'requests'     && <PartRequestsTab />}
      {tab === 'transactions' && <TransactionsTab />}
    </div>
  )
}
