import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useSubscription } from '@/context/SubscriptionContext'
import { equipmentApi } from '@/api/equipment'
import { equipmentMastersApi } from '@/api/equipmentMasters'
import { getApiError } from '@/lib/apiError'
import type { Equipment, EquipmentRequest, EquipmentWorkStatus, HireRateUnit } from '@/api/equipment'
import type { EquipmentMake, EquipmentModel, EquipmentType } from '@/api/equipmentMasters'

// ── Badge helpers ─────────────────────────────────────────────────────────────
const WORK_STATUS_BADGE: Record<EquipmentWorkStatus, { label: string; className: string }> = {
  AVAILABLE:  { label: 'Available',   className: 'bg-green-100 text-green-700 border-green-200' },
  ASSIGNED:   { label: 'Assigned',    className: 'bg-blue-100 text-blue-700 border-blue-200' },
  BUSY:       { label: 'Busy',        className: 'bg-orange-100 text-orange-700 border-orange-200' },
  BREAKDOWN:  { label: 'Breakdown',   className: 'bg-red-100 text-red-700 border-red-200' },
  IN_REPAIR:  { label: 'In Repair',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
}

const HIRE_RATE_UNIT_LABELS: Record<HireRateUnit, string> = {
  PER_DAY:   'Per Day',
  PER_HOUR:  'Per Hour',
  PER_MONTH: 'Per Month',
}

function WorkStatusBadge({ status }: { status: EquipmentWorkStatus }) {
  const { label, className } = WORK_STATUS_BADGE[status]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>{label}</span>
}

// ── Form default ─────────────────────────────────────────────────────────────
const EMPTY_FORM: EquipmentRequest = {
  equipmentTypeId: 0,
  ownershipType: 'OWNED',
  isFinanced: false,
  workStatus: 'AVAILABLE',
  isActive: true,
}

// ── Add/Edit Dialog ───────────────────────────────────────────────────────────
function EquipmentFormDialog({
  open,
  onClose,
  editing,
  btnPrimary,
}: {
  open: boolean
  onClose: () => void
  editing: Equipment | null
  btnPrimary: string
}) {
  const qc = useQueryClient()

  const [form, setForm] = useState<EquipmentRequest>(EMPTY_FORM)
  const [selectedMakeId, setSelectedMakeId]   = useState('')
  const [selectedModelId, setSelectedModelId] = useState('')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  // Catalog data
  const { data: makesData }  = useQuery({ queryKey: ['eq-makes'],  queryFn: equipmentMastersApi.getMakes,  enabled: open })
  const { data: modelsData } = useQuery({
    queryKey: ['eq-models', selectedMakeId],
    queryFn: () => equipmentMastersApi.getModels(Number(selectedMakeId)),
    enabled: open && !!selectedMakeId,
  })
  const { data: typesData }  = useQuery({
    queryKey: ['eq-types', selectedModelId],
    queryFn: () => equipmentMastersApi.getTypes(Number(selectedModelId)),
    enabled: open && !!selectedModelId,
  })

  const makes:  EquipmentMake[]  = (makesData?.data  ?? []) as EquipmentMake[]
  const models: EquipmentModel[] = (modelsData?.data ?? []) as EquipmentModel[]
  const types:  EquipmentType[]  = (typesData?.data  ?? []) as EquipmentType[]

  // Populate form when dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    if (editing) {
      setSelectedMakeId(String(editing.makeId))
      setSelectedModelId(String(editing.modelId))
      setForm({
        equipmentTypeId:     editing.equipmentTypeId,
        ownershipType:       editing.ownershipType,
        serialNumber:        editing.serialNumber ?? undefined,
        registrationNumber:  editing.registrationNumber ?? undefined,
        manufactureYear:     editing.manufactureYear ?? undefined,
        color:               editing.color ?? undefined,
        chassisNumber:       editing.chassisNumber ?? undefined,
        engineNumber:        editing.engineNumber ?? undefined,
        fuelType:            editing.fuelType ?? undefined,
        fuelTankCapacity:    editing.fuelTankCapacity ?? undefined,
        isFinanced:          editing.isFinanced,
        financerName:        editing.financerName ?? undefined,
        financeStartDate:    editing.financeStartDate ?? undefined,
        financeEndDate:      editing.financeEndDate ?? undefined,
        hiredFrom:           editing.hiredFrom ?? undefined,
        hireStartDate:       editing.hireStartDate ?? undefined,
        hireEndDate:         editing.hireEndDate ?? undefined,
        hireRate:            editing.hireRate ?? undefined,
        hireRateUnit:        editing.hireRateUnit ?? undefined,
        currentMeterReading: editing.currentMeterReading ?? undefined,
        workStatus:          editing.workStatus,
        isActive:            editing.isActive,
        notes:               editing.notes ?? undefined,
      })
    } else {
      setSelectedMakeId('')
      setSelectedModelId('')
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [open])

  const mutCreate = useMutation({
    mutationFn: (d: EquipmentRequest) => equipmentApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment'] }); toast.success('Machine added'); onClose() },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed to add machine')),
  })
  const mutUpdate = useMutation({
    mutationFn: (d: EquipmentRequest) => equipmentApi.update(editing!.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment'] }); toast.success('Machine updated'); onClose() },
    onError: (e: unknown) => toast.error(getApiError(e, 'Failed to update machine')),
  })

  function set(field: keyof EquipmentRequest, value: unknown) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e: Partial<Record<string, string>> = {}
    if (!selectedMakeId)       e.makeId = 'Select a make'
    if (!selectedModelId)      e.modelId = 'Select a model'
    if (!form.equipmentTypeId) e.equipmentTypeId = 'Select a type'
    if (!form.ownershipType)   e.ownershipType = 'Select ownership type'
    if (form.ownershipType === 'HIRED_IN' && !form.hiredFrom?.trim()) e.hiredFrom = 'Hired from is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    if (editing) mutUpdate.mutate(form)
    else mutCreate.mutate(form)
  }

  const isOwned   = form.ownershipType === 'OWNED'
  const isHiredIn = form.ownershipType === 'HIRED_IN'
  const isPending = mutCreate.isPending || mutUpdate.isPending

  // Selected type for meter type display
  const selectedType = types.find(t => t.id === form.equipmentTypeId)

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Machine' : 'Add Machine'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">

          {/* Row 1: Make + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Make <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={selectedMakeId}
                onValueChange={v => { setSelectedMakeId(v); setSelectedModelId(''); set('equipmentTypeId', 0); setErrors(e => ({ ...e, makeId: undefined })) }}
                options={makes.map(m => ({ value: String(m.id), label: m.name }))}
                placeholder="Select make"
                triggerClassName={errors.makeId ? 'border-red-400' : ''}
              />
              {errors.makeId && <p className="text-red-500 text-xs mt-1">{errors.makeId}</p>}
            </div>
            <div>
              <Label>Model <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={selectedModelId}
                onValueChange={v => { setSelectedModelId(v); set('equipmentTypeId', 0); setErrors(e => ({ ...e, modelId: undefined })) }}
                options={models.map(m => ({ value: String(m.id), label: m.name }))}
                placeholder="Select model"
                disabled={!selectedMakeId}
                triggerClassName={errors.modelId ? 'border-red-400' : ''}
              />
              {errors.modelId && <p className="text-red-500 text-xs mt-1">{errors.modelId}</p>}
            </div>
          </div>

          {/* Row 2: Type */}
          <div>
            <Label>Equipment Type <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={form.equipmentTypeId ? String(form.equipmentTypeId) : ''}
              onValueChange={v => set('equipmentTypeId', Number(v))}
              options={types.map(t => ({ value: String(t.id), label: t.name }))}
              placeholder="Select equipment type"
              disabled={!selectedModelId}
              triggerClassName={errors.equipmentTypeId ? 'border-red-400' : ''}
            />
            {errors.equipmentTypeId && <p className="text-red-500 text-xs mt-1">{errors.equipmentTypeId}</p>}
            {selectedType && (
              <p className="text-xs text-gray-400 mt-1">
                Meter type: <span className="font-medium text-gray-600">{selectedType.defaultMeterType}</span>
                {selectedType.capacity != null && (
                  <span className="ml-3">Capacity: <span className="font-medium text-gray-600">{selectedType.capacity}{selectedType.capacityUnit}</span></span>
                )}
              </p>
            )}
          </div>

          {/* Row 3: Serial + Registration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Serial Number</Label>
              <Input className="mt-1" value={form.serialNumber ?? ''} onChange={e => set('serialNumber', e.target.value)} placeholder="e.g. SN123456" />
            </div>
            <div>
              <Label>Registration Number</Label>
              <Input className="mt-1" value={form.registrationNumber ?? ''} onChange={e => set('registrationNumber', e.target.value)} placeholder="e.g. KA01XY1234" />
            </div>
          </div>

          {/* Row 4: Chassis + Engine */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Chassis Number</Label>
              <Input className="mt-1" value={form.chassisNumber ?? ''} onChange={e => set('chassisNumber', e.target.value)} placeholder="e.g. CH123456789" />
            </div>
            <div>
              <Label>Engine Number</Label>
              <Input className="mt-1" value={form.engineNumber ?? ''} onChange={e => set('engineNumber', e.target.value)} placeholder="e.g. ENG987654321" />
            </div>
          </div>

          {/* Row 5: Year + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Manufacture Year</Label>
              <Input className="mt-1" type="number" min={1990} max={new Date().getFullYear()} value={form.manufactureYear ?? ''} onChange={e => set('manufactureYear', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 2022" />
            </div>
            <div>
              <Label>Color</Label>
              <Input className="mt-1" value={form.color ?? ''} onChange={e => set('color', e.target.value)} placeholder="e.g. Yellow" />
            </div>
          </div>

          {/* Row 6: Fuel Type + Tank Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fuel Type</Label>
              <SearchableSelect
                value={form.fuelType ?? ''}
                onValueChange={v => set('fuelType', v)}
                options={['Diesel', 'Petrol', 'Electric', 'CNG', 'Hybrid'].map(f => ({ value: f, label: f }))}
                placeholder="Select fuel type"
                showSearch={false}
              />
            </div>
            <div>
              <Label>Fuel Tank Capacity (L)</Label>
              <Input className="mt-1" type="number" min={0} step="any" value={form.fuelTankCapacity ?? ''} onChange={e => set('fuelTankCapacity', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 200" />
            </div>
          </div>

          {/* Row 7: Current Meter Reading */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Current Meter Reading</Label>
              <Input className="mt-1" type="number" min={0} step="any" value={form.currentMeterReading ?? ''} onChange={e => set('currentMeterReading', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 1500" />
            </div>
          </div>

          {/* Row 8: Ownership dropdown */}
          <div>
            <Label>Ownership Type <span className="text-red-500">*</span></Label>
            <SearchableSelect
              value={form.ownershipType}
              onValueChange={v => set('ownershipType', v as 'OWNED' | 'HIRED_IN')}
              options={[
                { value: 'OWNED',    label: 'Owned' },
                { value: 'HIRED_IN', label: 'Hired In' },
              ]}
              placeholder="Select ownership"
              showSearch={false}
              triggerClassName={errors.ownershipType ? 'border-red-400' : ''}
            />
          </div>

          {/* Finance (OWNED) */}
          {isOwned && (
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              {/* Toggle switch */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Under Finance</span>
                <div
                  onClick={() => set('isFinanced', !form.isFinanced)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.isFinanced ? 'bg-feros-equip-sidebar' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isFinanced ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </label>
              {form.isFinanced && (
                <>
                  <div>
                    <Label>Financer Name</Label>
                    <Input className="mt-1" value={form.financerName ?? ''} onChange={e => set('financerName', e.target.value)} placeholder="e.g. HDFC Bank" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Finance Start Date</Label>
                      <Input className="mt-1" type="date" value={form.financeStartDate ?? ''} onChange={e => set('financeStartDate', e.target.value)} />
                    </div>
                    <div>
                      <Label>Finance End Date</Label>
                      <Input className="mt-1" type="date" value={form.financeEndDate ?? ''} onChange={e => set('financeEndDate', e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Hire info (HIRED_IN) */}
          {isHiredIn && (
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hire Details</p>
              <div>
                <Label>Hired From <span className="text-red-500">*</span></Label>
                <Input className={`mt-1 ${errors.hiredFrom ? 'border-red-400' : ''}`} value={form.hiredFrom ?? ''} onChange={e => { set('hiredFrom', e.target.value); setErrors(er => ({ ...er, hiredFrom: undefined })) }} placeholder="Owner / company name" />
                {errors.hiredFrom && <p className="text-red-500 text-xs mt-1">{errors.hiredFrom}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hire Start Date</Label>
                  <Input className="mt-1" type="date" value={form.hireStartDate ?? ''} onChange={e => set('hireStartDate', e.target.value)} />
                </div>
                <div>
                  <Label>Hire End Date</Label>
                  <Input className="mt-1" type="date" value={form.hireEndDate ?? ''} onChange={e => set('hireEndDate', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hire Rate (₹)</Label>
                  <Input className="mt-1" type="number" min={0} value={form.hireRate ?? ''} onChange={e => set('hireRate', e.target.value ? Number(e.target.value) : undefined)} placeholder="Amount" />
                </div>
                <div>
                  <Label>Rate Unit</Label>
                  <SearchableSelect
                    value={form.hireRateUnit ?? ''}
                    onValueChange={v => set('hireRateUnit', v as HireRateUnit)}
                    options={(['PER_DAY', 'PER_HOUR', 'PER_MONTH'] as HireRateUnit[]).map(u => ({ value: u, label: HIRE_RATE_UNIT_LABELS[u] }))}
                    placeholder="Select"
                    showSearch={false}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Edit-only: Work Status + Active */}
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Work Status</Label>
                <SearchableSelect
                  value={form.workStatus ?? ''}
                  onValueChange={v => set('workStatus', v as EquipmentWorkStatus)}
                  options={Object.entries(WORK_STATUS_BADGE).map(([v, { label }]) => ({ value: v, label }))}
                  placeholder="Select"
                  showSearch={false}
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg px-3 py-2 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">Active</span>
                <div
                  onClick={() => set('isActive', !form.isActive)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.isActive ? 'bg-feros-equip-sidebar' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
              rows={2}
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" className={btnPrimary} disabled={isPending}>
              {isPending ? 'Saving…' : editing ? 'Update' : 'Add Machine'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function EquipmentListPage() {
  const { isEquipmentMode } = useSubscription()
  const btnPrimary = isEquipmentMode
    ? 'bg-feros-equip-sidebar hover:bg-feros-equip-sidebar/90 text-white'
    : 'bg-feros-navy hover:bg-feros-navy/90 text-white'

  const { data, isLoading } = useQuery({ queryKey: ['equipment'], queryFn: equipmentApi.getAll })
  const machines: Equipment[] = (data?.data ?? []) as Equipment[]

  const [search, setSearch]   = useState('')
  const [dlgOpen, setDlgOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)

  const filtered = machines.filter(m => {
    const q = search.toLowerCase()
    return (
      m.makeName.toLowerCase().includes(q) ||
      m.modelName.toLowerCase().includes(q) ||
      m.equipmentTypeName.toLowerCase().includes(q) ||
      (m.serialNumber ?? '').toLowerCase().includes(q) ||
      (m.registrationNumber ?? '').toLowerCase().includes(q)
    )
  })

  function openAdd() { setEditing(null); setDlgOpen(true) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machines</h1>
          <p className="text-gray-500 text-sm mt-0.5">{machines.length} total</p>
        </div>
        <Button onClick={openAdd} className={`${btnPrimary} gap-2`}>
          <Plus size={16} /> Add Machine
        </Button>
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-48 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search make, model, serial no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Make', 'Model', 'Type', 'Serial No.', 'Reg. No.', 'Ownership', 'Status', 'Work Status', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-sm">{search ? 'No machines match your search' : 'No machines yet. Click "Add Machine" to get started.'}</td></tr>
            ) : filtered.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{m.makeName}</td>
                <td className="px-3 py-2 text-gray-600">{m.modelName}</td>
                <td className="px-3 py-2 text-gray-600">{m.equipmentTypeName}</td>
                <td className="px-3 py-2 text-gray-500">{m.serialNumber ?? '—'}</td>
                <td className="px-3 py-2 text-gray-500">{m.registrationNumber ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium ${m.ownershipType === 'OWNED' ? 'text-gray-700' : 'text-purple-700'}`}>
                    {m.ownershipType === 'OWNED' ? 'Owned' : 'Hired In'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium ${m.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2"><WorkStatusBadge status={m.workStatus} /></td>
                <td className="px-3 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EquipmentFormDialog open={dlgOpen} onClose={() => setDlgOpen(false)} editing={editing} btnPrimary={btnPrimary} />
    </div>
  )
}
