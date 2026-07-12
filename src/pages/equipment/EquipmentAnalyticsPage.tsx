import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Clock, Wrench, IndianRupee, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { equipmentAnalyticsApi } from '@/api/equipmentAnalytics'
import type { MachineAnalyticsRow } from '@/types'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function pctColor(pct: number, good = 70) {
  if (pct >= good) return 'text-green-600'
  if (pct >= good * 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

export function EquipmentAnalyticsPage() {
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(todayStr)
  const [applied, setApplied] = useState({ from: firstOfMonth, to: todayStr })

  const { data, isFetching, isError } = useQuery({
    queryKey: ['equipment-analytics', applied.from, applied.to],
    queryFn: () => equipmentAnalyticsApi.getAnalytics(applied.from, applied.to).then(r => r.data.data),
    staleTime: 5 * 60_000,
  })

  function handleExport() {
    if (!data) return
    const headers = ['Machine','Type','Deployed Days','Shift Hrs','Working Hrs','Utilization %','Availability %','Revenue','Service Costs','Depreciation','Net Profit']
    const rows = data.machines.map((m: MachineAnalyticsRow) => [
      m.serialNumber ?? m.equipmentId,
      m.equipmentTypeName ?? '',
      m.deployedDays,
      m.shiftHours.toFixed(1),
      m.workingHours.toFixed(1),
      m.utilizationPct.toFixed(1),
      m.availabilityPct.toFixed(1),
      m.revenue,
      m.serviceCosts,
      m.depreciation,
      m.netProfit,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `equipment-analytics-${applied.from}-${applied.to}.csv`
    a.click()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} min={from} max={todayStr} onChange={e => setTo(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-feros-navy" />
        </div>
        <Button size="sm" onClick={() => setApplied({ from, to })} disabled={isFetching}>
          {isFetching ? 'Loading…' : 'Apply'}
        </Button>
        {data && (
          <Button size="sm" variant="outline" onClick={handleExport} className="ml-auto">
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      {isError && <p className="text-red-500 text-sm">Failed to load analytics.</p>}

      {data && (
        <>
          {/* Fleet summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Avg Utilization', value: `${data.avgUtilizationPct.toFixed(1)}%`, icon: Clock,        color: pctColor(data.avgUtilizationPct) },
              { label: 'Avg Availability', value: `${data.avgAvailabilityPct.toFixed(1)}%`, icon: Wrench,      color: pctColor(data.avgAvailabilityPct) },
              { label: 'Total Revenue',   value: fmt(data.totalRevenue),    icon: IndianRupee,  color: 'text-blue-700' },
              { label: 'Service Costs',   value: fmt(data.totalServiceCosts), icon: Wrench,      color: 'text-orange-600' },
              { label: 'Depreciation',    value: fmt(data.totalDepreciation), icon: TrendingDown, color: 'text-gray-600' },
              { label: 'Net Profit',      value: fmt(data.totalNetProfit),  icon: TrendingUp,   color: data.totalNetProfit >= 0 ? 'text-green-700' : 'text-red-600' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <card.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{card.label}</span>
                </div>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Per-machine table */}
          {data.machines.length === 0 ? (
            <p className="text-gray-500 text-sm">No machines were deployed in this period.</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {['Machine', 'Type', 'Days', 'Shift Hrs', 'Working Hrs', 'Utilization', 'Availability', 'Revenue', 'Svc Cost', 'Deprec.', 'Net Profit'].map(h => (
                      <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.machines.map((m: MachineAnalyticsRow) => (
                    <tr key={m.equipmentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{m.serialNumber ?? `#${m.equipmentId}`}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.equipmentTypeName ?? '—'}</td>
                      <td className="px-4 py-3 text-center">{m.deployedDays}</td>
                      <td className="px-4 py-3 text-center">{m.shiftHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center">{m.workingHours.toFixed(1)}</td>
                      <td className={`px-4 py-3 text-center font-semibold ${pctColor(m.utilizationPct)}`}>
                        {m.utilizationPct.toFixed(1)}%
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${pctColor(m.availabilityPct)}`}>
                        {m.availabilityPct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmt(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{fmt(m.serviceCosts)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(m.depreciation)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {fmt(m.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!data && !isFetching && !isError && (
        <p className="text-gray-500 text-sm">Select a date range and click Apply.</p>
      )}
    </div>
  )
}
