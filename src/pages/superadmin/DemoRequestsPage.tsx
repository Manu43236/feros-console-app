import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ClipboardList, Phone, Mail, Building2, Truck, MapPin,
  Calendar, ChevronDown, X,
} from 'lucide-react'
import { demoRequestsApi } from '@/api/superadmin'
import type { DemoRequest, DemoRequestStatus } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<DemoRequestStatus, string> = {
  NEW:       'New',
  CONTACTED: 'Contacted',
  CONVERTED: 'Converted',
  CLOSED:    'Closed',
}

const STATUS_STYLES: Record<DemoRequestStatus, string> = {
  NEW:       'bg-blue-100 text-blue-700 border-blue-200',
  CONTACTED: 'bg-amber-100 text-amber-700 border-amber-200',
  CONVERTED: 'bg-green-100 text-green-700 border-green-200',
  CLOSED:    'bg-slate-100 text-slate-600 border-slate-200',
}

function StatusBadge({ status }: { status: DemoRequestStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  request,
  onClose,
}: {
  request: DemoRequest
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState(request.notes ?? '')

  const mutation = useMutation({
    mutationFn: ({ status, notes }: { status: DemoRequestStatus; notes?: string }) =>
      demoRequestsApi.updateStatus(request.id, status, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demo-requests'] })
      qc.invalidateQueries({ queryKey: ['demo-requests-count'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const statuses: DemoRequestStatus[] = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{request.company}</h2>
            <p className="text-slate-500 text-sm">{request.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6 flex-1">

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <button
                  key={s}
                  onClick={() => mutation.mutate({ status: s, notes: notes || undefined })}
                  disabled={mutation.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    request.status === s
                      ? STATUS_STYLES[s] + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Contact Details
            </label>
            <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
              {[
                { icon: Building2, label: 'Company',    value: request.company },
                { icon: Phone,     label: 'Phone',      value: request.phone,     href: `tel:${request.phone}` },
                { icon: Mail,      label: 'Email',      value: request.email,     href: `mailto:${request.email}` },
                { icon: Truck,     label: 'Fleet Size', value: request.fleetSize },
                { icon: MapPin,    label: 'City',       value: request.city },
                { icon: Calendar,  label: 'Received',   value: fmt(request.createdAt) },
              ].filter(row => row.value).map(row => {
                const Icon = row.icon
                return (
                  <div key={row.label} className="flex items-start gap-3">
                    <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-400">{row.label}</div>
                      {row.href ? (
                        <a href={row.href} className="text-sm font-medium text-orange-600 hover:underline">
                          {row.value}
                        </a>
                      ) : (
                        <div className="text-sm font-medium text-slate-800">{row.value}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Notes
            </label>
            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 resize-none outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10"
              rows={4}
              placeholder="Add notes about this lead…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button
              onClick={() => mutation.mutate({ status: request.status, notes: notes || undefined })}
              disabled={mutation.isPending}
              className="mt-2 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-50"
            >
              Save notes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const TABS: { label: string; value: DemoRequestStatus | 'ALL' }[] = [
  { label: 'All',       value: 'ALL' },
  { label: 'New',       value: 'NEW' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Converted', value: 'CONVERTED' },
  { label: 'Closed',    value: 'CLOSED' },
]

export default function DemoRequestsPage() {
  const [activeTab, setActiveTab] = useState<DemoRequestStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<DemoRequest | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['demo-requests', activeTab, page],
    queryFn: () => demoRequestsApi.getAll({
      status: activeTab === 'ALL' ? undefined : activeTab,
      page,
      size: 20,
    }),
  })

  const { data: countData } = useQuery({
    queryKey: ['demo-requests-count'],
    queryFn: () => demoRequestsApi.countNew(),
    refetchInterval: 60_000,
  })

  const requests = data?.data?.content ?? []
  const total    = data?.data?.totalElements ?? 0
  const pages    = data?.data?.totalPages ?? 1
  const newCount = countData?.data?.count ?? 0

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-slate-900">Demo Requests</h1>
            {newCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {newCount} new
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Leads submitted from the FEROS business website.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setActiveTab(tab.value); setPage(0) }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.value === 'NEW' && newCount > 0 && (
              <span className="ml-1.5 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Loading…
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <ClipboardList size={40} strokeWidth={1.5} />
            <div className="text-sm font-medium">No demo requests yet</div>
            <div className="text-xs">Requests from the business website will appear here</div>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Name', 'Company', 'Phone', 'Fleet Size', 'City', 'Date', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map(req => (
                  <tr
                    key={req.id}
                    onClick={() => setSelected(req)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{req.name}</td>
                    <td className="px-4 py-3 text-slate-600">{req.company}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${req.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="text-orange-600 hover:underline font-medium"
                      >
                        {req.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{req.fleetSize ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{req.city ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{fmt(req.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
                <span>{total} total requests</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-xs font-medium"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-xs">
                    Page {page + 1} of {pages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
                    disabled={page >= pages - 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-xs font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
