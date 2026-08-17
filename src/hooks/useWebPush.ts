import { useEffect } from 'react'
import { toast } from 'sonner'
import { getWebFcmToken, listenForegroundMessages } from '@/lib/firebase'
import { authApi } from '@/api/auth'

const WEB_PUSH_ROLES = ['ADMIN', 'OFFICE_STAFF', 'STORE_KEEPER']

export function useWebPush(role: string | null) {
  useEffect(() => {
    if (!role || !WEB_PUSH_ROLES.includes(role)) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    getWebFcmToken().then(token => {
      if (token) authApi.updateFcmToken(token).catch(() => {})
    })

    const unsubscribe = listenForegroundMessages((title, body) => {
      toast(title, { description: body })
    })

    return unsubscribe
  }, [role])
}
