import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { Calendar, CheckCircle, XCircle, Clock, Umbrella, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { attendanceApi } from '@/api/attendance'
import { globalMastersApi } from '@/api/masters'
import type { Attendance } from '@/types'

function todayStr() { return format(new Date(), 'yyyy-MM-dd') }

function AttendanceBadge({ type }: { type: string }) {
  const t = type?.toLowerCase() ?? ''
  if (t.includes('present'))
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle size={11} />{type}</span>
  if (t.includes('absent'))
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={11} />{type}</span>
  if (t.includes('half'))
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full"><Clock size={11} />{type}</span>
  if (t.includes('leave'))
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Umbrella size={11} />{type}</span>
  return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{type}</span>
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === 'APPROVED')
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle size={10} />Approved</span>
  if (status === 'REJECTED')
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={10} />Rejected</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full"><AlertCircle size={10} />Pending Approval</span>
}

// ── Mark Today Dialog ─────────────────────────────────────────────────────────
function MarkTodayDialog({ open, onClose, attendanceTypes, leaveTypes }: {
  open: boolean
  onClose: () => void
  attendanceTypes: { id: number; name: string }[]
  leaveTypes: { id: number; name: string }[]
}) {
  const qc = useQueryClient()
  const [attendanceTypeId, setAttendanceTypeId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState('none')
  const [leaveReason, setLeaveReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [typeError, setTypeError] = useState('')

  function handleClose() {
    setAttendanceTypeId(''); setLeaveTypeId('none'); setLeaveReason(''); setRemarks(''); setTypeError('')
    onClose()
  }

  const mutation = useMutation({
    mutationFn: () => attendanceApi.markOwn({
      attendanceTypeId: Number(attendanceTypeId),
      leaveTypeId: leaveTypeId !== 'none' ? Number(leaveTypeId) : undefined,
      leaveReason: leaveReason || undefined,
      remarks: remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-attendance'] })
      toast.success('Attendance marked — pending admin approval')
      handleClose()
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to mark attendance')
    },
  })

  function handleSubmit() {
    if (!attendanceTypeId) { setTypeError('Select attendance type'); return }
    mutation.mutate()
  }

  const selectedType = attendanceTypes.find(t => String(t.id) === attendanceTypeId)
  const isLeave = selectedType?.name?.toLowerCase().includes('leave')

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark Today's Attendance</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Date</Label>
            <Input value={format(new Date(), 'dd MMM yyyy')} disabled className="mt-1 bg-gray-50" />
          </div>
          <div>
            <Label>Attendance Type <span className="text-red-500">*</span></Label>
            <Select value={attendanceTypeId} onValueChange={v => { setAttendanceTypeId(v); setTypeError('') }}>
              <SelectTrigger className={cn('mt-1', typeError && 'border-red-400')}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {attendanceTypes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {typeError && <p className="text-red-500 text-xs mt-1">{typeError}</p>}
          </div>
          {isLeave && (
            <>
              <div>
                <Label>Leave Type</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select leave type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {leaveTypes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Leave Reason</Label>
                <Input value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="mt-1" placeholder="Optional reason" />
              </div>
            </>
          )}
          <div>
            <Label>Remarks</Label>
            <Input value={remarks} onChange={e => setRemarks(e.target.value)} className="mt-1" placeholder="Optional" />
          </div>
          <p className="text-xs text-gray-400">Your attendance will be reviewed and approved by admin.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Marking…' : 'Mark Attendance'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function MyAttendancePage() {
  const [markOpen, setMarkOpen] = useState(false)

  const from = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const to   = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance', from, to],
    queryFn: () => attendanceApi.getMyAttendance(from, to),
  })
  const records: Attendance[] = data?.data ?? []

  const { data: attTypesData } = useQuery({ queryKey: ['attendance-types'], queryFn: globalMastersApi.getAttendanceTypes })
  const attendanceTypes = (attTypesData?.data ?? []) as { id: number; name: string }[]

  const { data: leaveTypesData } = useQuery({ queryKey: ['leave-types'], queryFn: globalMastersApi.getLeaveTypes })
  const leaveTypes = (leaveTypesData?.data ?? []) as { id: number; name: string }[]

  const todayRecord = records.find(r => r.attendanceDate === todayStr())
  const alreadyMarked = !!todayRecord

  const stats = records.reduce(
    (acc, r) => {
      const t = r.attendanceTypeName?.toLowerCase() ?? ''
      if (t.includes('present')) acc.present++
      else if (t.includes('absent')) acc.absent++
      else if (t.includes('half')) acc.half++
      else if (t.includes('leave')) acc.leave++
      if (r.approvalStatus === 'PENDING') acc.pending++
      return acc
    },
    { present: 0, absent: 0, half: 0, leave: 0, pending: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'MMMM yyyy')}</p>
      </div>

      {/* Today's status card */}
      <div className={cn(
        'rounded-xl border p-5 flex items-center justify-between',
        alreadyMarked ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center',
            alreadyMarked ? 'bg-green-100' : 'bg-orange-100')}>
            <Calendar size={20} className={alreadyMarked ? 'text-green-600' : 'text-orange-500'} />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Today — {format(new Date(), 'dd MMM yyyy, EEEE')}</p>
            {alreadyMarked ? (
              <div className="flex items-center gap-2 mt-0.5">
                <AttendanceBadge type={todayRecord.attendanceTypeName} />
                <ApprovalBadge status={todayRecord.approvalStatus} />
              </div>
            ) : (
              <p className="text-sm text-orange-600 mt-0.5">Not marked yet</p>
            )}
          </div>
        </div>
        {!alreadyMarked && (
          <Button onClick={() => setMarkOpen(true)}>
            <CheckCircle size={14} className="mr-1.5" />Mark Attendance
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Present',         value: stats.present, color: 'text-green-700',  bg: 'bg-green-50'  },
          { label: 'Absent',          value: stats.absent,  color: 'text-red-700',    bg: 'bg-red-50'    },
          { label: 'Half Day',        value: stats.half,    color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'Leave',           value: stats.leave,   color: 'text-blue-700',   bg: 'bg-blue-50'   },
          { label: 'Pending Approval',value: stats.pending, color: 'text-orange-700', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4', s.bg)}>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* History table */}
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">This Month's Records</h2>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : records.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-gray-400">
            <Calendar size={36} className="mb-3 text-gray-300" />
            <p>No attendance records this month</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Approval</th>
                  <th className="text-left px-5 py-3">Leave Type</th>
                  <th className="text-left px-5 py-3">Approved By</th>
                  <th className="text-left px-5 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {format(new Date(r.attendanceDate), 'dd MMM, EEE')}
                    </td>
                    <td className="px-5 py-3"><AttendanceBadge type={r.attendanceTypeName} /></td>
                    <td className="px-5 py-3"><ApprovalBadge status={r.approvalStatus} /></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.leaveTypeName ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.approvedByName ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MarkTodayDialog
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        attendanceTypes={attendanceTypes}
        leaveTypes={leaveTypes}
      />
    </div>
  )
}
