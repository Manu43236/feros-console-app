import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { globalMastersApi } from '@/api/masters'

// Shared cargo-manifest editor for multi-material orders (Live + POL, create + edit).
// Purely additive: when the toggle is off the parent keeps its single-material flow untouched.

export const MATERIAL_OTHER = 0

export type ManifestItem = {
  materialTypeId: number
  customMaterialName?: string
  quantity: number | ''
  unitId: number
}

export function emptyManifestItem(): ManifestItem {
  return { materialTypeId: MATERIAL_OTHER, customMaterialName: '', quantity: '', unitId: 0 }
}

/** Map UI rows to the API shape (mirrors the single-material Other vs master rule). */
export function manifestToPayload(items: ManifestItem[]) {
  return items.map(it => {
    const isOther = Number(it.materialTypeId) === MATERIAL_OTHER
    return {
      materialTypeId: isOther ? undefined : it.materialTypeId,
      customMaterialName: isOther ? (it.customMaterialName?.trim() || undefined) : undefined,
      quantity: it.quantity === '' ? 0 : Number(it.quantity),
      unitId: it.unitId,
    }
  })
}

/** Returns an error message, or null when the manifest is valid. */
export function validateManifest(items: ManifestItem[]): string | null {
  if (items.length === 0) return 'Add at least one material'
  for (const it of items) {
    const isOther = Number(it.materialTypeId) === MATERIAL_OTHER
    if (isOther && !it.customMaterialName?.trim()) return 'Enter a material name for every "Other" row'
    if (!it.quantity || Number(it.quantity) <= 0) return 'Quantity must be greater than zero on every row'
    if (!it.unitId) return 'Select a unit on every row'
  }
  return null
}

export function MaterialManifest({
  enabled, onEnabledChange, items, onChange,
}: {
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  items: ManifestItem[]
  onChange: (items: ManifestItem[]) => void
}) {
  const { data: materialsRes } = useQuery({ queryKey: ['material-types'], queryFn: globalMastersApi.getMaterialTypes })
  const { data: unitsRes }     = useQuery({ queryKey: ['units'],          queryFn: globalMastersApi.getUnits })
  const materials = materialsRes?.data ?? []
  const units     = unitsRes?.data ?? []

  function update(i: number, field: keyof ManifestItem, value: unknown) {
    onChange(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-700">Multiple materials (cargo manifest)</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Multiple materials"
          onClick={() => {
            const next = !enabled
            onEnabledChange(next)
            if (next && items.length === 0) onChange([emptyManifestItem()])
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-feros-navy focus-visible:ring-offset-2 ${enabled ? 'bg-feros-navy' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 space-y-3">
          {items.map((row, i) => {
            const isOther = Number(row.materialTypeId) === MATERIAL_OTHER
            return (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-3 border border-gray-200 rounded-lg p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Material *</Label>
                  <SearchableSelect
                    value={row.materialTypeId != null ? String(row.materialTypeId) : ''}
                    onValueChange={v => update(i, 'materialTypeId', Number(v))}
                    options={[
                      ...materials.map(m => ({ value: String(m.id), label: m.name })),
                      { value: String(MATERIAL_OTHER), label: 'Other (specify manually)' },
                    ]}
                    placeholder="Select material"
                  />
                  {isOther && (
                    <Input
                      value={row.customMaterialName ?? ''}
                      onChange={e => update(i, 'customMaterialName', e.target.value)}
                      placeholder="Type material name…"
                      className="mt-1.5"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity *</Label>
                  <Input
                    type="number" step="0.001" min="0"
                    value={row.quantity}
                    onChange={e => update(i, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit *</Label>
                  <SearchableSelect
                    value={row.unitId ? String(row.unitId) : ''}
                    onValueChange={v => update(i, 'unitId', Number(v))}
                    options={units.map(u => ({ value: String(u.id), label: u.name }))}
                    placeholder="Unit"
                  />
                </div>
                <div className="flex items-end pb-1">
                  {items.length > 1 && (
                    <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          <Button type="button" variant="outline" onClick={() => onChange([...items, emptyManifestItem()])}
            className="gap-2 text-feros-navy border-feros-navy/30">
            <Plus className="h-4 w-4" /> Add Material
          </Button>
          <p className="text-xs text-gray-400">
            The first material is treated as the order's primary material. Total weight above is still used for freight.
          </p>
        </div>
      )}
    </div>
  )
}
