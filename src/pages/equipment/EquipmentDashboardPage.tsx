import { Construction } from 'lucide-react'

export function EquipmentDashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
        <Construction size={32} className="text-gray-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-gray-700">Equipment Dashboard</h2>
        <p className="text-sm text-gray-400 mt-1">Coming soon</p>
      </div>
    </div>
  )
}
