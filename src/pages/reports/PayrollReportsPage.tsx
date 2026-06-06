import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, DollarSign, BookOpen, TrendingDown, Users, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { reportsApi } from '@/api/reports'
import type {
  PayrollSummaryReportRow, SalaryRegisterRow,
  AdvanceRegisterRow, PayrollByRoleRow, PayrollYtdRow,
} from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]
const thisMonthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const currentYear = () => new Date().getFullYear()

// ── Tabs ───────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'summary',         label: 'Monthly Summary',  icon: DollarSign },
  { key: 'salary-register', label: 'Salary Register',  icon: BookOpen },
  { key: 'advances',        label: 'Advance Register', icon: TrendingDown },
  { key: 'by-role',         label: 'By Role',          icon: Users },
  { key: 'ytd',             label: 'Year-to-Date',     icon: CalendarRange },
] as const
type TabKey = typeof TABS[number]['key']
type DatePreset = 'this-month' | 'custom'

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  n != null ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    DRAFT: 'bg-gray-100 text-gray-600',
    CANCELLED: 'bg-red-100 text-red-600',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', map[s] ?? 'bg-gray-100 text-gray-600')}>
      {s}
    </span>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn('px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap', right && 'text-right')}>
      {children}
    </th>
  )
}
function Td({ children, right, muted }: { children: React.ReactNode; right?: boolean; muted?: boolean }) {
  return (
    <td className={cn('px-3 py-2 text-sm whitespace-nowrap', right && 'text-right', muted && 'text-gray-400')}>
      {children}
    </td>
  )
}

// ── Export button ──────────────────────────────────────────────────────────────
function ExportBtn({ onExport, loading }: { onExport: (f: 'csv' | 'pdf') => void; loading?: boolean }) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => onExport('csv')} disabled={loading}>
        <Download className="h-3.5 w-3.5 mr-1" /> CSV
      </Button>
      <Button size="sm" variant="outline" onClick={() => onExport('pdf')} disabled={loading}>
        <Download className="h-3.5 w-3.5 mr-1" /> PDF
      </Button>
    </div>
  )
}

// ── Bank details cell ──────────────────────────────────────────────────────────
function BankCell({ row }: { row: { bankName?: string | null; accountNumber?: string | null; ifscCode?: string | null; accountHolderName?: string | null } }) {
  if (!row.bankName && !row.accountNumber) return <td className="px-3 py-2 text-sm text-gray-400">—</td>
  return (
    <td className="px-3 py-2 text-sm">
      <div className="font-medium">{row.accountHolderName || '—'}</div>
      <div className="text-xs text-gray-500">{row.bankName} · {row.accountNumber}</div>
      <div className="text-xs text-gray-400">{row.ifscCode}</div>
    </td>
  )
}

// ── Monthly Summary Tab ────────────────────────────────────────────────────────
function SummaryTab() {
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [start, setStart] = useState(thisMonthStart())
  const [end, setEnd] = useState(todayStr())
  const [exportLoading, setExportLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-summary', start, end],
    queryFn: () => reportsApi.getPayrollSummary(start, end),
  })
  const rows: PayrollSummaryReportRow[] = data?.data ?? []

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportLoading(true)
    try { await reportsApi.exportPayrollSummary(start, end, format) }
    catch { toast.error('Export failed') }
    finally { setExportLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(['this-month', 'custom'] as DatePreset[]).map(p => (
            <button key={p} onClick={() => {
              setPreset(p)
              if (p === 'this-month') { setStart(thisMonthStart()); setEnd(todayStr()) }
            }} className={cn('px-3 py-1.5 rounded text-sm font-medium border transition-colors', preset === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>
              {p === 'this-month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-40" />
            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-40" />
          </>
        )}
        <ExportBtn onExport={handleExport} loading={exportLoading} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Employee</Th><Th>Role</Th><Th>Designation</Th>
              <Th>Pay Cycle</Th>
              <Th right>Present</Th><Th right>Absent</Th>
              <Th right>Gross Pay</Th><Th right>Deductions</Th><Th right>Net Pay</Th>
              <Th>Status</Th><Th>Mode</Th>
              <Th>Bank Details</Th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-sm text-gray-400">No payroll records found for this period.</td></tr>
            ) : rows.map(r => (
              <tr key={r.payrollId} className="hover:bg-gray-50">
                <Td><span className="font-medium">{r.employeeName}</span></Td>
                <Td muted>{r.role}</Td>
                <Td muted>{r.designation}</Td>
                <Td muted><span className="text-xs">{r.payCycleStart} → {r.payCycleEnd}</span></Td>
                <Td right>{r.presentDays}</Td>
                <Td right>{r.absentDays}</Td>
                <Td right>{fmt(r.grossPay)}</Td>
                <Td right><span className="text-red-600">{fmt(r.totalDeductions)}</span></Td>
                <Td right><span className="font-semibold text-green-700">{fmt(r.netPay)}</span></Td>
                <Td>{statusBadge(r.payrollStatus)}</Td>
                <Td muted>{r.paymentMode !== '—' ? r.paymentMode : '—'}</Td>
                <BankCell row={r} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Salary Register Tab ────────────────────────────────────────────────────────
function SalaryRegisterTab() {
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [start, setStart] = useState(thisMonthStart())
  const [end, setEnd] = useState(todayStr())
  const [exportLoading, setExportLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['salary-register', start, end],
    queryFn: () => reportsApi.getSalaryRegister(start, end),
  })
  const rows: SalaryRegisterRow[] = data?.data ?? []

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportLoading(true)
    try { await reportsApi.exportSalaryRegister(start, end, format) }
    catch { toast.error('Export failed') }
    finally { setExportLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(['this-month', 'custom'] as DatePreset[]).map(p => (
            <button key={p} onClick={() => {
              setPreset(p)
              if (p === 'this-month') { setStart(thisMonthStart()); setEnd(todayStr()) }
            }} className={cn('px-3 py-1.5 rounded text-sm font-medium border transition-colors', preset === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>
              {p === 'this-month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-40" />
            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-40" />
          </>
        )}
        <ExportBtn onExport={handleExport} loading={exportLoading} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Employee</Th><Th>Role</Th><Th>Pay Cycle</Th>
              <Th right>Days</Th><Th right>Daily Rate</Th>
              <Th right>Basic</Th><Th right>OT</Th><Th right>Bonus</Th><Th right>Extra</Th>
              <Th right>Gross</Th>
              <Th>Deductions Detail</Th>
              <Th right>Deductions</Th><Th right>Net Pay</Th>
              <Th>Status</Th><Th>Reference</Th>
              <Th>Bank Details</Th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-sm text-gray-400">No records found.</td></tr>
            ) : rows.map(r => (
              <tr key={r.payrollId} className="hover:bg-gray-50">
                <Td><span className="font-medium">{r.employeeName}</span></Td>
                <Td muted>{r.role}</Td>
                <Td muted><span className="text-xs">{r.payCycleStart} → {r.payCycleEnd}</span></Td>
                <Td right>{r.presentDays}/{r.totalDays}</Td>
                <Td right muted>{fmt(r.dailyRate)}</Td>
                <Td right>{fmt(r.basicPay)}</Td>
                <Td right muted>{fmt(r.overtimePay)}</Td>
                <Td right muted>{fmt(r.tripBonus)}</Td>
                <Td right muted>{fmt(r.vehicleExtraPay)}</Td>
                <Td right><span className="font-medium">{fmt(r.grossPay)}</span></Td>
                <Td><span className="text-xs text-gray-500 max-w-[180px] truncate block">{r.deductionsDetail}</span></Td>
                <Td right><span className="text-red-600">{fmt(r.totalDeductions)}</span></Td>
                <Td right><span className="font-semibold text-green-700">{fmt(r.netPay)}</span></Td>
                <Td>{statusBadge(r.payrollStatus)}</Td>
                <Td muted>{r.referenceNumber || '—'}</Td>
                <BankCell row={r} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Advance Register Tab ───────────────────────────────────────────────────────
function AdvancesTab() {
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [start, setStart] = useState(thisMonthStart())
  const [end, setEnd] = useState(todayStr())
  const [exportLoading, setExportLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['advance-register', start, end],
    queryFn: () => reportsApi.getAdvanceRegister(start, end),
  })
  const rows: AdvanceRegisterRow[] = data?.data ?? []

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportLoading(true)
    try { await reportsApi.exportAdvanceRegister(start, end, format) }
    catch { toast.error('Export failed') }
    finally { setExportLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(['this-month', 'custom'] as DatePreset[]).map(p => (
            <button key={p} onClick={() => {
              setPreset(p)
              if (p === 'this-month') { setStart(thisMonthStart()); setEnd(todayStr()) }
            }} className={cn('px-3 py-1.5 rounded text-sm font-medium border transition-colors', preset === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>
              {p === 'this-month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-40" />
            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-40" />
          </>
        )}
        <ExportBtn onExport={handleExport} loading={exportLoading} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Employee</Th><Th>Role</Th><Th>Date</Th>
              <Th right>Amount</Th><Th right>Repaid</Th><Th right>Balance</Th>
              <Th>Status</Th><Th>Reason</Th><Th>Approved By</Th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400">No advances found for this period.</td></tr>
            ) : rows.map(r => (
              <tr key={r.advanceId} className="hover:bg-gray-50">
                <Td><span className="font-medium">{r.employeeName}</span></Td>
                <Td muted>{r.role}</Td>
                <Td muted>{r.advanceDate}</Td>
                <Td right>{fmt(r.amount)}</Td>
                <Td right muted>{fmt(r.totalRepaid)}</Td>
                <Td right>
                  <span className={cn('font-semibold', r.fullyRepaid ? 'text-green-600' : 'text-orange-600')}>
                    {fmt(r.balanceAmount)}
                  </span>
                </Td>
                <Td>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', r.fullyRepaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                    {r.fullyRepaid ? 'Cleared' : 'Outstanding'}
                  </span>
                </Td>
                <Td muted>{r.reason || '—'}</Td>
                <Td muted>{r.approvedBy}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── By Role Tab ────────────────────────────────────────────────────────────────
function ByRoleTab() {
  const [preset, setPreset] = useState<DatePreset>('this-month')
  const [start, setStart] = useState(thisMonthStart())
  const [end, setEnd] = useState(todayStr())
  const [exportLoading, setExportLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-by-role', start, end],
    queryFn: () => reportsApi.getPayrollByRole(start, end),
  })
  const rows: PayrollByRoleRow[] = data?.data ?? []

  const totalNet = rows.reduce((s, r) => s + (r.totalNetPay ?? 0), 0)

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportLoading(true)
    try { await reportsApi.exportPayrollByRole(start, end, format) }
    catch { toast.error('Export failed') }
    finally { setExportLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(['this-month', 'custom'] as DatePreset[]).map(p => (
            <button key={p} onClick={() => {
              setPreset(p)
              if (p === 'this-month') { setStart(thisMonthStart()); setEnd(todayStr()) }
            }} className={cn('px-3 py-1.5 rounded text-sm font-medium border transition-colors', preset === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>
              {p === 'this-month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-40" />
            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-40" />
          </>
        )}
        <ExportBtn onExport={handleExport} loading={exportLoading} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Role</Th>
              <Th right>Employees</Th>
              <Th right>Total Gross</Th>
              <Th right>Total Deductions</Th>
              <Th right>Total Net Pay</Th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">No data for this period.</td></tr>
            ) : rows.map(r => (
              <tr key={r.role} className="hover:bg-gray-50">
                <Td><span className="font-medium">{r.role}</span></Td>
                <Td right>{r.employeeCount}</Td>
                <Td right>{fmt(r.totalGrossPay)}</Td>
                <Td right><span className="text-red-600">{fmt(r.totalDeductions)}</span></Td>
                <Td right><span className="font-semibold text-green-700">{fmt(r.totalNetPay)}</span></Td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={4} className="px-3 py-2 text-sm text-right text-gray-700">Grand Total Net Pay</td>
                <td className="px-3 py-2 text-sm text-right text-green-700">{fmt(totalNet)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── YTD Tab ────────────────────────────────────────────────────────────────────
function YtdTab() {
  const [year, setYear] = useState(currentYear())
  const [exportLoading, setExportLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-ytd', year],
    queryFn: () => reportsApi.getPayrollYtd(year),
  })
  const rows: PayrollYtdRow[] = data?.data ?? []

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportLoading(true)
    try { await reportsApi.exportPayrollYtd(year, format) }
    catch { toast.error('Export failed') }
    finally { setExportLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Financial Year:</span>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            {[currentYear(), currentYear() - 1, currentYear() - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <ExportBtn onExport={handleExport} loading={exportLoading} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Employee</Th><Th>Role</Th><Th>Designation</Th>
              <Th right>Present Days</Th>
              <Th right>Total Gross</Th><Th right>Total Deductions</Th><Th right>Total Net Pay</Th>
              <Th>Bank Details</Th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">No payroll data for {year}.</td></tr>
            ) : rows.map(r => (
              <tr key={r.employeeName} className="hover:bg-gray-50">
                <Td><span className="font-medium">{r.employeeName}</span></Td>
                <Td muted>{r.role}</Td>
                <Td muted>{r.designation}</Td>
                <Td right>{r.totalPresentDays}</Td>
                <Td right>{fmt(r.totalGrossPay)}</Td>
                <Td right><span className="text-red-600">{fmt(r.totalDeductions)}</span></Td>
                <Td right><span className="font-semibold text-green-700">{fmt(r.totalNetPay)}</span></Td>
                <BankCell row={r} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function PayrollReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('summary')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Payroll summaries, salary register, advances, and year-to-date data</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'summary'         && <SummaryTab />}
        {activeTab === 'salary-register' && <SalaryRegisterTab />}
        {activeTab === 'advances'        && <AdvancesTab />}
        {activeTab === 'by-role'         && <ByRoleTab />}
        {activeTab === 'ytd'             && <YtdTab />}
      </div>
    </div>
  )
}
