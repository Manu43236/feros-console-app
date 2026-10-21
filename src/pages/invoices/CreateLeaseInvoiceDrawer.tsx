import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sparkles, Loader2, ChevronDown, ChevronRight, Truck, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { leaseInvoicesApi } from '@/api/leaseInvoices'
import { clientsApi } from '@/api/clients'
import { tenantsApi } from '@/api/superadmin'
import type { LeaseInvoicePrefill } from '@/types'
import { cn } from '@/lib/utils'

const GST_SLABS = [0, 9, 12, 18, 36]

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

interface LineItem {
  assignmentId?: number
  leaseId?: number
  leaseNumber?: string
  registrationNumber: string
  vehicleType?: string
  description: string
  days: number
  rate: number
  amount: number
  alreadyInvoiced: boolean
  invoicedInvoiceNumber?: string
}

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Client-first lease invoice — one invoice across vehicles from ALL the client's leases.
 * Grouped by lease (Orders-style). A lease-vehicle already billed for the period shows a
 * green "Invoiced" lock and can't be selected again (frees up once that invoice is cancelled).
 */
export function CreateLeaseInvoiceDrawer({ open, onClose }: Props) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [clientId, setClientId]       = useState<number | undefined>(undefined)
  const [from, setFrom]               = useState('')
  const [to, setTo]                   = useState(today)
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dueDate, setDueDate]         = useState('')
  const [gstSlab, setGstSlab]         = useState(18)
  const [notes, setNotes]             = useState('')
  const [items, setItems]             = useState<LineItem[]>([])
  const [checked, setChecked]         = useState<Set<number>>(new Set()) // keyed by assignmentId
  const [expanded, setExpanded]       = useState<Set<number>>(new Set()) // keyed by leaseId
  const [prefillLoaded, setPrefillLoaded] = useState(false)

  const { data: clientsRes } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => clientsApi.getAll({ size: 1000 }),
    enabled: open,
  })
  const { data: tenantRes } = useQuery({
    queryKey: ['my-tenant'],
    queryFn: () => tenantsApi.getMy(),
    enabled: open,
  })

  const clients = clientsRes?.data?.content ?? []
  const clientOptions = clients.filter(c => c.isActive).map(c => ({ value: String(c.id), label: c.clientName }))
  const selectedClient = clients.find(c => c.id === clientId)
  const tenantState = tenantRes?.data?.state ?? ''
  const clientState = selectedClient?.stateName ?? ''
  const isIntraState = !!(tenantState && clientState && tenantState === clientState)

  useEffect(() => {
    if (!open) {
      setClientId(undefined); setFrom(''); setTo(today); setInvoiceDate(today); setDueDate('')
      setGstSlab(18); setNotes(''); setItems([]); setChecked(new Set()); setExpanded(new Set()); setPrefillLoaded(false)
    }
  }, [open])

  async function loadPrefill() {
    if (!clientId) { toast.error('Select a client first'); return }
    if (!from || !to) { toast.error('Select billing period first'); return }
    if (to > today) { toast.error('End date cannot be in the future'); return }
    try {
      const res = await leaseInvoicesApi.prefillByClient(clientId, from, to)
      const prefills: LeaseInvoicePrefill[] = res.data ?? []
      if (prefills.length === 0) { toast.error('No lease vehicles for this client in this period'); return }
      const mapped: LineItem[] = prefills.map(p => ({
        assignmentId: p.assignmentId,
        leaseId: p.leaseId,
        leaseNumber: p.leaseNumber,
        registrationNumber: p.registrationNumber,
        vehicleType: p.vehicleType,
        description: `${p.registrationNumber}${p.vehicleType ? ' – ' + p.vehicleType : ''} (${p.daysInPeriod} days)`,
        days: p.daysInPeriod,
        rate: p.rate,
        amount: p.suggestedAmount,
        alreadyInvoiced: !!p.alreadyInvoiced,
        invoicedInvoiceNumber: p.invoicedInvoiceNumber,
      }))
      setItems(mapped)
      // auto-select every selectable (not already invoiced) vehicle
      setChecked(new Set(mapped.filter(m => !m.alreadyInvoiced && m.assignmentId).map(m => m.assignmentId!)))
      setExpanded(new Set(mapped.map(m => m.leaseId).filter((v): v is number => v != null)))
      setPrefillLoaded(true)
    } catch {
      toast.error('Failed to load prefill')
    }
  }

  function updateItem(assignmentId: number, field: 'days' | 'rate' | 'description', value: string | number) {
    setItems(prev => prev.map(item => {
      if (item.assignmentId !== assignmentId) return item
      const updated = { ...item, [field]: value }
      if (field === 'days' || field === 'rate') updated.amount = Number(updated.days) * Number(updated.rate)
      return updated
    }))
  }

  function toggleVehicle(assignmentId: number) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(assignmentId) ? next.delete(assignmentId) : next.add(assignmentId)
      return next
    })
  }

  function toggleLease(leaseId: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(leaseId) ? next.delete(leaseId) : next.add(leaseId)
      return next
    })
  }

  // Group items by lease, preserving order
  const leaseGroups: { leaseId: number; leaseNumber: string; rows: LineItem[] }[] = []
  for (const it of items) {
    const lid = it.leaseId ?? -1
    let g = leaseGroups.find(x => x.leaseId === lid)
    if (!g) { g = { leaseId: lid, leaseNumber: it.leaseNumber ?? '—', rows: [] }; leaseGroups.push(g) }
    g.rows.push(it)
  }

  const selectedItems = items.filter(i => i.assignmentId && checked.has(i.assignmentId) && !i.alreadyInvoiced)
  const subtotal = selectedItems.reduce((s, i) => s + Number(i.amount), 0)
  const cgstPct = isIntraState ? gstSlab / 2 : 0
  const sgstPct = isIntraState ? gstSlab / 2 : 0
  const igstPct = isIntraState ? 0 : gstSlab
  const cgstAmt = subtotal * cgstPct / 100
  const sgstAmt = subtotal * sgstPct / 100
  const igstAmt = subtotal * igstPct / 100
  const total   = subtotal + cgstAmt + sgstAmt + igstAmt

  const mutation = useMutation({
    mutationFn: () => leaseInvoicesApi.createForClient({
      clientId: clientId!,
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
      qc.invalidateQueries({ queryKey: ['lease-invoices-all'] })
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Failed to create invoice')
    },
  })

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>New Lease Invoice</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Client */}
          <div>
            <Label>Client *</Label>
            <SearchableSelect
              className="mt-1"
              value={clientId ? String(clientId) : ''}
              onValueChange={v => { setClientId(v ? Number(v) : undefined); setPrefillLoaded(false); setItems([]) }}
              options={clientOptions}
              placeholder="Select client…"
            />
          </div>

          {/* Billing period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            disabled={!clientId || !from || !to} className="gap-1.5 w-full">
            <Sparkles size={14} /> Load Leases for Period
          </Button>

          {/* Leases → vehicles (grouped, Orders-style) */}
          {prefillLoaded && leaseGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Select Vehicles</Label>
                <span className="text-xs text-gray-400">{selectedItems.length} selected</span>
              </div>

              <div className="space-y-2">
                {leaseGroups.map(group => {
                  const isOpen = expanded.has(group.leaseId)
                  const selectable = group.rows.filter(r => !r.alreadyInvoiced)
                  const allInvoiced = selectable.length === 0
                  return (
                    <div key={group.leaseId} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Lease header */}
                      <button type="button" onClick={() => toggleLease(group.leaseId)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                          <span className="text-sm font-semibold text-feros-navy">{group.leaseNumber}</span>
                          <span className="text-xs text-gray-400">{group.rows.length} vehicle{group.rows.length !== 1 ? 's' : ''}</span>
                        </div>
                        {allInvoiced
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded"><CheckCircle2 size={12} /> Fully invoiced</span>
                          : <span className="text-xs text-gray-400">{group.rows.filter(r => r.assignmentId && checked.has(r.assignmentId) && !r.alreadyInvoiced).length}/{selectable.length} selected</span>}
                      </button>

                      {/* Vehicle rows */}
                      {isOpen && (
                        <div className="divide-y divide-gray-100">
                          {group.rows.map(row => {
                            const aid = row.assignmentId!
                            const locked = row.alreadyInvoiced
                            const isChecked = !locked && checked.has(aid)
                            return (
                              <div key={aid} className={cn('flex items-center gap-3 px-3 py-2.5', locked && 'bg-green-50/30')}>
                                <input type="checkbox" checked={isChecked} disabled={locked}
                                  onChange={() => toggleVehicle(aid)}
                                  className={cn('cursor-pointer', locked && 'cursor-not-allowed opacity-40')} />
                                <Truck size={15} className="text-gray-300 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{row.registrationNumber}
                                    {row.vehicleType && <span className="text-gray-400 font-normal"> · {row.vehicleType}</span>}
                                  </p>
                                  {locked ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 mt-0.5">
                                      <CheckCircle2 size={11} /> Already invoiced{row.invoicedInvoiceNumber ? ` · ${row.invoicedInvoiceNumber}` : ''}
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-3 mt-1">
                                      <label className="flex items-center gap-1 text-xs text-gray-500">
                                        Days
                                        <input type="number" min={1} value={row.days} disabled={!isChecked}
                                          onChange={e => updateItem(aid, 'days', Number(e.target.value))}
                                          className="w-14 text-right border border-gray-200 rounded px-1 py-0.5 text-xs disabled:bg-gray-50 disabled:text-gray-400" />
                                      </label>
                                      <label className="flex items-center gap-1 text-xs text-gray-500">
                                        Rate
                                        <input type="number" min={0} value={row.rate} disabled={!isChecked}
                                          onChange={e => updateItem(aid, 'rate', Number(e.target.value))}
                                          className="w-20 text-right border border-gray-200 rounded px-1 py-0.5 text-xs disabled:bg-gray-50 disabled:text-gray-400" />
                                      </label>
                                    </div>
                                  )}
                                </div>
                                {!locked && <span className="text-sm font-semibold text-gray-800 shrink-0">₹{fmt(row.amount)}</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* GST + totals */}
          {prefillLoaded && (
            <div className="space-y-3">
              <div>
                <Label>GST Rate</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
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

              <div className={cn('text-xs px-3 py-2 rounded-md',
                isIntraState ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                {isIntraState
                  ? `Intra-state (${clientState}) → CGST ${cgstPct}% + SGST ${sgstPct}%`
                  : `Inter-state (${clientState || '?'} ↔ ${tenantState || '?'}) → IGST ${igstPct}%`}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{fmt(subtotal)}</span></div>
                {isIntraState && gstSlab > 0 && <>
                  <div className="flex justify-between text-gray-600"><span>CGST {cgstPct}%</span><span>₹{fmt(cgstAmt)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>SGST {sgstPct}%</span><span>₹{fmt(sgstAmt)}</span></div>
                </>}
                {!isIntraState && gstSlab > 0 && (
                  <div className="flex justify-between text-gray-600"><span>IGST {igstPct}%</span><span>₹{fmt(igstAmt)}</span></div>
                )}
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                  <span>Total</span><span>₹{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Invoice meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              disabled={!prefillLoaded || selectedItems.length === 0 || !clientId || !from || !to || !invoiceDate || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? <><Loader2 size={14} className="animate-spin mr-1" />Creating…</> : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
