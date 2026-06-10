import { getApiError } from '@/lib/apiError'
import { useSubscription } from '@/context/SubscriptionContext'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tyresApi } from '@/api/tyres'
import { vehiclesApi } from '@/api/vehicles'
import { meterReadingsApi } from '@/api/meterReadings'
import type { Tyre, TyreStatus, TyreType, TyreFitting, TyrePosition, TyreRemovalReason, TyrePurchaseCondition, TyreRetreadLog } from '@/types'
import { toast } from 'sonner'
import { Plus, Search, RefreshCw, History, Layers, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { SearchableSelect } from '@/components/ui/searchable-select'

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

const STATUS_COLORS: Record<TyreStatus, string> = {
  IN_STOCK:   'bg-green-100 text-green-700',
  FITTED:     'bg-blue-100 text-blue-700',
  RETREADING: 'bg-yellow-100 text-yellow-700',
  SCRAPPED:   'bg-red-100 text-red-700',
  DISPOSED:   'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<TyreStatus, string> = {
  IN_STOCK:   'In Stock',
  FITTED:     'Fitted',
  RETREADING: 'Retreading',
  SCRAPPED:   'Scrapped',
  DISPOSED:   'Disposed',
}

const TYRE_TYPES: TyreType[] = ['RADIAL', 'BIAS', 'TUBELESS', 'TUBE_TYPE']
const TYRE_TYPE_LABELS: Record<TyreType, string> = {
  RADIAL: 'Radial', BIAS: 'Bias', TUBELESS: 'Tubeless', TUBE_TYPE: 'Tube Type',
}

const PURCHASE_CONDITIONS: { value: TyrePurchaseCondition; label: string }[] = [
  { value: 'NEW',        label: 'New' },
  { value: 'SECOND_HAND', label: 'Second Hand' },
  { value: 'RETREADED',  label: 'Retreaded (Pre-used)' },
]

const REMOVAL_REASONS: { value: TyreRemovalReason; label: string }[] = [
  { value: 'WORN',     label: 'Worn Out' },
  { value: 'PUNCTURE', label: 'Puncture' },
  { value: 'DAMAGE',   label: 'Damage' },
  { value: 'RETREAD',  label: 'Send for Retread' },
  { value: 'SCRAP',    label: 'Scrap' },
  { value: 'OTHER',    label: 'Other' },
]

// ── Add / Edit Tyre Dialog ──────────────────────────────────────────────────
function AddEditTyreDialog({ open, onClose, tyre }: { open: boolean; onClose: () => void; tyre?: Tyre }) {
  const qc = useQueryClient()
  const isEdit = !!tyre

  const [form, setForm] = useState({
    serialNumber:          tyre?.serialNumber ?? '',
    brand:                 tyre?.brand ?? '',
    size:                  tyre?.size ?? '',
    tyreType:              (tyre?.tyreType ?? 'RADIAL') as TyreType,
    plyRating:             tyre?.plyRating ?? '',
    purchaseDate:          tyre?.purchaseDate ?? '',
    purchaseCost:          tyre?.purchaseCost?.toString() ?? '',
    tyreLifeYears:         tyre?.tyreLifeYears?.toString() ?? '',
    maxLifetimeKm:         tyre?.maxLifetimeKm?.toString() ?? '',
    notes:                 tyre?.notes ?? '',
    purchaseCondition:     (tyre?.purchaseCondition ?? 'NEW') as TyrePurchaseCondition,
    kmAtPurchase:          tyre?.kmAtPurchase?.toString() ?? '',
    retreadCountAtPurchase: tyre?.retreadCount?.toString() ?? '',
    supplierName:          tyre?.supplierName ?? '',
    invoiceNumber:         tyre?.invoiceNumber ?? '',
  })


  const mutation = useMutation({
    mutationFn: (data: unknown) => isEdit ? tyresApi.update(tyre!.id, data) : tyresApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Tyre updated' : 'Tyre added')
      qc.invalidateQueries({ queryKey: ['tyres'] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({
      ...form,
      purchaseCost:           form.purchaseCost  ? Number(form.purchaseCost)  : undefined,
      purchaseDate:           form.purchaseDate  || undefined,
      tyreLifeYears:          form.tyreLifeYears ? Number(form.tyreLifeYears) : undefined,
      maxLifetimeKm:          form.maxLifetimeKm ? Number(form.maxLifetimeKm) : undefined,
      kmAtPurchase:           form.kmAtPurchase  ? Number(form.kmAtPurchase)  : undefined,
      retreadCountAtPurchase: form.retreadCountAtPurchase ? Number(form.retreadCountAtPurchase) : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Tyre' : 'Add Tyre'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Serial Number *</Label>
              <Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} placeholder="TYR-001" required />
            </div>
            <div className="space-y-1.5">
              <Label>Brand *</Label>
              <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="MRF" required />
            </div>
            <div className="space-y-1.5">
              <Label>Size *</Label>
              <Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="295/80 R22.5" required />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.tyreType} onChange={e => setForm(f => ({ ...f, tyreType: e.target.value as TyreType }))}>
                {TYRE_TYPES.map(t => <option key={t} value={t}>{TYRE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Ply Rating</Label>
              <Input value={form.plyRating} onChange={e => setForm(f => ({ ...f, plyRating: e.target.value }))} placeholder="18PR" />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Cost (₹)</Label>
              <Input type="number" value={form.purchaseCost} onChange={e => setForm(f => ({ ...f, purchaseCost: e.target.value }))} placeholder="12000" />
            </div>
            <div className="space-y-1.5">
              <Label>Tyre Life (Years)</Label>
              <Input type="number" value={form.tyreLifeYears} onChange={e => setForm(f => ({ ...f, tyreLifeYears: e.target.value }))} placeholder="5" />
            </div>
            <div className="space-y-1.5">
              <Label>Max Lifetime KM</Label>
              <Input type="number" value={form.maxLifetimeKm} onChange={e => setForm(f => ({ ...f, maxLifetimeKm: e.target.value }))} placeholder="100000" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          {/* Purchase condition — shown only when adding a new tyre */}
          {!isEdit && (
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Condition</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Condition at Purchase</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={form.purchaseCondition}
                    onChange={e => setForm(f => ({ ...f, purchaseCondition: e.target.value as TyrePurchaseCondition, kmAtPurchase: '', retreadCountAtPurchase: '' }))}
                  >
                    {PURCHASE_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {(form.purchaseCondition === 'SECOND_HAND' || form.purchaseCondition === 'RETREADED') && (
                  <div className="space-y-1.5">
                    <Label>KM Already on Tyre</Label>
                    <Input type="number" value={form.kmAtPurchase} onChange={e => setForm(f => ({ ...f, kmAtPurchase: e.target.value }))} placeholder="e.g. 30000" />
                  </div>
                )}
                {form.purchaseCondition === 'RETREADED' && (
                  <div className="space-y-1.5">
                    <Label>Retread Count at Purchase</Label>
                    <Input type="number" value={form.retreadCountAtPurchase} onChange={e => setForm(f => ({ ...f, retreadCountAtPurchase: e.target.value }))} placeholder="e.g. 1" min="1" max="5" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Supplier / Invoice — always shown */}
          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Reference</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier Name</Label>
                <Input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="e.g. MRF Tyres Ltd" />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Number</Label>
                <Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="e.g. INV-2024-001" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Tyre'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Bulk Add Tyres Dialog ───────────────────────────────────────────────────
function BulkAddTyreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()

  const [serials, setSerials] = useState<string[]>([''])
  const [form, setForm] = useState({
    brand:                 '',
    size:                  '',
    tyreType:              'RADIAL' as TyreType,
    plyRating:             '',
    purchaseDate:          '',
    purchaseCost:          '',
    tyreLifeYears:         '',
    maxLifetimeKm:         '',
    notes:                 '',
    purchaseCondition:     'NEW' as TyrePurchaseCondition,
    kmAtPurchase:          '',
    retreadCountAtPurchase: '',
    supplierName:          '',
    invoiceNumber:         '',
  })

  const mutation = useMutation({
    mutationFn: () => tyresApi.bulkCreate({
      serialNumbers:          serials.map(s => s.trim()).filter(Boolean),
      brand:                  form.brand,
      size:                   form.size,
      tyreType:               form.tyreType,
      plyRating:              form.plyRating || undefined,
      purchaseDate:           form.purchaseDate || undefined,
      purchaseCost:           form.purchaseCost  ? Number(form.purchaseCost)  : undefined,
      tyreLifeYears:          form.tyreLifeYears ? Number(form.tyreLifeYears) : undefined,
      maxLifetimeKm:          form.maxLifetimeKm ? Number(form.maxLifetimeKm) : undefined,
      notes:                  form.notes || undefined,
      purchaseCondition:      form.purchaseCondition,
      kmAtPurchase:           form.kmAtPurchase  ? Number(form.kmAtPurchase)  : undefined,
      retreadCountAtPurchase: form.retreadCountAtPurchase ? Number(form.retreadCountAtPurchase) : undefined,
      supplierName:           form.supplierName  || undefined,
      invoiceNumber:          form.invoiceNumber || undefined,
    }),
    onSuccess: (res) => {
      toast.success(`${res.data?.length ?? 0} tyres added successfully`)
      qc.invalidateQueries({ queryKey: ['tyres'] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed to add tyres'); if (_m) toast.error(_m) },
  })

  const validSerials = serials.map(s => s.trim()).filter(Boolean)
  const canSubmit = validSerials.length > 0 && form.brand && form.size

  function addRow() { setSerials(s => [...s, '']) }
  function removeRow(i: number) { setSerials(s => s.filter((_, idx) => idx !== i)) }
  function updateSerial(i: number, val: string) { setSerials(s => s.map((v, idx) => idx === i ? val : v)) }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Add Tyres</DialogTitle>
          <p className="text-sm text-gray-500">Add multiple tyres with the same specs but different serial numbers in one go.</p>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Serial Numbers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Serial Numbers</p>
              <span className="text-xs text-gray-400">{validSerials.length} tyre{validSerials.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {serials.map((serial, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                  <Input
                    value={serial}
                    onChange={e => updateSerial(i, e.target.value)}
                    placeholder={`e.g. TYR-${String(i + 1).padStart(3, '0')}`}
                    className="font-mono"
                  />
                  {serials.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
              <Plus size={13} /> Add Serial Number
            </Button>
          </div>

          {/* Common Specs */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Common Specs (applied to all)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand *</Label>
                <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="MRF" required />
              </div>
              <div className="space-y-1.5">
                <Label>Size *</Label>
                <Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="295/80 R22.5" required />
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.tyreType} onChange={e => setForm(f => ({ ...f, tyreType: e.target.value as TyreType }))}>
                  {TYRE_TYPES.map(t => <option key={t} value={t}>{TYRE_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Ply Rating</Label>
                <Input value={form.plyRating} onChange={e => setForm(f => ({ ...f, plyRating: e.target.value }))} placeholder="18PR" />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Cost (₹)</Label>
                <Input type="number" value={form.purchaseCost} onChange={e => setForm(f => ({ ...f, purchaseCost: e.target.value }))} placeholder="12000" />
              </div>
              <div className="space-y-1.5">
                <Label>Tyre Life (Years)</Label>
                <Input type="number" value={form.tyreLifeYears} onChange={e => setForm(f => ({ ...f, tyreLifeYears: e.target.value }))} placeholder="5" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Lifetime KM</Label>
                <Input type="number" value={form.maxLifetimeKm} onChange={e => setForm(f => ({ ...f, maxLifetimeKm: e.target.value }))} placeholder="100000" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* Purchase Condition */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Condition</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Condition at Purchase</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.purchaseCondition}
                  onChange={e => setForm(f => ({ ...f, purchaseCondition: e.target.value as TyrePurchaseCondition, kmAtPurchase: '', retreadCountAtPurchase: '' }))}
                >
                  {PURCHASE_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {(form.purchaseCondition === 'SECOND_HAND' || form.purchaseCondition === 'RETREADED') && (
                <div className="space-y-1.5">
                  <Label>KM Already on Tyre</Label>
                  <Input type="number" value={form.kmAtPurchase} onChange={e => setForm(f => ({ ...f, kmAtPurchase: e.target.value }))} placeholder="e.g. 30000" />
                </div>
              )}
              {form.purchaseCondition === 'RETREADED' && (
                <div className="space-y-1.5">
                  <Label>Retread Count at Purchase</Label>
                  <Input type="number" value={form.retreadCountAtPurchase} onChange={e => setForm(f => ({ ...f, retreadCountAtPurchase: e.target.value }))} placeholder="e.g. 1" min="1" max="5" />
                </div>
              )}
            </div>
          </div>

          {/* Purchase Reference */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Reference</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier Name</Label>
                <Input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="e.g. MRF Tyres Ltd" />
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Number</Label>
                <Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="e.g. INV-2024-001" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t mt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !canSubmit}
            onClick={() => mutation.mutate()}
            className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5"
          >
            <Layers size={14} />
            {mutation.isPending ? 'Adding…' : `Add ${validSerials.length > 0 ? validSerials.length : ''} Tyre${validSerials.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Fit Tyre Dialog ─────────────────────────────────────────────────────────
function FitTyreDialog({ open, onClose, tyre }: { open: boolean; onClose: () => void; tyre: Tyre }) {
  const qc = useQueryClient()
  const [vehicleId, setVehicleId] = useState(0)
  const [form, setForm] = useState({
    positionId: 0,
    fittedAtKm: '',
    fittedDate: new Date().toISOString().split('T')[0],
    notes:      '',
  })

  const { data: vehiclesData } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll() })
  const vehicles = (vehiclesData?.data ?? []).filter(v => v.isActive)

  const { data: positionsData } = useQuery({
    queryKey: ['tyre-positions-current', vehicleId],
    queryFn:  () => tyresApi.getCurrentPositions(vehicleId),
    enabled:  vehicleId > 0,
  })
  const allPositions: TyrePosition[]   = positionsData?.data ?? []
  const emptyPositions: TyrePosition[] = allPositions.filter(p => !p.currentFitting)

  const { data: meterData } = useQuery({
    queryKey: ['meter-readings', vehicleId],
    queryFn:  () => meterReadingsApi.getAll(vehicleId),
    enabled:  vehicleId > 0,
  })

  // Auto-fill odometer from latest meter reading when vehicle is selected
  useEffect(() => {
    const readings = meterData?.data ?? []
    if (readings.length > 0) {
      setForm(f => ({ ...f, fittedAtKm: String(readings[0].readingKm) }))
    } else {
      setForm(f => ({ ...f, fittedAtKm: '' }))
    }
  }, [meterData])

  const mutation = useMutation({
    mutationFn: () => tyresApi.fitTyre({
      vehicleId,
      tyreId:     tyre.id,
      positionId: form.positionId,
      fittedAtKm: Number(form.fittedAtKm),
      fittedDate: form.fittedDate || undefined,
      notes:      form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Tyre fitted successfully')
      qc.invalidateQueries({ queryKey: ['tyres'] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed to fit tyre'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fit Tyre to Vehicle</DialogTitle>
          <p className="text-sm text-gray-500">{tyre.serialNumber} — {tyre.brand} {tyre.size}</p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Vehicle *</Label>
            <SearchableSelect
              value={vehicleId === 0 ? '' : String(vehicleId)}
              onValueChange={val => { setVehicleId(Number(val)); setForm(f => ({ ...f, positionId: 0 })) }}
              options={vehicles.map(v => ({ value: String(v.id), label: `${v.registrationNumber} — ${v.vehicleTypeName}` }))}
              placeholder="Select vehicle…"
            />
          </div>

          {vehicleId > 0 && (
            <div className="space-y-1.5">
              <Label>Position *</Label>
              {allPositions.length === 0 ? (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-md">
                  No tyre positions configured for this vehicle. Please set up positions in the Vehicle detail page first.
                </p>
              ) : emptyPositions.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-md">
                  All positions on this vehicle are occupied.
                </p>
              ) : (
                <SearchableSelect
                  value={form.positionId === 0 ? '' : String(form.positionId)}
                  onValueChange={val => setForm(f => ({ ...f, positionId: Number(val) }))}
                  options={emptyPositions.map(p => ({ value: String(p.id), label: `${p.positionCode} (${p.positionType})` }))}
                  placeholder="Select position…"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Odometer at Fitting (km) *</Label>
              <Input type="number" value={form.fittedAtKm} onChange={e => setForm(f => ({ ...f, fittedAtKm: e.target.value }))} placeholder="48230" />
            </div>
            <div className="space-y-1.5">
              <Label>Fitting Date</Label>
              <Input type="date" value={form.fittedDate} onChange={e => setForm(f => ({ ...f, fittedDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || vehicleId === 0 || form.positionId === 0 || !form.fittedAtKm}
            onClick={() => mutation.mutate()}
            className="bg-feros-navy hover:bg-feros-navy/90 text-white"
          >
            {mutation.isPending ? 'Fitting…' : 'Fit Tyre'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Remove Tyre Dialog ──────────────────────────────────────────────────────
function RemoveTyreDialog({ open, onClose, tyre }: { open: boolean; onClose: () => void; tyre: Tyre }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    removedAtKm:        '',
    removedDate:        new Date().toISOString().split('T')[0],
    removalReason:      '' as TyreRemovalReason | '',
    retreaderName:      '',
    expectedReturnDate: '',
    notes:              '',
  })

  const mutation = useMutation({
    mutationFn: () => tyresApi.removeTyre(tyre.currentFittingId!, {
      removedAtKm:        Number(form.removedAtKm),
      removedDate:        form.removedDate || undefined,
      removalReason:      form.removalReason as TyreRemovalReason,
      retreaderName:      form.retreaderName || undefined,
      expectedReturnDate: form.expectedReturnDate || undefined,
      notes:              form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Tyre removed successfully')
      qc.invalidateQueries({ queryKey: ['tyres'] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed to remove tyre'); if (_m) toast.error(_m) },
  })

  const isRetread = form.removalReason === 'RETREAD'
  const isScrap   = form.removalReason === 'SCRAP'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Tyre</DialogTitle>
          <p className="text-sm text-gray-500">
            {tyre.serialNumber} — {tyre.currentVehicleRegistrationNumber} · {tyre.currentPositionCode}
          </p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {(isRetread || isScrap) && (
            <div className={cn('rounded-lg px-3 py-2 text-sm border', isRetread ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700')}>
              {isRetread
                ? 'Tyre will be sent for retreading. Status will change to Retreading.'
                : 'Tyre will be permanently scrapped. This cannot be undone.'}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Removal Reason *</Label>
            <SearchableSelect
              value={form.removalReason}
              onValueChange={val => setForm(f => ({ ...f, removalReason: val as TyreRemovalReason, retreaderName: '', expectedReturnDate: '' }))}
              options={REMOVAL_REASONS.map(r => ({ value: r.value, label: r.label }))}
              placeholder="Select reason…"
              showSearch={false}
            />
          </div>
          {isRetread && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Retreader Name</Label>
                <Input value={form.retreaderName} onChange={e => setForm(f => ({ ...f, retreaderName: e.target.value }))} placeholder="e.g. MRF Retread Centre" />
              </div>
              <div className="space-y-1.5">
                <Label>Expected Return Date</Label>
                <Input type="date" value={form.expectedReturnDate} onChange={e => setForm(f => ({ ...f, expectedReturnDate: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Odometer at Removal (km) *</Label>
              <Input type="number" value={form.removedAtKm} onChange={e => setForm(f => ({ ...f, removedAtKm: e.target.value }))} placeholder="52000" />
            </div>
            <div className="space-y-1.5">
              <Label>Removal Date</Label>
              <Input type="date" value={form.removedDate} onChange={e => setForm(f => ({ ...f, removedDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !form.removalReason || !form.removedAtKm}
            onClick={() => mutation.mutate()}
            className={cn(isScrap ? 'bg-red-600 hover:bg-red-700' : 'bg-feros-navy hover:bg-feros-navy/90', 'text-white')}
          >
            {mutation.isPending ? 'Removing…' : 'Remove Tyre'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Back to Stock Dialog (enhanced with retread details) ────────────────────
function BackToStockDialog({ open, onClose, tyre }: { open: boolean; onClose: () => void; tyre: Tyre }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    retreadingCost:   '',
    newMaxLifetimeKm: '',
    actualReturnDate: new Date().toISOString().split('T')[0],
    notes:            '',
  })

  const mutation = useMutation({
    mutationFn: () => tyresApi.backToStock(tyre.id, {
      retreadingCost:   form.retreadingCost   ? Number(form.retreadingCost)   : undefined,
      newMaxLifetimeKm: form.newMaxLifetimeKm ? Number(form.newMaxLifetimeKm) : undefined,
      actualReturnDate: form.actualReturnDate || undefined,
      notes:            form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Tyre marked as back in stock')
      qc.invalidateQueries({ queryKey: ['tyres'] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Retread Complete — Back to Stock</DialogTitle>
          <p className="text-sm text-gray-500">{tyre.serialNumber} · Retread #{tyre.retreadCount}</p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
            Tyre has returned from retreading and will be marked as In Stock.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Retreading Cost (₹)</Label>
              <Input type="number" value={form.retreadingCost} onChange={e => setForm(f => ({ ...f, retreadingCost: e.target.value }))} placeholder="e.g. 7500" />
            </div>
            <div className="space-y-1.5">
              <Label>Actual Return Date</Label>
              <Input type="date" value={form.actualReturnDate} onChange={e => setForm(f => ({ ...f, actualReturnDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>New Max Lifetime KM for this Retread</Label>
              <Input
                type="number"
                value={form.newMaxLifetimeKm}
                onChange={e => setForm(f => ({ ...f, newMaxLifetimeKm: e.target.value }))}
                placeholder={tyre.maxLifetimeKm ? `Current: ${Number(tyre.maxLifetimeKm).toLocaleString('en-IN')} km` : 'e.g. 70000'}
              />
              <p className="text-xs text-gray-400">Retreaded tyres typically give 60–70% of original life. Leave blank to keep current value.</p>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className="bg-green-600 hover:bg-green-700 text-white">
            {mutation.isPending ? 'Updating…' : 'Mark Back to Stock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Scrap Tyre Dialog ────────────────────────────────────────────────────────
function ScrapTyreDialog({ open, onClose, tyre }: { open: boolean; onClose: () => void; tyre: Tyre }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    scrapReason: '',
    scrapDate:   new Date().toISOString().split('T')[0],
    notes:       '',
  })

  const mutation = useMutation({
    mutationFn: () => tyresApi.scrapTyre(tyre.id, {
      scrapReason: form.scrapReason || undefined,
      scrapDate:   form.scrapDate   || undefined,
      notes:       form.notes       || undefined,
    }),
    onSuccess: () => {
      toast.success('Tyre marked as scrapped')
      qc.invalidateQueries({ queryKey: ['tyres'] })
      onClose()
    },
    onError: (e: unknown) => { const _m = getApiError(e, 'Failed to scrap tyre'); if (_m) toast.error(_m) },
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scrap Tyre</DialogTitle>
          <p className="text-sm text-gray-500">{tyre.serialNumber} — {tyre.brand} {tyre.size}</p>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            This tyre will be permanently scrapped. This action cannot be undone.
          </div>
          <div className="space-y-1.5">
            <Label>Scrap Reason</Label>
            <Input value={form.scrapReason} onChange={e => setForm(f => ({ ...f, scrapReason: e.target.value }))} placeholder="e.g. Burst, Sidewall damage, Expired, Casing too weak" />
          </div>
          <div className="space-y-1.5">
            <Label>Scrap Date</Label>
            <Input type="date" value={form.scrapDate} onChange={e => setForm(f => ({ ...f, scrapDate: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()} className="bg-red-600 hover:bg-red-700 text-white">
            {mutation.isPending ? 'Scrapping…' : 'Confirm Scrap'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tyre History Dialog ─────────────────────────────────────────────────────
function TyreHistoryDialog({ open, onClose, tyre }: { open: boolean; onClose: () => void; tyre: Tyre }) {
  const [tab, setTab] = useState<'fittings' | 'retreads'>('fittings')

  const { data: fittingData, isLoading: loadingFittings } = useQuery({
    queryKey: ['tyre-history', tyre.id],
    queryFn:  () => tyresApi.getTyreHistory(tyre.id),
    enabled:  open,
  })
  const { data: retreadData, isLoading: loadingRetreads } = useQuery({
    queryKey: ['tyre-retread-history', tyre.id],
    queryFn:  () => tyresApi.getRetreadHistory(tyre.id),
    enabled:  open,
  })
  const fittings: TyreFitting[]      = fittingData?.data ?? []
  const retreads: TyreRetreadLog[]   = retreadData?.data ?? []

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tyre History — {tyre.serialNumber}</DialogTitle>
          <p className="text-sm text-gray-500">{tyre.brand} · {tyre.size} · {TYRE_TYPE_LABELS[tyre.tyreType]}</p>
        </DialogHeader>
        <div className="pt-2">
          {/* Summary */}
          <div className="flex gap-6 text-sm text-gray-600 mb-4 flex-wrap">
            <span>Retread count: <strong>{tyre.retreadCount}x</strong></span>
            <span>Total lifetime KM: <strong>{Number(tyre.totalLifetimeKm).toLocaleString('en-IN')} km</strong></span>
            {(tyre.totalRetreadingCost ?? 0) > 0 && (
              <span>Total retread cost: <strong>₹{Number(tyre.totalRetreadingCost).toLocaleString('en-IN')}</strong></span>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-4">
            {(['fittings', 'retreads'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  tab === t ? 'bg-feros-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >
                {t === 'fittings' ? `Fitting History (${fittings.length})` : `Retread History (${retreads.length})`}
              </button>
            ))}
          </div>

          {/* Fittings tab */}
          {tab === 'fittings' && (
            loadingFittings ? (
              <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
            ) : fittings.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No fitting history yet</p>
            ) : (
              <div className="space-y-3">
                {fittings.map(f => (
                  <div key={f.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{f.vehicleRegistrationNumber} — Position {f.positionCode}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', f.removedDate ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700')}>
                        {f.removedDate ? 'Removed' : 'Currently Fitted'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div>Fitted: {fmtDate(f.fittedDate)} at {Number(f.fittedAtKm).toLocaleString('en-IN')} km</div>
                      {f.removedDate && (
                        <div>
                          Removed: {fmtDate(f.removedDate)} at {Number(f.removedAtKm).toLocaleString('en-IN')} km
                          · {f.removalReason?.replace('_', ' ')}
                          · {Number(f.kmDriven ?? 0).toLocaleString('en-IN')} km driven
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Retreads tab */}
          {tab === 'retreads' && (
            loadingRetreads ? (
              <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
            ) : retreads.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No retread history yet</p>
            ) : (
              <div className="space-y-3">
                {retreads.map(r => (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Retread #{r.retreadNumber}</span>
                      {r.retreadingCost && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          ₹{Number(r.retreadingCost).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {r.retreaderName && <div>Retreader: {r.retreaderName}</div>}
                      {r.sentDate && <div>Sent: {fmtDate(r.sentDate)}{r.kmAtSend ? ` at ${Number(r.kmAtSend).toLocaleString('en-IN')} km` : ''}</div>}
                      {r.returnDate && <div>Returned: {fmtDate(r.returnDate)}</div>}
                      {r.newMaxLifetimeKm && <div>New max life: {Number(r.newMaxLifetimeKm).toLocaleString('en-IN')} km</div>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
type ActiveFilter = TyreStatus | 'ALL'

export default function TyreInventoryPage() {
  const { locked } = useSubscription()
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<ActiveFilter>('ALL')
  const [addOpen, setAddOpen]           = useState(false)
  const [bulkAddOpen, setBulkAddOpen]   = useState(false)
  const [editTyre, setEditTyre]         = useState<Tyre | null>(null)
  const [fitTyre, setFitTyre]           = useState<Tyre | null>(null)
  const [removeTyre, setRemoveTyre]     = useState<Tyre | null>(null)
  const [backToStock, setBackToStock]   = useState<Tyre | null>(null)
  const [scrapTyre, setScrapTyre]       = useState<Tyre | null>(null)
  const [historyTyre, setHistoryTyre]   = useState<Tyre | null>(null)

  const { data, isLoading, refetch } = useQuery({ queryKey: ['tyres'], queryFn: tyresApi.getAll })
  const tyres: Tyre[] = data?.data ?? []

  const filtered = tyres.filter(t => {
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.serialNumber.toLowerCase().includes(q) ||
      t.brand.toLowerCase().includes(q) ||
      t.size.toLowerCase().includes(q) ||
      (t.currentVehicleRegistrationNumber ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const stats = {
    total:      tyres.length,
    inStock:    tyres.filter(t => t.status === 'IN_STOCK').length,
    fitted:     tyres.filter(t => t.status === 'FITTED').length,
    retreading: tyres.filter(t => t.status === 'RETREADING').length,
    scrapped:   tyres.filter(t => t.status === 'SCRAPPED').length,
  }

  const STAT_CARDS: { label: string; value: number; color: string; filter: ActiveFilter }[] = [
    { label: 'Total',      value: stats.total,      color: 'bg-gray-50   border-gray-200',   filter: 'ALL'        },
    { label: 'In Stock',   value: stats.inStock,    color: 'bg-green-50  border-green-200',  filter: 'IN_STOCK'   },
    { label: 'Fitted',     value: stats.fitted,     color: 'bg-blue-50   border-blue-200',   filter: 'FITTED'     },
    { label: 'Retreading', value: stats.retreading, color: 'bg-yellow-50 border-yellow-200', filter: 'RETREADING' },
    { label: 'Scrapped',   value: stats.scrapped,   color: 'bg-red-50    border-red-200',    filter: 'SCRAPPED'   },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tyre Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all tyres across the fleet</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" /> Refresh
          </Button>
          {!locked && (
            <>
              <Button size="sm" variant="outline" onClick={() => setBulkAddOpen(true)} className="gap-1.5">
                <Layers size={14} /> Bulk Add
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-1.5">
                <Plus size={14} /> Add Tyre
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stat cards — click to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STAT_CARDS.map(({ label, value, color, filter }) => (
          <button
            key={label}
            onClick={() => setStatusFilter(statusFilter === filter ? 'ALL' : filter)}
            className={cn('rounded-xl border p-4 text-left transition-all hover:shadow-sm', color, statusFilter === filter && 'ring-2 ring-feros-orange')}
          >
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-8 h-9"
          placeholder="Search serial, brand, size, vehicle…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No tyres found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Serial No.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand & Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle / Retreader</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lifetime KM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Retreads</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(tyre => (
                  <tr key={tyre.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium text-gray-800">{tyre.serialNumber}</p>
                      {tyre.expiryDate && (() => {
                        const daysLeft = Math.ceil((new Date(tyre.expiryDate).getTime() - Date.now()) / 86400000)
                        if (daysLeft < 0)
                          return <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Expired</span>
                        if (daysLeft <= 15)
                          return <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Expiring in {daysLeft}d</span>
                        return null
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{tyre.brand}</p>
                      <p className="text-xs text-gray-400">{tyre.size}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STATUS_COLORS[tyre.status])}>
                        {STATUS_LABELS[tyre.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tyre.status === 'FITTED' && tyre.currentVehicleRegistrationNumber ? (
                        <div>
                          <p className="font-medium text-gray-800">{tyre.currentVehicleRegistrationNumber}</p>
                          <p className="text-xs text-gray-400">{tyre.currentPositionCode}</p>
                        </div>
                      ) : tyre.status === 'RETREADING' ? (
                        <div>
                          <p className="font-medium text-gray-700">{tyre.retreaderName ?? '—'}</p>
                          {tyre.expectedReturnDate && (
                            <p className="text-xs text-gray-400">Due {fmtDate(tyre.expectedReturnDate)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{Number(tyre.totalLifetimeKm).toLocaleString('en-IN')} km</td>
                    <td className="px-4 py-3 text-gray-600">{tyre.retreadCount}x</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-gray-500 hover:text-gray-700"
                          onClick={() => setHistoryTyre(tyre)}>
                          <History size={12} /> History
                        </Button>
                        {tyre.status === 'IN_STOCK' && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditTyre(tyre)}>Edit</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => setScrapTyre(tyre)}>
                              Scrap
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-feros-navy hover:bg-feros-navy/90 text-white"
                              onClick={() => setFitTyre(tyre)}>
                              Fit to Vehicle
                            </Button>
                          </>
                        )}
                        {tyre.status === 'FITTED' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => setRemoveTyre(tyre)}>
                            Remove
                          </Button>
                        )}
                        {tyre.status === 'RETREADING' && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditTyre(tyre)}>Edit</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => setScrapTyre(tyre)}>
                              Scrap
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => setBackToStock(tyre)}>
                              Back to Stock
                            </Button>
                          </>
                        )}
                        {tyre.status === 'SCRAPPED' && (
                          <span className="text-xs text-gray-400 px-2">Scrapped</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {bulkAddOpen && <BulkAddTyreDialog open onClose={() => setBulkAddOpen(false)} />}
      {addOpen     && <AddEditTyreDialog open onClose={() => setAddOpen(false)} />}
      {editTyre    && <AddEditTyreDialog open onClose={() => setEditTyre(null)}    tyre={editTyre} />}
      {fitTyre     && <FitTyreDialog     open onClose={() => setFitTyre(null)}     tyre={fitTyre} />}
      {removeTyre  && <RemoveTyreDialog  open onClose={() => setRemoveTyre(null)}  tyre={removeTyre} />}
      {backToStock && <BackToStockDialog open onClose={() => setBackToStock(null)} tyre={backToStock} />}
      {scrapTyre   && <ScrapTyreDialog   open onClose={() => setScrapTyre(null)}   tyre={scrapTyre} />}
      {historyTyre && <TyreHistoryDialog open onClose={() => setHistoryTyre(null)} tyre={historyTyre} />}
    </div>
  )
}
