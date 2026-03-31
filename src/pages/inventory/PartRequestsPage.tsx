import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { servicePartsApi } from '@/api/inventory'
import type { ServicePart } from '@/types'
import { toast } from 'sonner'
import { CheckCircle2, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

// ── Approve/Reject Dialog ──────────────────────────────────────────────────────
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
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  action === a
                    ? a === 'APPROVED' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {a === 'APPROVED' ? '✓ Approve' : '✗ Reject'}
              </button>
            ))}
          </div>

          {action === 'APPROVED' && (
            <div>
              <Label>Quantity to Approve *</Label>
              <Input
                type="number" min={1} max={part.quantityRequested}
                value={qtyApproved}
                onChange={e => setQtyApproved(Number(e.target.value))}
              />
            </div>
          )}

          {action === 'REJECTED' && (
            <div>
              <Label>Rejection Reason *</Label>
              <Input
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection…"
              />
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

// ── Page ───────────────────────────────────────────────────────────────────────
export default function PartRequestsPage() {
  const [selected, setSelected] = useState<ServicePart | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['part-requests'],
    queryFn: servicePartsApi.getPending,
    refetchInterval: 30_000,
  })
  const requests = data?.data ?? []

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Part Requests</h1>
        <p className="text-sm text-gray-500">Approve or reject parts requested by service technicians</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Pending Requests</p>
          <p className="text-2xl font-bold text-orange-600">{requests.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-2 text-gray-400">
            <ClipboardList size={36} />
            <p className="text-sm">No pending part requests</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Part</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Requested By</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="px-4 py-3" />
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
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {r.quantityRequested} {r.unit}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
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

      {selected && <ApprovalDialog part={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
