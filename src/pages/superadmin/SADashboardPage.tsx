import { Building2, CheckCircle, CreditCard, Users } from 'lucide-react'

const stats = [
  { label: 'Total Tenants',    value: '—', icon: Building2,   color: 'bg-blue-50 text-feros-navy' },
  { label: 'Active Tenants',   value: '—', icon: CheckCircle, color: 'bg-green-50 text-green-600' },
  { label: 'Subscriptions',    value: '—', icon: CreditCard,  color: 'bg-orange-50 text-feros-orange' },
  { label: 'Total Users',      value: '—', icon: Users,       color: 'bg-purple-50 text-purple-600' },
]

export function SADashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">System-wide overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon size={16} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Tenants</h2>
          <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Expiring Subscriptions</h2>
          <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
        </div>
      </div>
    </div>
  )
}
