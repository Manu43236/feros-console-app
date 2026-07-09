import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { leaseInvoicesApi } from '@/api/leaseInvoices'
import { clientsApi } from '@/api/clients'
import { tenantsApi } from '@/api/superadmin'
import type { LeaseInvoicePrefill, VehicleLease } from '@/types'
import { cn } from '@/lib/utils'

const GST_SLABS = [0, 9, 12, 18, 36]

const STATUS_COLORS: Record<string, string> = {
  DRAFT:          'bg-gray-100 text-gray-600',
  SENT:           'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID:           'bg-green-100 text-green-700',
  CANCELLED:      'bg-red-100 text-red-600',
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

interface LineItem {
  assignmentId?: number
  registrationNumber: string
  description: string
  days: number
  rate: number
  amount: number
}

interface Props {
  open: boolean
  onClose: () => void
  lease: VehicleLease
}

export function GenerateLeaseInvoiceDialog({ open, onClose, lease }: Props) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [from, setFrom]             = useState('')
  const [to, setTo]                 = useState(today)
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dueDate, setDueDate]       = useState('')
  const [gstSlab, setGstSlab]       = useState(18)
  const [notes, setNotes]           = useState('')
  const [items, setItems]           = useState<LineItem[]>([])
  const [checkedIdx, setCheckedIdx] = useState<Set<number>>(new Set())
  const [prefillLoaded, setPrefillLoaded] = useState(false)

  // Get tenant state for intra/inter check
  const { data: tenantRes } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: () => tenantsApi.getMy(),
    enabled: open,
  })
  // Get client state
  const { data: clientRes } = useQuery({
    queryKey: ['client', lease.clientId],
    queryFn: () => clientsApi.getById(lease.clientId),
    enabled: open,
  })

  const tenantState = tenantRes?.data?.state ?? ''
  const clientState = clientRes?.data?.stateName ?? ''
  const isIntraState = !!(tenantState && clientState && tenantState === clientState)

  useEffect(() => {
    if (!open) {
      setFrom(''); setTo(today); setInvoiceDate(today); setDueDate('')
      setGstSlab(18); setNotes(''); setItems([]); setCheckedIdx(new Set()); setPrefillLoaded(false)
    }
  }, [open])

  async function loadPrefill() {
    if (!from || !to) { toast.error('Select billing period first'); return }
    if (to > today) { toast.error('End date cannot be in the future'); return }
    try {
      const res = await leaseInvoicesApi.prefill(lease.id, from, to)
      const prefills: LeaseInvoicePrefill[] = res.data ?? []
      if (prefills.length === 0) { toast.error('No active vehicles in this period'); return }
      const mapped = prefills.map(p => ({
        assignmentId: p.assignmentId,
        registrationNumber: p.registrationNumber,
        description: `${p.registrationNumber}${p.vehicleType ? ' – ' + p.vehicleType : ''} (${p.daysInPeriod} days)`,
        days: p.daysInPeriod,
        rate: p.rate,
        amount: p.suggestedAmount,
      }))
      setItems(mapped)
      setCheckedIdx(new Set(mapped.map((_, i) => i)))
      setPrefillLoaded(true)
    } catch {
      toast.error('Failed to load prefill')
    }
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'days' || field === 'rate') {
        updated.amount = Number(updated.days) * Number(updated.rate)
      }
      return updated
    }))
  }

  const selectedItems = items.filter((_, i) => checkedIdx.has(i))
  const subtotal = selectedItems.reduce((s, i) => s + Number(i.amount), 0)
  const cgstPct = isIntraState ? gstSlab / 2 : 0
  const sgstPct = isIntraState ? gstSlab / 2 : 0
  const igstPct = isIntraState ? 0 : gstSlab
  const cgstAmt = subtotal * cgstPct / 100
  const sgstAmt = subtotal * sgstPct / 100
  const igstAmt = subtotal * igstPct / 100
  const total   = subtotal + cgstAmt + sgstAmt + igstAmt

  const mutation = useMutation({
    mutationFn: () => leaseInvoicesApi.create(lease.id, {
      invoiceDate,
      dueDate: dueDate || undefined,
      billingPeriodStart: from,
      billingPeriodEnd: to,
      cgstPercentage: cgstPct || undefined,
      sgstPercentage: sgstPct || undefined,
      igstPercentage: igstPct || undefined,
      notes: notes || undefined,
      items: selectedItems.map((item, idx) => ({
        leaseVehicleAssignmentId: item.assignmentId,
        registrationNumber: item.registrationNumber,
        description: item.description,
        days: item.days,
        rate: item.rate,
        amount: item.amount,
        sortOrder: idx,
      })),
    }),
    onSuccess: () => {
      toast.success('Invoice created')
      qc.invalidateQueries({ queryKey: ['lease-invoices', lease.id] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create invoice')
    },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Invoice — {lease.leaseNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Billing period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Billing Period From *</Label>
              <Input type="date" value={from} max={today}
                onChange={e => { setFrom(e.target.value); setPrefillLoaded(false) }} className="mt-1" />
            </div>
            <div>
              <Label>Billing Period To *</Label>
              <Input type="date" value={to} max={today}
                onChange={e => { setTo(e.target.value); setPrefillLoaded(false) }} className="mt-1" />
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={loadPrefill}
            disabled={!from || !to} className="gap-1.5 w-full">
            <Sparkles size={14} /> Load Vehicles for Period
          </Button>

          {/* Line items */}
          {prefillLoaded && items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Line Items</Label>
                <span className="text-xs text-gray-400">{checkedIdx.size} of {items.length} selected</span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox"
                          checked={checkedIdx.size === items.length}
                          ref={el => { if (el) el.indeterminate = checkedIdx.size > 0 && checkedIdx.size < items.length }}
                          onChange={() => setCheckedIdx(
                            checkedIdx.size === items.length
                              ? new Set()
                              : new Set(items.map((_, i) => i))
                          )}
                          className="cursor-pointer" />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Description</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-16">Days</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-24">Rate</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const checked = checkedIdx.has(idx)
                      return (
                        <tr key={idx} className={cn('border-b border-gray-100', !checked && 'opacity-40')}>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={checked}
                              onChange={() => setCheckedIdx(prev => {
                                const next = new Set(prev)
                                next.has(idx) ? next.delete(idx) : next.add(idx)
                                return next
                              })}
                              className="cursor-pointer" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={item.description}
                              onChange={e => updateItem(idx, 'description', e.target.value)}
                              disabled={!checked}
                              className="w-full text-sm border-0 bg-transparent focus:outline-none focus:bg-gray-50 rounded px-1 disabled:cursor-default" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" value={item.days} min={1}
                              onChange={e => updateItem(idx, 'days', Number(e.target.value))}
                              disabled={!checked}
                              className="w-full text-sm text-right border-0 bg-transparent focus:outline-none focus:bg-gray-50 rounded px-1 disabled:cursor-default" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" value={item.rate}
                              onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
                              disabled={!checked}
                              className="w-full text-sm text-right border-0 bg-transparent focus:outline-none focus:bg-gray-50 rounded px-1 disabled:cursor-default" />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">
                            ₹{fmt(item.amount)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GST */}
          {prefillLoaded && (
            <div className="space-y-3">
              <div>
                <Label>GST Rate</Label>
                <div className="flex gap-2 mt-1">
                  {GST_SLABS.map(s => (
                    <button key={s} onClick={() => setGstSlab(s)}
                      className={cn('px-3 py-1.5 rounded text-sm font-medium border transition-colors',
                        gstSlab === s
                          ? 'bg-feros-navy text-white border-feros-navy'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-feros-navy')}>
                      {s}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Intra/Inter indicator */}
              <div className={cn('text-xs px-3 py-2 rounded-md',
                isIntraState ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                {isIntraState
                  ? `Intra-state (${clientState}) → CGST ${cgstPct}% + SGST ${sgstPct}%`
                  : `Inter-state (${clientState || '?'} ↔ ${tenantState || '?'}) → IGST ${igstPct}%`}
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span><span>₹{fmt(subtotal)}</span>
                </div>
                {isIntraState && gstSlab > 0 && <>
                  <div className="flex justify-between text-gray-600">
                    <span>CGST {cgstPct}%</span><span>₹{fmt(cgstAmt)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>SGST {sgstPct}%</span><span>₹{fmt(sgstAmt)}</span>
                  </div>
                </>}
                {!isIntraState && gstSlab > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>IGST {igstPct}%</span><span>₹{fmt(igstAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                  <span>Total</span><span>₹{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Invoice meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invoice Date *</Label>
              <Input type="date" value={invoiceDate} max={today}
                onChange={e => setInvoiceDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate}
                onChange={e => setDueDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full mt-1 border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-feros-navy/30" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm"
              disabled={!prefillLoaded || checkedIdx.size === 0 || !from || !to || !invoiceDate || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? <><Loader2 size={14} className="animate-spin mr-1" />Creating…</> : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
