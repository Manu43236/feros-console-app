import { getApiError } from '@/lib/apiError'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { payrollApi } from '@/api/payroll'
import type { Payroll } from '@/types'

const editSchema = z.object({
  dailyRate:     z.coerce.number().optional(),
  monthlySalary: z.coerce.number().optional(),
  overtimeHours: z.coerce.number().min(0).optional(),
  tripBonus:     z.coerce.number().min(0).optional(),
  remarks:       z.string().optional(),
})
type EditForm = z.infer<typeof editSchema>

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

  const mutation = useMutation({
    mutationFn: (d: EditForm) => payrollApi.update(payroll!.id, {
      dailyRate:     isMonthly ? undefined : (d.dailyRate || undefined),
      monthlySalary: isMonthly ? (d.monthlySalary || undefined) : undefined,
      overtimeHours: d.overtimeHours ?? 0,
      tripBonus:     d.tripBonus     ?? 0,
      remarks:       d.remarks       || undefined,
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
      <DialogContent className="max-w-sm">
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
              <p className="text-xs text-gray-400 mt-1">Basic pay recalculated with LOP for absent days</p>
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
