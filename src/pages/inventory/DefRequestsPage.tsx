import { Spinner } from '@/components/ui/loader'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { stockApi, consumableRequestsApi, type ConsumableRequestItem } from '@/api/inventory'
import { toast } from 'sonner'
import { CheckCircle2, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── Issue / Reject Dialog ─────────────────────────────────────────────────────
function IssueDialog({ request, onClose }: { request: ConsumableRequestItem; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'ISSUE' | 'REJECT'>('ISSUE')
  const [sparePartId, setSparePartId] = useState<number>(0)
  const [quantity, setQuantity] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ['inventory-stock'],
    queryFn: stockApi.getStock,
    enabled: action === 'ISSUE',
  })
  const stock = (stockData?.data ?? []).filter(s => s.quantity > 0)
  const selected = stock.find(s => s.sparePartId === sparePartId)

  const mutation = useMutation({
    mutationFn: () => {
      if (action === 'ISSUE') {
        return consumableRequestsApi.issue(request.id, { sparePartId, quantity: Number(quantity) })
      }
      return consumableRequestsApi.reject(request.id, { rejectionReason })
    },
    onSuccess: () => {
      toast.success(action === 'ISSUE' ? 'DEF issued to vehicle' : 'Request rejected')
      qc.invalidateQueries({ queryKey: ['consumable-requests'] })
      qc.invalidateQueries({ queryKey: ['inventory-stock'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to process')
    },
  })

  const qtyNum = Number(quantity)
  const overStock = action === 'ISSUE' && !!selected && qtyNum > selected.quantity
  const canSubmit = action === 'ISSUE'
    ? sparePartId > 0 && qtyNum > 0 && !overStock
    : rejectionReason.trim().length > 0

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Process DEF Request</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p><span className="text-gray-500">Vehicle:</span> <strong>{request.vehicleRegistrationNumber}</strong></p>
            <p><span className="text-gray-500">Requested by:</span> {request.requestedByName}</p>
            {request.notes && <p><span className="text-gray-500">Notes:</span> {request.notes}</p>}
          </div>

          <div className="flex gap-3">
            {(['ISSUE', 'REJECT'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  action === a
                    ? a === 'ISSUE' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {a === 'ISSUE' ? '✓ Issue' : '✗ Reject'}
              </button>
            ))}
          </div>

          {action === 'ISSUE' && (
            <>
              <div>
                <Label>Select DEF Item to Issue *</Label>
                <SearchableSelect
                  value={sparePartId ? String(sparePartId) : ''}
                  onValueChange={v => setSparePartId(Number(v))}
                  options={stock.map(s => ({
                    value: String(s.sparePartId),
                    label: `${s.partName}${s.partNumber ? ` · ${s.partNumber}` : ''} — ${s.quantity} ${s.unit} in stock`,
                  }))}
                  placeholder={loadingStock ? 'Loading…' : 'Search inventory…'}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder={selected ? `Available: ${selected.quantity} ${selected.unit}` : 'e.g. 10'}
                  className="mt-1"
                />
                {overStock && (
                  <p className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    Only {selected!.quantity} {selected!.unit} in stock. Enter a lower quantity.
                  </p>
                )}
              </div>
            </>
          )}

          {action === 'REJECT' && (
            <div>
              <Label>Rejection Reason *</Label>
              <Input
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection…"
                className="mt-1"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !canSubmit}
            className={action === 'ISSUE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Processing…'
              : action === 'ISSUE' ? 'Issue DEF' : 'Reject Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DefRequestsPage() {
  const [selected, setSelected] = useState<ConsumableRequestItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['consumable-requests'],
    queryFn: consumableRequestsApi.getPending,
    refetchInterval: 30_000,
  })
  const requests: ConsumableRequestItem[] = data?.data ?? []

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">DEF Requests</h1>
        <p className="text-sm text-gray-500">Issue DEF/AdBlue to vehicles requested by supervisors, or reject</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Pending Requests</p>
          <p className="text-2xl font-bold text-orange-600">{requests.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400"><Spinner /></div>
        ) : requests.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-2 text-gray-400">
            <CircleDot size={36} />
            <p className="text-sm">No pending DEF requests</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Requested By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.vehicleRegistrationNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{r.requestedByName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setSelected(r)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100"
                      >
                        <CheckCircle2 size={13} /> Process
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && <IssueDialog request={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
