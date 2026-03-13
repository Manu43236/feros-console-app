import { Route } from 'lucide-react'

export function MyTripsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
        <p className="text-gray-500 text-sm mt-1">View your assigned orders and LRs</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center py-16 text-gray-400">
        <Route size={40} className="mb-3 text-gray-300" />
        <p>No trips assigned yet</p>
      </div>
    </div>
  )
}
