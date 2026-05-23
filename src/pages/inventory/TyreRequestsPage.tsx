import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tyresApi, tyreRequestsApi, type TyreRequestItem } from '@/api/tyres'
import { toast } from 'sonner'
import { CheckCircle2, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'

// ── Approve/Reject Dialog ─────────────────────────────────────────────────────
function ApprovalDialog({ request, onClose }: { request: TyreRequestItem; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [selectedTyreId, setSelectedTyreId] = useState<number>(0)
  const [fittedAtKm, setFittedAtKm] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const { data: tyresData, isLoading: loadingTyres } = useQuery({
    queryKey: ['tyres-available'],
    queryFn: tyresApi.getAvailable,
    enabled: action === 'APPROVED',
  })
  const availableTyres = tyresData?.data ?? []

  const mutation = useMutation({
    mutationFn: () => {
      if (action === 'APPROVED') {
        return tyreRequestsApi.approve(request.id, {
          tyreId: selectedTyreId,
          fittedAtKm: fittedAtKm ? Number(fittedAtKm) : undefined,
        })
      }
      return tyreRequestsApi.reject(request.id, { rejectionReason })
    },
    onSuccess: () => {
      toast.success(action === 'APPROVED' ? 'Tyre issued and fitted' : 'Request rejected')
      qc.invalidateQueries({ queryKey: ['tyre-requests'] })
      qc.invalidateQueries({ queryKey: ['tyres-available'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to process')
    },
  })

  const canSubmit = action === 'APPROVED'
    ? selectedTyreId > 0
    : rejectionReason.trim().length > 0

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Process Tyre Request</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p><span className="text-gray-500">Vehicle:</span> <strong>{request.vehicleRegistrationNumber}</strong></p>
            <p><span className="text-gray-500">Position:</span> {request.positionCode}</p>
            <p><span className="text-gray-500">Requested by:</span> {request.requestedByName}</p>
            {request.notes && <p><span className="text-gray-500">Notes:</span> {request.notes}</p>}
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
            <>
              <div>
                <Label>Select Tyre to Issue *</Label>
                <SearchableSelect
                  value={selectedTyreId ? String(selectedTyreId) : ''}
                  onValueChange={v => setSelectedTyreId(Number(v))}
                  options={availableTyres.map(t => ({
                    value: String(t.id),
                    label: `${t.serialNumber}${t.brand ? ` · ${t.brand}` : ''}${t.size ? ` (${t.size})` : ''}`,
                  }))}
                  placeholder={loadingTyres ? 'Loading…' : 'Search by serial number…'}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Fitted at Km (optional)</Label>
                <Input
                  type="number"
                  value={fittedAtKm}
                  onChange={e => setFittedAtKm(e.target.value)}
                  placeholder="e.g. 45000"
                  className="mt-1"
                />
              </div>
            </>
          )}

          {action === 'REJECTED' && (
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
            className={action === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Processing…'
              : action === 'APPROVED' ? 'Approve & Issue Tyre' : 'Reject Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TyreRequestsPage() {
  const [selected, setSelected] = useState<TyreRequestItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tyre-requests'],
    queryFn: tyreRequestsApi.getPending,
    refetchInterval: 30_000,
  })
  const requests: TyreRequestItem[] = data?.data ?? []

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Tyre Requests</h1>
        <p className="text-sm text-gray-500">Approve or reject tyre fitting requests from service technicians</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Pending Requests</p>
          <p className="text-2xl font-bold text-orange-600">{requests.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-2 text-gray-400">
            <CircleDot size={36} />
            <p className="text-sm">No pending tyre requests</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Position</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Requested By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.vehicleRegistrationNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{r.positionCode}</td>
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

      {selected && <ApprovalDialog request={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
