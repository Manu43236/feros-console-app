import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Receipt, ChevronRight, X, CheckCircle2, Clock, Banknote, ExternalLink, XCircle } from 'lucide-react'
import { tripExpensesApi } from '@/api/tripExpenses'
import { useAuthStore } from '@/store/authStore'
import type { TripExpense, TripExpenseStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getApiError } from '@/lib/apiError'

const STATUS_CFG: Record<TripExpenseStatus, { label: string; bg: string; text: string }> = {
  DRAFT:     { label: 'Draft',     bg: 'bg-gray-100',   text: 'text-gray-600'  },
  SUBMITTED: { label: 'Submitted', bg: 'bg-amber-100',  text: 'text-amber-700' },
  APPROVED:  { label: 'Approved',  bg: 'bg-green-100',  text: 'text-green-700' },
  SETTLED:   { label: 'Settled',   bg: 'bg-blue-100',   text: 'text-blue-700'  },
  REJECTED:  { label: 'Rejected',  bg: 'bg-red-100',    text: 'text-red-700'   },
}

const FILTER_TABS: { key: TripExpenseStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',       label: 'All'       },
  { key: 'DRAFT',     label: 'Draft'     },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'APPROVED',  label: 'Approved'  },
  { key: 'SETTLED',   label: 'Settled'   },
  { key: 'REJECTED',  label: 'Rejected'  },
]

function StatusBadge({ status }: { status: TripExpenseStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ─── Settle Dialog ────────────────────────────────────────────────────────────
function SettleDialog({ expenseId, balanceAmount, open, onClose, onSettled }: {
  expenseId: number
  balanceAmount: number
  open: boolean
  onClose: () => void
  onSettled: () => void
}) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const driverReturns = balanceAmount > 0

  const mutation = useMutation({
    mutationFn: () => tripExpensesApi.settle(expenseId, {
      settlementAmount: Math.abs(balanceAmount),
      settlementNote:   note || undefined,
    }),
    onSuccess: () => {
      toast.success('Settlement recorded')
      qc.invalidateQueries({ queryKey: ['trip-expenses'] })
      qc.invalidateQueries({ queryKey: ['trip-expense'] })
      onSettled()
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to record settlement')),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record Settlement</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className={cn(
            'rounded-xl p-4 flex items-center justify-between',
            driverReturns ? 'bg-blue-50 border border-blue-200' : 'bg-orange-50 border border-orange-200'
          )}>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {driverReturns ? 'Driver returns cash' : 'Company pays driver'}
              </p>
              <p className={cn('text-2xl font-bold mt-0.5', driverReturns ? 'text-blue-700' : 'text-orange-700')}>
                ₹{Math.abs(balanceAmount).toLocaleString()}
              </p>
            </div>
            <Banknote className={cn('h-8 w-8', driverReturns ? 'text-blue-400' : 'text-orange-400')} />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background"
              placeholder="e.g. Cash received from Suresh on 15 Jan"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Mark Settled'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Expense Detail Panel (slide-over) ───────────────────────────────────────
function ExpenseDetailPanel({ expense, onClose }: { expense: TripExpense; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [approvedAmounts, setApprovedAmounts] = useState<Record<number, string>>({})
  const [showSettle, setShowSettle] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const isSubmitted = expense.status === 'SUBMITTED'
  const isApproved  = expense.status === 'APPROVED'
  const isSettled   = expense.status === 'SETTLED'
  const isRejected  = expense.status === 'REJECTED'
  const isLocked    = isApproved || isSettled

  const rejectMutation = useMutation({
    mutationFn: () => tripExpensesApi.reject(expense.id, rejectReason || undefined),
    onSuccess: () => {
      toast.success('Expense sheet rejected and sent back')
      qc.invalidateQueries({ queryKey: ['trip-expenses'] })
      setRejectReason('')
      setShowReject(false)
      onClose()
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to reject')),
  })

  const approveMutation = useMutation({
    mutationFn: () => {
      const items = expense.items.map(item => ({
        itemId:         item.id,
        approvedAmount: approvedAmounts[item.id] !== undefined
          ? parseFloat(approvedAmounts[item.id])
          : item.amount,
      }))
      return tripExpensesApi.approve(expense.id, { items })
    },
    onSuccess: () => {
      toast.success('Trip expenses approved')
      qc.invalidateQueries({ queryKey: ['trip-expenses'] })
      qc.invalidateQueries({ queryKey: ['trip-expense'] })
      onClose()
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to approve')),
  })

  // Live balance preview while admin edits approved amounts
  const liveApprovedTotal = expense.totalFixedAmount + expense.items.reduce((sum, item) => {
    const val = approvedAmounts[item.id]
    return sum + (val !== undefined ? (parseFloat(val) || 0) : item.amount)
  }, 0)
  const liveBalance = expense.advanceAmount - liveApprovedTotal

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{expense.lrNumber}</span>
              <StatusBadge status={expense.status} />
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
              {expense.driverName  && <span>Driver: {expense.driverName}</span>}
              {expense.cleanerName && <span>Cleaner: {expense.cleanerName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/lrs/${expense.lrId}`)}
              className="text-xs text-feros-navy flex items-center gap-1 hover:underline"
            >
              View LR <ExternalLink className="h-3 w-3" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Rejection banner */}
          {isRejected && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Rejected</p>
                {expense.rejectionReason && (
                  <p className="text-sm text-red-700 mt-0.5">{expense.rejectionReason}</p>
                )}
                {expense.rejectedByName && (
                  <p className="text-xs text-red-400 mt-1">
                    By {expense.rejectedByName} · {expense.rejectedAt ? new Date(expense.rejectedAt).toLocaleString() : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fixed Allowances */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Trip Allowances (Fixed)</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Advance Issued</span>
                <span className="font-semibold text-gray-800">₹{expense.advanceAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Driver Batta ({expense.tripDays} days)</span>
                <span className="text-gray-600">₹{expense.driverBatta.toLocaleString()}</span>
              </div>
              {expense.cleanerBatta > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cleaner Batta</span>
                  <span className="text-gray-600">₹{expense.cleanerBatta.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Trip Mamulu</span>
                <span className="text-gray-600">₹{expense.tripMamulu.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-1">
                <span className="text-gray-700 font-medium">Fixed Total</span>
                <span className="font-semibold text-gray-900">₹{expense.totalFixedAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Expense Items */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Expense Items</p>
            </div>
            {expense.items.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">No expense items added</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Submitted</th>
                    {(isSubmitted || isLocked) && (
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Approved</th>
                    )}
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expense.items.map(item => (
                    <tr key={item.id} className={cn('hover:bg-gray-50/50', item.amountChanged && 'bg-amber-50/40')}>
                      <td className="px-4 py-3 text-gray-800">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{item.amount.toLocaleString()}</td>
                      {isSubmitted && (
                        <td className="px-4 py-3 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-28 h-7 text-right text-sm ml-auto"
                            value={approvedAmounts[item.id] ?? item.amount.toString()}
                            onChange={e => setApprovedAmounts(p => ({ ...p, [item.id]: e.target.value }))}
                          />
                        </td>
                      )}
                      {isLocked && (
                        <td className="px-4 py-3 text-right">
                          <span className={cn('font-medium', item.amountChanged ? 'text-amber-600' : 'text-gray-700')}>
                            ₹{(item.approvedAmount ?? item.amount).toLocaleString()}
                          </span>
                          {item.amountChanged && (
                            <span className="ml-1 text-xs text-amber-500">(edited)</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        {item.receiptUrl ? (
                          <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fixed (Batta + Mamulu)</span>
              <span className="font-medium text-gray-800">₹{expense.totalFixedAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Operational Expenses</span>
              <span className="font-medium text-gray-800">₹{expense.totalOperationalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
              <span className="text-gray-700 font-medium">Total Submitted</span>
              <span className="font-semibold text-gray-900">₹{expense.totalSubmittedAmount.toLocaleString()}</span>
            </div>

            {/* Live preview while admin is editing */}
            {isSubmitted && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Approved (preview)</span>
                  <span className="font-semibold text-green-700">₹{liveApprovedTotal.toLocaleString()}</span>
                </div>
                <div className={cn(
                  'flex justify-between py-2 px-3 rounded-lg border text-sm mt-1',
                  liveBalance > 0 ? 'bg-blue-50 border-blue-200' : liveBalance < 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                )}>
                  <span className="font-medium text-gray-700">
                    {liveBalance > 0 ? 'Driver Returns' : liveBalance < 0 ? 'Company Pays Driver' : 'Exact'}
                  </span>
                  <span className={cn('font-bold', liveBalance > 0 ? 'text-blue-700' : liveBalance < 0 ? 'text-orange-700' : 'text-gray-600')}>
                    ₹{Math.abs(liveBalance).toLocaleString()}
                  </span>
                </div>
              </>
            )}

            {isLocked && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Approved</span>
                  <span className="font-semibold text-green-700">₹{expense.totalApprovedAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Advance Given</span>
                  <span className="font-medium text-gray-800">₹{expense.advanceAmount.toLocaleString()}</span>
                </div>
                <div className={cn(
                  'flex justify-between py-2 px-3 rounded-lg border text-sm mt-1',
                  expense.balanceAmount > 0 ? 'bg-blue-50 border-blue-200' : expense.balanceAmount < 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                )}>
                  <span className="font-medium text-gray-700">
                    {expense.balanceAmount > 0 ? 'Driver Returns' : expense.balanceAmount < 0 ? 'Company Pays Driver' : 'Settled'}
                  </span>
                  <span className={cn('font-bold', expense.balanceAmount > 0 ? 'text-blue-700' : expense.balanceAmount < 0 ? 'text-orange-700' : 'text-gray-600')}>
                    ₹{Math.abs(expense.balanceAmount).toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Status banners */}
          {isSubmitted && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Awaiting Approval</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Submitted by {expense.submittedByName} · {expense.submittedAt ? new Date(expense.submittedAt).toLocaleString() : ''}
                </p>
              </div>
            </div>
          )}

          {(isApproved || isSettled) && expense.approvedByName && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-xs text-green-700">
                Approved by <span className="font-medium">{expense.approvedByName}</span> · {expense.approvedAt ? new Date(expense.approvedAt).toLocaleString() : ''}
              </p>
            </div>
          )}

          {isSettled && expense.settlementNote && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Settlement Recorded</p>
                <p className="text-sm text-green-700 mt-0.5">{expense.settlementNote}</p>
                {expense.settledByName && (
                  <p className="text-xs text-green-500 mt-1">
                    By {expense.settledByName} · {expense.settledAt ? new Date(expense.settledAt).toLocaleString() : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(isSubmitted || isApproved) && (
          <div className="px-5 py-4 border-t border-gray-100 bg-white shrink-0">
            {isSubmitted && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setShowReject(true)}
                >
                  Reject
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? 'Approving…' : 'Approve'}
                </Button>
              </div>
            )}
            {isApproved && (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setShowSettle(true)}
              >
                Record Settlement
              </Button>
            )}
          </div>
        )}
      </div>

      {isApproved && (
        <SettleDialog
          expenseId={expense.id}
          balanceAmount={expense.balanceAmount}
          open={showSettle}
          onClose={() => setShowSettle(false)}
          onSettled={onClose}
        />
      )}

      {/* Reject dialog */}
      <Dialog open={showReject} onOpenChange={v => !v && setShowReject(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Expense Sheet</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-gray-600">This will send the sheet back to the supervisor for correction.</p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                autoFocus
                className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none bg-background"
                placeholder="e.g. Toll amount seems incorrect, please verify receipts"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowReject(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject & Send Back'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Expense Card ─────────────────────────────────────────────────────────────
function ExpenseCard({ expense, onSelect }: { expense: TripExpense; onSelect?: () => void }) {
  const navigate = useNavigate()
  const isApproved = expense.status === 'APPROVED'
  const isSettled  = expense.status === 'SETTLED'

  return (
    <div
      onClick={() => onSelect ? onSelect() : navigate(`/lrs/${expense.lrId}`)}
      className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{expense.lrNumber}</span>
            <StatusBadge status={expense.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-500">
            {expense.driverName  && <span>Driver: <span className="text-gray-700">{expense.driverName}</span></span>}
            {expense.cleanerName && <span>Cleaner: <span className="text-gray-700">{expense.cleanerName}</span></span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400">Advance</p>
          <p className="text-sm font-semibold text-gray-800">₹{expense.advanceAmount.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400">Submitted</p>
          <p className="text-sm font-semibold text-gray-800">₹{expense.totalSubmittedAmount.toLocaleString()}</p>
        </div>
        {(isApproved || isSettled) && (
          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400">Approved</p>
            <p className="text-sm font-semibold text-green-700">₹{expense.totalApprovedAmount.toLocaleString()}</p>
          </div>
        )}
        {(isApproved || isSettled) && (
          <div className={cn(
            'rounded-lg px-3 py-2',
            expense.balanceAmount > 0 ? 'bg-blue-50' : expense.balanceAmount < 0 ? 'bg-orange-50' : 'bg-gray-50'
          )}>
            <p className="text-xs text-gray-400">{expense.balanceAmount > 0 ? 'Driver Returns' : 'Co. Pays'}</p>
            <p className={cn(
              'text-sm font-semibold',
              expense.balanceAmount > 0 ? 'text-blue-700' : expense.balanceAmount < 0 ? 'text-orange-700' : 'text-gray-600'
            )}>
              ₹{Math.abs(expense.balanceAmount).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {expense.submittedAt && (
        <p className="text-xs text-gray-400 mt-2">
          Submitted {new Date(expense.submittedAt).toLocaleDateString()} by {expense.submittedByName}
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function TripExpensesPage() {
  const role = useAuthStore(s => s.role)
  const isAdmin = role === 'ADMIN'
  const [filter, setFilter] = useState<TripExpenseStatus | 'ALL'>('ALL')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['trip-expenses', filter],
    queryFn: () => tripExpensesApi.getAll(filter === 'ALL' ? undefined : filter).then(r => r.data),
  })

  const sorted = isAdmin && filter === 'ALL'
    ? [...expenses].sort((a, b) => {
        const order = { SUBMITTED: 0, REJECTED: 1, APPROVED: 2, DRAFT: 3, SETTLED: 4 }
        return (order[a.status] ?? 9) - (order[b.status] ?? 9)
      })
    : expenses

  const selectedExpense = selectedId != null ? sorted.find(e => e.id === selectedId) ?? null : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trip Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage driver advance and trip expense settlements</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              filter === t.key
                ? 'bg-white text-feros-navy shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-400 animate-pulse text-sm">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
            <Receipt className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No trip expenses found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(e => (
            <ExpenseCard
              key={e.id}
              expense={e}
              onSelect={isAdmin ? () => setSelectedId(e.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Detail panel (admin only) */}
      {isAdmin && selectedExpense && (
        <ExpenseDetailPanel
          expense={selectedExpense}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
