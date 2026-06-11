import { getApiError } from '@/lib/apiError'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { payrollApi } from '@/api/payroll'
import type { BulkPayrollResult } from '@/types'

type StaffUser = { id: number; name: string; role: string; isActive: boolean }

const PAYROLL_ROLES = ['DRIVER', 'CLEANER', 'SUPERVISOR', 'SERVICE_MANAGER', 'STORE_KEEPER', 'TECHNICIAN']

export function BulkGenerateDialog({ open, onClose, users }: {
  open: boolean
  onClose: () => void
  users: StaffUser[]
}) {
  const qc = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [roleFilter, setRole]     = useState('ALL')
  const [selectedIds, setSelected] = useState<Set<number>>(new Set())
  const [result, setResult]       = useState<BulkPayrollResult | null>(null)

  const eligibleUsers = users.filter(u => u.isActive && PAYROLL_ROLES.includes(u.role))
  const filteredUsers = roleFilter === 'ALL'
    ? eligibleUsers
    : eligibleUsers.filter(u => u.role === roleFilter)

  const availableRoles = [...new Set(eligibleUsers.map(u => u.role))].sort()

  function toggleUser(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filteredUsers.map(u => u.id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  function handleClose() {
    setFrom(''); setTo(''); setRole('ALL')
    setSelected(new Set()); setResult(null)
    onClose()
  }

  const mutation = useMutation({
    mutationFn: () => payrollApi.bulkGenerate({
      payCycleStartDate: from,
      payCycleEndDate:   to,
      userIds:           [...selectedIds],
    }),
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['payrolls'] })
      if (res.data.failedCount === 0) {
        toast.success(`All ${res.data.successCount} payrolls generated`)
      } else {
        toast.warning(`${res.data.successCount} succeeded, ${res.data.failedCount} failed`)
      }
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Bulk generate failed') ?? 'Bulk generate failed'),
  })

  const canGenerate = from && to && selectedIds.size > 0 && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Generate Payroll</DialogTitle>
        </DialogHeader>

        {result ? (
          /* ── Results Screen ── */
          <div className="space-y-4 overflow-y-auto flex-1 py-1">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-gray-50 border p-3">
                <p className="text-2xl font-bold text-gray-700">{result.totalRequested}</p>
                <p className="text-xs text-gray-500 mt-0.5">Requested</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                <p className="text-2xl font-bold text-green-700">{result.successCount}</p>
                <p className="text-xs text-green-600 mt-0.5">Generated</p>
              </div>
              <div className={`rounded-lg border p-3 ${result.failedCount > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50'}`}>
                <p className={`text-2xl font-bold ${result.failedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {result.failedCount}
                </p>
                <p className={`text-xs mt-0.5 ${result.failedCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>Failed</p>
              </div>
            </div>

            {result.failed.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 uppercase mb-2">Failed — review below</p>
                <div className="border border-red-100 rounded-lg divide-y divide-red-50 max-h-48 overflow-y-auto">
                  {result.failed.map(f => (
                    <div key={f.userId} className="flex items-start gap-3 px-3 py-2">
                      <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700">{f.userName}</p>
                        <p className="text-xs text-red-500 truncate">{f.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.succeeded.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase mb-2">Generated successfully</p>
                <div className="border border-green-100 rounded-lg divide-y max-h-48 overflow-y-auto">
                  {result.succeeded.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                      <span className="text-sm text-gray-700 flex-1">{p.userName}</span>
                      <span className="text-xs text-gray-500">
                        ₹{p.netPay.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : (
          /* ── Config Screen ── */
          <div className="space-y-4 overflow-y-auto flex-1 py-1">
            {/* Pay Cycle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pay Cycle Start <span className="text-red-500">*</span></Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  max={today} className="mt-1" />
              </div>
              <div>
                <Label>Pay Cycle End <span className="text-red-500">*</span></Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)}
                  max={today} className="mt-1" />
              </div>
            </div>

            {/* Role Filter + Select All */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label>Filter by Role</Label>
                <SearchableSelect
                  className="mt-1"
                  value={roleFilter}
                  onValueChange={v => { setRole(v); setSelected(new Set()) }}
                  options={[
                    { value: 'ALL', label: 'All Eligible Staff' },
                    ...availableRoles.map(r => ({ value: r, label: r.replace(/_/g, ' ') })),
                  ]}
                />
              </div>
              <div className="flex gap-2 self-end">
                <Button type="button" size="sm" variant="outline" onClick={selectAll}>
                  Select All ({filteredUsers.length})
                </Button>
                {selectedIds.size > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Staff List */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b px-3 py-2 flex items-center gap-2">
                <Users size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Staff — {selectedIds.size} selected of {filteredUsers.length}
                </span>
              </div>
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No eligible staff found</p>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y">
                  {filteredUsers.map(u => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-800 flex-1">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.role.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedIds.size > 0 && (
              <p className="text-xs text-gray-500">
                Rates will be auto-fetched from each staff member's designation / profile.
                Staff with missing rate configuration will be reported as failed.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => mutation.mutate()} disabled={!canGenerate}>
                {mutation.isPending
                  ? `Generating ${selectedIds.size} payrolls…`
                  : `Generate ${selectedIds.size > 0 ? selectedIds.size : ''} Payrolls`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
