import { useState } from 'react'
import { Settings, Monitor, Smartphone, ShieldCheck } from 'lucide-react'

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLES = [
  { key: 'OFFICE_STAFF', label: 'Office Staff' },
  { key: 'SUPERVISOR',   label: 'Supervisor' },
  { key: 'DRIVER',       label: 'Driver' },
  { key: 'CLEANER',      label: 'Cleaner' },
  { key: 'STORE_KEEPER', label: 'Store Keeper' },
  { key: 'SERVICE_MEN',  label: 'Service Men' },
]

// ─── Modules ──────────────────────────────────────────────────────────────────
const MODULES = [
  { key: 'dashboard',        label: 'Dashboard',        section: 'General' },
  { key: 'clients',          label: 'Clients',          section: 'Operations' },
  { key: 'orders',           label: 'Orders',           section: 'Operations' },
  { key: 'assignments',      label: 'Assignments',      section: 'Operations' },
  { key: 'lrs',              label: 'LR Register',      section: 'Operations' },
  { key: 'invoices',         label: 'Invoices',         section: 'Finance' },
  { key: 'credit_notes',     label: 'Credit Notes',     section: 'Finance' },
  { key: 'service_invoices', label: 'Service Invoices', section: 'Finance' },
  { key: 'client_advances',  label: 'Client Advances',  section: 'Finance' },
  { key: 'vehicles',         label: 'Vehicles',         section: 'Fleet' },
  { key: 'fuel_logs',        label: 'Fuel Logs',        section: 'Fleet' },
  { key: 'meter_readings',   label: 'Meter Readings',   section: 'Fleet' },
  { key: 'vehicle_services', label: 'Vehicle Services', section: 'Fleet' },
  { key: 'spare_parts',      label: 'Spare Parts',      section: 'Inventory' },
  { key: 'tires',            label: 'Tires',            section: 'Inventory' },
  { key: 'staff',            label: 'Staff',            section: 'HR' },
  { key: 'attendance',       label: 'Attendance',       section: 'HR' },
  { key: 'payroll',          label: 'Payroll',          section: 'HR' },
  { key: 'reports',          label: 'Reports',          section: 'Analytics' },
  { key: 'masters',          label: 'Masters',          section: 'Analytics' },
]

const SECTIONS = ['General', 'Operations', 'Finance', 'Fleet', 'Inventory', 'HR', 'Analytics']

// ─── Types ───────────────────────────────────────────────────────────────────
type Platform = 'web' | 'mobile'
type CheckMap = Record<string, Record<string, boolean>>

// ─── Default state helpers ────────────────────────────────────────────────────
function defaultLoginAccess(): CheckMap {
  const map: CheckMap = {}
  for (const p of ['web', 'mobile']) {
    map[p] = {}
    for (const r of ROLES) map[p][r.key] = true
  }
  return map
}

function defaultModuleAccess(): CheckMap {
  const map: CheckMap = {}
  for (const m of MODULES) {
    map[m.key] = {}
    for (const r of ROLES) map[m.key][r.key] = true
  }
  return map
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          checked
            ? 'bg-feros-orange border-feros-orange'
            : 'bg-white border-gray-300 hover:border-feros-orange'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ─── Role column header with "Select All" toggle ──────────────────────────────
function RoleHeader({
  label, allChecked, onToggleAll,
}: { label: string; allChecked: boolean; onToggleAll: () => void }) {
  return (
    <th className="px-4 py-3 text-center min-w-[100px]">
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{label}</span>
        <button
          onClick={onToggleAll}
          className="text-[10px] text-feros-orange hover:underline font-medium"
        >
          {allChecked ? 'None' : 'All'}
        </button>
      </div>
    </th>
  )
}

// ─── Tab: Login Access ────────────────────────────────────────────────────────
function LoginAccessTab() {
  const [access, setAccess] = useState<CheckMap>(defaultLoginAccess)

  const platforms: { key: Platform; label: string; icon: React.ElementType }[] = [
    { key: 'web',    label: 'Web Platform',    icon: Monitor },
    { key: 'mobile', label: 'Mobile App', icon: Smartphone },
  ]

  function toggle(platform: string, role: string, val: boolean) {
    setAccess(prev => ({ ...prev, [platform]: { ...prev[platform], [role]: val } }))
  }

  function toggleAll(role: string) {
    const allChecked = platforms.every(p => access[p.key]?.[role])
    setAccess(prev => {
      const next = { ...prev }
      for (const p of platforms) next[p.key] = { ...next[p.key], [role]: !allChecked }
      return next
    })
  }

  function toggleRow(platform: string) {
    const allChecked = ROLES.every(r => access[platform]?.[r.key])
    setAccess(prev => ({
      ...prev,
      [platform]: Object.fromEntries(ROLES.map(r => [r.key, !allChecked])),
    }))
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        Control which roles can log in on each platform. Admin always has full access.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 w-40">Platform</th>
                {ROLES.map(r => (
                  <RoleHeader
                    key={r.key}
                    label={r.label}
                    allChecked={platforms.every(p => access[p.key]?.[r.key])}
                    onToggleAll={() => toggleAll(r.key)}
                  />
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 min-w-[70px]">Row</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {platforms.map(({ key, label, icon: Icon }) => (
                <tr key={key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-feros-navy/10 flex items-center justify-center shrink-0">
                        <Icon size={15} className="text-feros-navy" />
                      </div>
                      <span className="font-medium text-gray-800">{label}</span>
                    </div>
                  </td>
                  {ROLES.map(r => (
                    <td key={r.key} className="px-4 py-4">
                      <Checkbox
                        checked={access[key]?.[r.key] ?? false}
                        onChange={v => toggle(key, r.key, v)}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleRow(key)}
                        className="text-xs text-feros-orange hover:underline font-medium"
                      >
                        {ROLES.every(r => access[key]?.[r.key]) ? 'None' : 'All'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="bg-feros-orange hover:bg-feros-orange/90 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ─── Tab: Module Access ───────────────────────────────────────────────────────
function ModuleAccessTab() {
  const [access, setAccess] = useState<CheckMap>(defaultModuleAccess)

  function toggle(module: string, role: string, val: boolean) {
    setAccess(prev => ({ ...prev, [module]: { ...prev[module], [role]: val } }))
  }

  function toggleColAll(role: string) {
    const allChecked = MODULES.every(m => access[m.key]?.[role])
    setAccess(prev => {
      const next = { ...prev }
      for (const m of MODULES) next[m.key] = { ...next[m.key], [role]: !allChecked }
      return next
    })
  }

  function toggleRow(moduleKey: string) {
    const allChecked = ROLES.every(r => access[moduleKey]?.[r.key])
    setAccess(prev => ({
      ...prev,
      [moduleKey]: Object.fromEntries(ROLES.map(r => [r.key, !allChecked])),
    }))
  }

  function toggleSection(section: string) {
    const sectionModules = MODULES.filter(m => m.section === section)
    const allChecked = sectionModules.every(m => ROLES.every(r => access[m.key]?.[r.key]))
    setAccess(prev => {
      const next = { ...prev }
      for (const m of sectionModules)
        next[m.key] = Object.fromEntries(ROLES.map(r => [r.key, !allChecked]))
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        Control which modules each role can access. Admin always has full access to all modules.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 w-48">Module</th>
                {ROLES.map(r => (
                  <RoleHeader
                    key={r.key}
                    label={r.label}
                    allChecked={MODULES.every(m => access[m.key]?.[r.key])}
                    onToggleAll={() => toggleColAll(r.key)}
                  />
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 min-w-[70px]">Row</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map(section => {
                const sectionModules = MODULES.filter(m => m.section === section)
                const allSectionChecked = sectionModules.every(m => ROLES.every(r => access[m.key]?.[r.key]))
                return (
                  <>
                    {/* Section header row */}
                    <tr key={`section-${section}`} className="bg-gray-50 border-y border-gray-200">
                      <td className="px-5 py-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{section}</span>
                      </td>
                      {ROLES.map(r => <td key={r.key} />)}
                      <td className="px-4 py-2">
                        <div className="flex justify-center">
                          <button
                            onClick={() => toggleSection(section)}
                            className="text-[10px] text-feros-orange hover:underline font-medium"
                          >
                            {allSectionChecked ? 'None' : 'All'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Module rows */}
                    {sectionModules.map(m => (
                      <tr key={m.key} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3 pl-8">
                          <span className="text-gray-700">{m.label}</span>
                        </td>
                        {ROLES.map(r => (
                          <td key={r.key} className="px-4 py-3">
                            <Checkbox
                              checked={access[m.key]?.[r.key] ?? false}
                              onChange={v => toggle(m.key, r.key, v)}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleRow(m.key)}
                              className="text-xs text-feros-orange hover:underline font-medium"
                            >
                              {ROLES.every(r => access[m.key]?.[r.key]) ? 'None' : 'All'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="bg-feros-orange hover:bg-feros-orange/90 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'login' | 'modules'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('login')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-feros-navy flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm">Manage role-based access control for your organisation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('login')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'login'
              ? 'bg-white text-feros-navy shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Monitor size={15} />
          Login Access
        </button>
        <button
          onClick={() => setTab('modules')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'modules'
              ? 'bg-white text-feros-navy shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck size={15} />
          Module Access
        </button>
      </div>

      {/* Tab content */}
      {tab === 'login'   && <LoginAccessTab />}
      {tab === 'modules' && <ModuleAccessTab />}
    </div>
  )
}
