import { Calendar } from 'lucide-react'

export function MyAttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">Your attendance history</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center py-16 text-gray-400">
        <Calendar size={40} className="mb-3 text-gray-300" />
        <p>No attendance records found</p>
      </div>
    </div>
  )
}
