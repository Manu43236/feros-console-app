import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/superadmin'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Notification } from '@/types'

function formatDate(iso: string) {
  return iso?.slice(0, 16).replace('T', ' ') ?? ''
}

export function NotificationsPage() {
  const qc = useQueryClient()

  const { data: notifsRes, isLoading } = useQuery({
    queryKey: ['notifs'],
    queryFn: () => notificationsApi.getAll(),
  })
  const notifs: Notification[] = notifsRes?.data ?? []
  const unreadCount = notifs.filter(n => !n.isRead).length

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifs'] })
      qc.invalidateQueries({ queryKey: ['notif-count'] })
      toast.success('All notifications marked as read')
    },
    onError: () => toast.error('Failed to mark notifications as read'),
  })

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : notifs.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <Bell size={36} strokeWidth={1.5} />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          notifs.map((n, i) => (
            <div
              key={n.id}
              className={cn(
                'px-5 py-4 flex gap-4',
                i !== notifs.length - 1 && 'border-b border-gray-100',
                !n.isRead && 'bg-blue-50'
              )}
            >
              <div className={cn(
                'mt-1 w-2 h-2 rounded-full shrink-0',
                n.isRead ? 'bg-gray-200' : 'bg-feros-orange'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
