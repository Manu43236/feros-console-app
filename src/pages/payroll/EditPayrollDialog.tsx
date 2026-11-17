import { getApiError } from '@/lib/apiError'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { payrollApi } from '@/api/payroll'
import { globalMastersApi } from '@/api/masters'
import type { Payroll } from '@/types'

const editSchema = z.object({
  dailyRate:     z.coerce.number().optional(),
  monthlySalary: z.coerce.number().optional(),
  overtimeHours: z.coerce.number().min(0).optional(),
  tripBonus:     z.coerce.number().min(0).optional(),
  remarks:       z.string().optional(),
})
type EditForm = z.infer<typeof editSchema>

// One editable deduction line. salaryAdvanceId links a Salary Advance so its balance is updated server-side.
type DeductionRow = {
  key: number
  deductionTypeId: number | ''
  amount: string
  salaryAdvanceId?: number
  remarks?: string
}

let rowSeq = 1

export function EditPayrollDialog({ open, onClose, payroll }: {
  open: boolean
  onClose: () => void
  payroll: Payroll | null
}) {
  const qc = useQueryClient()
  const isMonthly = payroll?.salaryType === 'MONTHLY'

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditForm>({
    resolver: zodResolver(editSchema) as Resolver<EditForm>,
    values: payroll ? {
      dailyRate:     payroll.dailyRate     ?? undefined,
      monthlySalary: payroll.monthlySalary ?? undefined,
      overtimeHours: payroll.overtimeHours ?? 0,
      tripBonus:     payroll.tripBonus     ?? 0,
      remarks:       payroll.remarks       ?? '',
    } : undefined,
  })

  // ── Deductions ──────────────────────────────────────────────────────────────
  const { data: typesRes } = useQuery({
    queryKey: ['deduction-types'],
    queryFn:  () => globalMastersApi.getDeductionTypes(),
    enabled:  open,
  })
  const { data: pendingAdvRes } = useQuery({
    queryKey: ['pending-advances', payroll?.userId],
    queryFn:  () => payrollApi.getPendingAdvances(payroll!.userId),
    enabled:  open && !!payroll,
  })
  const deductionTypes = typesRes?.data ?? []
  const pendingAdvances = pendingAdvRes?.data ?? []

  const [rows, setRows]   = useState<DeductionRow[]>([])
  const [dirty, setDirty] = useState(false)

  // Prefill from the payroll's current deductions whenever the dialog (re)opens.
  useEffect(() => {
    if (!payroll || !open) return
    setRows((payroll.deductions ?? []).map(d => ({
      key: rowSeq++,
      deductionTypeId: d.deductionTypeId,
      amount: String(d.amount ?? ''),
      salaryAdvanceId: d.salaryAdvanceId,
      remarks: d.remarks,
    })))
    setDirty(false)
  }, [payroll, open])

  const updateRow = (key: number, patch: Partial<DeductionRow>) => {
    setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r))
    setDirty(true)
  }
  const addRow = () => {
    setRows(rs => [...rs, { key: rowSeq++, deductionTypeId: '', amount: '' }])
    setDirty(true)
  }
  const removeRow = (key: number) => {
    setRows(rs => rs.filter(r => r.key !== key))
    setDirty(true)
  }
  const recoverAdvance = (advanceId: number) => {
    const adv = pendingAdvances.find(a => a.id === advanceId)
    if (!adv) return
    const advType = deductionTypes.find(t => /advance/i.test(t.name))
    setRows(rs => [...rs, {
      key: rowSeq++,
      deductionTypeId: advType?.id ?? '',
      amount: String(adv.balanceAmount),
      salaryAdvanceId: adv.id,
      remarks: `Advance ${adv.advanceDate}`,
    }])
    setDirty(true)
  }

  const totalDeductions = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const mutation = useMutation({
    mutationFn: (d: EditForm) => payrollApi.update(payroll!.id, {
      dailyRate:     isMonthly ? undefined : (d.dailyRate || undefined),
      monthlySalary: isMonthly ? (d.monthlySalary || undefined) : undefined,
      overtimeHours: d.overtimeHours ?? 0,
      tripBonus:     d.tripBonus     ?? 0,
      remarks:       d.remarks       || undefined,
      // Only send deductions when the user edited them; untouched = keep existing (unchanged behaviour).
      deductions: dirty
        ? rows
            .filter(r => r.deductionTypeId !== '' && Number(r.amount) > 0)
            .map(r => ({
              deductionTypeId: Number(r.deductionTypeId),
              amount: Number(r.amount),
              salaryAdvanceId: r.salaryAdvanceId,
              remarks: r.remarks,
            }))
        : undefined,
    }),
    onSuccess: () => {
      toast.success('Payroll updated')
      qc.invalidateQueries({ queryKey: ['payrolls'] })
      reset()
      onClose()
    },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed to update') ?? 'Failed to update'),
  })

  if (!payroll) return null

  return (
    <Dialog open={open} onOpenChange={v => !v && (reset(), onClose())}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payroll — {payroll.userName}</DialogTitle>
        </DialogHeader>

        <div className="text-xs text-gray-400 -mt-2 mb-1">
          {payroll.payCycleStartDate} → {payroll.payCycleEndDate} &nbsp;·&nbsp;
          {payroll.presentDays}P {payroll.absentDays}A {payroll.halfDays}H {payroll.leaveDays}L
          <span className="ml-1 text-amber-500">(attendance is read-only)</span>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">

          {/* Rate */}
          {isMonthly ? (
            <div>
              <Label>Monthly Salary (₹)</Label>
              <Input type="number" step="100" {...register('monthlySalary')}
                className={`mt-1 ${errors.monthlySalary ? 'border-red-400' : ''}`} />
              <p className="text-xs text-gray-400 mt-1">Basic pay recalculated: offs beyond the allowance deducted at monthly ÷ days in month</p>
            </div>
          ) : (
            <div>
              <Label>Daily Rate (₹)</Label>
              <Input type="number" step="0.01" {...register('dailyRate')}
                className={`mt-1 ${errors.dailyRate ? 'border-red-400' : ''}`} />
              <p className="text-xs text-gray-400 mt-1">Basic pay recalculated from attendance</p>
            </div>
          )}

          {/* Overtime */}
          <div>
            <Label>Overtime Hours</Label>
            <Input type="number" step="0.5" min="0" {...register('overtimeHours')} className="mt-1" />
          </div>

          {/* Trip Bonus */}
          <div>
            <Label>Trip Bonus (₹)</Label>
            <Input type="number" step="0.01" min="0" {...register('tripBonus')} className="mt-1" />
          </div>

          {/* Deductions */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <Label>Deductions</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addRow}>
                <Plus size={13} /> Add
              </Button>
            </div>

            {rows.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No deductions. Add salary advance recovery or other deductions.</p>
            )}

            <div className="space-y-2 mt-2">
              {rows.map(r => (
                <div key={r.key} className="flex items-center gap-2">
                  <select
                    value={r.deductionTypeId}
                    onChange={e => updateRow(r.key, { deductionTypeId: e.target.value ? Number(e.target.value) : '' })}
                    className="flex-1 h-9 rounded-md border border-gray-200 bg-white px-2 text-sm">
                    <option value="">Type…</option>
                    {deductionTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <Input type="number" step="0.01" min="0" placeholder="₹" className="w-24 h-9"
                    value={r.amount} onChange={e => updateRow(r.key, { amount: e.target.value })} />
                  <button type="button" onClick={() => removeRow(r.key)}
                    className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {pendingAdvances.length > 0 && (
              <div className="mt-2">
                <select
                  value=""
                  onChange={e => e.target.value && recoverAdvance(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-dashed border-gray-300 bg-white px-2 text-sm text-gray-600">
                  <option value="">+ Recover salary advance…</option>
                  {pendingAdvances.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.advanceDate} — balance ₹{a.balanceAmount}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {rows.length > 0 && (
              <div className="flex justify-between text-xs font-medium text-gray-600 mt-2">
                <span>Total deductions</span>
                <span className="text-red-500">–₹{totalDeductions.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Remarks */}
          <div>
            <Label>Remarks</Label>
            <Input {...register('remarks')} className="mt-1" placeholder="Optional" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
