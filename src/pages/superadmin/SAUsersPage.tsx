import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserCog, CheckCircle, XCircle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { staffApi } from '@/api/staff'

type StaffUser = {
  id: number; name: string; phone: string; role: string
  isActive: boolean; designationName: string | null
  generatedPin: string | null
}

export function SAUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['sa-users'], queryFn: staffApi.getUsers })
  const users: StaffUser[] = (data?.data ?? []) as StaffUser[]

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => staffApi.toggleStatus(id, isActive),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['sa-users'] }) },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  const resetPinMutation = useMutation({
    mutationFn: (id: number) => staffApi.resetPin(id),
    onSuccess: (res) => {
      toast.success(`New PIN: ${res.data?.pin ?? '—'}`, { duration: 10000 })
      qc.invalidateQueries({ queryKey: ['sa-users'] })
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  })

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const active   = users.filter(u => u.isActive).length
  const inactive = users.length - active

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">All users in the system</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: users.length, icon: UserCog,     color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Active',   value: active,       icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Inactive', value: inactive,     icon: XCircle,     color: 'text-gray-500',  bg: 'bg-gray-100' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, or role…" className="max-w-xs" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <UserCog size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">{search ? 'No matching users' : 'No users found'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Designation</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.phone}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">{u.role}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.designationName ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                        disabled={toggleMutation.isPending}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-orange-500" title="Reset PIN"
                        onClick={() => {
                          if (confirm(`Reset PIN for ${u.name}?`)) resetPinMutation.mutate(u.id)
                        }}
                      >
                        <KeyRound size={12} />
                      </Button>
                    </div>
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
