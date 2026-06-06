import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Plus, Trash2, ArrowLeft, CheckCircle, XCircle, Loader2,
  Link, Link2Off, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { gpsApi } from '@/api/gps'
import type {
  GpsProviderConfig, GpsProviderVehicle, GpsProviderConfigRequest,
  GpsProviderType, VehicleGpsMappingRequest,
} from '@/types'

// ─── Provider labels ───────────────────────────────────────────────────────────
const PROVIDER_OPTIONS: { value: GpsProviderType; label: string }[] = [
  { value: 'TATA_FLEET_EDGE', label: 'TATA Fleet Edge' },
  { value: 'BLACKBUCK',       label: 'Blackbuck Omnicom' },
  { value: 'VAMOSYS',         label: 'Vamosys' },
  { value: 'FLEETX',          label: 'Fleetx' },
  { value: 'CUSTOM',          label: 'Custom' },
]

function providerLabel(type: GpsProviderType) {
  return PROVIDER_OPTIONS.find(o => o.value === type)?.label ?? type
}

function syncBadge(status: string) {
  if (status === 'OK')    return <Badge className="bg-green-100 text-green-700 border-0">Connected</Badge>
  if (status === 'ERROR') return <Badge className="bg-red-100 text-red-700 border-0">Error</Badge>
  return <Badge variant="secondary">Not tested</Badge>
}

// ─── Add/Edit Config Dialog ────────────────────────────────────────────────────
function ConfigDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing: GpsProviderConfig | null
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GpsProviderConfigRequest>()

  const save = useMutation({
    mutationFn: (data: GpsProviderConfigRequest) =>
      editing ? gpsApi.updateConfig(editing.id, data) : gpsApi.createConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gps-configs'] })
      toast.success(editing ? 'Config updated' : 'GPS provider added')
      reset()
      onClose()
    },
    onError: () => toast.error('Failed to save config'),
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit GPS Provider' : 'Add GPS Provider'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => save.mutate(d))} className="space-y-4 pt-2">
          <div>
            <Label>Provider</Label>
            <select
              {...register('providerType', { required: true })}
              defaultValue={editing?.providerType ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy"
            >
              <option value="" disabled>Select provider</option>
              {PROVIDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.providerType && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>

          <div>
            <Label>Display Name <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input {...register('displayName')} defaultValue={editing?.displayName ?? ''} className="mt-1" placeholder="e.g. Main Fleet" />
          </div>

          <div>
            <Label>Client ID</Label>
            <Input {...register('clientId', { required: true })} className="mt-1" placeholder="Your provider client ID" />
            {errors.clientId && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>

          <div>
            <Label>Client Secret</Label>
            <Input {...register('clientSecret', { required: true })} type="password" className="mt-1" placeholder="Your provider client secret" />
            {errors.clientSecret && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>

          <div>
            <Label>API Base URL <span className="text-gray-400 font-normal">(optional — uses provider default)</span></Label>
            <Input {...register('apiBaseUrl')} defaultValue={editing?.apiBaseUrl ?? ''} className="mt-1" placeholder="https://..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
              {editing ? 'Update' : 'Add Provider'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Vehicle Mapping Panel (for one config) ────────────────────────────────────
function MappingPanel({ config }: { config: GpsProviderConfig }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: providerVehicles, isLoading: loadingPV } = useQuery({
    queryKey: ['gps-provider-vehicles', config.id],
    queryFn: () => gpsApi.getProviderVehicles(config.id).then(r => r.data ?? []),
    enabled: open,
  })

  const { data: mappings } = useQuery({
    queryKey: ['gps-mappings'],
    queryFn: () => gpsApi.getMappings().then(r => r.data ?? []),
  })

  const addMapping = useMutation({
    mutationFn: (data: VehicleGpsMappingRequest) => gpsApi.createMapping(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gps-mappings'] })
      qc.invalidateQueries({ queryKey: ['gps-fleet'] })
      toast.success('Vehicle linked to GPS')
    },
    onError: () => toast.error('Failed to link vehicle'),
  })

  const removeMapping = useMutation({
    mutationFn: (id: number) => gpsApi.deleteMapping(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gps-mappings'] })
      qc.invalidateQueries({ queryKey: ['gps-fleet'] })
      toast.success('Mapping removed')
    },
  })

  const configMappings = (mappings ?? []).filter(m => m.gpsProviderConfigId === config.id)

  function getMappingForVehicle(pv: GpsProviderVehicle) {
    return configMappings.find(m => m.providerVehicleId === pv.providerVehicleId)
  }

  function handleLink(pv: GpsProviderVehicle) {
    if (!pv.ferosVehicleId) return
    addMapping.mutate({
      vehicleId: pv.ferosVehicleId,
      gpsProviderConfigId: config.id,
      providerVehicleId: pv.providerVehicleId,
      providerRegNumber: pv.registrationNumber,
    })
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
      >
        <span>Vehicle Mapping ({configMappings.length} linked)</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="overflow-x-auto">
          {loadingPV ? (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <Loader2 size={18} className="animate-spin mr-2" /> Fetching vehicles from provider...
            </div>
          ) : (providerVehicles ?? []).length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">
              No vehicles returned from provider. Check your credentials.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Provider Vehicle ID</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Reg Number</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">FEROS Match</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {(providerVehicles ?? []).map(pv => {
                  const mapping = getMappingForVehicle(pv)
                  return (
                    <tr key={pv.providerVehicleId} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">{pv.providerVehicleId}</td>
                      <td className="px-4 py-2 font-medium">{pv.registrationNumber}</td>
                      <td className="px-4 py-2">
                        {pv.autoMatched
                          ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Auto-matched</Badge>
                          : <span className="text-gray-400 text-xs">No match</span>
                        }
                      </td>
                      <td className="px-4 py-2">
                        {mapping ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs"
                            onClick={() => removeMapping.mutate(mapping.id)}
                            disabled={removeMapping.isPending}
                          >
                            <Link2Off size={12} className="mr-1" />
                            Unlink
                          </Button>
                        ) : pv.ferosVehicleId ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2 text-xs"
                            onClick={() => handleLink(pv)}
                            disabled={addMapping.isPending}
                          >
                            <Link size={12} className="mr-1" />
                            Link
                          </Button>
                        ) : (
                          <span className="text-gray-300 text-xs">No FEROS vehicle</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main settings page ────────────────────────────────────────────────────────
export default function GpsSettingsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<GpsProviderConfig | null>(null)

  const { data: configs, isLoading } = useQuery({
    queryKey: ['gps-configs'],
    queryFn: () => gpsApi.getConfigs().then(r => r.data ?? []),
  })

  const deleteConfig = useMutation({
    mutationFn: (id: number) => gpsApi.deleteConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gps-configs'] })
      toast.success('GPS provider removed')
    },
    onError: () => toast.error('Failed to remove config'),
  })

  const testConnection = useMutation({
    mutationFn: (id: number) => gpsApi.testConnection(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['gps-configs'] })
      res.data
        ? toast.success('Connection successful!')
        : toast.error('Connection failed. Check your credentials.')
    },
  })

  function openAdd() {
    setEditingConfig(null)
    setDialogOpen(true)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/gps')} className="p-1">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">GPS Settings</h1>
          <p className="text-sm text-gray-500">Connect your GPS provider and map vehicles</p>
        </div>
        <Button className="ml-auto" onClick={openAdd}>
          <Plus size={16} className="mr-1" />
          Add Provider
        </Button>
      </div>

      {/* Provider configs */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading...
        </div>
      ) : (configs ?? []).length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-xl text-gray-400">
          <p className="font-medium text-gray-600">No GPS providers configured</p>
          <p className="text-sm mt-1">Add your first provider to start tracking vehicles</p>
          <Button className="mt-4" onClick={openAdd}>
            <Plus size={16} className="mr-1" />
            Add Provider
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {(configs ?? []).map(config => (
            <div key={config.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {config.displayName || providerLabel(config.providerType)}
                    </h3>
                    {syncBadge(config.syncStatus)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{providerLabel(config.providerType)}</p>
                  {config.lastSyncAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last tested: {new Date(config.lastSyncAt).toLocaleString()}
                    </p>
                  )}
                  {config.syncStatus === 'ERROR' && config.syncErrorMsg && (
                    <p className="text-xs text-red-500 mt-1">{config.syncErrorMsg}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testConnection.mutate(config.id)}
                    disabled={testConnection.isPending}
                  >
                    {testConnection.isPending
                      ? <Loader2 size={13} className="animate-spin mr-1" />
                      : config.syncStatus === 'OK'
                        ? <CheckCircle size={13} className="mr-1 text-green-600" />
                        : <XCircle size={13} className="mr-1 text-gray-400" />
                    }
                    Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingConfig(config); setDialogOpen(true) }}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => deleteConfig.mutate(config.id)}
                    disabled={deleteConfig.isPending}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <MappingPanel config={config} />
            </div>
          ))}
        </div>
      )}

      <ConfigDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingConfig(null) }}
        editing={editingConfig}
      />
    </div>
  )
}
