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
  logoUrl:     string | null
  isAuthenticated: boolean

  // Impersonation — saved SA session while impersonating
  saSession: {
    token: string; userId: number; phone: string
    name: string; role: string; companyName: string; logoUrl: string | null
  } | null

  login:              (data: LoginResponse) => void
  logout:             () => void
  impersonate:        (data: LoginResponse) => void
  exitImpersonation:  () => void
  setLogoUrl:         (url: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token:       null,
      userId:      null,
      tenantId:    null,
      phone:       null,
      name:        null,
      role:        null,
      companyName: null,
      logoUrl:     null,
      isAuthenticated: false,
      saSession:   null,

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
          logoUrl:     data.logoUrl ?? null,
          isAuthenticated: true,
          saSession:   null,
        })
      },

      logout: () => {
        localStorage.removeItem('feros_token')
        set({
          token: null, userId: null, tenantId: null,
          phone: null, name: null, role: null, companyName: null, logoUrl: null,
          isAuthenticated: false, saSession: null,
        })
      },

      impersonate: (data: LoginResponse) => {
        const state = get()
        // Save current SA session before switching
        const saSession = {
          token:       state.token!,
          userId:      state.userId!,
          phone:       state.phone!,
          name:        state.name!,
          role:        state.role!,
          companyName: state.companyName!,
          logoUrl:     state.logoUrl,
        }
        localStorage.setItem('feros_token', data.token)
        set({
          token:       data.token,
          userId:      data.userId,
          tenantId:    data.tenantId,
          phone:       data.phone,
          name:        data.name,
          role:        data.role,
          companyName: data.companyName,
          logoUrl:     data.logoUrl ?? null,
          isAuthenticated: true,
          saSession,
        })
      },

      setLogoUrl: (url: string) => set({ logoUrl: url }),

      exitImpersonation: () => {
        const { saSession } = get()
        if (!saSession) return
        localStorage.setItem('feros_token', saSession.token)
        set({
          token:       saSession.token,
          userId:      saSession.userId,
          tenantId:    null,
          phone:       saSession.phone,
          name:        saSession.name,
          role:        saSession.role,
          companyName: saSession.companyName,
          logoUrl:     saSession.logoUrl,
          isAuthenticated: true,
          saSession:   null,
        })
      },
    }),
    { name: 'feros_user' }
  )
)
