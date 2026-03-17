import { useQuery } from '@tanstack/react-query'
import { Building2, CheckCircle, CreditCard, Users, AlertTriangle } from 'lucide-react'
import { tenantsApi } from '@/api/superadmin'
import type { Tenant } from '@/types'

export function SADashboardPage() {
  const { data } = useQuery({ queryKey: ['tenants'], queryFn: tenantsApi.getAll })
  const tenants: Tenant[] = data?.data ?? []

  const total   = tenants.length
  const active  = tenants.filter(t => t.isActive).length
  const subActive = tenants.filter(t => t.subscriptionStatus === 'ACTIVE').length
  const expiring = tenants.filter(t => {
    const end = t.subscriptionEndDate || t.trialEndDate
    if (!end) return false
    const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 30
  })
  const recent = [...tenants].sort((a, b) => b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0).slice(0, 5)

  const stats = [
    { label: 'Total Tenants',       value: total,     icon: Building2,   color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Tenants',      value: active,    icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'On Subscription',     value: subActive, icon: CreditCard,  color: 'bg-orange-50 text-orange-600' },
    { label: 'Expiring (30 days)',  value: expiring.length, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">System-wide overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`p-2 rounded-lg ${color}`}><Icon size={16} /></div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={15} className="text-blue-500" />Recent Tenants
          </h2>
          {recent.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No tenants yet</p>
          ) : (
            <div className="divide-y">
              {recent.map(t => (
                <div key={t.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                      {t.prefix || t.companyName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.companyName}</p>
                      <p className="text-xs text-gray-400">{t.createdAt?.split('T')[0]}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={15} className="text-orange-500" />Expiring Subscriptions
          </h2>
          {expiring.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No subscriptions expiring soon</p>
          ) : (
            <div className="divide-y">
              {expiring.map(t => {
                const end = t.subscriptionEndDate || t.trialEndDate
                const days = end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86400000) : null
                return (
                  <div key={t.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.companyName}</p>
                      <p className="text-xs text-gray-400">Expires: {end}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${days !== null && days <= 7 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                      {days !== null ? `${days}d left` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
