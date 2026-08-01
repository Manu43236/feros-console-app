import { useState, useEffect } from 'react'
import { Settings, Smartphone, Save, PlayCircle, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { appConfigApi, tutorialVideosApi, type AppConfig, type TutorialVideo, type TutorialVideoRequest } from '@/api/superadmin'

const TABS = ['App Update', 'Tutorial Videos'] as const
type Tab = typeof TABS[number]

const ROLES = ['ALL', 'DRIVER', 'CLEANER', 'SUPERVISOR', 'TECHNICIAN', 'SERVICE_MANAGER', 'STORE_KEEPER', 'OFFICE_STAFF', 'ADMIN']
const LANGUAGES = [
  { code: 'te', label: 'Telugu' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'en', label: 'English' },
]

// ── App Update Tab ────────────────────────────────────────────────────────────
function AppUpdateTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['app-config'], queryFn: appConfigApi.get })
  const config = data?.data
  const [form, setForm] = useState<AppConfig>({ minVersion: 1, latestVersion: 1, forceUpdate: false })

  useEffect(() => { if (config) setForm(config) }, [config])

  const mutation = useMutation({
    mutationFn: appConfigApi.update,
    onSuccess: () => { toast.success('App config saved'); qc.invalidateQueries({ queryKey: ['app-config'] }) },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Smartphone size={18} style={{ color: '#1a3a5c' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1a3a5c' }}>Mobile App Update</h2>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Controls in-app update behaviour on Android. Devices below <strong>Min Version</strong> get a forced
          blocking update. Others get a dismissable bottom sheet. <strong>Force Update</strong> overrides
          everything — all devices must update immediately.
        </p>
        {isLoading ? (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Min Version (version code)" hint="Below this → immediate blocking update">
              <input type="number" min={1} value={form.minVersion}
                onChange={e => setForm(f => ({ ...f, minVersion: Number(e.target.value) }))}
                style={inputStyle} />
            </Field>
            <Field label="Latest Version (version code)" hint="Current release on Play Store">
              <input type="number" min={1} value={form.latestVersion}
                onChange={e => setForm(f => ({ ...f, latestVersion: Number(e.target.value) }))}
                style={inputStyle} />
            </Field>
            <Field label="Force Update" hint="Force ALL devices to update immediately, regardless of version">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.forceUpdate}
                  onChange={e => setForm(f => ({ ...f, forceUpdate: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ fontSize: 14, color: form.forceUpdate ? '#dc2626' : '#64748b', fontWeight: form.forceUpdate ? 600 : 400 }}>
                  {form.forceUpdate ? 'ENABLED — all devices will be blocked until updated' : 'Disabled'}
                </span>
              </label>
            </Field>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: mutation.isPending ? 'not-allowed' : 'pointer', opacity: mutation.isPending ? 0.7 : 1 }}>
                <Save size={15} />
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tutorial Videos Tab ───────────────────────────────────────────────────────
function TutorialVideosTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['tutorial-videos-all'], queryFn: tutorialVideosApi.getAll })
  const videos = data?.data ?? []

  const [roleFilter, setRoleFilter]   = useState('ALL')
  const [langFilter, setLangFilter]   = useState('ALL')
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [editItem, setEditItem]       = useState<TutorialVideo | null>(null)
  const [confirmId, setConfirmId]     = useState<number | null>(null)

  const filtered = videos.filter(v =>
    (roleFilter === 'ALL' || v.role === roleFilter) &&
    (langFilter === 'ALL' || v.language === langFilter)
  )

  const createMut = useMutation({
    mutationFn: tutorialVideosApi.create,
    onSuccess: () => { toast.success('Video added'); qc.invalidateQueries({ queryKey: ['tutorial-videos-all'] }); setDialogOpen(false) },
    onError: () => toast.error('Failed to add video'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TutorialVideoRequest }) => tutorialVideosApi.update(id, data),
    onSuccess: () => { toast.success('Video updated'); qc.invalidateQueries({ queryKey: ['tutorial-videos-all'] }); setDialogOpen(false) },
    onError: () => toast.error('Failed to update video'),
  })

  const deleteMut = useMutation({
    mutationFn: tutorialVideosApi.delete,
    onSuccess: () => { toast.success('Video deleted'); qc.invalidateQueries({ queryKey: ['tutorial-videos-all'] }); setConfirmId(null) },
    onError: () => toast.error('Failed to delete video'),
  })

  function openAdd()              { setEditItem(null); setDialogOpen(true) }
  function openEdit(v: TutorialVideo) { setEditItem(v); setDialogOpen(true) }

  function handleSave(req: TutorialVideoRequest) {
    if (editItem) updateMut.mutate({ id: editItem.id, data: req })
    else createMut.mutate(req)
  }

  const langLabel = (code: string) => LANGUAGES.find(l => l.code === code)?.label ?? code

  return (
    <div>
      {/* Filters + Add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={selectStyle}>
          <option value="ALL">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={langFilter} onChange={e => setLangFilter(e.target.value)} style={selectStyle}>
          <option value="ALL">All Languages</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <Button size="sm" onClick={openAdd} className="h-8 text-xs bg-[#1a3a5c] hover:bg-[#142d48]">
            <Plus size={13} className="mr-1" /> Add Video
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>No videos found</div>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Role', 'Language', 'Title', 'Link', 'Active', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={v.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#fff' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{v.role}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{langLabel(v.language)}</td>
                  <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.featureTitle}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <a href={v.youtubeUrl} target="_blank" rel="noreferrer" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={13} /> Preview
                    </a>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: v.isActive ? '#16a34a' : '#94a3b8', fontWeight: 600, fontSize: 12 }}>
                      {v.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(v)} style={iconBtn}><Pencil size={13} /></button>
                      <button onClick={() => setConfirmId(v.id)} style={{ ...iconBtn, color: '#ef4444' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VideoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editItem}
        onSave={handleSave}
        isPending={createMut.isPending || updateMut.isPending}
      />

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete Tutorial Video"
        description="This will permanently remove the video from all mobile apps."
        onConfirm={() => confirmId !== null && deleteMut.mutate(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}

// ── Add / Edit Dialog ─────────────────────────────────────────────────────────
function VideoDialog({ open, onClose, initial, onSave, isPending }: {
  open: boolean
  onClose: () => void
  initial: TutorialVideo | null
  onSave: (req: TutorialVideoRequest) => void
  isPending: boolean
}) {
  const blank: TutorialVideoRequest = { role: 'ALL', language: 'te', featureTitle: '', youtubeUrl: '', sortOrder: 0, isActive: true }
  const [form, setForm] = useState<TutorialVideoRequest>(blank)
  const [errors, setErrors] = useState<Partial<Record<keyof TutorialVideoRequest, string>>>({})

  useEffect(() => {
    setForm(initial ? { role: initial.role, language: initial.language, featureTitle: initial.featureTitle, youtubeUrl: initial.youtubeUrl, sortOrder: initial.sortOrder, isActive: initial.isActive } : blank)
    setErrors({})
  }, [initial, open])

  function validate() {
    const e: typeof errors = {}
    if (!form.role)         e.role = 'Required'
    if (!form.language)     e.language = 'Required'
    if (!form.featureTitle.trim()) e.featureTitle = 'Required'
    if (!form.youtubeUrl.trim())   e.youtubeUrl = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (validate()) onSave(form)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Tutorial Video' : 'Add Tutorial Video'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role <span className="text-red-500">*</span></Label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className={`mt-1 w-full border rounded-md px-3 py-2 text-sm ${errors.role ? 'border-red-400' : 'border-gray-200'}`}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
            </div>
            <div>
              <Label>Language <span className="text-red-500">*</span></Label>
              <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                className={`mt-1 w-full border rounded-md px-3 py-2 text-sm ${errors.language ? 'border-red-400' : 'border-gray-200'}`}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              {errors.language && <p className="text-red-500 text-xs mt-1">{errors.language}</p>}
            </div>
          </div>

          <div>
            <Label>Feature Title <span className="text-red-500">*</span></Label>
            <Input value={form.featureTitle} onChange={e => setForm(f => ({ ...f, featureTitle: e.target.value }))}
              placeholder="e.g. Login చేయడం ఎలా"
              className={`mt-1 ${errors.featureTitle ? 'border-red-400' : ''}`} />
            {errors.featureTitle && <p className="text-red-500 text-xs mt-1">{errors.featureTitle}</p>}
          </div>

          <div>
            <Label>YouTube URL <span className="text-red-500">*</span></Label>
            <Input value={form.youtubeUrl} onChange={e => setForm(f => ({ ...f, youtubeUrl: e.target.value }))}
              placeholder="https://youtube.com/shorts/..."
              className={`mt-1 ${errors.youtubeUrl ? 'border-red-400' : ''}`} />
            {errors.youtubeUrl && <p className="text-red-500 text-xs mt-1">{errors.youtubeUrl}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>Sort Order</Label>
              <Input type="number" min={0} value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="mt-1" />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <input type="checkbox" id="isActive" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">Active</label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-[#1a3a5c] hover:bg-[#142d48]">
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function SASettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('App Update')

  return (
    <div style={{ padding: '48px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Settings size={22} style={{ color: '#1a3a5c' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a3a5c', letterSpacing: '-0.02em' }}>Settings</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
        {TABS.map(tab => {
          const Icon = tab === 'App Update' ? Smartphone : PlayCircle
          const active = activeTab === tab
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px', fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? '#1a3a5c' : '#64748b',
              border: 'none', borderBottom: active ? '2px solid #1a3a5c' : '2px solid transparent',
              background: 'none', cursor: 'pointer', marginBottom: -1, borderRadius: '6px 6px 0 0',
              transition: 'color 0.15s',
            }}>
              <Icon size={15} />
              {tab}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'App Update'       && <AppUpdateTab />}
      {activeTab === 'Tutorial Videos'  && <TutorialVideosTab />}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{hint}</p>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, color: '#374151', background: '#fff', cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  color: '#94a3b8', borderRadius: 4, display: 'flex', alignItems: 'center',
}
