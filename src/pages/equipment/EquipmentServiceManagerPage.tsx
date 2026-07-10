import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Wrench } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { equipmentApi } from '@/api/equipment'
import type { Equipment, EquipmentWorkStatus } from '@/types'
import { ServiceTab } from './MachineDetailPage'

// Compact status badge — service-desk view only needs a quick visual cue.
const WORK_STATUS: Record<EquipmentWorkStatus, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Available',  cls: 'bg-green-100 text-green-700' },
  ASSIGNED:  { label: 'Assigned',   cls: 'bg-blue-100 text-blue-700' },
  BUSY:      { label: 'Busy',       cls: 'bg-orange-100 text-orange-700' },
  BREAKDOWN: { label: 'Breakdown',  cls: 'bg-red-100 text-red-700' },
  IN_REPAIR: { label: 'In Repair',  cls: 'bg-yellow-100 text-yellow-700' },
}

export function EquipmentServiceManagerPage() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['equipment'], queryFn: equipmentApi.getAll })
  const machines: Equipment[] = (data?.data ?? []) as Equipment[]

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

  // Default to the first machine once loaded.
  const selected = machines.find(m => m.id === selectedId)
    ?? (selectedId === null ? filtered[0] : undefined)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipment Services</h1>
        <p className="text-gray-500 text-sm mt-0.5">Log and track machine service records</p>
      </div>

      <div className="flex gap-6">
        {/* Machine list */}
        <div className="w-72 shrink-0 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search machines…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg overflow-hidden divide-y max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                {search ? 'No machines match' : 'No machines yet'}
              </div>
            ) : filtered.map(m => {
              const ws = WORK_STATUS[m.workStatus] ?? { label: m.workStatus, cls: 'bg-gray-100 text-gray-600' }
              const active = selected?.id === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 transition-colors',
                    active ? 'bg-feros-equip-sidebar text-white' : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{m.makeName} {m.modelName}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      active ? 'bg-white/20 text-white' : ws.cls)}>
                      {ws.label}
                    </span>
                  </div>
                  <p className={cn('text-xs mt-0.5 truncate', active ? 'text-white/70' : 'text-gray-500')}>
                    {m.equipmentTypeName}{m.serialNumber && ` · ${m.serialNumber}`}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected machine's services */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="border rounded-lg p-6 bg-white">
              <div className="mb-4 pb-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">{selected.makeName} {selected.modelName}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selected.equipmentTypeName}
                  {selected.serialNumber && <span className="ml-2 font-mono">S/N {selected.serialNumber}</span>}
                </p>
              </div>
              <ServiceTab equipmentId={selected.id} currentHmr={selected.currentMeterReading} />
            </div>
          ) : (
            <div className="border rounded-lg p-12 bg-white text-center text-gray-400">
              <Wrench size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Select a machine to view or log services</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
