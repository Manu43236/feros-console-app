import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryTransactionsApi } from '@/api/inventory'
import type { StockTransactionType } from '@/types'
import { Search, ArrowDownCircle, ArrowUpCircle, AlertOctagon } from 'lucide-react'
import { Input } from '@/components/ui/input'

function txChip(type: StockTransactionType) {
  if (type === 'IN')     return <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded"><ArrowDownCircle size={12} /> IN</span>
  if (type === 'OUT')    return <span className="flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded"><ArrowUpCircle size={12} /> OUT</span>
  return <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded"><AlertOctagon size={12} /> DAMAGE</span>
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<StockTransactionType | 'ALL'>('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: inventoryTransactionsApi.getAll,
  })
  const transactions = data?.data ?? []

  const filtered = transactions.filter(t => {
    const matchSearch =
      t.partName.toLowerCase().includes(search.toLowerCase()) ||
      (t.serviceNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.vehicleRegistrationNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.supplierName ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'ALL' || t.transactionType === typeFilter
    return matchSearch && matchType
  })

  const inCount  = transactions.filter(t => t.transactionType === 'IN').length
  const outCount = transactions.filter(t => t.transactionType === 'OUT').length
  const dmgCount = transactions.filter(t => t.transactionType === 'DAMAGE').length

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
        <p className="text-sm text-gray-500">Complete stock movement history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Stock In</p>
          <p className="text-2xl font-bold text-green-600">{inCount}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Stock Out</p>
          <p className="text-2xl font-bold text-orange-600">{outCount}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Damage</p>
          <p className="text-2xl font-bold text-red-600">{dmgCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9 w-64" placeholder="Search transactions…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'IN', 'OUT', 'DAMAGE'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === t ? 'bg-feros-navy text-white border-feros-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No transactions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Part</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                  <td className="px-4 py-3">{txChip(t.transactionType)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.partName}</p>
                    <p className="text-xs text-gray-400">{t.unit}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{t.quantity}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {t.serviceNumber ? (
                      <div>
                        <p>{t.serviceNumber}</p>
                        <p className="text-xs text-gray-400">{t.vehicleRegistrationNumber}</p>
                      </div>
                    ) : t.supplierName ? (
                      t.supplierName
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.createdByName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {t.totalCost ? `₹${t.totalCost.toLocaleString('en-IN')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
