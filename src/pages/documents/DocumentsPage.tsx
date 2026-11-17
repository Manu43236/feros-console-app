import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, parseISO, isValid } from 'date-fns'
import { FileText, Upload, Paperclip, ExternalLink, Search } from 'lucide-react'
import { documentsApi } from '@/api/documents'
import { vehiclesApi } from '@/api/vehicles'
import { staffApi } from '@/api/staff'
import { globalMastersApi } from '@/api/masters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Spinner } from '@/components/ui/loader'
import { cn } from '@/lib/utils'
import type { DocEntityType, DocStatus } from '@/types'

const STATUS_META: Record<DocStatus, { label: string; chip: string; dot: string }> = {
  EXPIRED:  { label: 'Expired',       chip: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
  EXPIRING: { label: 'Soon expiring', chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  ACTIVE:   { label: 'Active',        chip: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500' },
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const parsed = parseISO(d)
  return isValid(parsed) ? format(parsed, 'dd MMM yyyy') : '—'
}

function StatusChip({ status, daysLeft }: { status: DocStatus; daysLeft?: number | null }) {
  const m = STATUS_META[status]
  const suffix = daysLeft == null ? '' : status === 'EXPIRED' ? ` · ${Math.abs(daysLeft)}d ago` : ` · ${daysLeft}d`
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', m.chip)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}{suffix}
    </span>
  )
}

export function DocumentsPage() {
  const [params] = useSearchParams()
  const initialEntity = params.get('entity') === 'STAFF' ? 'STAFF' : 'VEHICLE'
  const initialStatus = (['EXPIRED', 'EXPIRING', 'ACTIVE'] as const).find(s => s === params.get('status')) ?? 'ALL'
  const [entity, setEntity] = useState<'ALL' | DocEntityType>(initialEntity)
  const [status, setStatus] = useState<'ALL' | DocStatus>(initialStatus)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['documents', entity, status, q],
    queryFn: () => documentsApi.list({ entity, status, q: q.trim() || undefined }),
  })
  const rows = data?.data ?? []

  const counts = useMemo(() => {
    const c = { EXPIRED: 0, EXPIRING: 0, ACTIVE: 0 } as Record<DocStatus, number>
    for (const r of rows) c[r.status]++
    return c
  }, [rows])

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-feros-navy/10">
            <FileText className="text-feros-navy" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
            <p className="text-sm text-gray-500">Renew every vehicle &amp; staff document from one place</p>
          </div>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-feros-navy hover:bg-feros-navy/90 text-white gap-2">
          <Upload size={16} /> Upload Documents
        </Button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={entity}
          onChange={v => setEntity(v as typeof entity)}
          options={[{ value: 'VEHICLE', label: 'Vehicles' }, { value: 'STAFF', label: 'Staff' }, { value: 'ALL', label: 'All' }]}
        />
        <Segmented
          value={status}
          onChange={v => setStatus(v as typeof status)}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'EXPIRED', label: `Expired (${counts.EXPIRED})` },
            { value: 'EXPIRING', label: `Soon (${counts.EXPIRING})` },
            { value: 'ACTIVE', label: `Active (${counts.ACTIVE})` },
          ]}
        />
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={entity === 'STAFF' ? 'Search staff / doc no.' : 'Search reg. no / doc no.'}
            className="w-64 pl-9"
          />
        </div>
      </div>

      {/* list */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{entity === 'STAFF' ? 'Staff' : 'Owner'}</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Doc No.</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center"><Spinner /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No documents match these filters</td></tr>
            ) : rows.map(r => (
              <tr key={`${r.entityType}-${r.documentId}`} className="hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{r.ownerName}</div>
                  {r.ownerSubtitle && <div className="text-xs text-gray-400">{r.ownerSubtitle}</div>}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.documentTypeName}</td>
                <td className="px-4 py-3 text-gray-500">{r.documentNumber || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{fmtDate(r.expiryDate)}</td>
                <td className="px-4 py-3"><StatusChip status={r.status} daysLeft={r.daysLeft} /></td>
                <td className="px-4 py-3 text-right">
                  {r.fileUrl
                    ? <a href={r.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-feros-navy hover:underline"><ExternalLink size={14} /> View</a>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultEntity={entity === 'STAFF' ? 'STAFF' : 'VEHICLE'}
      />
    </div>
  )
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-feros-navy text-white' : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── upload dialog: pick owner → renew any expired doc, all at once ──────────────
type RowDraft = { documentNumber: string; expiryDate: string; issuerName: string; file: File | null }
type ExistingDoc = { id: number; documentTypeId: number; documentNumber?: string | null; expiryDate?: string | null; fileUrl?: string | null }

function UploadDialog({ open, onClose, defaultEntity }: { open: boolean; onClose: () => void; defaultEntity: DocEntityType }) {
  const qc = useQueryClient()
  const [entity, setEntity] = useState<DocEntityType>(defaultEntity)
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({})
  const [saving, setSaving] = useState(false)

  const { data: docTypesRes } = useQuery({ queryKey: ['document-types'], queryFn: globalMastersApi.getDocumentTypes })
  const { data: vehiclesRes } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.getAll(), enabled: open && entity === 'VEHICLE' })
  const { data: staffRes } = useQuery({ queryKey: ['staff-profiles'], queryFn: () => staffApi.getAll(), enabled: open && entity === 'STAFF' })

  const { data: existingDocs } = useQuery({
    queryKey: ['owner-docs', entity, ownerId],
    enabled: open && ownerId != null,
    queryFn: async (): Promise<ExistingDoc[]> => {
      const res = entity === 'VEHICLE' ? await vehiclesApi.getDocuments(ownerId!) : await staffApi.getDocuments(ownerId!)
      return (res.data ?? []).map(d => ({
        id: d.id, documentTypeId: d.documentTypeId,
        documentNumber: d.documentNumber, expiryDate: d.expiryDate, fileUrl: d.fileUrl,
      }))
    },
  })

  const applicableTypes = useMemo(() => (docTypesRes?.data ?? []).filter(t =>
    entity === 'VEHICLE' ? (t.applicableFor === 'VEHICLE' || t.applicableFor === 'BOTH')
                         : (t.applicableFor === 'DRIVER' || t.applicableFor === 'BOTH'),
  ), [docTypesRes, entity])

  const existingByType = useMemo(() => {
    const m = new Map<number, ExistingDoc>()
    for (const d of (existingDocs ?? [])) if (!m.has(d.documentTypeId)) m.set(d.documentTypeId, d)
    return m
  }, [existingDocs])

  function resetAll() { setOwnerId(null); setDrafts({}) }
  function close() { resetAll(); onClose() }
  function switchEntity(e: DocEntityType) { setEntity(e); resetAll() }

  function draftFor(typeId: number): RowDraft {
    return drafts[typeId] ?? (() => {
      const ex = existingByType.get(typeId)
      return { documentNumber: ex?.documentNumber ?? '', expiryDate: ex?.expiryDate ?? '', issuerName: '', file: null }
    })()
  }
  function patch(typeId: number, p: Partial<RowDraft>) {
    setDrafts(prev => ({ ...prev, [typeId]: { ...draftFor(typeId), ...p } }))
  }

  const ownerOptions = entity === 'VEHICLE'
    ? (vehiclesRes?.data ?? []).map(v => ({ value: String(v.id), label: v.registrationNumber }))
    : (staffRes?.data ?? []).map(s => ({ value: String(s.userId), label: `${s.userName}${s.roleName ? ` · ${s.roleName}` : ''}` }))

  async function handleUpload() {
    if (ownerId == null) { toast.error(`Select a ${entity === 'VEHICLE' ? 'vehicle' : 'staff member'}`); return }
    const jobs = applicableTypes.filter(t => {
      const d = drafts[t.id]
      return d && (d.file || d.expiryDate || d.documentNumber)
    })
    if (jobs.length === 0) { toast.error('Nothing to upload — fill at least one document'); return }

    setSaving(true)
    let ok = 0, fail = 0
    for (const t of jobs) {
      const d = drafts[t.id]
      try {
        let fileUrl: string | undefined
        if (d.file) {
          const res = entity === 'VEHICLE' ? await vehiclesApi.uploadDocFile(ownerId, d.file) : await staffApi.uploadDocFile(d.file)
          fileUrl = res.data?.publicUrl
        }
        const payload: Record<string, unknown> = {
          documentNumber: d.documentNumber || undefined,
          expiryDate: d.expiryDate || undefined,
          ...(d.issuerName ? { issuerName: d.issuerName } : {}),
          ...(fileUrl ? { fileUrl } : {}),
        }
        const existing = existingByType.get(t.id)
        if (existing) {
          entity === 'VEHICLE' ? await vehiclesApi.updateDocument(existing.id, payload) : await staffApi.updateDocument(existing.id, payload)
        } else {
          const body = { documentTypeId: t.id, ...payload }
          entity === 'VEHICLE' ? await vehiclesApi.addDocument(ownerId, body) : await staffApi.addDocument(ownerId, body)
        }
        ok++
      } catch { fail++ }
    }
    setSaving(false)
    if (ok) toast.success(`${ok} document${ok > 1 ? 's' : ''} saved`)
    if (fail) toast.error(`${fail} document${fail > 1 ? 's' : ''} failed`)
    qc.invalidateQueries({ queryKey: ['documents'] })
    if (ownerId != null) qc.invalidateQueries({ queryKey: ['owner-docs', entity, ownerId] })
    if (!fail) close()
    else setDrafts({})
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upload / Renew Documents</DialogTitle></DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Segmented value={entity} onChange={v => switchEntity(v as DocEntityType)}
              options={[{ value: 'VEHICLE', label: 'Vehicle' }, { value: 'STAFF', label: 'Staff' }]} />
          </div>

          <div className="space-y-1.5">
            <Label>{entity === 'VEHICLE' ? 'Vehicle Number' : 'Staff Member'} *</Label>
            <SearchableSelect
              value={ownerId != null ? String(ownerId) : ''}
              onValueChange={v => { setOwnerId(v ? Number(v) : null); setDrafts({}) }}
              options={ownerOptions}
              placeholder={entity === 'VEHICLE' ? 'Select vehicle' : 'Select staff member'}
            />
          </div>

          {ownerId != null && (
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {applicableTypes.length === 0 && <div className="p-4 text-sm text-gray-400">No document types configured.</div>}
              {applicableTypes.map(t => {
                const ex = existingByType.get(t.id)
                const d = draftFor(t.id)
                const isInsurance = t.name.toLowerCase().includes('insurance')
                return (
                  <div key={t.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-gray-800">{t.name}</div>
                      <div className="flex items-center gap-2 text-xs">
                        {ex?.expiryDate && <span className="text-gray-400">now: {fmtDate(ex.expiryDate)}</span>}
                        {ex?.fileUrl && (
                          <a href={ex.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-feros-navy hover:underline">
                            <ExternalLink size={12} /> current
                          </a>
                        )}
                        {!ex && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">new</span>}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input placeholder="Doc number" value={d.documentNumber} onChange={e => patch(t.id, { documentNumber: e.target.value })} />
                      <Input type="date" value={d.expiryDate} onChange={e => patch(t.id, { expiryDate: e.target.value })} />
                      <label className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors',
                        d.file ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50',
                      )}>
                        <Paperclip size={14} />
                        <span className="truncate">{d.file ? d.file.name : 'Attach file'}</span>
                        {d.file && <button type="button" onClick={e => { e.preventDefault(); patch(t.id, { file: null }) }} className="ml-auto text-gray-400 hover:text-red-500">✕</button>}
                        <input type="file" className="hidden" onChange={e => patch(t.id, { file: e.target.files?.[0] ?? null })} />
                      </label>
                    </div>
                    {isInsurance && (
                      <Input className="mt-2" placeholder="Insurance company" value={d.issuerName} onChange={e => patch(t.id, { issuerName: e.target.value })} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={handleUpload} disabled={saving || ownerId == null} className="bg-feros-navy hover:bg-feros-navy/90 text-white">
              {saving ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
