import { useState, useEffect } from 'react'
import { Settings, Smartphone, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { appConfigApi, type AppConfig } from '@/api/superadmin'

export function SASettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['app-config'], queryFn: appConfigApi.get })
  const config = data?.data

  const [form, setForm] = useState<AppConfig>({ minVersion: 1, latestVersion: 1, forceUpdate: false })

  useEffect(() => {
    if (config) setForm(config)
  }, [config])

  const mutation = useMutation({
    mutationFn: appConfigApi.update,
    onSuccess: () => { toast.success('App config saved'); qc.invalidateQueries({ queryKey: ['app-config'] }) },
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div style={{ padding: '48px 40px', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <Settings size={22} style={{ color: '#1a3a5c' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a3a5c', letterSpacing: '-0.02em' }}>Settings</h1>
      </div>

      {/* App Update Config */}
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
              <input
                type="number"
                min={1}
                value={form.minVersion}
                onChange={e => setForm(f => ({ ...f, minVersion: Number(e.target.value) }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Latest Version (version code)" hint="Current release on Play Store">
              <input
                type="number"
                min={1}
                value={form.latestVersion}
                onChange={e => setForm(f => ({ ...f, latestVersion: Number(e.target.value) }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Force Update" hint="Force ALL devices to update immediately, regardless of version">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.forceUpdate}
                  onChange={e => setForm(f => ({ ...f, forceUpdate: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: form.forceUpdate ? '#dc2626' : '#64748b', fontWeight: form.forceUpdate ? 600 : 400 }}>
                  {form.forceUpdate ? 'ENABLED — all devices will be blocked until updated' : 'Disabled'}
                </span>
              </label>
            </Field>

            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', background: '#1a3a5c', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: mutation.isPending ? 0.7 : 1,
                }}
              >
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
  borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none',
  boxSizing: 'border-box',
}
