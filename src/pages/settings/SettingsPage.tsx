import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { moduleAccessApi } from '@/api/moduleAccess'
import { targetsApi } from '@/api/targets'
import type { ModuleKey, ModuleAccessEntry } from '@/types'
import { Shield, Check, Loader2, Target } from 'lucide-react'
import { useSubscription } from '@/context/SubscriptionContext'

// ─── Config: roles + their configurable modules ───────────────────────────────
const ROLE_CONFIG: {
  role: string
  label: string
  modules: { key: ModuleKey; label: string }[]
}[] = [
  {
    role: 'OFFICE_STAFF',
    label: 'Office Staff',
    modules: [
      { key: 'CLIENTS',          label: 'Clients' },
      { key: 'ORDERS',           label: 'Orders' },
      { key: 'LR_REGISTER',      label: 'LR Register' },
      { key: 'INVOICES',         label: 'Invoices' },
      { key: 'CREDIT_NOTES',     label: 'Credit Notes' },
      { key: 'SERVICE_INVOICES', label: 'Service Invoices' },
      { key: 'ATTENDANCE',       label: 'Attendance' },
    ],
  },
  {
    role: 'SUPERVISOR',
    label: 'Supervisor',
    modules: [
      { key: 'ORDERS',      label: 'Orders' },
      { key: 'ASSIGNMENTS', label: 'Assignments' },
      { key: 'LR_REGISTER', label: 'LR Register' },
    ],
  },
  {
    role: 'STORE_KEEPER',
    label: 'Store Keeper',
    modules: [
      { key: 'SPARE_PARTS',   label: 'Spare Parts' },
      { key: 'TYRES',         label: 'Tyres' },
      { key: 'PART_REQUESTS', label: 'Part Requests' },
      { key: 'TYRE_REQUESTS', label: 'Tyre Requests' },
    ],
  },
  {
    role: 'SERVICE_MANAGER',
    label: 'Service Manager',
    modules: [
      { key: 'VEHICLE_SERVICES', label: 'Vehicle Services' },
    ],
  },
  {
    role: 'DRIVER',
    label: 'Driver / Cleaner',
    modules: [],
  },
]

// Always-on items shown as locked
const ALWAYS_ON = ['Dashboard', 'My Attendance', 'My Payslip']

type EnabledMap = Record<string, Record<ModuleKey, boolean>>

function buildInitialMap(entries: ModuleAccessEntry[]): EnabledMap {
  const map: EnabledMap = {}
  for (const e of entries) {
    if (!map[e.role]) map[e.role] = {} as Record<ModuleKey, boolean>
    map[e.role][e.moduleKey] = e.enabled
  }
  return map
}

export function SettingsPage() {
  const { isEquipmentMode } = useSubscription()
  const th = isEquipmentMode ? {
    btn:        'flex items-center gap-2 px-5 py-2 bg-feros-amber text-white rounded-lg text-sm font-medium hover:bg-feros-amber/90 disabled:opacity-50 transition-colors',
    iconBg:     'w-8 h-8 rounded-lg bg-feros-amber/10 flex items-center justify-center',
    iconText:   'text-feros-amber',
    inputFocus: 'w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-feros-amber/30 focus:border-feros-amber transition-colors',
    activeTab:  'bg-feros-amber/5 text-feros-amber border-r-2 border-feros-amber',
    toggleOn:   'bg-feros-amber border-feros-amber',
    toggleOnBg: 'bg-feros-amber/5 border-feros-amber/20 hover:bg-feros-amber/10',
  } : {
    btn:        'flex items-center gap-2 px-5 py-2 bg-feros-navy text-white rounded-lg text-sm font-medium hover:bg-feros-navy/90 disabled:opacity-50 transition-colors',
    iconBg:     'w-8 h-8 rounded-lg bg-feros-navy/10 flex items-center justify-center',
    iconText:   'text-feros-navy',
    inputFocus: 'w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-feros-navy/30 focus:border-feros-navy transition-colors',
    activeTab:  'bg-feros-navy/5 text-feros-navy border-r-2 border-feros-navy',
    toggleOn:   'bg-feros-navy border-feros-navy',
    toggleOnBg: 'bg-feros-navy/5 border-feros-navy/20 hover:bg-feros-navy/10',
  }
  const queryClient = useQueryClient()
  const [activeRole, setActiveRole] = useState(ROLE_CONFIG[0].role)
  const [enabledMap, setEnabledMap] = useState<EnabledMap>({})

  // ── Monthly Targets state ──────────────────────────────────────────────────
  const now = new Date()
  const [tripTarget, setTripTarget] = useState<string>('')
  const [tonTarget, setTonTarget]   = useState<string>('')

  const { data: targetData } = useQuery({
    queryKey: ['monthly-targets'],
    queryFn: () => targetsApi.getCurrent(),
  })

  useEffect(() => {
    if (targetData?.data) {
      setTripTarget(targetData.data.targetTrips?.toString() ?? '')
      setTonTarget(targetData.data.targetTons?.toString() ?? '')
    }
  }, [targetData])

  const targetMutation = useMutation({
    mutationFn: () => targetsApi.set({
      year:         now.getFullYear(),
      month:        now.getMonth() + 1,
      targetTrips:  tripTarget  ? Number(tripTarget)  : undefined,
      targetTons:   tonTarget   ? Number(tonTarget)   : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-targets'] })
      toast.success('Monthly targets saved')
    },
    onError: (err: any) => {
      if (!err?.isSubscriptionBlock)
        toast.error(err?.response?.data?.message ?? 'Failed to save targets')
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['module-access'],
    queryFn: () => moduleAccessApi.getAll(),
  })

  // Populate enabled map when data loads (only once — don't overwrite user edits)
  useEffect(() => {
    if (data?.data?.data?.entries) {
      setEnabledMap(buildInitialMap(data.data.data.entries))
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (entries: ModuleAccessEntry[]) => moduleAccessApi.saveAll({ entries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module-access'] })
      toast.success('Module access saved')
    },
    onError: (err: any) => {
      if (!err?.isSubscriptionBlock)
        toast.error(err?.response?.data?.message ?? 'Failed to save module access')
    },
  })

  function toggle(role: string, key: ModuleKey) {
    setEnabledMap(prev => ({
      ...prev,
      [role]: {
        ...(prev[role] ?? {}),
        [key]: !(prev[role]?.[key] ?? true),
      },
    }))
  }

  function handleSave() {
    const entries: ModuleAccessEntry[] = []
    for (const rc of ROLE_CONFIG) {
      for (const m of rc.modules) {
        entries.push({
          role: rc.role,
          moduleKey: m.key,
          enabled: enabledMap[rc.role]?.[m.key] ?? true,
        })
      }
    }
    mutation.mutate(entries)
  }

  const currentRoleConfig = ROLE_CONFIG.find(r => r.role === activeRole)!

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure which modules each role can access</p>
      </div>

      {/* Monthly Targets card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className={th.iconBg}>
            <Target size={16} className={th.iconText} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Monthly Targets</h2>
            <p className="text-xs text-gray-500">
              Set targets for {now.toLocaleString('default', { month: 'long' })} {now.getFullYear()} — carries forward automatically each month
            </p>
          </div>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Number of Trips Target
            </label>
            <input
              type="number"
              min={0}
              placeholder="e.g. 1000"
              value={tripTarget}
              onChange={e => setTripTarget(e.target.value)}
              className={th.inputFocus}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Number of Tons Target
            </label>
            <input
              type="number"
              min={0}
              placeholder="e.g. 50000"
              value={tonTarget}
              onChange={e => setTonTarget(e.target.value)}
              className={th.inputFocus}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => targetMutation.mutate()}
            disabled={targetMutation.isPending}
            className={th.btn}
          >
            {targetMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save Targets
          </button>
        </div>
      </div>

      {/* Module Access card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className={th.iconBg}>
            <Shield size={16} className={th.iconText} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Module Access</h2>
            <p className="text-xs text-gray-500">Select which modules are visible for each role</p>
          </div>
        </div>

        <div className="flex min-h-[400px]">
          {/* Role tabs */}
          <div className="w-48 border-r border-gray-100 py-2 shrink-0">
            {ROLE_CONFIG.map(rc => (
              <button
                key={rc.role}
                onClick={() => setActiveRole(rc.role)}
                className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                  activeRole === rc.role
                    ? th.activeTab
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {rc.label}
              </button>
            ))}
          </div>

          {/* Module checkboxes */}
          <div className="flex-1 p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Always-on section */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Always visible
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ALWAYS_ON.map(label => (
                      <div
                        key={label}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 opacity-60 cursor-not-allowed select-none"
                      >
                        <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center shrink-0">
                          <Check size={10} className="text-white" />
                        </div>
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configurable modules */}
                {currentRoleConfig.modules.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Configurable modules
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {currentRoleConfig.modules.map(m => {
                        const enabled = enabledMap[activeRole]?.[m.key] ?? true
                        return (
                          <button
                            key={m.key}
                            onClick={() => toggle(activeRole, m.key)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                              enabled
                                ? th.toggleOnBg
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              enabled
                                ? th.toggleOn
                                : 'border-gray-300 bg-white'
                            }`}>
                              {enabled && <Check size={10} className="text-white" />}
                            </div>
                            <span className={`text-sm font-medium ${enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                              {m.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No configurable modules for this role. Dashboard, My Attendance, My Payslip, and My Trips are always visible.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className={th.btn}
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
