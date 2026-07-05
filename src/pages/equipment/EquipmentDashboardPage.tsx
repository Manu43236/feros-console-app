import { useQuery } from '@tanstack/react-query'
import { Construction, Gauge, Wrench, AlertTriangle, ClipboardList, Clock, Calendar } from 'lucide-react'
import { equipmentApi } from '@/api/equipment'
import { cn } from '@/lib/utils'

function fmtHours(h?: number | null) {
  if (h == null) return '0.0'
  return Number(h).toFixed(1)
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string // tailwind bg+border+text classes
}

function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div className={cn('rounded-xl p-4 border', color)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <span className="opacity-60">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

export function EquipmentDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['equipment-dashboard'],
    queryFn: () => equipmentApi.getDashboard(),
    refetchInterval: 60_000, // refresh every minute
  })

  const d = data?.data

  if (isLoading) return (
    <div className="p-12 text-center text-gray-400 animate-pulse">Loading dashboard…</div>
  )

  return (
    <div className="space-y-5">

      {/* ── Banner ── */}
      <div className="bg-gradient-to-br from-[#1C1400] via-[#1C1400] to-[#2d2200] rounded-xl overflow-hidden">
        <div className="px-6 py-5">
          <p className="text-yellow-300/60 text-xs font-semibold uppercase tracking-widest mb-1">Equipment</p>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-yellow-200/50 text-sm mt-0.5">Live overview of your fleet</p>
        </div>
      </div>

      {/* ── Hours summary ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Hours Today</p>
            <p className="text-2xl font-bold text-gray-800">{fmtHours(d?.hoursToday)} <span className="text-sm font-normal text-gray-400">hrs</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
            <Calendar size={20} className="text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Hours This Month</p>
            <p className="text-2xl font-bold text-gray-800">{fmtHours(d?.hoursThisMonth)} <span className="text-sm font-normal text-gray-400">hrs</span></p>
          </div>
        </div>
      </div>

      {/* ── Machine status breakdown ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Machine Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total"      value={d?.totalMachines ?? 0} icon={<Construction size={16} />} color="bg-gray-50 border-gray-200 text-gray-700" />
          <StatCard label="Available"  value={d?.available ?? 0}     icon={<Construction size={16} />} color="bg-green-50 border-green-200 text-green-700" sub="ready to deploy" />
          <StatCard label="Assigned"   value={d?.assigned ?? 0}      icon={<Construction size={16} />} color="bg-blue-50 border-blue-200 text-blue-700"  sub="on work order" />
          <StatCard label="Busy"       value={d?.busy ?? 0}          icon={<Gauge size={16} />}        color="bg-orange-50 border-orange-200 text-orange-700" />
          <StatCard label="In Repair"  value={d?.inRepair ?? 0}      icon={<Wrench size={16} />}       color="bg-yellow-50 border-yellow-200 text-yellow-700" />
          <StatCard label="Breakdown"  value={d?.breakdown ?? 0}     icon={<AlertTriangle size={16} />} color="bg-red-50 border-red-200 text-red-700" />
        </div>
      </div>

      {/* ── Work Orders ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Work Orders</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className="text-amber-500" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{d?.activeWorkOrders ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">In Progress</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={16} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{d?.totalWorkOrders ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">all time</p>
          </div>
        </div>
      </div>

    </div>
  )
}
