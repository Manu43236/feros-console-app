import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Plus, ChevronDown, ChevronRight, CheckCircle, XCircle,
  Banknote, TrendingUp, AlertCircle, Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { payrollApi } from '@/api/payroll'
import { staffApi } from '@/api/staff'
import type { Payroll, SalaryAdvance, PayrollStatus, PaymentMode } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────
type StaffUser = { id: number; name: string; role: string; isActive: boolean }

const STATUS_COLORS: Record<PayrollStatus, string> = {
  DRAFT:     'bg-gray-100 text-gray-700',
  APPROVED:  'bg-blue-50 text-blue-700',
  PAID:      'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function StatusBadge({ status }: { status: PayrollStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  )
}

// ── Generate Payroll Dialog ───────────────────────────────────────────────────
function GenerateDialog({ open, onClose, users }: {
  open: boolean; onClose: () => void; users: StaffUser[]
}) {
  const qc = useQueryClient()
  const [userId, setUserId]   = useState('')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')

  const mutation = useMutation({
    mutationFn: () => payrollApi.generate({ userId: Number(userId), payCycleStartDate: from, payCycleEndDate: to }),
    onSuccess: () => {
      toast.success('Payroll generated')
      qc.invalidateQueries({ queryKey: ['payrolls'] })
      onClose()
      setUserId(''); setFrom(''); setTo('')
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to generate'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !from || !to) return toast.error('All fields required')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Generate Payroll</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>Staff *</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name} — {u.role}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pay Cycle Start *</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Pay Cycle End *</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Approve Dialog ────────────────────────────────────────────────────────────
function ApproveDialog({ open, onClose, payroll }: {
  open: boolean; onClose: () => void; payroll: Payroll | null
}) {
  const qc = useQueryClient()
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH')
  const [ref, setRef]                 = useState('')
  const [remarks, setRemarks]         = useState('')

  const mutation = useMutation({
    mutationFn: () => payrollApi.approve(payroll!.id, { paymentDate, paymentMode, referenceNumber: ref || undefined, remarks: remarks || undefined }),
    onSuccess: () => {
      toast.success('Payroll approved & paid')
      qc.invalidateQueries({ queryKey: ['payrolls'] })
      onClose()
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Approve & Mark Paid</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          {payroll && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">{payroll.userName}</p>
              <p>Net Pay: <span className="font-bold">{fmt(payroll.netPay)}</span></p>
              <p className="text-xs text-blue-600">{payroll.payCycleStartDate} → {payroll.payCycleEndDate}</p>
            </div>
          )}
          <div>
            <Label>Payment Date *</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Payment Mode *</Label>
            <Select value={paymentMode} onValueChange={v => setPaymentMode(v as PaymentMode)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['CASH','CHEQUE','NEFT','UPI','RTGS'] as PaymentMode[]).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference Number</Label>
            <Input value={ref} onChange={e => setRef(e.target.value)} className="mt-1" placeholder="Optional" />
          </div>
          <div>
            <Label>Remarks</Label>
            <Input value={remarks} onChange={e => setRemarks(e.target.value)} className="mt-1" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Approve & Pay'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Payroll Detail Row ────────────────────────────────────────────────────────
function PayrollRow({ payroll, onApprove, onCancel }: {
  payroll: Payroll
  onApprove: (p: Payroll) => void
  onCancel: (p: Payroll) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const p = payroll

  return (
    <>
      <tr className="hover:bg-gray-50 border-b">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-gray-800">{p.userName}</p>
          <p className="text-xs text-gray-400">{p.roleName}</p>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">
          <span className="text-xs">{p.payCycleStartDate}</span>
          <span className="text-xs text-gray-400"> → </span>
          <span className="text-xs">{p.payCycleEndDate}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex justify-center gap-2 text-xs text-gray-500">
            <span className="text-green-600 font-medium">{p.presentDays}P</span>
            <span className="text-red-500">{p.absentDays}A</span>
            {p.halfDays > 0 && <span className="text-yellow-600">{p.halfDays}H</span>}
            {p.leaveDays > 0 && <span className="text-blue-500">{p.leaveDays}L</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(p.grossPay)}</td>
        <td className="px-4 py-3 text-right text-sm text-red-500">–{fmt(p.totalDeductions)}</td>
        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">{fmt(p.netPay)}</td>
        <td className="px-4 py-3"><StatusBadge status={p.payrollStatus} /></td>
        <td className="px-4 py-3">
          <div className="flex gap-1 justify-end">
            {p.payrollStatus === 'DRAFT' && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => onApprove(p)}>
                  <CheckCircle size={11} className="mr-1" />Approve
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => onCancel(p)}>
                  <XCircle size={11} className="mr-1" />Cancel
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b">
          <td colSpan={9} className="px-8 py-4">
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Earnings</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-gray-600">Basic Pay ({p.presentDays} + {p.halfDays}×0.5 days × ₹{p.dailyRate}/day)</span><span className="font-medium">{fmt(p.basicPay)}</span></div>
                  {p.overtimePay > 0 && <div className="flex justify-between"><span className="text-gray-600">Overtime ({p.overtimeHours}h)</span><span className="font-medium">{fmt(p.overtimePay)}</span></div>}
                  {p.tripBonus > 0 && <div className="flex justify-between"><span className="text-gray-600">Trip Bonus</span><span className="font-medium">{fmt(p.tripBonus)}</span></div>}
                  <div className="flex justify-between border-t pt-1 font-semibold"><span>Gross Pay</span><span>{fmt(p.grossPay)}</span></div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deductions</p>
                {p.deductions?.length > 0 ? (
                  <div className="space-y-1">
                    {p.deductions.map(d => (
                      <div key={d.id} className="flex justify-between">
                        <span className="text-gray-600">{d.deductionTypeName}</span>
                        <span className="font-medium text-red-600">–{fmt(d.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 font-semibold text-red-600">
                      <span>Total Deductions</span><span>–{fmt(p.totalDeductions)}</span>
                    </div>
                  </div>
                ) : <p className="text-gray-400 text-xs">No deductions</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Summary</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span className="text-gray-600">Net Pay</span><span className="font-bold text-lg text-gray-800">{fmt(p.netPay)}</span></div>
                  {p.paymentDate && <div className="flex justify-between"><span className="text-gray-600">Paid On</span><span>{p.paymentDate}</span></div>}
                  {p.paymentMode && <div className="flex justify-between"><span className="text-gray-600">Mode</span><span>{p.paymentMode}</span></div>}
                  {p.referenceNumber && <div className="flex justify-between"><span className="text-gray-600">Reference</span><span>{p.referenceNumber}</span></div>}
                  {p.approvedByName && <div className="flex justify-between"><span className="text-gray-600">Approved By</span><span>{p.approvedByName}</span></div>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Salary Advance Dialog ─────────────────────────────────────────────────────
function AdvanceDialog({ open, onClose, users }: {
  open: boolean; onClose: () => void; users: StaffUser[]
}) {
  const qc = useQueryClient()
  const [userId, setUserId]       = useState('')
  const [advanceDate, setDate]    = useState(format(new Date(), 'yyyy-MM-dd'))
  const [amount, setAmount]       = useState('')
  const [reason, setReason]       = useState('')

  const mutation = useMutation({
    mutationFn: () => payrollApi.createAdvance({ userId: Number(userId), advanceDate, amount: Number(amount), reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Salary advance created')
      qc.invalidateQueries({ queryKey: ['advances'] })
      onClose()
      setUserId(''); setAmount(''); setReason('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !amount || Number(amount) <= 0) return toast.error('Select staff and enter a valid amount')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Create Salary Advance</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label>Staff *</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name} — {u.role}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Advance Date *</Label>
            <Input type="date" value={advanceDate} onChange={e => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Amount (₹) *</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1" placeholder="0" min="1" />
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} className="mt-1" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function PayrollPage() {
  const qc = useQueryClient()
  const [tab, setTab]               = useState<'payrolls' | 'advances'>('payrolls')
  const [genOpen, setGenOpen]       = useState(false)
  const [approveTarget, setApprove] = useState<Payroll | null>(null)
  const [advOpen, setAdvOpen]       = useState(false)

  const { data: payrollsData, isLoading: loadingPayrolls } = useQuery({
    queryKey: ['payrolls'],
    queryFn: payrollApi.getAll,
  })
  const payrolls: Payroll[] = payrollsData?.data ?? []

  const { data: advancesData, isLoading: loadingAdvances } = useQuery({
    queryKey: ['advances'],
    queryFn: payrollApi.getAllAdvances,
  })
  const advances: SalaryAdvance[] = advancesData?.data ?? []

  const { data: usersData } = useQuery({ queryKey: ['staff-users'], queryFn: staffApi.getUsers })
  const users: StaffUser[] = (usersData?.data ?? []) as StaffUser[]

  const cancelMutation = useMutation({
    mutationFn: (id: number) => payrollApi.cancel(id),
    onSuccess: () => { toast.success('Payroll cancelled'); qc.invalidateQueries({ queryKey: ['payrolls'] }) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  // summary stats
  const totalNetPay = payrolls.filter(p => p.payrollStatus !== 'CANCELLED').reduce((s, p) => s + p.netPay, 0)
  const draftCount  = payrolls.filter(p => p.payrollStatus === 'DRAFT').length
  const paidCount   = payrolls.filter(p => p.payrollStatus === 'PAID').length
  const totalAdvOut = advances.filter(a => !a.isFullyRepaid).reduce((s, a) => s + a.balanceAmount, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff salaries and advances</p>
        </div>
        <div className="flex gap-2">
          {tab === 'payrolls' ? (
            <Button onClick={() => setGenOpen(true)}>
              <Plus size={14} className="mr-1.5" />Generate Payroll
            </Button>
          ) : (
            <Button onClick={() => setAdvOpen(true)}>
              <Plus size={14} className="mr-1.5" />New Advance
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Net Pay', value: fmt(totalNetPay), icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pending Approval', value: String(draftCount), icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Paid', value: String(paidCount), icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Outstanding Advances', value: fmt(totalAdvOut), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['payrolls', 'advances'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'payrolls' ? 'Payrolls' : 'Salary Advances'}
          </button>
        ))}
      </div>

      {/* Payrolls Tab */}
      {tab === 'payrolls' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingPayrolls ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : payrolls.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">No payrolls yet. Generate one to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pay Cycle</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Pay</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map(p => (
                  <PayrollRow
                    key={p.id}
                    payroll={p}
                    onApprove={setApprove}
                    onCancel={pr => {
                      if (confirm(`Cancel payroll for ${pr.userName}?`)) cancelMutation.mutate(pr.id)
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Advances Tab */}
      {tab === 'advances' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingAdvances ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : advances.length === 0 ? (
            <div className="py-12 text-center">
              <Banknote size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">No salary advances recorded.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Staff</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Repaid</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {advances.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{a.userName}</td>
                    <td className="px-5 py-3 text-gray-500">{a.advanceDate}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmt(a.amount)}</td>
                    <td className="px-5 py-3 text-right text-green-600">{fmt(a.totalRepaid)}</td>
                    <td className="px-5 py-3 text-right font-medium text-red-500">{fmt(a.balanceAmount)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.isFullyRepaid ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                        {a.isFullyRepaid ? 'Repaid' : 'Outstanding'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{a.reason ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{a.approvedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Dialogs */}
      <GenerateDialog open={genOpen} onClose={() => setGenOpen(false)} users={users} />
      <ApproveDialog open={!!approveTarget} onClose={() => setApprove(null)} payroll={approveTarget} />
      <AdvanceDialog open={advOpen} onClose={() => setAdvOpen(false)} users={users} />
    </div>
  )
}
