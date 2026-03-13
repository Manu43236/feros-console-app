import { CreditCard } from 'lucide-react'

export function MyPayslipPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
        <p className="text-gray-500 text-sm mt-1">View and download your salary slips</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center py-16 text-gray-400">
        <CreditCard size={40} className="mb-3 text-gray-300" />
        <p>No payslips found</p>
      </div>
    </div>
  )
}
