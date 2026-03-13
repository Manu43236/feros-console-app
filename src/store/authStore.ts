import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LoginResponse } from '@/types'

interface AuthState {
  token:       string | null
  userId:      number | null
  tenantId:    number | null
  phone:       string | null
  name:        string | null
  role:        string | null
  companyName: string | null
  isAuthenticated: boolean
  login:  (data: LoginResponse) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:       null,
      userId:      null,
      tenantId:    null,
      phone:       null,
      name:        null,
      role:        null,
      companyName: null,
      isAuthenticated: false,

      login: (data: LoginResponse) => {
        localStorage.setItem('feros_token', data.token)
        set({
          token:       data.token,
          userId:      data.userId,
          tenantId:    data.tenantId,
          phone:       data.phone,
          name:        data.name,
          role:        data.role,
          companyName: data.companyName,
          isAuthenticated: true,
        })
      },

      logout: () => {
        localStorage.removeItem('feros_token')
        set({
          token: null, userId: null, tenantId: null,
          phone: null, name: null, role: null, companyName: null, isAuthenticated: false,
        })
      },
    }),
    { name: 'feros_user' }
  )
)
