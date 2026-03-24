import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format, subDays } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarDays, ChevronLeft, ChevronRight, Users,
  CheckCircle, XCircle, Clock, Umbrella, Pencil, ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { attendanceApi, type AttendanceRequest, type BulkAttendanceEntry } from '@/api/attendance'
import { globalMastersApi } from '@/api/masters'
import { staffApi } from '@/api/staff'
import type { Attendance } from '@/types'

type StaffUser = { id: number; name: string; phone: string; role: string; isActive: boolean }

// ── helpers ───────────────────────────────────────────────────────────────────
const STAFF_ROLES = ['DRIVER', 'CLEANER', 'SUPERVISOR', 'OFFICE_STAFF']
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

// ── Single mark / edit dialog ─────────────────────────────────────────────────
function AttendanceDialog({
  open, onClose, date, record, users, attendanceTypes, leaveTypes,
}: {
  open: boolean; onClose: () => void; date: string
  record?: Attendance
  users: StaffUser[]
  attendanceTypes: { id: number; name: string }[]
  leaveTypes: { id: number; name: string }[]
}) {
  const qc = useQueryClient()
  const isEdit = !!record
  const [userId, setUserId] = useState('')
  const [attendanceTypeId, setAttendanceTypeId] = useState('')
  const [leaveTypeId, setLeaveTypeId] = useState('none')
  const { register, handleSubmit, reset } = useForm<{ leaveReason?: string; remarks?: string }>()

  useEffect(() => {
    if (open) {
      setUserId(record ? String(record.userId) : '')
      setAttendanceTypeId(record ? String(record.attendanceTypeId) : '')
      setLeaveTypeId(record?.leaveTypeId ? String(record.leaveTypeId) : 'none')
      reset({ leaveReason: record?.leaveReason ?? '', remarks: record?.remarks ?? '' })
    }
  }, [open, record?.id])

  const mutation = useMutation({
    mutationFn: (d: AttendanceRequest) =>
      isEdit ? attendanceApi.update(record!.id, d) : attendanceApi.mark(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', date] })
      toast.success(isEdit ? 'Attendance updated' : 'Attendance marked')
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to save attendance')
    },
  })

  function onSubmit(d: { leaveReason?: string; remarks?: string }) {
    if (!userId || !attendanceTypeId) { toast.error('User and attendance type are required'); return }
    mutation.mutate({
      userId: Number(userId),
      attendanceDate: date,
      attendanceTypeId: Number(attendanceTypeId),
      leaveTypeId: leaveTypeId !== 'none' ? Number(leaveTypeId) : undefined,
      leaveReason: d.leaveReason || undefined,
      remarks: d.remarks || undefined,
    })
  }

  const selectedType = attendanceTypes.find(t => String(t.id) === attendanceTypeId)
  const isLeave = selectedType?.name?.toLowerCase().includes('leave')

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Attendance' : 'Mark Attendance'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div>
            <Label>Date</Label>
            <Input value={date} disabled className="mt-1 bg-gray-50" />
          </div>
          <div>
            <Label>Staff *</Label>
            <Select value={userId} onValueChange={setUserId} disabled={isEdit}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name} — {u.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Attendance Type *</Label>
            <Select value={attendanceTypeId} onValueChange={setAttendanceTypeId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {attendanceTypes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
                <Input {...register('leaveReason')} className="mt-1" placeholder="Optional reason" />
              </div>
            </>
          )}
          <div>
            <Label>Remarks</Label>
            <Input {...register('remarks')} className="mt-1" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Mark'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Bulk mark dialog ──────────────────────────────────────────────────────────
function BulkMarkDialog({
  open, onClose, date, users, attendanceTypes, leaveTypes, existingMap,
}: {
  open: boolean; onClose: () => void; date: string
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
        initial[u.id] = {
          typeId: ex ? String(ex.attendanceTypeId) : '',
          leaveTypeId: ex?.leaveTypeId ? String(ex.leaveTypeId) : 'none',
        }
      })
      setEntries(initial)
    }
  }, [open, users.length, date])

  const mutation = useMutation({
    mutationFn: () => {
      const validEntries: BulkAttendanceEntry[] = Object.entries(entries)
        .filter(([, v]) => v.typeId)
        .map(([uid, v]) => ({
          userId: Number(uid),
          attendanceTypeId: Number(v.typeId),
          leaveTypeId: v.leaveTypeId !== 'none' ? Number(v.leaveTypeId) : undefined,
        }))
      return attendanceApi.markBulk({ attendanceDate: date, entries: validEntries })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', date] })
      toast.success('Bulk attendance saved')
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to save')
    },
  })

  function setAll(typeId: string) {
    setEntries(prev => {
      const next = { ...prev }
      users.forEach(u => { next[u.id] = { typeId, leaveTypeId: 'none' } })
      return next
    })
  }

  const presentType = attendanceTypes.find(t => t.name.toLowerCase().includes('present'))
  const absentType  = attendanceTypes.find(t => t.name.toLowerCase().includes('absent'))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Mark Attendance — {date}</DialogTitle>
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

          <div className="border rounded-lg divide-y">
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
                  <Select
                    value={entry.typeId}
                    onValueChange={v => setEntries(prev => ({ ...prev, [u.id]: { ...prev[u.id], typeId: v } }))}
                  >
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {attendanceTypes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isLeave && (
                    <Select
                      value={entry.leaveTypeId}
                      onValueChange={v => setEntries(prev => ({ ...prev, [u.id]: { ...prev[u.id], leaveTypeId: v } }))}
                    >
                      <SelectTrigger className="h-8 text-xs w-36">
                        <SelectValue placeholder="Leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {leaveTypes.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
            })}
            {users.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No staff found</div>
            )}
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

// ── Staff history dialog ──────────────────────────────────────────────────────
function StaffHistoryDialog({
  open, onClose, user,
}: {
  open: boolean; onClose: () => void; user: StaffUser | null
}) {
  const [from, setFrom] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]     = useState(todayStr)

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-user', user?.id, from, to],
    queryFn: () => attendanceApi.getByUser(user!.id, from, to),
    enabled: !!user && open,
  })
  const records = data?.data ?? []

  const summary = records.reduce(
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{user?.name} — Attendance History</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1" />
            </div>
            <div className="flex-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Present',  value: summary.present, color: 'text-green-700 bg-green-50'  },
              { label: 'Absent',   value: summary.absent,  color: 'text-red-700 bg-red-50'      },
              { label: 'Half Day', value: summary.half,    color: 'text-yellow-700 bg-yellow-50'},
              { label: 'Leave',    value: summary.leave,   color: 'text-blue-700 bg-blue-50'    },
            ].map(s => (
              <div key={s.label} className={cn('rounded-lg p-3 text-center', s.color)}>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs">{s.label}</p>
              </div>
            ))}
          </div>
          {isLoading ? (
            <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
          ) : records.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">No records in this range</div>
          ) : (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-700">{r.attendanceDate}</span>
                  <div className="flex items-center gap-3">
                    <AttendanceBadge type={r.attendanceTypeName} />
                    {r.leaveTypeName && <span className="text-xs text-gray-500">{r.leaveTypeName}</span>}
                    {r.remarks && <span className="text-xs text-gray-400 truncate max-w-[120px]">{r.remarks}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [markOpen, setMarkOpen]         = useState(false)
  const [bulkOpen, setBulkOpen]         = useState(false)
  const [editRecord, setEditRecord]     = useState<Attendance | undefined>()
  const [historyUser, setHistoryUser]   = useState<StaffUser | null>(null)

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance', selectedDate],
    queryFn: () => attendanceApi.getByDate(selectedDate),
  })
  const records = attendanceData?.data ?? []

  const { data: usersData } = useQuery({
    queryKey: ['staff-users'],
    queryFn: staffApi.getUsers,
  })
  const allUsers: StaffUser[] = ((usersData?.data ?? []) as StaffUser[]).filter(u => STAFF_ROLES.includes(u.role ?? ''))

  const { data: attTypesData } = useQuery({ queryKey: ['attendance-types'], queryFn: globalMastersApi.getAttendanceTypes })
  const attendanceTypes = (attTypesData?.data ?? []) as { id: number; name: string }[]

  const { data: leaveTypesData } = useQuery({ queryKey: ['leave-types'], queryFn: globalMastersApi.getLeaveTypes })
  const leaveTypes = (leaveTypesData?.data ?? []) as { id: number; name: string }[]

  const existingMap: Record<number, Attendance> = {}
  records.forEach(r => { existingMap[r.userId] = r })

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
  const unmarked = allUsers.length - records.length

  function shiftDay(delta: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(format(d, 'yyyy-MM-dd'))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track daily attendance for all staff</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditRecord(undefined); setMarkOpen(true) }}>
            <Pencil size={14} className="mr-1.5" />Mark Single
          </Button>
          <Button onClick={() => setBulkOpen(true)}>
            <ClipboardList size={14} className="mr-1.5" />Bulk Mark
          </Button>
        </div>
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}><ChevronLeft size={16} /></Button>
        <div className="flex items-center gap-2 border rounded-lg px-4 py-2 bg-white">
          <CalendarDays size={16} className="text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-sm font-medium text-gray-800 border-none outline-none bg-transparent"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => shiftDay(1)}><ChevronRight size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayStr())} className="text-xs text-gray-500">
          Today
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Staff', value: allUsers.length, icon: Users,       color: 'text-gray-700',   bg: 'bg-white'       },
          { label: 'Present',     value: stats.present,  icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-50'    },
          { label: 'Absent',      value: stats.absent,   icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-50'      },
          { label: 'Half Day',    value: stats.half,     icon: Clock,        color: 'text-yellow-700', bg: 'bg-yellow-50'   },
          { label: 'On Leave',    value: stats.leave,    icon: Umbrella,     color: 'text-blue-700',   bg: 'bg-blue-50'     },
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
        <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Attendance for {selectedDate}</h2>
          {unmarked > 0 && (
            <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
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
                  <th className="text-left px-5 py-3">Staff</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Leave Type</th>
                  <th className="text-left px-5 py-3">Remarks</th>
                  <th className="text-left px-5 py-3">Marked By</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{r.userName}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.roleName}</td>
                    <td className="px-5 py-3"><AttendanceBadge type={r.attendanceTypeName} /></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.leaveTypeName ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs max-w-[160px] truncate">{r.remarks || '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.markedByName}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditRecord(r); setMarkOpen(true) }}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500"
                          onClick={() => setHistoryUser(allUsers.find(u => u.id === r.userId) ?? null)}>
                          <CalendarDays size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {allUsers.filter(u => !existingMap[u.id]).map(u => (
                  <tr key={`u-${u.id}`} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{u.name}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{u.role}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not marked</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">—</td>
                    <td className="px-5 py-3 text-gray-400">—</td>
                    <td className="px-5 py-3 text-gray-400">—</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditRecord(undefined); setMarkOpen(true) }}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500"
                          onClick={() => setHistoryUser(u)}>
                          <CalendarDays size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {allUsers.length === 0 && records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                      No staff found. Add staff from the Staff module first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AttendanceDialog
        open={markOpen}
        onClose={() => { setMarkOpen(false); setEditRecord(undefined) }}
        date={selectedDate}
        record={editRecord}
        users={allUsers}
        attendanceTypes={attendanceTypes}
        leaveTypes={leaveTypes}
      />
      <BulkMarkDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        date={selectedDate}
        users={allUsers}
        attendanceTypes={attendanceTypes}
        leaveTypes={leaveTypes}
        existingMap={existingMap}
      />
      <StaffHistoryDialog
        open={!!historyUser}
        onClose={() => setHistoryUser(null)}
        user={historyUser}
      />
    </div>
  )
}
