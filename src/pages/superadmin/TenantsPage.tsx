import { Building2, Users, CheckCircle, XCircle } from 'lucide-react'

const stats = [
  { label: 'Total Tenants',  value: '—', icon: Building2, color: 'text-feros-navy' },
  { label: 'Active',         value: '—', icon: CheckCircle, color: 'text-green-600' },
  { label: 'Inactive',       value: '—', icon: XCircle, color: 'text-red-500' },
  { label: 'Total Users',    value: '—', icon: Users, color: 'text-feros-orange' },
]

export function TenantsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
        <p className="text-gray-500 text-sm mt-1">Manage all FEROS tenants from here</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <Icon size={18} className={color} />
            </div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Tenants table placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <p className="text-gray-400 text-center py-12">Tenant list — coming soon</p>
      </div>
    </div>
  )
}
