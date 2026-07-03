import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { equipmentInvoicesApi } from '@/api/equipmentInvoices'
import { clientsApi } from '@/api/clients'
import type { EquipmentBillingType, EquipmentInvoicePrefill } from '@/types'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
type BillingType = EquipmentBillingType

interface LineItem {
  _key: string
  itemType: 'MACHINE' | 'CHARGE'
  description: string
  machineAssignmentId?: number
  billingType: BillingType
  quantity: string
  rate: string
}

function nextKey() { return Math.random().toString(36).slice(2) }

function suggestedQty(p: EquipmentInvoicePrefill, billing: BillingType): string {
  if (billing === 'HOURLY') return String(p.suggestedHours ?? 0)
  if (billing === 'DAILY')  return String(p.suggestedDays ?? 0)
  return String(p.suggestedMonths ?? 0)
}

function woRateToBilling(woRateType: string): BillingType {
  if (woRateType === 'HOURLY')      return 'HOURLY'
  if (woRateType === 'DAILY_SHIFT') return 'DAILY'
  return 'MONTHLY'
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  defaultClientId?: number   // pre-selected when opened from WO detail
  defaultClientName?: string
}

export function CreateEquipmentInvoiceDialog({ open, onClose, defaultClientId, defaultClientName }: Props) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [clientId, setClientId]     = useState<number | null>(defaultClientId ?? null)
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dueDate, setDueDate]       = useState('')
  const [from, setFrom]             = useState('')
  const [to, setTo]                 = useState('')
  const [taxPercent, setTaxPercent] = useState('18')
  const [notes, setNotes]           = useState('')
  const [items, setItems]           = useState<LineItem[]>([])
  const [prefills, setPrefills]     = useState<EquipmentInvoicePrefill[]>([])
  const [loadingPrefill, setLoadingPrefill] = useState(false)
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<number>>(new Set())

  // clients for picker
  const { data: clientsData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientsApi.getAll(),
    enabled: open,
  })
  const clients = clientsData?.data?.content ?? []

  // reset when opened
  useEffect(() => {
    if (open) {
      setClientId(defaultClientId ?? null)
      setInvoiceDate(today)
      setDueDate('')
      setFrom('')
      setTo('')
      setTaxPercent('18')
      setNotes('')
      setItems([])
      setPrefills([])
      setSelectedAssignmentIds(new Set())
    }
  }, [open])

  // ── Prefill ─────────────────────────────────────────────────────────────────
  async function loadPrefill() {
    if (!clientId) { toast.error('Select a client first'); return }
    setLoadingPrefill(true)
    try {
      const res = await equipmentInvoicesApi.prefillByClient(clientId, {
        from: from || undefined,
        to:   to   || undefined,
      })
      const ps = res.data ?? []
      setPrefills(ps)
      setSelectedAssignmentIds(new Set(ps.map(p => p.machineAssignmentId)))

      const chargeItems = items.filter(i => i.itemType === 'CHARGE')
      const machineItems: LineItem[] = ps.map(p => {
        const billing = woRateToBilling(p.woRateType)
        return {
          _key: nextKey(),
          itemType: 'MACHINE',
          description: `${p.equipmentTypeName}${p.serialNumber ? ` — ${p.serialNumber}` : ''} (${p.woNumber})`,
          machineAssignmentId: p.machineAssignmentId,
          billingType: billing,
          quantity: suggestedQty(p, billing),
          rate: String(p.woRate ?? 0),
        }
      })
      setItems([...machineItems, ...chargeItems])
    } catch {
      toast.error('Failed to load suggestions')
    } finally {
      setLoadingPrefill(false)
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
    setItems(prev => prev.map(i => {
      if (i._key !== key) return i
      const next = { ...i, ...patch }
      if (patch.billingType && i.itemType === 'MACHINE' && i.machineAssignmentId) {
        const p = prefills.find(p => p.machineAssignmentId === i.machineAssignmentId)
        if (p) next.quantity = suggestedQty(p, patch.billingType)
      }
      return next
    }))
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, i) => {
    const qty  = parseFloat(i.quantity) || 0
    const rate = parseFloat(i.rate) || 0
    return sum + qty * rate
  }, 0)
  const tax       = parseFloat(taxPercent) || 0
  const taxAmount = subtotal * tax / 100
  const total     = subtotal + taxAmount

  // ── Save ─────────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => equipmentInvoicesApi.createForClient({
      clientId,
      invoiceDate,
      dueDate:            dueDate || null,
      billingPeriodStart: from    || null,
      billingPeriodEnd:   to      || null,
      taxPercent: parseFloat(taxPercent) || 0,
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

  const canSave = !!clientId && items.length > 0 && items.every(i => i.description && i.rate)

  // group prefills by WO for display
  const prefillByWo = prefills.reduce<Record<string, EquipmentInvoicePrefill[]>>((acc, p) => {
    const key = p.woNumber
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Equipment Invoice</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* ── Client picker ── */}
          <div className="space-y-1.5">
            <Label>Client <span className="text-red-500">*</span></Label>
            {defaultClientId ? (
              <p className="text-sm font-medium text-gray-800 py-2">{defaultClientName}</p>
            ) : (
              <SearchableSelect
                options={clients.map(c => ({ value: String(c.id), label: c.clientName }))}
                value={clientId ? String(clientId) : ''}
                onValueChange={v => setClientId(v ? Number(v) : null)}
                placeholder="Select client…"
              />
            )}
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

          {/* ── Prefill bar ── */}
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Sparkles size={16} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 flex-1">
              Load machine-wise suggestions from daily logs for the billing period above.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0"
              onClick={loadPrefill}
              disabled={loadingPrefill || !clientId}
            >
              {loadingPrefill ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
              Load Suggestions
            </Button>
          </div>

          {/* ── Machine selector (grouped by WO) ── */}
          {Object.keys(prefillByWo).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Machines to include</p>
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-feros-equip-sidebar hover:underline"
                    onClick={() => setSelectedAssignmentIds(new Set(prefills.map(p => p.machineAssignmentId)))}>
                    All
                  </button>
                  <button type="button" className="text-gray-400 hover:underline"
                    onClick={() => setSelectedAssignmentIds(new Set())}>
                    None
                  </button>
                </div>
              </div>
              {Object.entries(prefillByWo).map(([woNum, woPrefills]) => (
                <div key={woNum} className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{woNum}</p>
                  <div className="flex flex-wrap gap-2">
                    {woPrefills.map(p => {
                      const checked = selectedAssignmentIds.has(p.machineAssignmentId)
                      const label = p.serialNumber
                        ? `${p.equipmentTypeName} — ${p.serialNumber}`
                        : p.equipmentTypeName
                      return (
                        <label key={p.machineAssignmentId}
                          className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors',
                            checked
                              ? 'bg-feros-equip-sidebar/10 border-feros-equip-sidebar/40 text-feros-equip-sidebar'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="accent-feros-equip-sidebar"
                            checked={checked}
                            onChange={e => {
                              setSelectedAssignmentIds(prev => {
                                const next = new Set(prev)
                                e.target.checked ? next.add(p.machineAssignmentId) : next.delete(p.machineAssignmentId)
                                return next
                              })
                              // sync items list with checkbox state
                              if (!e.target.checked) {
                                setItems(prev => prev.filter(i => i.machineAssignmentId !== p.machineAssignmentId))
                              } else {
                                const billing = woRateToBilling(p.woRateType)
                                setItems(prev => [...prev, {
                                  _key: nextKey(),
                                  itemType: 'MACHINE',
                                  description: `${p.equipmentTypeName}${p.serialNumber ? ` — ${p.serialNumber}` : ''} (${p.woNumber})`,
                                  machineAssignmentId: p.machineAssignmentId,
                                  billingType: billing,
                                  quantity: suggestedQty(p, billing),
                                  rate: String(p.woRate ?? 0),
                                }])
                              }
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Line items ── */}
          <div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px_100px_90px_36px] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Description / Machine</span>
                <span>Billing</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Rate (₹)</span>
                <span className="text-right">Amount</span>
                <span />
              </div>

              {items.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-gray-400">
                  Click "Load Suggestions" or add a charge below.
                </div>
              ) : (
                items.map(item => {
                  const qty    = parseFloat(item.quantity) || 0
                  const rate   = parseFloat(item.rate)     || 0
                  const amount = qty * rate
                  return (
                    <div key={item._key}
                      className={cn('grid grid-cols-[1fr_100px_80px_100px_90px_36px] gap-2 items-center px-3 py-2 border-b border-gray-100 last:border-0',
                        item.itemType === 'MACHINE' ? 'bg-white' : 'bg-blue-50/40'
                      )}
                    >
                      {item.itemType === 'MACHINE' ? (
                        <p className="text-sm text-gray-800 truncate">{item.description}</p>
                      ) : (
                        <Input
                          className="h-7 text-sm"
                          placeholder="Charge description…"
                          value={item.description}
                          onChange={e => updateItem(item._key, { description: e.target.value })}
                        />
                      )}

                      {item.itemType === 'MACHINE' ? (
                        <select
                          value={item.billingType}
                          onChange={e => updateItem(item._key, { billingType: e.target.value as BillingType })}
                          className="h-7 text-sm border border-gray-200 rounded px-1.5 bg-white w-full"
                        >
                          <option value="HOURLY">Hourly</option>
                          <option value="DAILY">Daily</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400 text-center">—</span>
                      )}

                      <Input
                        className="h-7 text-sm text-right"
                        type="number" min={0} step="0.01"
                        value={item.quantity}
                        onChange={e => updateItem(item._key, { quantity: e.target.value })}
                      />
                      <Input
                        className="h-7 text-sm text-right"
                        type="number" min={0} step="0.01"
                        value={item.rate}
                        onChange={e => updateItem(item._key, { rate: e.target.value })}
                      />
                      <p className="text-sm font-medium text-right text-gray-800">₹{fmt(amount)}</p>
                      <button
                        onClick={() => removeItem(item._key)}
                        className="text-gray-300 hover:text-red-500 transition-colors flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <Button
              type="button" variant="ghost" size="sm"
              className="mt-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={addChargeLine}
            >
              <Plus size={14} className="mr-1" /> Add Charge
            </Button>
          </div>

          {/* ── Footer: tax + notes + totals ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-gray-100 pt-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Tax %</Label>
                <div className="flex gap-2 flex-wrap">
                  {[0, 5, 12, 18, 28].map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setTaxPercent(String(t))}
                      className={cn('px-2.5 py-1 rounded text-sm font-medium border transition-colors',
                        taxPercent === String(t)
                          ? 'bg-feros-equip-sidebar text-white border-feros-equip-sidebar'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      )}
                    >
                      {t}%
                    </button>
                  ))}
                  <Input
                    className="h-7 w-20 text-sm"
                    type="number" min={0} max={100}
                    value={taxPercent}
                    onChange={e => setTaxPercent(e.target.value)}
                    placeholder="Custom"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  className="w-full border border-gray-200 rounded-md text-sm p-2 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-feros-equip-sidebar/30"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Payment terms, remarks…"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>₹{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax ({tax}%)</span><span>₹{fmt(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-2 mt-1">
                  <span>Total</span><span>₹{fmt(total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  disabled={!canSave || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white"
                >
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
