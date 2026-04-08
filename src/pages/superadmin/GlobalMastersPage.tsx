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
import { globalMastersApi } from '@/api/masters'
import { globalMastersWriteApi } from '@/api/superadmin'
import type { MasterItem, StateItem, CityItem, VehicleTypeItem, TaxItem, DocumentTypeItem } from '@/types'

// ── Generic simple CRUD section (name only) ───────────────────────────────────
function SimpleSection({
  title, items, isLoading,
  onAdd, onEdit, onDelete,
  addLabel = 'Add',
}: {
  title: string
  items: MasterItem[]
  isLoading: boolean
  onAdd: (name: string) => void
  onEdit: (item: MasterItem, name: string) => void
  onDelete: (id: number) => void
  addLabel?: string
}) {
  const [open, setOpen]       = useState(false)
  const [editItem, setEditItem] = useState<MasterItem | null>(null)
  const [name, setName]       = useState('')
  const [nameErr, setNameErr] = useState('')
  const [dlg, setDlg]         = useState<{ name: string; id: number } | null>(null)

  function openAdd() { setEditItem(null); setName(''); setNameErr(''); setOpen(true) }
  function openEdit(it: MasterItem) { setEditItem(it); setName(it.name); setNameErr(''); setOpen(true) }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameErr('Name is required'); return }
    setNameErr('')
    if (editItem) onEdit(editItem, name.trim())
    else onAdd(name.trim())
    setOpen(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}>
          <Plus size={12} className="mr-1" />{addLabel}
        </Button>
      </div>
      {isLoading ? (
        <div className="text-xs text-gray-400 py-3">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-gray-400 py-3">No items yet</div>
      ) : (
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
          <DialogHeader><DialogTitle>{editItem ? `Edit ${title}` : `Add ${title}`}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setNameErr('') }} className={`mt-1 ${nameErr ? 'border-red-400' : ''}`} autoFocus />
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
        title="Delete Item"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) onDelete(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── States section ────────────────────────────────────────────────────────────
function StatesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['g-states'], queryFn: globalMastersApi.getStates })
  const items = (data?.data ?? []) as StateItem[]
  const [open, setOpen]       = useState(false)
  const [editItem, setEditItem] = useState<StateItem | null>(null)
  const [name, setName]       = useState('')
  const [code, setCode]       = useState('')
  const [errs, setErrs]       = useState({ name: '', code: '' })
  const [dlg, setDlg]         = useState<{ name: string; id: number } | null>(null)

  const mutAdd = useMutation({ mutationFn: (d: { name: string; code: string }) => globalMastersWriteApi.createState(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-states'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { name: string; code: string } }) => globalMastersWriteApi.updateState(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-states'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutDel = useMutation({ mutationFn: (id: number) => globalMastersWriteApi.deleteState(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['g-states'] }), onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })

  function openAdd() { setEditItem(null); setName(''); setCode(''); setErrs({ name: '', code: '' }); setOpen(true) }
  function openEdit(it: StateItem) { setEditItem(it); setName(it.name); setCode(it.code); setErrs({ name: '', code: '' }); setOpen(true) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const e2 = { name: !name.trim() ? 'Name is required' : '', code: !code.trim() ? 'Code is required' : '' }
    setErrs(e2)
    if (e2.name || e2.code) return
    if (editItem) mutEdit.mutate({ id: editItem.id, d: { name: name.trim(), code: code.trim() } })
    else mutAdd.mutate({ name: name.trim(), code: code.trim() })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">States</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : items.length === 0 ? <div className="text-xs text-gray-400 py-3">No states yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <div><span className="text-sm text-gray-700">{it.name}</span><span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{it.code}</span></div>
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
          <DialogHeader><DialogTitle>{editItem ? 'Edit State' : 'Add State'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setErrs(v => ({ ...v, name: '' })) }} className={`mt-1 ${errs.name ? 'border-red-400' : ''}`} autoFocus />
              {errs.name && <p className="text-red-500 text-xs mt-1">{errs.name}</p>}
            </div>
            <div>
              <Label>Code <span className="text-red-500">*</span></Label>
              <Input value={code} onChange={e => { setCode(e.target.value); setErrs(v => ({ ...v, code: '' })) }} className={`mt-1 ${errs.code ? 'border-red-400' : ''}`} placeholder="e.g. MH" maxLength={4} />
              {errs.code && <p className="text-red-500 text-xs mt-1">{errs.code}</p>}
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
        title="Delete State"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── Cities section ────────────────────────────────────────────────────────────
function CitiesSection({ states }: { states: StateItem[] }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['g-cities'], queryFn: () => globalMastersApi.getCities() })
  const items = (data?.data ?? []) as CityItem[]
  const [open, setOpen]       = useState(false)
  const [editItem, setEditItem] = useState<CityItem | null>(null)
  const [name, setName]       = useState('')
  const [stateId, setStateId] = useState('')
  const [filterState, setFilterState] = useState('all')
  const [errs, setErrs]       = useState({ name: '', stateId: '' })
  const [dlg, setDlg]         = useState<{ name: string; id: number } | null>(null)

  const mutAdd  = useMutation({ mutationFn: (d: { name: string; stateId: number }) => globalMastersWriteApi.createCity(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-cities'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { name: string; stateId: number } }) => globalMastersWriteApi.updateCity(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-cities'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutDel  = useMutation({ mutationFn: (id: number) => globalMastersWriteApi.deleteCity(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['g-cities'] }), onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })

  function openAdd() { setEditItem(null); setName(''); setStateId(''); setErrs({ name: '', stateId: '' }); setOpen(true) }
  function openEdit(it: CityItem) { setEditItem(it); setName(it.name); setStateId(String(it.stateId)); setErrs({ name: '', stateId: '' }); setOpen(true) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const e2 = { name: !name.trim() ? 'Name is required' : '', stateId: !stateId ? 'Select a state' : '' }
    setErrs(e2)
    if (e2.name || e2.stateId) return
    if (editItem) mutEdit.mutate({ id: editItem.id, d: { name: name.trim(), stateId: Number(stateId) } })
    else mutAdd.mutate({ name: name.trim(), stateId: Number(stateId) })
  }

  const displayed = filterState === 'all' ? items : items.filter(c => String(c.stateId) === filterState)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Cities</h3>
        <div className="flex gap-2">
          <SearchableSelect
            value={filterState}
            onValueChange={setFilterState}
            options={[{ value: 'all', label: 'All States' }, ...states.map(s => ({ value: String(s.id), label: s.name }))]}
            className="w-32"
            triggerClassName="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
        </div>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : displayed.length === 0 ? <div className="text-xs text-gray-400 py-3">No cities yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          {displayed.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <div><span className="text-sm text-gray-700">{it.name}</span><span className="ml-2 text-xs text-gray-400">{it.stateName}</span></div>
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
          <DialogHeader><DialogTitle>{editItem ? 'Edit City' : 'Add City'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setErrs(v => ({ ...v, name: '' })) }} className={`mt-1 ${errs.name ? 'border-red-400' : ''}`} autoFocus />
              {errs.name && <p className="text-red-500 text-xs mt-1">{errs.name}</p>}
            </div>
            <div>
              <Label>State <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={stateId}
                onValueChange={v => { setStateId(v); setErrs(e => ({ ...e, stateId: '' })) }}
                options={states.map(s => ({ value: String(s.id), label: s.name }))}
                placeholder="Select state"
                className="mt-1"
                triggerClassName={errs.stateId ? 'border-red-400' : undefined}
              />
              {errs.stateId && <p className="text-red-500 text-xs mt-1">{errs.stateId}</p>}
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
        title="Delete City"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── Vehicle Types section ─────────────────────────────────────────────────────
function VehicleTypesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['g-vehicle-types'], queryFn: globalMastersApi.getVehicleTypes })
  const items = (data?.data ?? []) as VehicleTypeItem[]
  const [open, setOpen]         = useState(false)
  const [editItem, setEditItem] = useState<VehicleTypeItem | null>(null)
  const [name, setName]         = useState('')
  const [capacity, setCapacity] = useState('')
  const [tyres, setTyres]       = useState('')
  const [nameErr, setNameErr]   = useState('')
  const [dlg, setDlg]           = useState<{ name: string; id: number } | null>(null)

  const mutAdd  = useMutation({ mutationFn: (d: { name: string; capacityInTons?: number; tyreCount?: number }) => globalMastersWriteApi.createVehicleType(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-vehicle-types'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { name: string; capacityInTons?: number; tyreCount?: number } }) => globalMastersWriteApi.updateVehicleType(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-vehicle-types'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutDel  = useMutation({ mutationFn: (id: number) => globalMastersWriteApi.deleteVehicleType(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['g-vehicle-types'] }), onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })

  function openAdd() { setEditItem(null); setName(''); setCapacity(''); setTyres(''); setNameErr(''); setOpen(true) }
  function openEdit(it: VehicleTypeItem) { setEditItem(it); setName(it.name); setCapacity(String(it.capacityInTons ?? '')); setTyres(String(it.tyreCount ?? '')); setNameErr(''); setOpen(true) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameErr('Name is required'); return }
    setNameErr('')
    const d = { name: name.trim(), capacityInTons: capacity ? Number(capacity) : undefined, tyreCount: tyres ? Number(tyres) : undefined }
    if (editItem) mutEdit.mutate({ id: editItem.id, d })
    else mutAdd.mutate(d)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Vehicle Types</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : items.length === 0 ? <div className="text-xs text-gray-400 py-3">No vehicle types yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <div>
                <span className="text-sm text-gray-700">{it.name}</span>
                <span className="ml-2 text-xs text-gray-400">{it.capacityInTons}T · {it.tyreCount} tyres</span>
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
          <DialogHeader><DialogTitle>{editItem ? 'Edit Vehicle Type' : 'Add Vehicle Type'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setNameErr('') }} className={`mt-1 ${nameErr ? 'border-red-400' : ''}`} autoFocus />
              {nameErr && <p className="text-red-500 text-xs mt-1">{nameErr}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Capacity (tons)</Label><Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} className="mt-1" /></div>
              <div><Label>Tyre Count</Label><Input type="number" value={tyres} onChange={e => setTyres(e.target.value)} className="mt-1" /></div>
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
        title="Delete Vehicle Type"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── Document Types section ────────────────────────────────────────────────────
function DocumentTypesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['g-document-types'], queryFn: globalMastersApi.getDocumentTypes })
  const items = (data?.data ?? []) as DocumentTypeItem[]
  const [open, setOpen]           = useState(false)
  const [editItem, setEditItem]   = useState<DocumentTypeItem | null>(null)
  const [name, setName]           = useState('')
  const [applicableFor, setApplicableFor] = useState<'VEHICLE' | 'DRIVER' | 'BOTH'>('BOTH')
  const [nameErr, setNameErr]     = useState('')
  const [dlg, setDlg]             = useState<{ name: string; id: number } | null>(null)

  const mutAdd  = useMutation({ mutationFn: (d: { name: string; applicableFor: string }) => globalMastersWriteApi.createDocumentType(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-document-types'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { name: string; applicableFor: string } }) => globalMastersWriteApi.updateDocumentType(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-document-types'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutDel  = useMutation({ mutationFn: (id: number) => globalMastersWriteApi.deleteDocumentType(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['g-document-types'] }), onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })

  function openAdd() { setEditItem(null); setName(''); setApplicableFor('BOTH'); setNameErr(''); setOpen(true) }
  function openEdit(it: DocumentTypeItem) { setEditItem(it); setName(it.name); setApplicableFor(it.applicableFor); setNameErr(''); setOpen(true) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameErr('Name is required'); return }
    setNameErr('')
    if (editItem) mutEdit.mutate({ id: editItem.id, d: { name: name.trim(), applicableFor } })
    else mutAdd.mutate({ name: name.trim(), applicableFor })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Document Types</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : items.length === 0 ? <div className="text-xs text-gray-400 py-3">No document types yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <div>
                <span className="text-sm text-gray-700">{it.name}</span>
                <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{it.applicableFor}</span>
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
          <DialogHeader><DialogTitle>{editItem ? 'Edit Document Type' : 'Add Document Type'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setNameErr('') }} className={`mt-1 ${nameErr ? 'border-red-400' : ''}`} autoFocus />
              {nameErr && <p className="text-red-500 text-xs mt-1">{nameErr}</p>}
            </div>
            <div>
              <Label>Applicable For <span className="text-red-500">*</span></Label>
              <SearchableSelect
                value={applicableFor}
                onValueChange={v => setApplicableFor(v as 'VEHICLE' | 'DRIVER' | 'BOTH')}
                options={[
                  { value: 'VEHICLE', label: 'Vehicle' },
                  { value: 'DRIVER', label: 'Driver' },
                  { value: 'BOTH', label: 'Both' },
                ]}
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
        title="Delete Document Type"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── Taxes section ─────────────────────────────────────────────────────────────
function TaxesSection() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['g-taxes'], queryFn: globalMastersApi.getTaxes })
  const items = (data?.data ?? []) as TaxItem[]
  const [open, setOpen]         = useState(false)
  const [editItem, setEditItem] = useState<TaxItem | null>(null)
  const [name, setName]         = useState('')
  const [rate, setRate]         = useState('')
  const [taxType, setTaxType]   = useState('')
  const [errs, setErrs]         = useState({ name: '', rate: '', taxType: '' })
  const [dlg, setDlg]           = useState<{ name: string; id: number } | null>(null)

  const mutAdd  = useMutation({ mutationFn: (d: { name: string; rate: number; taxType: string }) => globalMastersWriteApi.createTax(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-taxes'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { name: string; rate: number; taxType: string } }) => globalMastersWriteApi.updateTax(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['g-taxes'] }); setOpen(false) }, onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })
  const mutDel  = useMutation({ mutationFn: (id: number) => globalMastersWriteApi.deleteTax(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['g-taxes'] }), onError: err => toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed') })

  function openAdd() { setEditItem(null); setName(''); setRate(''); setTaxType(''); setErrs({ name: '', rate: '', taxType: '' }); setOpen(true) }
  function openEdit(it: TaxItem) { setEditItem(it); setName(it.name); setRate(String(it.rate)); setTaxType(it.taxType); setErrs({ name: '', rate: '', taxType: '' }); setOpen(true) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const e2 = { name: !name.trim() ? 'Name is required' : '', rate: !rate ? 'Rate is required' : '', taxType: !taxType.trim() ? 'Tax type is required' : '' }
    setErrs(e2)
    if (e2.name || e2.rate || e2.taxType) return
    const d = { name: name.trim(), rate: Number(rate), taxType: taxType.trim() }
    if (editItem) mutEdit.mutate({ id: editItem.id, d })
    else mutAdd.mutate(d)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Taxes</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openAdd}><Plus size={12} className="mr-1" />Add</Button>
      </div>
      {isLoading ? <div className="text-xs text-gray-400 py-3">Loading…</div> : items.length === 0 ? <div className="text-xs text-gray-400 py-3">No taxes yet</div> : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {items.map(it => (
            <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
              <div>
                <span className="text-sm text-gray-700">{it.name}</span>
                <span className="ml-2 text-xs text-gray-400">{it.rate}% · {it.taxType}</span>
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
          <DialogHeader><DialogTitle>{editItem ? 'Edit Tax' : 'Add Tax'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={e => { setName(e.target.value); setErrs(v => ({ ...v, name: '' })) }} className={`mt-1 ${errs.name ? 'border-red-400' : ''}`} autoFocus />
              {errs.name && <p className="text-red-500 text-xs mt-1">{errs.name}</p>}
            </div>
            <div>
              <Label>Rate (%) <span className="text-red-500">*</span></Label>
              <Input type="number" value={rate} onChange={e => { setRate(e.target.value); setErrs(v => ({ ...v, rate: '' })) }} className={`mt-1 ${errs.rate ? 'border-red-400' : ''}`} step="0.01" />
              {errs.rate && <p className="text-red-500 text-xs mt-1">{errs.rate}</p>}
            </div>
            <div>
              <Label>Tax Type <span className="text-red-500">*</span></Label>
              <Input value={taxType} onChange={e => { setTaxType(e.target.value); setErrs(v => ({ ...v, taxType: '' })) }} className={`mt-1 ${errs.taxType ? 'border-red-400' : ''}`} placeholder="e.g. GST, IGST" />
              {errs.taxType && <p className="text-red-500 text-xs mt-1">{errs.taxType}</p>}
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
        title="Delete Tax"
        description={`Delete "${dlg?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (dlg) mutDel.mutate(dlg.id); setDlg(null) }}
        onCancel={() => setDlg(null)}
      />
    </div>
  )
}

// ── helper: make a simple section using the pattern ───────────────────────────
function makeSimpleSection(
  title: string,
  queryKey: string,
  queryFn: () => Promise<{ data?: MasterItem[] }>,
  createFn: (d: { name: string }) => Promise<unknown>,
  updateFn: (id: number, d: { name: string }) => Promise<unknown>,
  deleteFn: (id: number) => Promise<unknown>,
) {
  return function Section() {
    const qc = useQueryClient()
    const { data, isLoading } = useQuery({ queryKey: [queryKey], queryFn })
    const items = (data?.data ?? []) as MasterItem[]
    const err = (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed')
    const mutAdd  = useMutation({ mutationFn: (d: { name: string }) => createFn(d), onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }), onError: err })
    const mutEdit = useMutation({ mutationFn: ({ id, d }: { id: number; d: { name: string } }) => updateFn(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }), onError: err })
    const mutDel  = useMutation({ mutationFn: (id: number) => deleteFn(id), onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }), onError: err })
    return (
      <SimpleSection
        title={title}
        items={items}
        isLoading={isLoading}
        onAdd={name => mutAdd.mutate({ name })}
        onEdit={(it, name) => mutEdit.mutate({ id: it.id, d: { name } })}
        onDelete={id => mutDel.mutate(id)}
      />
    )
  }
}

const VehicleBrandsSection    = makeSimpleSection('Vehicle Brands',    'g-vehicle-brands',    globalMastersApi.getVehicleBrands,    globalMastersWriteApi.createVehicleBrand,  globalMastersWriteApi.updateVehicleBrand,  globalMastersWriteApi.deleteVehicleBrand)
const FuelTypesSection        = makeSimpleSection('Fuel Types',        'g-fuel-types',        globalMastersApi.getFuelTypes,         globalMastersWriteApi.createFuelType,      globalMastersWriteApi.updateFuelType,      globalMastersWriteApi.deleteFuelType)
const MaterialTypesSection    = makeSimpleSection('Material Types',    'g-material-types',    globalMastersApi.getMaterialTypes,     globalMastersWriteApi.createMaterialType,  globalMastersWriteApi.updateMaterialType,  globalMastersWriteApi.deleteMaterialType)
const AttendanceTypesSection  = makeSimpleSection('Attendance Types',  'g-attendance-types',  globalMastersApi.getAttendanceTypes,   globalMastersWriteApi.createAttendanceType,globalMastersWriteApi.updateAttendanceType,globalMastersWriteApi.deleteAttendanceType)
const LeaveTypesSection       = makeSimpleSection('Leave Types',       'g-leave-types',       globalMastersApi.getLeaveTypes,        globalMastersWriteApi.createLeaveType,     globalMastersWriteApi.updateLeaveType,     globalMastersWriteApi.deleteLeaveType)
const EmploymentTypesSection  = makeSimpleSection('Employment Types',  'g-employment-types',  globalMastersApi.getEmploymentTypes,   globalMastersWriteApi.createEmploymentType,globalMastersWriteApi.updateEmploymentType,globalMastersWriteApi.deleteEmploymentType)
const OwnershipTypesSection   = makeSimpleSection('Ownership Types',   'g-ownership-types',   globalMastersApi.getOwnershipTypes,    globalMastersWriteApi.createOwnershipType, globalMastersWriteApi.updateOwnershipType, globalMastersWriteApi.deleteOwnershipType)
const DeductionTypesSection   = makeSimpleSection('Deduction Types',   'g-deduction-types',   globalMastersApi.getDeductionTypes,    globalMastersWriteApi.createDeductionType, globalMastersWriteApi.updateDeductionType, globalMastersWriteApi.deleteDeductionType)
const PaymentStatusesSection  = makeSimpleSection('Payment Statuses',  'g-payment-statuses',  globalMastersApi.getPaymentStatuses,   globalMastersWriteApi.createPaymentStatus, globalMastersWriteApi.updatePaymentStatus, globalMastersWriteApi.deletePaymentStatus)

// ── Section registry ──────────────────────────────────────────────────────────
type SectionId =
  | 'states' | 'cities' | 'vehicleBrands' | 'vehicleTypes' | 'fuelTypes'
  | 'materialTypes' | 'documentTypes' | 'attendanceTypes' | 'leaveTypes'
  | 'employmentTypes' | 'ownershipTypes' | 'deductionTypes' | 'taxes' | 'paymentStatuses'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'states',          label: 'States' },
  { id: 'cities',          label: 'Cities' },
  { id: 'vehicleBrands',   label: 'Vehicle Brands' },
  { id: 'vehicleTypes',    label: 'Vehicle Types' },
  { id: 'fuelTypes',       label: 'Fuel Types' },
  { id: 'materialTypes',   label: 'Material Types' },
  { id: 'documentTypes',   label: 'Document Types' },
  { id: 'attendanceTypes', label: 'Attendance Types' },
  { id: 'leaveTypes',      label: 'Leave Types' },
  { id: 'employmentTypes', label: 'Employment Types' },
  { id: 'ownershipTypes',  label: 'Ownership Types' },
  { id: 'deductionTypes',  label: 'Deduction Types' },
  { id: 'taxes',           label: 'Taxes' },
  { id: 'paymentStatuses', label: 'Payment Statuses' },
]

// ── Main Page ─────────────────────────────────────────────────────────────────
export function GlobalMastersPage() {
  const [active, setActive] = useState<SectionId>('states')

  const { data: statesData } = useQuery({ queryKey: ['g-states'], queryFn: globalMastersApi.getStates })
  const states = ((statesData?.data ?? []) as StateItem[])

  const content: Record<SectionId, React.ReactNode> = {
    states:          <StatesSection />,
    cities:          <CitiesSection states={states} />,
    vehicleBrands:   <VehicleBrandsSection />,
    vehicleTypes:    <VehicleTypesSection />,
    fuelTypes:       <FuelTypesSection />,
    materialTypes:   <MaterialTypesSection />,
    documentTypes:   <DocumentTypesSection />,
    attendanceTypes: <AttendanceTypesSection />,
    leaveTypes:      <LeaveTypesSection />,
    employmentTypes: <EmploymentTypesSection />,
    ownershipTypes:  <OwnershipTypesSection />,
    deductionTypes:  <DeductionTypesSection />,
    taxes:           <TaxesSection />,
    paymentStatuses: <PaymentStatusesSection />,
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Global Masters</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage system-wide master data shared across all tenants</p>
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
