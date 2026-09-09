import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, ToggleLeft, ToggleRight, Wifi, Globe, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { gpsHardwareApi } from '@/api/gpsHardware'
import type { GpsDeviceModel, GpsDeviceModelRequest, GpsConnectionType } from '@/api/gpsHardware'

const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong'

const CONNECTION_TYPE_LABELS: Record<GpsConnectionType, string> = {
  TCP: 'TCP (Raw Socket)',
  REST_API: 'REST API',
  WEBHOOK: 'Webhook',
}

const CONNECTION_TYPE_ICONS: Record<GpsConnectionType, React.ReactNode> = {
  TCP: <Wifi size={12} />,
  REST_API: <Globe size={12} />,
  WEBHOOK: <Webhook size={12} />,
}

const EMPTY_FORM: GpsDeviceModelRequest = {
  companyName: '',
  modelName: '',
  connectionType: 'TCP',
  parserKey: '',
  protocolVersion: '',
  description: '',
}

export function GpsHardwarePage() {
  const qc = useQueryClient()
  const [filterCompany, setFilterCompany] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<GpsDeviceModel | null>(null)
  const [form, setForm] = useState<GpsDeviceModelRequest>(EMPTY_FORM)
  const [errs, setErrs] = useState<Partial<Record<keyof GpsDeviceModelRequest, string>>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['gps-models', filterCompany],
    queryFn: () => gpsHardwareApi.getAll(filterCompany || undefined),
  })
  const models = data?.data ?? []

  const distinctCompanies = [...new Set(models.map(m => m.companyName))].sort()

  const mutCreate = useMutation({
    mutationFn: (d: GpsDeviceModelRequest) => gpsHardwareApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gps-models'] }); setOpen(false); toast.success('Device model added') },
    onError: e => toast.error(errMsg(e)),
  })
  const mutUpdate = useMutation({
    mutationFn: ({ id, d }: { id: number; d: GpsDeviceModelRequest }) => gpsHardwareApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gps-models'] }); setOpen(false); toast.success('Device model updated') },
    onError: e => toast.error(errMsg(e)),
  })
  const mutToggle = useMutation({
    mutationFn: (id: number) => gpsHardwareApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gps-models'] }),
    onError: e => toast.error(errMsg(e)),
  })

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setErrs({})
    setOpen(true)
  }

  function openEdit(item: GpsDeviceModel) {
    setEditItem(item)
    setForm({
      companyName: item.companyName,
      modelName: item.modelName,
      connectionType: item.connectionType,
      parserKey: item.parserKey,
      protocolVersion: item.protocolVersion ?? '',
      description: item.description ?? '',
    })
    setErrs({})
    setOpen(true)
  }

  function validate(): boolean {
    const e: typeof errs = {}
    if (!form.companyName.trim()) e.companyName = 'Required'
    if (!form.modelName.trim()) e.modelName = 'Required'
    if (!form.parserKey.trim()) e.parserKey = 'Required'
    setErrs(e)
    return Object.keys(e).length === 0
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    if (editItem) {
      mutUpdate.mutate({ id: editItem.id, d: form })
    } else {
      mutCreate.mutate(form)
    }
  }

  const filtered = filterCompany
    ? models.filter(m => m.companyName === filterCompany)
    : models

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">GPS Hardware Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage supported GPS device companies and models</p>
        </div>
        <Button size="sm" onClick={openAdd} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
          <Plus size={14} className="mr-1" /> Add Model
        </Button>
      </div>

      {/* Company filter */}
      {distinctCompanies.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCompany('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filterCompany ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            All
          </button>
          {distinctCompanies.map(c => (
            <button
              key={c}
              onClick={() => setFilterCompany(c === filterCompany ? '' : c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterCompany === c ? 'bg-feros-navy text-white border-feros-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Model</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Connection</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Protocol</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Parser Key</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No device models yet. Add one to get started.</td></tr>
            ) : (
              filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 font-medium">{m.companyName}</td>
                  <td className="px-4 py-3 text-gray-700">{m.modelName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                      {CONNECTION_TYPE_ICONS[m.connectionType]}
                      {CONNECTION_TYPE_LABELS[m.connectionType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{m.protocolVersion || '—'}</td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{m.parserKey}</code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={m.isActive ? 'default' : 'secondary'} className={m.isActive ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(m)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => mutToggle.mutate(m.id)}
                        className={`p-1.5 rounded ${m.isActive ? 'text-green-500 hover:text-red-400' : 'text-gray-400 hover:text-green-500'}`}
                        title={m.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {m.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Device Model' : 'Add Device Model'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Company Name <span className="text-red-500">*</span></Label>
                <Input
                  className={`mt-1 ${errs.companyName ? 'border-red-400' : ''}`}
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="e.g. iTriangle Infotech"
                />
                {errs.companyName && <p className="text-red-500 text-xs mt-1">{errs.companyName}</p>}
              </div>
              <div>
                <Label>Model Name <span className="text-red-500">*</span></Label>
                <Input
                  className={`mt-1 ${errs.modelName ? 'border-red-400' : ''}`}
                  value={form.modelName}
                  onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))}
                  placeholder="e.g. BHARAT101 2G"
                />
                {errs.modelName && <p className="text-red-500 text-xs mt-1">{errs.modelName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Connection Type <span className="text-red-500">*</span></Label>
                <Select value={form.connectionType} onValueChange={v => setForm(f => ({ ...f, connectionType: v as GpsConnectionType }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TCP">TCP (Raw Socket)</SelectItem>
                    <SelectItem value="REST_API">REST API</SelectItem>
                    <SelectItem value="WEBHOOK">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Protocol Version</Label>
                <Input
                  className="mt-1"
                  value={form.protocolVersion}
                  onChange={e => setForm(f => ({ ...f, protocolVersion: e.target.value }))}
                  placeholder="e.g. AIS140"
                />
              </div>
            </div>

            <div>
              <Label>Parser Key <span className="text-red-500">*</span></Label>
              <Input
                className={`mt-1 font-mono ${errs.parserKey ? 'border-red-400' : ''}`}
                value={form.parserKey}
                onChange={e => setForm(f => ({ ...f, parserKey: e.target.value.toUpperCase() }))}
                placeholder="e.g. ITRIANGLE_AIS140_V2"
              />
              {errs.parserKey
                ? <p className="text-red-500 text-xs mt-1">{errs.parserKey}</p>
                : <p className="text-gray-400 text-xs mt-1">Must match the code-level parser class key exactly.</p>
              }
            </div>

            <div>
              <Label>Description</Label>
              <textarea
                className="mt-1 w-full text-sm border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes about this device model"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" className="bg-feros-navy hover:bg-feros-navy/90 text-white">
                {editItem ? 'Update' : 'Add Model'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
