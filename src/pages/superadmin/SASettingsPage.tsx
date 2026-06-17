import { Settings } from 'lucide-react'

export function SASettingsPage() {
  return (
    <div style={{ padding: '48px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Settings size={22} style={{ color: '#1a3a5c' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a3a5c', letterSpacing: '-0.02em' }}>Settings</h1>
      </div>
      <p style={{ color: '#94a3b8', fontSize: 14 }}>Platform settings — coming soon.</p>
    </div>
  )
}
