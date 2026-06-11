import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle error status codes globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const message = error.response?.data?.message
      useAuthStore.getState().logout()
      if (message === 'SESSION_DISPLACED') {
        useAuthStore.getState().setSessionDisplaced(true)
      } else {
        toast.error('Your session has expired. Please sign in again.')
        setTimeout(() => { window.location.href = '/login' }, 1500)
      }
    }
    if (error.response?.status === 402) {
      // Mark so mutations know not to show a duplicate toast
      error.isSubscriptionBlock = true
      toast.error('Your trial/subscription has expired. Please upgrade your plan to continue using FEROS.', {
        action: { label: 'Upgrade Now', onClick: () => { window.location.href = '/subscription' } },
        duration: 8000,
      })
    }
    if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action.')
    }
    if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment and try again.')
    }
    return Promise.reject(error)
  }
)

export default apiClient
