import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, HardHat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
}: {
  open: boolean
  onClose: () => void
  editing: Equipment | null
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Machine' : 'Add Machine'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">

          {/* Catalog cascade */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Make <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={selectedMakeId}
                onValueChange={v => { setSelectedMakeId(v); setSelectedModelId(''); set('equipmentTypeId', 0); setErrors(e => ({ ...e, makeId: undefined })) }}
                options={makes.map(m => ({ value: String(m.id), label: m.name }))}
                placeholder="Make"
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
                placeholder="Model"
                disabled={!selectedMakeId}
                triggerClassName={errors.modelId ? 'border-red-400' : ''}
              />
              {errors.modelId && <p className="text-red-500 text-xs mt-1">{errors.modelId}</p>}
            </div>
            <div>
              <Label>Type <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={form.equipmentTypeId ? String(form.equipmentTypeId) : ''}
                onValueChange={v => set('equipmentTypeId', Number(v))}
                options={types.map(t => ({ value: String(t.id), label: t.name }))}
                placeholder="Type"
                disabled={!selectedModelId}
                triggerClassName={errors.equipmentTypeId ? 'border-red-400' : ''}
              />
              {errors.equipmentTypeId && <p className="text-red-500 text-xs mt-1">{errors.equipmentTypeId}</p>}
            </div>
          </div>

          {/* Basic info */}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Manufacture Year</Label>
              <Input className="mt-1" type="number" min={1990} max={new Date().getFullYear()} value={form.manufactureYear ?? ''} onChange={e => set('manufactureYear', e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 2022" />
            </div>
            <div>
              <Label>Meter Reading</Label>
              <Input className="mt-1" type="number" min={0} value={form.currentMeterReading ?? ''} onChange={e => set('currentMeterReading', e.target.value ? Number(e.target.value) : undefined)} placeholder="Current reading" />
            </div>
          </div>

          {/* Ownership */}
          <div>
            <Label>Ownership Type <span className="text-red-500">*</span></Label>
            <div className="flex gap-2 mt-1">
              {(['OWNED', 'HIRED_IN'] as const).map(ot => (
                <button
                  key={ot}
                  type="button"
                  onClick={() => set('ownershipType', ot)}
                  className={`flex-1 py-1.5 rounded-md border text-sm font-medium transition-colors
                    ${form.ownershipType === ot ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {ot === 'OWNED' ? 'Owned' : 'Hired In'}
                </button>
              ))}
            </div>
          </div>

          {/* Finance (OWNED) */}
          {isOwned && (
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" checked={!!form.isFinanced} onChange={e => set('isFinanced', e.target.checked)} />
                <span className="text-sm font-medium">Under Finance</span>
              </label>
              {form.isFinanced && (
                <div className="grid grid-cols-1 gap-3">
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
                </div>
              )}
            </div>
          )}

          {/* Hire info (HIRED_IN) */}
          {isHiredIn && (
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Hire Details</p>
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

          {/* Edit-only fields */}
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
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="isActive" className="rounded" checked={!!form.isActive} onChange={e => set('isActive', e.target.checked)} />
                <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Active</label>
              </div>
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-feros-navy/30"
              rows={2}
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Saving…' : editing ? 'Update' : 'Add Machine'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function EquipmentListPage() {
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
  function openEdit(m: Equipment) { setEditing(m); setDlgOpen(true) }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardHat size={20} className="text-feros-navy" />
          <h1 className="text-xl font-bold text-gray-900">Machines</h1>
          <Badge variant="outline" className="text-xs">{machines.length}</Badge>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} className="mr-1" /> Add Machine
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Input
          placeholder="Search make, model, serial no…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-3 h-8 text-sm"
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
                <td className="px-3 py-2">
                  <button onClick={() => openEdit(m)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <Pencil size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EquipmentFormDialog open={dlgOpen} onClose={() => setDlgOpen(false)} editing={editing} />
    </div>
  )
}
