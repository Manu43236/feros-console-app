import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Calculator, Loader2, Pencil, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { equipmentInvoicesApi } from '@/api/equipmentInvoices'
import type { EquipmentBillingType, EquipmentInvoiceCalcResult, GstType } from '@/types'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItem {
  _key: string
  itemType: 'MACHINE' | 'CHARGE'
  description: string
  machineAssignmentId?: number
  billingType: EquipmentBillingType
  quantity: string
  rate: string
}

function nextKey() { return Math.random().toString(36).slice(2) }

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function calcToItems(results: EquipmentInvoiceCalcResult[]): LineItem[] {
  const items: LineItem[] = []
  for (const r of results) {
    const billing: EquipmentBillingType =
      r.rateType === 'DAILY_SHIFT' ? 'DAILY' : r.rateType === 'MONTHLY' ? 'MONTHLY' : 'HOURLY'
    const label = r.serialNumber ? `${r.serialNumber} · ${r.equipmentTypeName}` : r.equipmentTypeName
    const qtyHint =
      r.rateType === 'DAILY_SHIFT' ? `${r.workingDays} days`
      : r.rateType === 'MONTHLY'   ? `${r.billedBaseHours} months`
      : `${r.billedBaseHours} hrs (working ${r.workingHours}${r.guaranteedHours ? `, guaranteed ${r.guaranteedHours}` : ''})`

    // Base line
    items.push({
      _key: nextKey(),
      itemType: 'MACHINE',
      description: `${label} (${r.woNumber}) — ${qtyHint}`,
      machineAssignmentId: r.machineAssignmentId,
      billingType: billing,
      quantity: String(r.billedBaseHours),
      rate: String(r.baseRate),
    })

    // OT line
    if (r.otAmount > 0 && r.otHours > 0) {
      items.push({
        _key: nextKey(),
        itemType: 'MACHINE',
        description: `${label} — OT ${r.otHours} hrs`,
        machineAssignmentId: r.machineAssignmentId,
        billingType: 'HOURLY',
        quantity: String(r.otHours),
        rate: String(r.otRate ?? 0),
      })
    }

    // Standby line
    if (r.standbyAmount > 0 && r.standbyHours > 0) {
      items.push({
        _key: nextKey(),
        itemType: 'MACHINE',
        description: `${label} — Standby ${r.standbyHours} hrs @ 50%`,
        machineAssignmentId: r.machineAssignmentId,
        billingType: 'HOURLY',
        quantity: String(r.standbyHours),
        rate: String(r.standbyRate),
      })
    }
  }
  return items
}

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  woId?: number
  defaultClientId?: number
  defaultClientName?: string
  retentionPercent?: number
  tdsPercent?: number
}

export function CreateEquipmentInvoiceDialog({
  open, onClose, woId, defaultClientId, defaultClientName, retentionPercent: woRetention, tdsPercent: woTds,
}: Props) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dueDate, setDueDate]         = useState('')
  const [from, setFrom]               = useState('')
  const [to, setTo]                   = useState('')
  const [taxPercent, setTaxPercent]   = useState('18')
  const [gstType, setGstType]         = useState<GstType>('INTRA_STATE')
  const [retentionPct, setRetentionPct] = useState(String(woRetention ?? 0))
  const [tdsPct, setTdsPct]           = useState(String(woTds ?? 0))
  const [notes, setNotes]             = useState('')
  const [items, setItems]             = useState<LineItem[]>([])
  const [calculating, setCalculating] = useState(false)
  const [overriddenKeys, setOverriddenKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setInvoiceDate(today)
      setDueDate(''); setFrom(''); setTo('')
      setTaxPercent('18')
      setGstType('INTRA_STATE')
      setRetentionPct(String(woRetention ?? 0))
      setTdsPct(String(woTds ?? 0))
      setNotes(''); setItems([]); setOverriddenKeys(new Set())
    }
  }, [open])

  // ── Calculate ───────────────────────────────────────────────────────────────
  async function runCalculate() {
    if (!woId) { toast.error('Calculate is only available when viewing a specific Work Order'); return }
    setCalculating(true)
    try {
      const res = await equipmentInvoicesApi.calculate(woId, {
        from: from || undefined,
        to:   to   || undefined,
      })
      const results = (res.data ?? []).filter(r => r.totalAmount > 0)
      if (results.length === 0) {
        toast.info('No billable activity found for this period')
        return
      }
      const machineItems = calcToItems(results)
      const chargeItems = items.filter(i => i.itemType === 'CHARGE')
      setItems([...machineItems, ...chargeItems])
      setOverriddenKeys(new Set())
      toast.success(`Calculated ${results.length} machine(s)`)
    } catch {
      toast.error('Failed to calculate billing')
    } finally {
      setCalculating(false)
    }
  }

  // ── Item helpers ─────────────────────────────────────────────────────────────
  function addChargeLine() {
    setItems(prev => [...prev, {
      _key: nextKey(), itemType: 'CHARGE', description: '',
      billingType: 'HOURLY', quantity: '1', rate: '',
    }])
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems(prev => prev.map(i => i._key !== key ? i : { ...i, ...patch }))
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0)
  const tax         = parseFloat(taxPercent) || 0
  const taxAmount   = subtotal * tax / 100
  const total       = subtotal + taxAmount
  const halfTax     = taxAmount / 2
  const retentionAmt = total * (parseFloat(retentionPct) || 0) / 100
  const tdsAmt       = total * (parseFloat(tdsPct) || 0) / 100
  const netPayable   = total - retentionAmt - tdsAmt

  // ── Save ─────────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => equipmentInvoicesApi.createForClient({
      clientId: defaultClientId,
      invoiceDate,
      dueDate:            dueDate || null,
      billingPeriodStart: from    || null,
      billingPeriodEnd:   to      || null,
      taxPercent: parseFloat(taxPercent) || 0,
      gstType,
      retentionPercent: parseFloat(retentionPct) || null,
      tdsPercent:       parseFloat(tdsPct)       || null,
      notes: notes || null,
      items: items.map((i, idx) => ({
        itemType: i.itemType,
        description: i.description,
        machineAssignmentId: i.machineAssignmentId ?? null,
        billingType: i.itemType === 'MACHINE' ? i.billingType : null,
        quantity: parseFloat(i.quantity) || 0,
        rate:     parseFloat(i.rate)     || 0,
        sortOrder: idx,
      })),
    }),
    onSuccess: () => {
      toast.success('Invoice created')
      qc.invalidateQueries({ queryKey: ['equip-invoices-all'] })
      qc.invalidateQueries({ queryKey: ['equip-invoices-by-wo'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create invoice')
    },
  })

  const canSave = items.length > 0 && items.every(i => i.description && i.rate)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Equipment Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* ── Client ── */}
          <div className="space-y-1.5">
            <Label>Client</Label>
            <p className="text-sm font-medium text-gray-800 py-1">{defaultClientName}</p>
          </div>

          {/* ── Date row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Invoice Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Billing From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Billing To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          {/* ── Calculate bar ── */}
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <Calculator size={16} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 flex-1">
              Auto-calculate billing from daily logs × WO terms (rates, guaranteed hours, OT, standby).
            </p>
            <Button
              type="button" variant="outline" size="sm"
              className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 shrink-0"
              onClick={runCalculate}
              disabled={calculating}
            >
              {calculating ? <Loader2 size={14} className="animate-spin mr-1" /> : <Calculator size={14} className="mr-1" />}
              Calculate
            </Button>
          </div>

          {/* ── Line items ── */}
          <div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px_100px_90px_52px] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Description</span>
                <span>Billing</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Rate (₹)</span>
                <span className="text-right">Amount</span>
                <span />
              </div>

              {items.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-gray-400">
                  Click "Calculate" to auto-fill from daily logs, or add a charge below.
                </div>
              ) : (
                items.map(item => {
                  const qty       = parseFloat(item.quantity) || 0
                  const rate      = parseFloat(item.rate) || 0
                  const amount    = qty * rate
                  const isMachine = item.itemType === 'MACHINE'
                  const overriding = overriddenKeys.has(item._key)
                  const toggleOverride = () => setOverriddenKeys(prev => {
                    const next = new Set(prev)
                    overriding ? next.delete(item._key) : next.add(item._key)
                    return next
                  })
                  return (
                    <div key={item._key}
                      className={cn(
                        'grid grid-cols-[1fr_100px_80px_100px_90px_52px] gap-2 items-center px-3 py-2 border-b border-gray-100 last:border-0',
                        isMachine ? 'bg-white' : 'bg-blue-50/40'
                      )}
                    >
                      {isMachine ? (
                        <p className="text-sm text-gray-800 truncate" title={item.description}>{item.description}</p>
                      ) : (
                        <Input className="h-7 text-sm" placeholder="Charge description…"
                          value={item.description} onChange={e => updateItem(item._key, { description: e.target.value })} />
                      )}

                      {isMachine ? (
                        <select value={item.billingType}
                          onChange={e => updateItem(item._key, { billingType: e.target.value as EquipmentBillingType })}
                          className="h-7 text-sm border border-gray-200 rounded px-1.5 bg-white w-full">
                          <option value="HOURLY">Hourly</option>
                          <option value="DAILY">Daily</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400 text-center">—</span>
                      )}

                      {isMachine && !overriding ? (
                        <p className="text-sm text-right text-gray-800 font-medium">{qty}</p>
                      ) : (
                        <Input className="h-7 text-sm text-right" type="number" min={0} step="0.01"
                          value={item.quantity} onChange={e => updateItem(item._key, { quantity: e.target.value })} />
                      )}

                      {isMachine && !overriding ? (
                        <p className="text-sm text-right text-gray-800 font-medium">₹{fmt(rate)}</p>
                      ) : (
                        <Input className="h-7 text-sm text-right" type="number" min={0} step="0.01"
                          value={item.rate} onChange={e => updateItem(item._key, { rate: e.target.value })} />
                      )}

                      <p className="text-sm font-semibold text-right text-gray-900">₹{fmt(amount)}</p>

                      <div className="flex items-center justify-end gap-1">
                        {isMachine && (
                          <button type="button" title={overriding ? 'Lock values' : 'Override values'}
                            onClick={toggleOverride}
                            className={cn('transition-colors', overriding ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-gray-500')}>
                            {overriding ? <Lock size={13} /> : <Pencil size={13} />}
                          </button>
                        )}
                        <button type="button" onClick={() => removeItem(item._key)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <Button type="button" variant="ghost" size="sm"
              className="mt-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={addChargeLine}>
              <Plus size={14} className="mr-1" /> Add Charge
            </Button>
          </div>

          {/* ── Footer: tax + notes + totals ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-gray-100 pt-4">
            <div className="space-y-3">
              {/* Tax % */}
              <div className="space-y-1.5">
                <Label>GST %</Label>
                <div className="flex gap-2 flex-wrap">
                  {[0, 5, 12, 18, 28].map(t => (
                    <button key={t} type="button" onClick={() => setTaxPercent(String(t))}
                      className={cn('px-2.5 py-1 rounded text-sm font-medium border transition-colors',
                        taxPercent === String(t)
                          ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400')}>
                      {t}%
                    </button>
                  ))}
                  <Input className="h-7 w-20 text-sm" type="number" min={0} max={100}
                    value={taxPercent} onChange={e => setTaxPercent(e.target.value)} placeholder="Custom" />
                </div>
              </div>

              {/* GST Type */}
              <div className="space-y-1.5">
                <Label>GST Type</Label>
                <div className="flex gap-2">
                  {(['INTRA_STATE', 'INTER_STATE'] as GstType[]).map(g => (
                    <button key={g} type="button" onClick={() => setGstType(g)}
                      className={cn('px-3 py-1.5 rounded text-sm font-medium border transition-colors',
                        gstType === g
                          ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400')}>
                      {g === 'INTRA_STATE' ? 'Intra-state (CGST+SGST)' : 'Inter-state (IGST)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retention + TDS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Retention %</Label>
                  <Input className="h-8 text-sm" type="number" min={0} max={100} step="0.1"
                    value={retentionPct} onChange={e => setRetentionPct(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>TDS %</Label>
                  <Input className="h-8 text-sm" type="number" min={0} max={100} step="0.1"
                    value={tdsPct} onChange={e => setTdsPct(e.target.value)} />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea className="w-full border border-gray-200 rounded-md text-sm p-2 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-feros-equip-sidebar/30"
                  value={notes} onChange={e => setNotes(e.target.value)} placeholder="Payment terms, remarks…" />
              </div>
            </div>

            {/* Totals panel */}
            <div className="space-y-2">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span><span>₹{fmt(subtotal)}</span>
                </div>
                {gstType === 'INTRA_STATE' ? (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>CGST ({tax / 2}%)</span><span>₹{fmt(halfTax)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>SGST ({tax / 2}%)</span><span>₹{fmt(halfTax)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-gray-500">
                    <span>IGST ({tax}%)</span><span>₹{fmt(taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-2">
                  <span>Invoice Total</span><span>₹{fmt(total)}</span>
                </div>
                {retentionAmt > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Less: Retention ({retentionPct}%)</span><span>−₹{fmt(retentionAmt)}</span>
                  </div>
                )}
                {tdsAmt > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Less: TDS ({tdsPct}%)</span><span>−₹{fmt(tdsAmt)}</span>
                  </div>
                )}
                {(retentionAmt > 0 || tdsAmt > 0) && (
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-300 pt-2 text-base">
                    <span>Net Payable</span><span>₹{fmt(netPayable)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button disabled={!canSave || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white">
                  {saveMutation.isPending ? 'Saving…' : 'Save as Draft'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
