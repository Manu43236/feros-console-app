import { getApiError } from '@/lib/apiError'
import { useState, useEffect } from 'react'
import { useSubscription } from '@/context/SubscriptionContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarDays, ChevronLeft, ChevronRight, Users,
  CheckCircle, XCircle, Clock, Umbrella, Pencil, ClipboardList,
  AlertCircle, Camera, Calendar, LogIn, LogOut, Timer, Search, MapPin,
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
import { useAuthStore } from '@/store/authStore'
import type { Attendance } from '@/types'

type StaffUser = { id: number; name: string; phone: string; role: string; isActive: boolean }

const ATTENDANCE_ROLES = ['DRIVER', 'CLEANER', 'SUPERVISOR', 'OFFICE_STAFF', 'SERVICE_MANAGER', 'STORE_KEEPER', 'TECHNICIAN']
const PAGE_SIZE = 20
function todayStr() { return format(new Date(), 'yyyy-MM-dd') }

// ── Shared Badges ─────────────────────────────────────────────────────────────
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
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full"><AlertCircle size={10} />Pending</span>
}

// ── Selfie dialog ─────────────────────────────────────────────────────────────
function SelfieDialog({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xs p-3">
        <DialogHeader><DialogTitle className="text-sm">Attendance Selfie</DialogTitle></DialogHeader>
        <img src={url} alt="Selfie" className="w-full rounded-lg object-cover" />
      </DialogContent>
    </Dialog>
  )
}

// ── Map Modal ─────────────────────────────────────────────────────────────────
function MapModal({ coords, onClose }: { coords: { lat: number; lng: number } | null; onClose: () => void }) {
  if (!coords) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl overflow-hidden shadow-xl w-[90vw] max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-medium text-sm text-gray-700">Check-in Location</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <iframe
          src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
          width="100%"
          height="350"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  )
}

// ── My Attendance Tab (self-service) ──────────────────────────────────────────
function MyAttendanceTab({
  attendanceTypes, leaveTypes,
}: {
  attendanceTypes: { id: number; name: string }[]
  leaveTypes: { id: number; name: string }[]
}) {
  const qc = useQueryClient()
  const [markOpen, setMarkOpen] = useState(false)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const from = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const to   = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance', from, to],
    queryFn: () => attendanceApi.getMyAttendance(from, to),
  })
  const records: Attendance[] = data?.data ?? []
  const totalMyPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const myPageRows   = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
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

  // ── Mark Today dialog (inline) ──
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
      resetDialog()
      setMarkOpen(false)
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed to mark attendance') ?? 'Failed'),
  })

  const selectedType = attendanceTypes.find(t => String(t.id) === attendanceTypeId)
  const isLeave = selectedType?.name?.toLowerCase().includes('leave')

  return (
    <div className="space-y-5">
      {/* Today card */}
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
          { label: 'Present',          value: stats.present, color: 'text-green-700',  bg: 'bg-green-50'  },
          { label: 'Absent',           value: stats.absent,  color: 'text-red-700',    bg: 'bg-red-50'    },
          { label: 'Half Day',         value: stats.half,    color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'Leave',            value: stats.leave,   color: 'text-blue-700',   bg: 'bg-blue-50'   },
          { label: 'Pending Approval', value: stats.pending, color: 'text-orange-700', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4', s.bg)}>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* History table */}
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">This Month's Records — {format(new Date(), 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-xs">{page + 1} / {totalMyPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalMyPages - 1}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : records.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-gray-400">
            <Calendar size={36} className="mb-3 text-gray-300" />
            <p>No attendance records this month</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-18rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="text-left px-5 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Type</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Approval</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Leave Type</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Approved By</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {myPageRows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {format(new Date(r.attendanceDate), 'dd MMM, EEE')}
                        {r.selfieUrl && (
                          <button onClick={() => setSelfieUrl(r.selfieUrl!)} className="text-gray-400 hover:text-blue-500 transition-colors" title="View selfie">
                            <Camera size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap"><AttendanceBadge type={r.attendanceTypeName} /></td>
                    <td className="px-5 py-3 whitespace-nowrap"><ApprovalBadge status={r.approvalStatus} /></td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.leaveTypeName ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.approvedByName ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mark Today dialog */}
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
              <Button variant="outline" onClick={() => { resetDialog(); setMarkOpen(false) }}>Cancel</Button>
              <Button onClick={() => { if (!attendanceTypeId) { setTypeError('Select attendance type'); return } markMutation.mutate() }} disabled={markMutation.isPending}>
                {markMutation.isPending ? 'Marking…' : 'Mark Attendance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selfieUrl && <SelfieDialog url={selfieUrl} onClose={() => setSelfieUrl(null)} />}
    </div>
  )
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
  const [selectErrors, setSelectErrors] = useState({ userId: '', attendanceTypeId: '' })
  const { register, handleSubmit, reset } = useForm<{ leaveReason?: string; remarks?: string }>()

  useEffect(() => {
    if (open) {
      setUserId(record ? String(record.userId) : '')
      setAttendanceTypeId(record ? String(record.attendanceTypeId) : '')
      setLeaveTypeId(record?.leaveTypeId ? String(record.leaveTypeId) : 'none')
      setSelectErrors({ userId: '', attendanceTypeId: '' })
      reset({ leaveReason: record?.leaveReason ?? '', remarks: record?.remarks ?? '' })
    }
  }, [open, record?.id])

  const mutation = useMutation({
    mutationFn: (d: AttendanceRequest) =>
      isEdit ? attendanceApi.update(record!.id, d) : attendanceApi.mark(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', date] })
      qc.invalidateQueries({ queryKey: ['attendance-pending'] })
      toast.success(isEdit ? 'Attendance updated' : 'Attendance marked')
      onClose()
    },
    onError: (e: unknown) => {
      toast.error(getApiError(e, 'Failed to save attendance') ?? 'Failed to save attendance')
    },
  })

  function onSubmit(d: { leaveReason?: string; remarks?: string }) {
    const errs = {
      userId: !userId ? 'Select a staff member' : '',
      attendanceTypeId: !attendanceTypeId ? 'Select attendance type' : '',
    }
    setSelectErrors(errs)
    if (errs.userId || errs.attendanceTypeId) return
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
            <Label>Staff <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={userId}
              onValueChange={v => { setUserId(v); setSelectErrors(e => ({ ...e, userId: '' })) }}
              disabled={isEdit}
              options={users.map(u => ({ value: String(u.id), label: `${u.name} — ${u.role}` }))}
              placeholder="Select staff"
              className="mt-1"
              triggerClassName={selectErrors.userId ? 'border-red-400' : undefined}
            />
            {selectErrors.userId && <p className="text-red-500 text-xs mt-1">{selectErrors.userId}</p>}
          </div>
          <div>
            <Label>Attendance Type <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={attendanceTypeId}
              onValueChange={v => { setAttendanceTypeId(v); setSelectErrors(e => ({ ...e, attendanceTypeId: '' })) }}
              options={attendanceTypes.map(t => ({ value: String(t.id), label: t.name }))}
              placeholder="Select type"
              className="mt-1"
              triggerClassName={selectErrors.attendanceTypeId ? 'border-red-400' : undefined}
            />
            {selectErrors.attendanceTypeId && <p className="text-red-500 text-xs mt-1">{selectErrors.attendanceTypeId}</p>}
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
      qc.invalidateQueries({ queryKey: ['attendance-pending'] })
      toast.success('Bulk attendance saved')
      onClose()
    },
    onError: (e: unknown) => {
      toast.error(getApiError(e, 'Failed to save') ?? 'Failed to save')
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
            {users.length === 0 && <div className="py-8 text-center text-sm text-gray-400">No staff found</div>}
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
function StaffHistoryDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: StaffUser | null }) {
  const [from, setFrom] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]     = useState(todayStr)
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)

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
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{user?.name} — Attendance History</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-3">
              <div className="flex-1"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1" /></div>
              <div className="flex-1"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Present',  value: summary.present, color: 'text-green-700 bg-green-50'   },
                { label: 'Absent',   value: summary.absent,  color: 'text-red-700 bg-red-50'       },
                { label: 'Half Day', value: summary.half,    color: 'text-yellow-700 bg-yellow-50' },
                { label: 'Leave',    value: summary.leave,   color: 'text-blue-700 bg-blue-50'     },
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
                      <ApprovalBadge status={r.approvalStatus} />
                      {r.leaveTypeName && <span className="text-xs text-gray-500">{r.leaveTypeName}</span>}
                      {r.selfieUrl && (
                        <button onClick={() => setSelfieUrl(r.selfieUrl!)} className="text-gray-400 hover:text-blue-500 transition-colors">
                          <Camera size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {selfieUrl && <SelfieDialog url={selfieUrl} onClose={() => setSelfieUrl(null)} />}
    </>
  )
}

// ── Pending Approvals Tab ─────────────────────────────────────────────────────
function PendingApprovalsTab() {
  const qc = useQueryClient()
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-pending'],
    queryFn: attendanceApi.getPending,
  })
  const records = [...(data?.data ?? [])].sort((a, b) =>
    new Date(b.markedAt ?? b.attendanceDate).getTime() - new Date(a.markedAt ?? a.attendanceDate).getTime()
  )
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const pageRows   = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSelect(id: number) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAll() {
    setSelected(prev => prev.size === records.length ? new Set() : new Set(records.map(r => r.id)))
  }

  const approveMutation = useMutation({
    mutationFn: (id: number) => attendanceApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-pending'] }); qc.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Approved') },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: number) => attendanceApi.reject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-pending'] }); qc.invalidateQueries({ queryKey: ['attendance'] }); toast.success('Rejected') },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })
  const bulkApproveMutation = useMutation({
    mutationFn: () => attendanceApi.bulkApprove(Array.from(selected)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-pending'] }); qc.invalidateQueries({ queryKey: ['attendance'] }); setSelected(new Set()); toast.success(`${selected.size} approved`) },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })
  const bulkRejectMutation = useMutation({
    mutationFn: () => attendanceApi.bulkReject(Array.from(selected)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-pending'] }); qc.invalidateQueries({ queryKey: ['attendance'] }); setSelected(new Set()); toast.success(`${selected.size} rejected`) },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })

  if (isLoading) return <div className="py-12 text-center text-sm text-gray-400">Loading…</div>

  if (records.length === 0)
    return (
      <div className="bg-white rounded-xl border p-12 flex flex-col items-center text-gray-400">
        <CheckCircle size={36} className="mb-3 text-green-300" />
        <p className="font-medium">All caught up!</p>
        <p className="text-sm mt-1">No pending attendance approvals</p>
      </div>
    )

  return (
    <>
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Pending Approvals</h2>
            <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">{records.length} pending</span>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-xs text-gray-500">{selected.size} selected</span>
                <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50 h-7 px-3 text-xs"
                  disabled={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
                  onClick={() => bulkApproveMutation.mutate()}>
                  <CheckCircle size={12} className="mr-1" />Approve All
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 h-7 px-3 text-xs"
                  disabled={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
                  onClick={() => bulkRejectMutation.mutate()}>
                  <XCircle size={12} className="mr-1" />Reject All
                </Button>
                <span className="text-gray-300">|</span>
              </>
            )}
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
        <div className="overflow-auto max-h-[calc(100vh-18rem)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                <th className="px-5 py-3 w-10">
                  <input type="checkbox" checked={selected.size === records.length} onChange={toggleAll} className="rounded" />
                </th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Staff</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Role</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Vehicle</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Date</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Type</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Marked At</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Location</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Selfie</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Remarks</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.map(r => (
                <tr key={r.id} className={cn('hover:bg-gray-50', selected.has(r.id) && 'bg-blue-50')}>
                  <td className="px-5 py-3 whitespace-nowrap"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.userName}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.roleName}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.assignedVehicleNumber ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{r.attendanceDate}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><AttendanceBadge type={r.attendanceTypeName} /></td>
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{r.markedAt ? format(new Date(r.markedAt), 'dd MMM, hh:mm a') : '—'}</td>
                  <td className="px-5 py-3 w-[140px]">{r.locationName && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(r.locationName.trim()) ? <span className="block w-[140px] truncate text-gray-500 text-xs" title={r.locationName}>{r.locationName}</span> : r.latitude != null && r.longitude != null ? <button onClick={() => setMapCoords({ lat: r.latitude!, lng: r.longitude! })} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><MapPin size={11} />Other</button> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {r.selfieUrl ? (
                      <button onClick={() => setSelfieUrl(r.selfieUrl!)} className="group relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                        <img src={r.selfieUrl} alt="selfie" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Camera size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{r.remarks || '—'}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex gap-1.5 justify-end">
                      <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50 h-7 px-2.5 text-xs"
                        disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(r.id)}>
                        <CheckCircle size={12} className="mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 h-7 px-2.5 text-xs"
                        disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate(r.id)}>
                        <XCircle size={12} className="mr-1" />Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selfieUrl && <SelfieDialog url={selfieUrl} onClose={() => setSelfieUrl(null)} />}
      <MapModal coords={mapCoords} onClose={() => setMapCoords(null)} />
    </>
  )
}

// ── Rejected Tab ──────────────────────────────────────────────────────────────
function RejectedTab() {
  const qc = useQueryClient()
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-rejected'],
    queryFn: attendanceApi.getRejected,
  })
  const records = data?.data ?? []
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const pageRows   = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const approveMutation = useMutation({
    mutationFn: (id: number) => attendanceApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance-rejected'] })
      qc.invalidateQueries({ queryKey: ['attendance-pending'] })
      toast.success('Attendance approved')
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed') ?? 'Failed'),
  })

  if (isLoading) return <div className="py-12 text-center text-sm text-gray-400">Loading…</div>

  if (records.length === 0)
    return (
      <div className="bg-white rounded-xl border p-12 flex flex-col items-center text-gray-400">
        <CheckCircle size={36} className="mb-3 text-green-300" />
        <p className="font-medium">No rejected records</p>
        <p className="text-sm mt-1">All attendance has been approved or is pending</p>
      </div>
    )

  return (
    <>
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Rejected Attendance</h2>
            <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{records.length} rejected</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
        <div className="overflow-auto max-h-[calc(100vh-18rem)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                <th className="text-left px-5 py-3 whitespace-nowrap">Staff</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Role</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Vehicle</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Date</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Type</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Marked At</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Location</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Selfie</th>
                <th className="text-left px-5 py-3 whitespace-nowrap">Rejected By</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.userName}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.roleName}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.assignedVehicleNumber ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{r.attendanceDate}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><AttendanceBadge type={r.attendanceTypeName} /></td>
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{r.markedAt ? format(new Date(r.markedAt), 'dd MMM, hh:mm a') : '—'}</td>
                  <td className="px-5 py-3 w-[140px]">{r.locationName && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(r.locationName.trim()) ? <span className="block w-[140px] truncate text-gray-500 text-xs" title={r.locationName}>{r.locationName}</span> : r.latitude != null && r.longitude != null ? <button onClick={() => setMapCoords({ lat: r.latitude!, lng: r.longitude! })} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><MapPin size={11} />Other</button> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {r.selfieUrl ? (
                      <button onClick={() => setSelfieUrl(r.selfieUrl!)} className="group relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                        <img src={r.selfieUrl} alt="selfie" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Camera size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.approvedByName ?? '—'}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50 h-7 px-2.5 text-xs"
                      disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(r.id)}>
                      <CheckCircle size={12} className="mr-1" />Approve
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selfieUrl && <SelfieDialog url={selfieUrl} onClose={() => setSelfieUrl(null)} />}
      <MapModal coords={mapCoords} onClose={() => setMapCoords(null)} />
    </>
  )
}

// ── Duty Times Tab ────────────────────────────────────────────────────────────
function DutyTimesTab({
  selectedDate,
  records,
  isLoading,
  shiftDay,
  setSelectedDate,
}: {
  selectedDate: string
  records: Attendance[]
  isLoading: boolean
  shiftDay: (delta: number) => void
  setSelectedDate: (d: string) => void
}) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [selectedDate])

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const pageRows   = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function fmtTime(iso: string | undefined) {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    } catch { return '—' }
  }

  const markedOutCount = records.filter(r => r.markedOutAt).length
  const onDutyCount    = records.length - markedOutCount

  return (
    <div className="space-y-4">
      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button
          className="border rounded-lg p-2 hover:bg-gray-50 transition-colors"
          onClick={() => shiftDay(-1)}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2 border rounded-lg px-4 py-2 bg-white">
          <CalendarDays size={16} className="text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            max={todayStr()}
            onChange={e => { if (e.target.value <= todayStr()) setSelectedDate(e.target.value) }}
            className="text-sm font-medium text-gray-800 border-none outline-none bg-transparent"
          />
        </div>
        <button
          className="border rounded-lg p-2 hover:bg-gray-50 transition-colors"
          onClick={() => shiftDay(1)}
        >
          <ChevronRight size={16} />
        </button>
        <button
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          onClick={() => setSelectedDate(todayStr())}
        >
          Today
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          <LogOut size={14} className="text-green-700" />
          <div>
            <p className="text-xl font-bold text-green-700 leading-none">{markedOutCount}</p>
            <p className="text-xs text-green-600 mt-0.5">Marked Out</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <Timer size={14} className="text-amber-700" />
          <div>
            <p className="text-xl font-bold text-amber-700 leading-none">{onDutyCount}</p>
            <p className="text-xs text-amber-600 mt-0.5">Still On Duty</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
          <Users size={14} className="text-gray-600" />
          <div>
            <p className="text-xl font-bold text-gray-700 leading-none">{records.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Present</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Duty Times — {selectedDate}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-white">Prev</button>
            <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-white">Next</button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No attendance records for this date
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-22rem)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="text-left px-5 py-3 whitespace-nowrap">Staff</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Role</th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <LogIn size={11} />In Time
                    </span>
                  </th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <LogOut size={11} />Out Time
                    </span>
                  </th>
                  <th className="text-left px-5 py-3 whitespace-nowrap">Duty</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.map(r => {
                  const isOut = !!r.markedOutAt
                  const dutyLabel = r.dutyLabel ?? 'Full Day'
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.userName}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.roleName}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-gray-600 text-xs">
                          <LogIn size={12} className="text-green-500" />
                          {fmtTime(r.markedAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {isOut ? (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <LogOut size={12} />
                            {fmtTime(r.markedOutAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={cn(
                          'text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                          isOut
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200',
                        )}>
                          {dutyLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AttendancePage() {
  const { locked } = useSubscription()
  const role = useAuthStore(s => s.role)
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'

  type Tab = 'daily' | 'duty' | 'my' | 'pending' | 'rejected'
  const [activeTab, setActiveTab]       = useState<Tab>('daily')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [dailySearch, setDailySearch]   = useState('')
  const [dailyPage, setDailyPage]       = useState(0)
  const [markOpen, setMarkOpen]         = useState(false)
  const [bulkOpen, setBulkOpen]         = useState(false)
  const [editRecord, setEditRecord]     = useState<Attendance | undefined>()
  const [historyUser, setHistoryUser]   = useState<StaffUser | null>(null)
  const [mapCoords, setMapCoords]       = useState<{ lat: number; lng: number } | null>(null)
  const [selfieUrl, setSelfieUrl]       = useState<string | null>(null)

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance', selectedDate],
    queryFn: () => attendanceApi.getByDate(selectedDate),
    enabled: activeTab === 'daily' || activeTab === 'duty',
  })
  const records = [...(attendanceData?.data ?? [])].sort((a, b) => b.id - a.id)

  const { data: usersData } = useQuery({ queryKey: ['staff-users'], queryFn: () => staffApi.getUsers() })
  const allUsers: StaffUser[] = ((usersData?.data ?? []) as StaffUser[]).filter(u => ATTENDANCE_ROLES.includes(u.role ?? ''))

  const { data: attTypesData } = useQuery({ queryKey: ['attendance-types'], queryFn: globalMastersApi.getAttendanceTypes })
  const attendanceTypes = (attTypesData?.data ?? []) as { id: number; name: string }[]

  const { data: leaveTypesData } = useQuery({ queryKey: ['leave-types'], queryFn: globalMastersApi.getLeaveTypes })
  const leaveTypes = (leaveTypesData?.data ?? []) as { id: number; name: string }[]

  const { data: pendingData }  = useQuery({ queryKey: ['attendance-pending'],  queryFn: attendanceApi.getPending,  enabled: isAdmin })
  const { data: rejectedData } = useQuery({ queryKey: ['attendance-rejected'], queryFn: attendanceApi.getRejected, enabled: isAdmin })
  const pendingCount  = pendingData?.data?.length ?? 0
  const rejectedCount = rejectedData?.data?.length ?? 0

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

  const filteredMarked   = records.filter(r => !dailySearch || r.userName?.toLowerCase().includes(dailySearch.toLowerCase()))
  const filteredUnmarked = isAdmin ? allUsers.filter(u => !existingMap[u.id] && (!dailySearch || u.name?.toLowerCase().includes(dailySearch.toLowerCase()))) : []
  const allDailyRows = [
    ...filteredMarked.map(r => ({ kind: 'marked' as const, r })),
    ...filteredUnmarked.map(u => ({ kind: 'unmarked' as const, u })),
  ]
  const dailyTotalPages = Math.max(1, Math.ceil(allDailyRows.length / PAGE_SIZE))
  const dailyPageRows   = allDailyRows.slice(dailyPage * PAGE_SIZE, (dailyPage + 1) * PAGE_SIZE)

  function shiftDay(delta: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    const newDate = format(d, 'yyyy-MM-dd')
    if (newDate <= todayStr()) { setSelectedDate(newDate); setDailyPage(0) }
  }

  const tabBtn = (tab: Tab, label: string, badge?: number) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors relative',
        activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className={cn(
          'ml-2 min-w-[18px] h-[18px] text-white text-[10px] font-bold rounded-full inline-flex items-center justify-center px-1',
          tab === 'pending' ? 'bg-orange-500' : 'bg-red-500'
        )}>
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
          <p className="text-sm text-gray-500 mt-0.5">Track daily attendance for all staff</p>
        </div>
        {!locked && isAdmin && activeTab === 'daily' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditRecord(undefined); setMarkOpen(true) }}>
              <Pencil size={14} className="mr-1.5" />Mark Single
            </Button>
            <Button onClick={() => setBulkOpen(true)}>
              <ClipboardList size={14} className="mr-1.5" />Bulk Mark
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabBtn('daily', 'Daily Attendance')}
        {tabBtn('duty', 'Duty Times')}
        {tabBtn('my', 'My Attendance')}
        {isAdmin && tabBtn('pending', 'Pending Approvals', pendingCount)}
        {isAdmin && tabBtn('rejected', 'Rejected', rejectedCount)}
      </div>

      {/* Tab content */}
      {activeTab === 'duty' && (
        <DutyTimesTab
          selectedDate={selectedDate}
          records={records}
          isLoading={isLoading}
          shiftDay={shiftDay}
          setSelectedDate={setSelectedDate}
        />
      )}
      {activeTab === 'my' && (
        <MyAttendanceTab attendanceTypes={attendanceTypes} leaveTypes={leaveTypes} />
      )}
      {activeTab === 'rejected' && <RejectedTab />}
      {activeTab === 'pending' && <PendingApprovalsTab />}
      {activeTab === 'daily' && (
        <>
          {/* Date navigator */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}><ChevronLeft size={16} /></Button>
            <div className="flex items-center gap-2 border rounded-lg px-4 py-2 bg-white">
              <CalendarDays size={16} className="text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr()}
                onChange={e => { if (e.target.value <= todayStr()) { setSelectedDate(e.target.value); setDailyPage(0) } }}
                className="text-sm font-medium text-gray-800 border-none outline-none bg-transparent"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => shiftDay(1)}><ChevronRight size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(todayStr())} className="text-xs text-gray-500">Today</Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Staff', value: allUsers.length, icon: Users,       color: 'text-gray-700',   bg: 'bg-white'     },
              { label: 'Present',     value: stats.present,  icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-50'  },
              { label: 'Absent',      value: stats.absent,   icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-50'    },
              { label: 'Half Day',    value: stats.half,     icon: Clock,        color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'On Leave',    value: stats.leave,    icon: Umbrella,     color: 'text-blue-700',   bg: 'bg-blue-50'   },
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
              <h2 className="text-sm font-semibold text-gray-700 shrink-0">Attendance for {selectedDate}</h2>
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={dailySearch}
                  onChange={e => { setDailySearch(e.target.value); setDailyPage(0) }}
                  placeholder="Search by name…"
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {unmarked > 0 && (
                <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full shrink-0">
                  {unmarked} not marked
                </span>
              )}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <button onClick={() => setDailyPage(p => p - 1)} disabled={dailyPage === 0}
                  className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-white">Prev</button>
                <span className="text-xs text-gray-500">{dailyPage + 1} / {dailyTotalPages}</span>
                <button onClick={() => setDailyPage(p => p + 1)} disabled={dailyPage >= dailyTotalPages - 1}
                  className="px-2 py-1 rounded border text-xs disabled:opacity-40 hover:bg-white">Next</button>
              </div>
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-22rem)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                      <th className="text-left px-5 py-3 whitespace-nowrap">Staff</th>
                      <th className="text-left px-5 py-3 whitespace-nowrap">Role</th>
                      <th className="text-left px-5 py-3 whitespace-nowrap">Vehicle</th>
                      <th className="text-left px-5 py-3 whitespace-nowrap">Status</th>
                      <th className="text-left px-5 py-3 whitespace-nowrap">Approval</th>
                      <th className="text-left px-5 py-3 whitespace-nowrap">Location</th>
                      <th className="text-left px-5 py-3 whitespace-nowrap">Photo</th>
                      <th className="text-left px-5 py-3 whitespace-nowrap">Marked By</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dailyPageRows.map(row => {
                      if (row.kind === 'marked') {
                        const r = row.r
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.userName}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.roleName}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.assignedVehicleNumber ?? '—'}</td>
                            <td className="px-5 py-3 whitespace-nowrap"><AttendanceBadge type={r.attendanceTypeName} /></td>
                            <td className="px-5 py-3 whitespace-nowrap"><ApprovalBadge status={r.approvalStatus} /></td>
                            <td className="px-5 py-3 w-[140px]">{r.locationName && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(r.locationName.trim()) ? <span className="block w-[140px] truncate text-gray-500 text-xs" title={r.locationName}>{r.locationName}</span> : r.latitude != null && r.longitude != null ? <button onClick={() => setMapCoords({ lat: r.latitude!, lng: r.longitude! })} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><MapPin size={11} />Other</button> : <span className="text-gray-400 text-xs">—</span>}</td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              {r.selfieUrl ? (
                                <button onClick={() => setSelfieUrl(r.selfieUrl!)} className="group relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                                  <img src={r.selfieUrl} alt="selfie" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <Camera size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </button>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{r.markedByName}</td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <div className="flex gap-1 justify-end">
                                {isAdmin && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={() => { setEditRecord(r); setMarkOpen(true) }}>
                                    <Pencil size={12} />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500"
                                  onClick={() => setHistoryUser(allUsers.find(u => u.id === r.userId) ?? null)}>
                                  <CalendarDays size={12} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      } else {
                        const u = row.u
                        return (
                          <tr key={`u-${u.id}`} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-700 whitespace-nowrap">{u.name}</td>
                            <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{u.role}</td>
                            <td className="px-5 py-3 text-gray-400 whitespace-nowrap">—</td>
                            <td className="px-5 py-3 whitespace-nowrap"><span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not marked</span></td>
                            <td className="px-5 py-3 text-gray-400 whitespace-nowrap">—</td>
                            <td className="px-5 py-3 text-gray-400 whitespace-nowrap">—</td>
                            <td className="px-5 py-3 text-gray-400 whitespace-nowrap">—</td>
                            <td className="px-5 py-3 whitespace-nowrap">
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
                        )
                      }
                    })}
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
        </>
      )}

      {isAdmin && (
        <>
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
        </>
      )}
      <StaffHistoryDialog open={!!historyUser} onClose={() => setHistoryUser(null)} user={historyUser} />
      <MapModal coords={mapCoords} onClose={() => setMapCoords(null)} />
      {selfieUrl && <SelfieDialog url={selfieUrl} onClose={() => setSelfieUrl(null)} />}
    </div>
  )
}
