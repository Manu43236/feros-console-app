import axios from 'axios'
import { toast } from 'sonner'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('feros_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally — show message and redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear persisted auth state
      localStorage.removeItem('feros_user')
      toast.error('Your session has expired. Please sign in again.')
      setTimeout(() => { window.location.href = '/login' }, 1500)
    }
    if (error.response?.status === 402) {
      // Mark so mutations know not to show a duplicate toast
      error.isSubscriptionBlock = true
      toast.error('Your trial/subscription has expired. Please upgrade your plan to continue using FEROS.', {
        action: { label: 'Upgrade Now', onClick: () => { window.location.href = '/subscription' } },
        duration: 8000,
      })
    }
    return Promise.reject(error)
  }
)

export default apiClient
