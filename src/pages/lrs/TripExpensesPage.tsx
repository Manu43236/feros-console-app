import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Receipt, ChevronRight } from 'lucide-react'
import { tripExpensesApi } from '@/api/tripExpenses'
import { useAuthStore } from '@/store/authStore'
import type { TripExpense, TripExpenseStatus } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_CFG: Record<TripExpenseStatus, { label: string; bg: string; text: string }> = {
  DRAFT:     { label: 'Draft',     bg: 'bg-gray-100',   text: 'text-gray-600'  },
  SUBMITTED: { label: 'Submitted', bg: 'bg-amber-100',  text: 'text-amber-700' },
  APPROVED:  { label: 'Approved',  bg: 'bg-green-100',  text: 'text-green-700' },
  SETTLED:   { label: 'Settled',   bg: 'bg-blue-100',   text: 'text-blue-700'  },
}

const FILTER_TABS: { key: TripExpenseStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',       label: 'All'       },
  { key: 'DRAFT',     label: 'Draft'     },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'APPROVED',  label: 'Approved'  },
  { key: 'SETTLED',   label: 'Settled'   },
]

function StatusBadge({ status }: { status: TripExpenseStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function ExpenseCard({ expense }: { expense: TripExpense }) {
  const navigate = useNavigate()
  const isApproved = expense.status === 'APPROVED'
  const isSettled  = expense.status === 'SETTLED'

  return (
    <div
      onClick={() => navigate(`/lrs/${expense.lrId}`)}
      className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{expense.lrNumber}</span>
            <StatusBadge status={expense.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-500">
            {expense.driverName && <span>Driver: <span className="text-gray-700">{expense.driverName}</span></span>}
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

export function TripExpensesPage() {
  const role = useAuthStore(s => s.role)
  const isAdmin = role === 'ADMIN'
  const [filter, setFilter] = useState<TripExpenseStatus | 'ALL'>('ALL')

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['trip-expenses', filter],
    queryFn: () => tripExpensesApi.getAll(filter === 'ALL' ? undefined : filter).then(r => r.data),
  })

  // Admin default: show SUBMITTED first
  const sorted = isAdmin && filter === 'ALL'
    ? [...expenses].sort((a, b) => {
        const order = { SUBMITTED: 0, APPROVED: 1, DRAFT: 2, SETTLED: 3 }
        return (order[a.status] ?? 9) - (order[b.status] ?? 9)
      })
    : expenses

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
          {sorted.map(e => <ExpenseCard key={e.id} expense={e} />)}
        </div>
      )}
    </div>
  )
}
