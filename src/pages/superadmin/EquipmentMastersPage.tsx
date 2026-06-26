import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { equipmentMastersApi } from '@/api/equipmentMasters'
import type { EquipmentMake, EquipmentModel, EquipmentType } from '@/api/equipmentMasters'

const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'

// ── Makes Section ─────────────────────────────────────────────────────────────
function MakesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['eq-makes'], queryFn: equipmentMastersApi.getMakes })
  const items = (data?.data ?? []) as EquipmentMake[]
  const [open, setOpen]         = useState(false)
  const [editItem, setEditItem] = useState<EquipmentMake | null>(null)
  const [name, setName]         = useState('')
  const [nameErr, setNameErr]   = useState('')
  const [dlg, setDlg]           = useState<{ name: string; id: number } | null>(null)

  const mutAdd  = useMutation({ mutationFn: (d: { name: string }) => equipmentMastersApi.createMake(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-makes'] }); setOpen(false) }, onError: e => toast.error(errMsg(e)) })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { name: string } }) => equipmentMastersApi.updateMake(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-makes'] }); setOpen(false) }, onError: e => toast.error(errMsg(e)) })
  const mutDel  = useMutation({ mutationFn: (id: number) => equipmentMastersApi.deleteMake(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['eq-makes'] }), onError: e => toast.error(errMsg(e)) })

  function openAdd() { setEditItem(null); setName(''); setNameErr(''); setOpen(true) }
  function openEdit(it: EquipmentMake) { setEditItem(it); setName(it.name); setNameErr(''); setOpen(true) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameErr('Name is required'); return }
    setNameErr('')
    if (editItem) mutEdit.mutate({ id: editItem.id, d: { name: name.trim() } })
    else mutAdd.mutate({ name: name.trim() })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Equipment Makes</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : items.length === 0 ? <div className="text-xs text-gray-400 py-3">No makes yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <span className="text-sm text-gray-700">{it.name}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(it)} className="p-1 text-gray-400 hover:text-gray-600"><Pencil size={11} /></button>
                <button onClick={() => setDlg({ name: it.name, id: it.id })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Make' : 'Add Make'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setNameErr('') }} className={`mt-1 ${nameErr ? 'border-red-400' : ''}`} autoFocus placeholder="e.g. JCB, Volvo, Caterpillar" />
              {nameErr && <p className="text-red-500 text-xs mt-1">{nameErr}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm">{editItem ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!dlg}
        title="Delete Make"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── Models Section ────────────────────────────────────────────────────────────
function ModelsSection({ makes }: { makes: EquipmentMake[] }) {
  const qc = useQueryClient()
  const [filterMake, setFilterMake] = useState('all')
  const makeId = filterMake !== 'all' ? Number(filterMake) : undefined
  const { data, isLoading } = useQuery({ queryKey: ['eq-models', filterMake], queryFn: () => equipmentMastersApi.getModels(makeId) })
  const items = (data?.data ?? []) as EquipmentModel[]
  const [open, setOpen]         = useState(false)
  const [editItem, setEditItem] = useState<EquipmentModel | null>(null)
  const [name, setName]         = useState('')
  const [selectedMake, setSelectedMake] = useState('')
  const [errs, setErrs]         = useState({ name: '', makeId: '' })
  const [dlg, setDlg]           = useState<{ name: string; id: number } | null>(null)

  const mutAdd  = useMutation({ mutationFn: (d: { makeId: number; name: string }) => equipmentMastersApi.createModel(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-models'] }); setOpen(false) }, onError: e => toast.error(errMsg(e)) })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { makeId: number; name: string } }) => equipmentMastersApi.updateModel(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-models'] }); setOpen(false) }, onError: e => toast.error(errMsg(e)) })
  const mutDel  = useMutation({ mutationFn: (id: number) => equipmentMastersApi.deleteModel(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['eq-models'] }), onError: e => toast.error(errMsg(e)) })

  function openAdd() { setEditItem(null); setName(''); setSelectedMake(''); setErrs({ name: '', makeId: '' }); setOpen(true) }
  function openEdit(it: EquipmentModel) { setEditItem(it); setName(it.name); setSelectedMake(String(it.makeId)); setErrs({ name: '', makeId: '' }); setOpen(true) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const e2 = { name: !name.trim() ? 'Name is required' : '', makeId: !selectedMake ? 'Select a make' : '' }
    setErrs(e2)
    if (e2.name || e2.makeId) return
    const d = { name: name.trim(), makeId: Number(selectedMake) }
    if (editItem) mutEdit.mutate({ id: editItem.id, d })
    else mutAdd.mutate(d)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Equipment Models</h3>
        <div className="flex gap-2">
          <SearchableSelect
            value={filterMake}
            onValueChange={setFilterMake}
            options={[{ value: 'all', label: 'All Makes' }, ...makes.map(m => ({ value: String(m.id), label: m.name }))]}
            className="w-32"
            triggerClassName="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
        </div>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : items.length === 0 ? <div className="text-xs text-gray-400 py-3">No models yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <div>
                <span className="text-sm text-gray-700">{it.name}</span>
                <span className="ml-2 text-xs text-gray-400">{it.makeName}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(it)} className="p-1 text-gray-400 hover:text-gray-600"><Pencil size={11} /></button>
                <button onClick={() => setDlg({ name: it.name, id: it.id })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Model' : 'Add Model'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Make <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={selectedMake}
                onValueChange={v => { setSelectedMake(v); setErrs(p => ({ ...p, makeId: '' })) }}
                options={makes.map(m => ({ value: String(m.id), label: m.name }))}
                placeholder="Select make"
                className="mt-1"
                triggerClassName={errs.makeId ? 'border-red-400' : undefined}
              />
              {errs.makeId && <p className="text-red-500 text-xs mt-1">{errs.makeId}</p>}
            </div>
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setErrs(p => ({ ...p, name: '' })) }} className={`mt-1 ${errs.name ? 'border-red-400' : ''}`} autoFocus placeholder="e.g. 3CX, JS205" />
              {errs.name && <p className="text-red-500 text-xs mt-1">{errs.name}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm">{editItem ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!dlg}
        title="Delete Model"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── Types Section ─────────────────────────────────────────────────────────────
function TypesSection({ makes }: { makes: EquipmentMake[] }) {
  const qc = useQueryClient()
  const [filterModel, setFilterModel] = useState('all')
  const modelId = filterModel !== 'all' ? Number(filterModel) : undefined
  const { data, isLoading } = useQuery({ queryKey: ['eq-types', filterModel], queryFn: () => equipmentMastersApi.getTypes(modelId) })
  const items = (data?.data ?? []) as EquipmentType[]

  // All models needed for filter + form
  const { data: allModelsData } = useQuery({ queryKey: ['eq-models', 'all'], queryFn: () => equipmentMastersApi.getModels() })
  const allModels = (allModelsData?.data ?? []) as EquipmentModel[]

  const [open, setOpen]           = useState(false)
  const [editItem, setEditItem]   = useState<EquipmentType | null>(null)
  const [name, setName]           = useState('')
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [meterType, setMeterType] = useState<'OMR' | 'HMR' | 'BOTH'>('HMR')
  const [errs, setErrs]           = useState({ name: '', modelId: '' })
  const [dlg, setDlg]             = useState<{ name: string; id: number } | null>(null)

  // Models filtered by selected make in form
  const formModels = selectedMake ? allModels.filter(m => String(m.makeId) === selectedMake) : allModels

  const mutAdd  = useMutation({ mutationFn: (d: { modelId: number; name: string; defaultMeterType: string }) => equipmentMastersApi.createType(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-types'] }); setOpen(false) }, onError: e => toast.error(errMsg(e)) })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { modelId: number; name: string; defaultMeterType: string } }) => equipmentMastersApi.updateType(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['eq-types'] }); setOpen(false) }, onError: e => toast.error(errMsg(e)) })
  const mutDel  = useMutation({ mutationFn: (id: number) => equipmentMastersApi.deleteType(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['eq-types'] }), onError: e => toast.error(errMsg(e)) })

  function openAdd() { setEditItem(null); setName(''); setSelectedMake(''); setSelectedModel(''); setMeterType('HMR'); setErrs({ name: '', modelId: '' }); setOpen(true) }
  function openEdit(it: EquipmentType) {
    setEditItem(it); setName(it.name); setSelectedMake(String(it.makeId)); setSelectedModel(String(it.modelId))
    setMeterType(it.defaultMeterType); setErrs({ name: '', modelId: '' }); setOpen(true)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const e2 = { name: !name.trim() ? 'Name is required' : '', modelId: !selectedModel ? 'Select a model' : '' }
    setErrs(e2)
    if (e2.name || e2.modelId) return
    const d = { name: name.trim(), modelId: Number(selectedModel), defaultMeterType: meterType }
    if (editItem) mutEdit.mutate({ id: editItem.id, d })
    else mutAdd.mutate(d)
  }

  // All models for filter dropdown
  const filterModels = [{ value: 'all', label: 'All Models' }, ...allModels.map(m => ({ value: String(m.id), label: `${m.makeName} — ${m.name}` }))]

  const meterTypeOptions = [
    { value: 'OMR', label: 'OMR (Odometer)' },
    { value: 'HMR', label: 'HMR (Hour Meter)' },
    { value: 'BOTH', label: 'Both' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Equipment Types</h3>
        <div className="flex gap-2">
          <SearchableSelect
            value={filterModel}
            onValueChange={setFilterModel}
            options={filterModels}
            className="w-40"
            triggerClassName="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
        </div>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : items.length === 0 ? <div className="text-xs text-gray-400 py-3">No types yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <div>
                <span className="text-sm text-gray-700">{it.name}</span>
                <span className="ml-2 text-xs text-gray-400">{it.makeName} · {it.modelName}</span>
                <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{it.defaultMeterType}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(it)} className="p-1 text-gray-400 hover:text-gray-600"><Pencil size={11} /></button>
                <button onClick={() => setDlg({ name: it.name, id: it.id })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>{editItem ? 'Edit Equipment Type' : 'Add Equipment Type'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Make</Label>
              <SearchableSelect
                value={selectedMake}
                onValueChange={v => { setSelectedMake(v); setSelectedModel('') }}
                options={[{ value: '', label: 'All Makes' }, ...makes.map(m => ({ value: String(m.id), label: m.name }))]}
                placeholder="Filter by make (optional)"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Model <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={selectedModel}
                onValueChange={v => { setSelectedModel(v); setErrs(p => ({ ...p, modelId: '' })) }}
                options={formModels.map(m => ({ value: String(m.id), label: m.name }))}
                placeholder="Select model"
                className="mt-1"
                triggerClassName={errs.modelId ? 'border-red-400' : undefined}
              />
              {errs.modelId && <p className="text-red-500 text-xs mt-1">{errs.modelId}</p>}
            </div>
            <div>
              <Label>Type Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setErrs(p => ({ ...p, name: '' })) }} className={`mt-1 ${errs.name ? 'border-red-400' : ''}`} autoFocus placeholder="e.g. Backhoe Loader, Excavator" />
              {errs.name && <p className="text-red-500 text-xs mt-1">{errs.name}</p>}
            </div>
            <div>
              <Label>Default Meter Type <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={meterType}
                onValueChange={v => setMeterType(v as 'OMR' | 'HMR' | 'BOTH')}
                options={meterTypeOptions}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm">{editItem ? 'Update' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!dlg}
        title="Delete Equipment Type"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── Section registry ──────────────────────────────────────────────────────────
type SectionId = 'makes' | 'models' | 'types'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'makes',  label: 'Makes' },
  { id: 'models', label: 'Models' },
  { id: 'types',  label: 'Equipment Types' },
]

// ── Main Page ─────────────────────────────────────────────────────────────────
export function EquipmentMastersPage() {
  const [active, setActive] = useState<SectionId>('makes')

  const { data: makesData } = useQuery({ queryKey: ['eq-makes'], queryFn: equipmentMastersApi.getMakes })
  const makes = (makesData?.data ?? []) as EquipmentMake[]

  const content: Record<SectionId, React.ReactNode> = {
    makes:  <MakesSection />,
    models: <ModelsSection makes={makes} />,
    types:  <TypesSection makes={makes} />,
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Equipment Masters</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage equipment catalog — makes, models, and types used across all tenants</p>
      </div>

      <div className="flex gap-6 min-h-[520px]">
        {/* Sidebar */}
        <div className="w-52 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 border-b bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase">Categories</p>
          </div>
          <nav className="py-2">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${active === s.id ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          {content[active]}
        </div>
      </div>
    </div>
  )
}
