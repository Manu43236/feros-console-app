import { getApiError } from '@/lib/apiError'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'
import {
  CheckCircle, XCircle, Clock, Umbrella, Pencil,
  ClipboardList, Users, AlertCircle, Calendar, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cn } from '@/lib/utils'
import { attendanceApi, type AttendanceRequest, type BulkAttendanceEntry } from '@/api/attendance'
import { globalMastersApi } from '@/api/masters'
import { staffApi } from '@/api/staff'
import type { Attendance } from '@/types'

type StaffUser = { id: number; name: string; phone: string; role: string; isActive: boolean }

function todayStr() { return format(new Date(), 'yyyy-MM-dd') }

// ── Badges ────────────────────────────────────────────────────────────────────
function AttendanceBadge({ type }: { type: string }) {
  const t = type?.toLowerCase() ?? ''
  if (t.includes('present')) return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle size={11} />{type}</span>
  if (t.includes('absent'))  return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={11} />{type}</span>
  if (t.includes('half'))    return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full"><Clock size={11} />{type}</span>
  if (t.includes('leave'))   return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Umbrella size={11} />{type}</span>
  return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{type}</span>
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle size={10} />Approved</span>
  if (status === 'REJECTED') return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={10} />Rejected</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full"><AlertCircle size={10} />Pending</span>
}

// ── Mark dialog (single staff) ────────────────────────────────────────────────
function MarkDialog({
  open, onClose, user, record, attendanceTypes, leaveTypes,
}: {
  open: boolean; onClose: () => void
  user: StaffUser | null
  record?: Attendance
  attendanceTypes: { id: number; name: string }[]
  leaveTypes: { id: number; name: string }[]
}) {
  const qc = useQueryClient()
  const isEdit = !!record
  const [attendanceTypeId, setAttendanceTypeId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState('none')
  const [leaveReason, setLeaveReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [typeError, setTypeError] = useState('')

  useEffect(() => {
    if (open) {
      setAttendanceTypeId(record ? String(record.attendanceTypeId) : '')
      setLeaveTypeId(record?.leaveTypeId ? String(record.leaveTypeId) : 'none')
      setLeaveReason(record?.leaveReason ?? '')
      setRemarks(record?.remarks ?? '')
      setTypeError('')
    }
  }, [open, record?.id])

  const mutation = useMutation({
    mutationFn: () => {
      const payload: AttendanceRequest = {
        userId: user!.id,
        attendanceDate: todayStr(),
        attendanceTypeId: Number(attendanceTypeId),
        leaveTypeId: leaveTypeId !== 'none' ? Number(leaveTypeId) : undefined,
        leaveReason: leaveReason || undefined,
        remarks: remarks || undefined,
      }
      return isEdit ? attendanceApi.update(record!.id, payload) : attendanceApi.mark(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor-attendance-today'] })
      toast.success(isEdit ? 'Attendance updated' : 'Attendance marked')
      onClose()
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })

  const selectedType = attendanceTypes.find(t => String(t.id) === attendanceTypeId)
  const isLeave = selectedType?.name?.toLowerCase().includes('leave')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit' : 'Mark'} Attendance — {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Date</Label>
            <Input value={format(new Date(), 'dd MMM yyyy')} disabled className="mt-1 bg-gray-50" />
          </div>
          <div>
            <Label>Attendance Type <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={attendanceTypeId}
              onValueChange={v => { setAttendanceTypeId(v); setTypeError('') }}
              options={attendanceTypes.map(t => ({ value: String(t.id), label: t.name }))}
              placeholder="Select type"
              className="mt-1"
              triggerClassName={cn(typeError && 'border-red-400')}
            />
            {typeError && <p className="text-red-500 text-xs mt-1">{typeError}</p>}
          </div>
          {isLeave && (
            <>
              <div>
                <Label>Leave Type</Label>
                <SearchableSelect
                  value={leaveTypeId}
                  onValueChange={setLeaveTypeId}
                  options={[{ value: 'none', label: 'Not specified' }, ...leaveTypes.map(t => ({ value: String(t.id), label: t.name }))]}
                  placeholder="Select leave type"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Leave Reason</Label>
                <Input value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="mt-1" placeholder="Optional" />
              </div>
            </>
          )}
          <div>
            <Label>Remarks</Label>
            <Input value={remarks} onChange={e => setRemarks(e.target.value)} className="mt-1" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => { if (!attendanceTypeId) { setTypeError('Select attendance type'); return } mutation.mutate() }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Mark'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Bulk mark dialog ──────────────────────────────────────────────────────────
function BulkMarkDialog({
  open, onClose, users, attendanceTypes, leaveTypes, existingMap,
}: {
  open: boolean; onClose: () => void
  users: StaffUser[]
  attendanceTypes: { id: number; name: string }[]
  leaveTypes: { id: number; name: string }[]
  existingMap: Record<number, Attendance>
}) {
  const qc = useQueryClient()
  const [entries, setEntries] = useState<Record<number, { typeId: string; leaveTypeId: string }>>({})

  useEffect(() => {
    if (open) {
      const initial: Record<number, { typeId: string; leaveTypeId: string }> = {}
      users.forEach(u => {
        const ex = existingMap[u.id]
        initial[u.id] = { typeId: ex ? String(ex.attendanceTypeId) : '', leaveTypeId: ex?.leaveTypeId ? String(ex.leaveTypeId) : 'none' }
      })
      setEntries(initial)
    }
  }, [open, users.length])

  const mutation = useMutation({
    mutationFn: () => {
      const validEntries: BulkAttendanceEntry[] = Object.entries(entries)
        .filter(([, v]) => v.typeId)
        .map(([uid, v]) => ({
          userId: Number(uid),
          attendanceTypeId: Number(v.typeId),
          leaveTypeId: v.leaveTypeId !== 'none' ? Number(v.leaveTypeId) : undefined,
        }))
      return attendanceApi.markBulk({ attendanceDate: todayStr(), entries: validEntries })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supervisor-attendance-today'] })
      toast.success('Bulk attendance saved')
      onClose()
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })

  function setAll(typeId: string) {
    setEntries(prev => {
      const next = { ...prev }
      users.forEach(u => { next[u.id] = { typeId, leaveTypeId: 'none' } })
      return next
    })
  }

  const presentType = attendanceTypes.find(t => t.name.toLowerCase().includes('present') && !t.name.toLowerCase().includes('half'))
  const absentType  = attendanceTypes.find(t => t.name.toLowerCase().includes('absent'))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Mark Attendance — {format(new Date(), 'dd MMM yyyy')}</DialogTitle>
        </DialogHeader>
        <div className="pt-2 space-y-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600 mr-2">Mark all as:</span>
            {presentType && (
              <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => setAll(String(presentType.id))}>
                <CheckCircle size={13} className="mr-1" />Present
              </Button>
            )}
            {absentType && (
              <Button size="sm" variant="outline" className="text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => setAll(String(absentType.id))}>
                <XCircle size={13} className="mr-1" />Absent
              </Button>
            )}
          </div>
          <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
            {users.map(u => {
              const entry = entries[u.id] ?? { typeId: '', leaveTypeId: 'none' }
              const selType = attendanceTypes.find(t => String(t.id) === entry.typeId)
              const isLeave = selType?.name?.toLowerCase().includes('leave')
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.role}</p>
                  </div>
                  <SearchableSelect
                    value={entry.typeId}
                    onValueChange={v => setEntries(prev => ({ ...prev, [u.id]: { ...prev[u.id], typeId: v } }))}
                    options={attendanceTypes.map(t => ({ value: String(t.id), label: t.name }))}
                    placeholder="Select type"
                    className="w-36"
                    triggerClassName="h-8 text-xs"
                  />
                  {isLeave && (
                    <SearchableSelect
                      value={entry.leaveTypeId}
                      onValueChange={v => setEntries(prev => ({ ...prev, [u.id]: { ...prev[u.id], leaveTypeId: v } }))}
                      options={[{ value: 'none', label: 'Not specified' }, ...leaveTypes.map(t => ({ value: String(t.id), label: t.name }))]}
                      placeholder="Leave type"
                      className="w-36"
                      triggerClassName="h-8 text-xs"
                    />
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save All'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── My Attendance tab ─────────────────────────────────────────────────────────
function MyAttendanceTab({
  attendanceTypes, leaveTypes,
}: {
  attendanceTypes: { id: number; name: string }[]
  leaveTypes: { id: number; name: string }[]
}) {
  const qc = useQueryClient()
  const [markOpen, setMarkOpen] = useState(false)
  const from = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const to   = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance', from, to],
    queryFn: () => attendanceApi.getMyAttendance(from, to),
  })
  const records: Attendance[] = data?.data ?? []
  const todayRecord = records.find(r => r.attendanceDate === todayStr())
  const alreadyMarked = !!todayRecord

  const [attendanceTypeId, setAttendanceTypeId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState('none')
  const [leaveReason, setLeaveReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [typeError, setTypeError] = useState('')

  function resetDialog() {
    setAttendanceTypeId(''); setLeaveTypeId('none'); setLeaveReason(''); setRemarks(''); setTypeError('')
  }

  const markMutation = useMutation({
    mutationFn: () => attendanceApi.markOwn({
      attendanceTypeId: Number(attendanceTypeId),
      leaveTypeId: leaveTypeId !== 'none' ? Number(leaveTypeId) : undefined,
      leaveReason: leaveReason || undefined,
      remarks: remarks || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-attendance'] })
      toast.success('Attendance marked — pending admin approval')
      resetDialog(); setMarkOpen(false)
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })

  const selectedType = attendanceTypes.find(t => String(t.id) === attendanceTypeId)
  const isLeave = selectedType?.name?.toLowerCase().includes('leave')

  return (
    <div className="space-y-5">
      {/* Today card */}
      <div className={cn('rounded-xl border p-5 flex items-center justify-between',
        alreadyMarked ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200')}>
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

      {/* This month history */}
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">This Month — {format(new Date(), 'MMMM yyyy')}</h2>
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
                  <th className="text-left px-5 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{format(new Date(r.attendanceDate), 'dd MMM, EEE')}</td>
                    <td className="px-5 py-3"><AttendanceBadge type={r.attendanceTypeName} /></td>
                    <td className="px-5 py-3"><ApprovalBadge status={r.approvalStatus} /></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.leaveTypeName ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mark dialog */}
      <Dialog open={markOpen} onOpenChange={v => { if (!v) { resetDialog(); setMarkOpen(false) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Today's Attendance</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Date</Label>
              <Input value={format(new Date(), 'dd MMM yyyy')} disabled className="mt-1 bg-gray-50" />
            </div>
            <div>
              <Label>Attendance Type <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={attendanceTypeId}
                onValueChange={v => { setAttendanceTypeId(v); setTypeError('') }}
                options={attendanceTypes.map(t => ({ value: String(t.id), label: t.name }))}
                placeholder="Select type"
                className="mt-1"
                triggerClassName={cn(typeError && 'border-red-400')}
              />
              {typeError && <p className="text-red-500 text-xs mt-1">{typeError}</p>}
            </div>
            {isLeave && (
              <>
                <div>
                  <Label>Leave Type</Label>
                  <SearchableSelect
                    value={leaveTypeId}
                    onValueChange={setLeaveTypeId}
                    options={[{ value: 'none', label: 'Not specified' }, ...leaveTypes.map(t => ({ value: String(t.id), label: t.name }))]}
                    placeholder="Select leave type"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Leave Reason</Label>
                  <Input value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="mt-1" placeholder="Optional" />
                </div>
              </>
            )}
            <div>
              <Label>Remarks</Label>
              <Input value={remarks} onChange={e => setRemarks(e.target.value)} className="mt-1" placeholder="Optional" />
            </div>
            <p className="text-xs text-gray-400">Your attendance will be reviewed and approved by admin.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { resetDialog(); setMarkOpen(false) }}>Cancel</Button>
              <Button
                onClick={() => { if (!attendanceTypeId) { setTypeError('Select attendance type'); return } markMutation.mutate() }}
                disabled={markMutation.isPending}
              >
                {markMutation.isPending ? 'Marking…' : 'Mark Attendance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SupervisorAttendancePage() {
  type Tab = 'today' | 'present' | 'my'
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [todaySearch, setTodaySearch] = useState('')
  const [markUser, setMarkUser]   = useState<StaffUser | null>(null)
  const [editRecord, setEditRecord] = useState<Attendance | undefined>()
  const [bulkOpen, setBulkOpen]   = useState(false)

  const today = todayStr()

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['supervisor-attendance-today'],
    queryFn: () => attendanceApi.getByDate(today),
    enabled: activeTab === 'today' || activeTab === 'present',
  })
  const allRecords: Attendance[] = attendanceData?.data ?? []

  const { data: usersData } = useQuery({ queryKey: ['staff-users'], queryFn: () => staffApi.getUsers() })
  const crew: StaffUser[] = ((usersData?.data ?? []) as StaffUser[])
    .filter(u => u.isActive && (u.role === 'DRIVER' || u.role === 'CLEANER'))

  const { data: attTypesData } = useQuery({ queryKey: ['attendance-types'], queryFn: globalMastersApi.getAttendanceTypes })
  const attendanceTypes = (attTypesData?.data ?? []) as { id: number; name: string }[]

  const { data: leaveTypesData } = useQuery({ queryKey: ['leave-types'], queryFn: globalMastersApi.getLeaveTypes })
  const leaveTypes = (leaveTypesData?.data ?? []) as { id: number; name: string }[]

  // Only crew records (filter out any non-driver/cleaner)
  const crewIds = new Set(crew.map(u => u.id))
  const records = allRecords.filter(r => crewIds.has(r.userId))

  const existingMap: Record<number, Attendance> = {}
  records.forEach(r => { existingMap[r.userId] = r })

  const presentRecords = records.filter(r => r.attendanceTypeName?.toLowerCase().includes('present'))

  const stats = records.reduce(
    (acc, r) => {
      const t = r.attendanceTypeName?.toLowerCase() ?? ''
      if (t.includes('present')) acc.present++
      else if (t.includes('absent')) acc.absent++
      else if (t.includes('half')) acc.half++
      else if (t.includes('leave')) acc.leave++
      return acc
    },
    { present: 0, absent: 0, half: 0, leave: 0 }
  )
  const unmarked = crew.length - records.length

  const tabBtn = (tab: Tab, label: string, badge?: number) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative',
        activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-2 min-w-[18px] h-[18px] text-white text-[10px] font-bold rounded-full inline-flex items-center justify-center px-1 bg-orange-500">
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Today — {format(new Date(), 'dd MMMM yyyy, EEEE')}</p>
        </div>
        {activeTab === 'today' && (
          <div className="flex gap-2">
            <Button onClick={() => setBulkOpen(true)}>
              <ClipboardList size={14} className="mr-1.5" />Bulk Mark
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabBtn('today', "Today's Attendance", unmarked > 0 ? unmarked : undefined)}
        {tabBtn('present', 'Present')}
        {tabBtn('my', 'My Attendance')}
      </div>

      {/* My Attendance */}
      {activeTab === 'my' && (
        <MyAttendanceTab attendanceTypes={attendanceTypes} leaveTypes={leaveTypes} />
      )}

      {/* Present list */}
      {activeTab === 'present' && (
        <div className="border rounded-xl bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Present Today</h2>
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              {presentRecords.length} present
            </span>
          </div>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : presentRecords.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-gray-400">
              <Users size={36} className="mb-3 text-gray-300" />
              <p>No drivers or cleaners marked present yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="text-left px-5 py-3">Name</th>
                    <th className="text-left px-5 py-3">Role</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Approval</th>
                    <th className="text-left px-5 py-3">Marked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {presentRecords.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{r.userName}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{r.roleName}</td>
                      <td className="px-5 py-3"><AttendanceBadge type={r.attendanceTypeName} /></td>
                      <td className="px-5 py-3"><ApprovalBadge status={r.approvalStatus} /></td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{r.markedByName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Today's Attendance */}
      {activeTab === 'today' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total',    value: crew.length,    icon: Users,        color: 'text-gray-700',   bg: 'bg-white'     },
              { label: 'Present',  value: stats.present,  icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-50'  },
              { label: 'Absent',   value: stats.absent,   icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-50'    },
              { label: 'Half Day', value: stats.half,     icon: Clock,        color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'On Leave', value: stats.leave,    icon: Umbrella,     color: 'text-blue-700',   bg: 'bg-blue-50'   },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className={cn('rounded-xl border p-4', s.bg)}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={15} className={s.color} />
                    <span className="text-xs text-gray-500">{s.label}</span>
                  </div>
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                </div>
              )
            })}
          </div>

          {/* Table */}
          <div className="border rounded-xl bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-700 shrink-0">Drivers & Cleaners — {format(new Date(), 'dd MMM yyyy')}</h2>
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={todaySearch}
                  onChange={e => setTodaySearch(e.target.value)}
                  placeholder="Search by name…"
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {unmarked > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full shrink-0">
                  {unmarked} not marked
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                      <th className="text-left px-5 py-3">Name</th>
                      <th className="text-left px-5 py-3">Role</th>
                      <th className="text-left px-5 py-3">Status</th>
                      <th className="text-left px-5 py-3">Approval</th>
                      <th className="text-left px-5 py-3">Marked By</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {/* Marked rows */}
                    {records.filter(r => !todaySearch || r.userName?.toLowerCase().includes(todaySearch.toLowerCase())).map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{r.userName}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{r.roleName}</td>
                        <td className="px-5 py-3"><AttendanceBadge type={r.attendanceTypeName} /></td>
                        <td className="px-5 py-3"><ApprovalBadge status={r.approvalStatus} /></td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{r.markedByName ?? '—'}</td>
                        <td className="px-5 py-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => {
                              setEditRecord(r)
                              setMarkUser(crew.find(u => u.id === r.userId) ?? null)
                            }}>
                            <Pencil size={12} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {/* Unmarked rows */}
                    {crew.filter(u => !existingMap[u.id] && (!todaySearch || u.name?.toLowerCase().includes(todaySearch.toLowerCase()))).map(u => (
                      <tr key={`u-${u.id}`} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-700">{u.name}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{u.role}</td>
                        <td className="px-5 py-3"><span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not marked</span></td>
                        <td className="px-5 py-3 text-gray-400">—</td>
                        <td className="px-5 py-3 text-gray-400">—</td>
                        <td className="px-5 py-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditRecord(undefined); setMarkUser(u) }}>
                            <Pencil size={12} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {crew.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                          No drivers or cleaners found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Dialogs */}
      <MarkDialog
        open={!!markUser}
        onClose={() => { setMarkUser(null); setEditRecord(undefined) }}
        user={markUser}
        record={editRecord}
        attendanceTypes={attendanceTypes}
        leaveTypes={leaveTypes}
      />
      <BulkMarkDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        users={crew}
        attendanceTypes={attendanceTypes}
        leaveTypes={leaveTypes}
        existingMap={existingMap}
      />
    </div>
  )
}
