import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Receipt, CheckCircle2, Clock, Banknote, AlertCircle } from 'lucide-react'
import { tripExpensesApi } from '@/api/tripExpenses'
import { useAuthStore } from '@/store/authStore'
import type { TripExpenseItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getApiError } from '@/lib/apiError'

// ─── Status badge ───────────────────────────────────────────────────────────
const STATUS_CFG = {
  DRAFT:      { label: 'Draft',     bg: 'bg-gray-100',   text: 'text-gray-600' },
  SUBMITTED:  { label: 'Submitted', bg: 'bg-amber-100',  text: 'text-amber-700' },
  APPROVED:   { label: 'Approved',  bg: 'bg-green-100',  text: 'text-green-700' },
  SETTLED:    { label: 'Settled',   bg: 'bg-blue-100',   text: 'text-blue-700' },
}

function ExpenseStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ─── Create Draft Dialog ─────────────────────────────────────────────────────
function CreateDraftDialog({ lrId, open, onClose }: { lrId: number; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [advance, setAdvance] = useState('')
  const [tripDays, setTripDays] = useState('')

  const mutation = useMutation({
    mutationFn: () => tripExpensesApi.createDraft(lrId, {
      advanceAmount: advance ? parseFloat(advance) : 0,
      tripDays:      tripDays ? parseInt(tripDays) : undefined,
      items:         [],
    }),
    onSuccess: () => {
      toast.success('Trip expense sheet created')
      qc.invalidateQueries({ queryKey: ['trip-expense', lrId] })
      onClose()
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to create expense sheet')),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Create Trip Expense Sheet</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Advance Issued to Driver (₹)</Label>
            <Input
              type="number" min="0" step="0.01"
              value={advance}
              onChange={e => setAdvance(e.target.value)}
              placeholder="e.g. 10000"
              autoFocus
            />
            <p className="text-xs text-gray-400">Enter 0 if no advance was given</p>
          </div>
          <div className="space-y-1.5">
            <Label>Trip Days</Label>
            <Input
              type="number" min="1"
              value={tripDays}
              onChange={e => setTripDays(e.target.value)}
              placeholder="Auto-calculated from LR dates"
            />
            <p className="text-xs text-gray-400">Leave blank to auto-calculate from LR start → delivery</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 bg-feros-navy hover:bg-feros-navy/90"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Creating…' : 'Create Sheet'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Item Dialog ─────────────────────────────────────────────────────────
function AddItemDialog({ lrId, currentItems, open, onClose }: {
  lrId: number
  currentItems: TripExpenseItem[]
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [desc, setDesc]   = useState('')
  const [amount, setAmount] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')

  const mutation = useMutation({
    mutationFn: () => tripExpensesApi.updateDraft(lrId, {
      items: [
        ...currentItems.map(i => ({ description: i.description, amount: i.amount, receiptUrl: i.receiptUrl })),
        { description: desc, amount: parseFloat(amount), receiptUrl: receiptUrl || undefined },
      ],
    }),
    onSuccess: () => {
      toast.success('Expense added')
      qc.invalidateQueries({ queryKey: ['trip-expense', lrId] })
      setDesc(''); setAmount(''); setReceiptUrl('')
      onClose()
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to add expense')),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="e.g. Toll, Hamali, Fuel, Food…"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <Input
              type="number" min="0" step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 350"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Receipt URL (optional)</Label>
            <Input
              value={receiptUrl}
              onChange={e => setReceiptUrl(e.target.value)}
              placeholder="Paste S3 URL after upload"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 bg-feros-navy hover:bg-feros-navy/90"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !desc.trim() || !amount}
            >
              {mutation.isPending ? 'Adding…' : 'Add Expense'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Settle Dialog ───────────────────────────────────────────────────────────
function SettleDialog({ expenseId, balanceAmount, open, onClose }: {
  expenseId: number
  balanceAmount: number
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () => tripExpensesApi.settle(expenseId, {
      settlementAmount: Math.abs(balanceAmount),
      settlementNote:   note || undefined,
    }),
    onSuccess: () => {
      toast.success('Settlement recorded')
      qc.invalidateQueries({ queryKey: ['trip-expense'] })
      onClose()
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to record settlement')),
  })

  const driverReturns = balanceAmount > 0

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

// ─── Summary Row ─────────────────────────────────────────────────────────────
function SummaryRow({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between py-1.5', highlight && 'border-t border-gray-200 mt-1 pt-2.5')}>
      <span className={cn('text-sm', muted ? 'text-gray-400' : 'text-gray-600')}>{label}</span>
      <span className={cn('text-sm font-semibold', highlight ? 'text-base text-gray-900' : 'text-gray-800')}>{value}</span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function TripExpenseTab({ lrId }: { lrId: number }) {
  const qc = useQueryClient()
  const role = useAuthStore(s => s.role)
  const isAdmin = role === 'ADMIN'

  const [showCreate, setShowCreate]   = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showSettle, setShowSettle]   = useState(false)
  const [approvedAmounts, setApprovedAmounts] = useState<Record<number, string>>({})

  const { data: expense, isLoading, error } = useQuery({
    queryKey: ['trip-expense', lrId],
    queryFn:  () => tripExpensesApi.getByLrId(lrId).then(r => r.data),
    retry:    false,
  })

  const submitMutation = useMutation({
    mutationFn: () => tripExpensesApi.submit(lrId),
    onSuccess: () => {
      toast.success('Expenses submitted for admin approval')
      qc.invalidateQueries({ queryKey: ['trip-expense', lrId] })
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to submit')),
  })

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!expense) return Promise.reject()
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
      qc.invalidateQueries({ queryKey: ['trip-expense', lrId] })
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to approve')),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => {
      if (!expense) return Promise.reject()
      const remaining = expense.items.filter(i => i.id !== itemId)
      return tripExpensesApi.updateDraft(lrId, {
        items: remaining.map(i => ({ description: i.description, amount: i.amount, receiptUrl: i.receiptUrl })),
      })
    },
    onSuccess: () => {
      toast.success('Item removed')
      qc.invalidateQueries({ queryKey: ['trip-expense', lrId] })
    },
    onError: (e) => toast.error(getApiError(e, 'Failed to remove item')),
  })

  // Loading state
  if (isLoading) return <div className="py-8 text-center text-sm text-gray-400 animate-pulse">Loading…</div>

  // No sheet yet
  if (!expense || (error as { response?: { status?: number } })?.response?.status === 404) {
    return (
      <>
        <div className="py-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Receipt className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="font-medium text-gray-700">No expense sheet yet</p>
            <p className="text-sm text-gray-400 mt-1">Create a trip expense sheet to record advance and expenses.</p>
          </div>
          {!isAdmin && (
            <Button onClick={() => setShowCreate(true)} className="bg-feros-navy hover:bg-feros-navy/90">
              <Plus className="h-4 w-4 mr-2" /> Create Expense Sheet
            </Button>
          )}
        </div>
        <CreateDraftDialog lrId={lrId} open={showCreate} onClose={() => setShowCreate(false)} />
      </>
    )
  }

  const isDraft     = expense.status === 'DRAFT'
  const isSubmitted = expense.status === 'SUBMITTED'
  const isApproved  = expense.status === 'APPROVED'
  const isSettled   = expense.status === 'SETTLED'
  const isLocked    = isApproved || isSettled

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <ExpenseStatusBadge status={expense.status} />
        {isDraft && !isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddItem(true)}
            className="text-feros-navy border-feros-navy/30"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Expense
          </Button>
        )}
      </div>

      {/* ── Advance & Batta ── */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Trip Allowances (Fixed)</p>
        <div className="space-y-0.5">
          <SummaryRow label="Advance Issued" value={`₹${expense.advanceAmount.toLocaleString()}`} />
          <SummaryRow label={`Driver Batta (${expense.tripDays} days × ₹${(expense.driverBatta / expense.tripDays || 0).toFixed(0)})`} value={`₹${expense.driverBatta.toLocaleString()}`} muted />
          {expense.cleanerBatta > 0 && (
            <SummaryRow label={`Cleaner Batta (${expense.tripDays} days)`} value={`₹${expense.cleanerBatta.toLocaleString()}`} muted />
          )}
          <SummaryRow label="Trip Mamulu" value={`₹${expense.tripMamulu.toLocaleString()}`} muted />
          <SummaryRow label="Fixed Total" value={`₹${expense.totalFixedAmount.toLocaleString()}`} highlight />
        </div>
      </div>

      {/* ── Expense Items ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Expense Items</p>
        </div>

        {expense.items.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">No expenses added yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                {(isSubmitted || isLocked) && (
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Approved</th>
                )}
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Receipt</th>
                {isDraft && !isAdmin && <th className="px-2 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expense.items.map(item => (
                <tr key={item.id} className={cn('hover:bg-gray-50/50', item.amountChanged && 'bg-amber-50/40')}>
                  <td className="px-4 py-3 text-gray-800">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₹{item.amount.toLocaleString()}</td>

                  {/* Admin editing approved amount */}
                  {isSubmitted && isAdmin && (
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

                  {/* Locked approved amount */}
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
                      <a href={item.receiptUrl} target="_blank" rel="noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-xs underline">View</a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {isDraft && !isAdmin && (
                    <td className="px-2 py-3">
                      <button
                        onClick={() => deleteItemMutation.mutate(item.id)}
                        disabled={deleteItemMutation.isPending}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Totals ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Summary</p>
        <div className="space-y-0.5">
          <SummaryRow label="Fixed (Batta + Mamulu)" value={`₹${expense.totalFixedAmount.toLocaleString()}`} />
          <SummaryRow label="Operational Expenses" value={`₹${expense.totalOperationalAmount.toLocaleString()}`} />
          <SummaryRow label="Total Submitted" value={`₹${expense.totalSubmittedAmount.toLocaleString()}`} highlight />
          {isLocked && (
            <>
              <SummaryRow label="Total Approved" value={`₹${expense.totalApprovedAmount.toLocaleString()}`} />
              <SummaryRow label="Advance Given" value={`₹${expense.advanceAmount.toLocaleString()}`} />
              <div className={cn(
                'flex justify-between py-2 mt-1 px-3 rounded-lg border',
                expense.balanceAmount > 0
                  ? 'bg-blue-50 border-blue-200'
                  : expense.balanceAmount < 0
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-gray-50 border-gray-200'
              )}>
                <span className="text-sm font-medium text-gray-700">
                  {expense.balanceAmount > 0 ? 'Driver Returns' : expense.balanceAmount < 0 ? 'Company Pays Driver' : 'Settled'}
                </span>
                <span className={cn(
                  'text-sm font-bold',
                  expense.balanceAmount > 0 ? 'text-blue-700' : expense.balanceAmount < 0 ? 'text-orange-700' : 'text-gray-600'
                )}>
                  ₹{Math.abs(expense.balanceAmount).toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Settlement info (when settled) ── */}
      {isSettled && expense.settlementNote && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Settlement Recorded</p>
            <p className="text-sm text-green-700 mt-0.5">{expense.settlementNote}</p>
            {expense.settledByName && (
              <p className="text-xs text-green-500 mt-1">By {expense.settledByName} · {expense.settledAt ? new Date(expense.settledAt).toLocaleString() : ''}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Submitted info ── */}
      {isSubmitted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Awaiting Admin Approval</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Submitted by {expense.submittedByName} · {expense.submittedAt ? new Date(expense.submittedAt).toLocaleString() : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Approved info ── */}
      {(isApproved || isSettled) && expense.approvedByName && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-xs text-green-700">
            Approved by <span className="font-medium">{expense.approvedByName}</span> · {expense.approvedAt ? new Date(expense.approvedAt).toLocaleString() : ''}
          </p>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex justify-end gap-3">
        {/* Supervisor: Submit */}
        {isDraft && !isAdmin && expense.items.length > 0 && (
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="bg-feros-navy hover:bg-feros-navy/90"
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
          </Button>
        )}

        {/* Supervisor: no items warning */}
        {isDraft && !isAdmin && expense.items.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            Add at least one expense before submitting
          </div>
        )}

        {/* Admin: Approve */}
        {isSubmitted && isAdmin && (
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {approveMutation.isPending ? 'Approving…' : 'Approve Expenses'}
          </Button>
        )}

        {/* Both: Settle */}
        {isApproved && (
          <Button
            onClick={() => setShowSettle(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Record Settlement
          </Button>
        )}
      </div>

      {/* ── Dialogs ── */}
      <AddItemDialog
        lrId={lrId}
        currentItems={expense.items}
        open={showAddItem}
        onClose={() => setShowAddItem(false)}
      />
      {expense && isApproved && (
        <SettleDialog
          expenseId={expense.id}
          balanceAmount={expense.balanceAmount}
          open={showSettle}
          onClose={() => setShowSettle(false)}
        />
      )}
    </div>
  )
}
