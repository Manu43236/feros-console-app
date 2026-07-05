import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LoginResponse, ModuleType } from '@/types'

interface AuthState {
  token:          string | null
  userId:         number | null
  tenantId:       number | null
  phone:          string | null
  name:           string | null
  role:           string | null
  companyName:    string | null
  logoUrl:        string | null
  isAuthenticated: boolean
  /** Null = ADMIN/SA (all modules visible). Array = only these module keys visible. */
  allowedModules: string[] | null
  /** Which modules this tenant has access to */
  moduleType: ModuleType | null
  /** Current active mode — only relevant when moduleType === 'BOTH' */
  currentMode: 'VEHICLES' | 'EQUIPMENT'
  /** Null for ADMIN/SA. For staff roles: whether they can access vehicles/equipment */
  canAccessVehicles: boolean | null
  canAccessEquipment: boolean | null

  // Impersonation — saved SA session while impersonating
  saSession: {
    token: string; userId: number; phone: string
    name: string; role: string; companyName: string; logoUrl: string | null
  } | null

  sessionDisplaced:   boolean

  login:              (data: LoginResponse) => void
  logout:             () => void
  impersonate:        (data: LoginResponse) => void
  exitImpersonation:  () => void
  setLogoUrl:         (url: string) => void
  setSessionDisplaced: (val: boolean) => void
  setCurrentMode:     (mode: 'VEHICLES' | 'EQUIPMENT') => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token:          null,
      userId:         null,
      tenantId:       null,
      phone:          null,
      name:           null,
      role:           null,
      companyName:    null,
      logoUrl:        null,
      isAuthenticated: false,
      allowedModules: null,
      moduleType:     null,
      currentMode:    'VEHICLES',
      canAccessVehicles: null,
      canAccessEquipment: null,
      saSession:      null,
      sessionDisplaced: false,

      login: (data: LoginResponse) => {
        set({
          token:          data.token,
          userId:         data.userId,
          tenantId:       data.tenantId,
          phone:          data.phone,
          name:           data.name,
          role:           data.role,
          companyName:    data.companyName,
          logoUrl:        data.logoUrl ?? null,
          isAuthenticated: true,
          allowedModules: data.allowedModules ?? null,
          moduleType:     data.moduleType ?? null,
          // Equipment-only supervisor → start in equipment mode
          currentMode:    (data.canAccessVehicles === false && data.canAccessEquipment === true)
                            ? 'EQUIPMENT'
                            : 'VEHICLES',
          canAccessVehicles:  data.canAccessVehicles ?? null,
          canAccessEquipment: data.canAccessEquipment ?? null,
          saSession:      null,
        })
      },

      logout: () => {
        set({
          token: null, userId: null, tenantId: null,
          phone: null, name: null, role: null, companyName: null, logoUrl: null,
          isAuthenticated: false, allowedModules: null, moduleType: null,
          currentMode: 'VEHICLES', canAccessVehicles: null, canAccessEquipment: null,
          saSession: null,
        })
      },

      impersonate: (data: LoginResponse) => {
        const state = get()
        const saSession = {
          token:       state.token!,
          userId:      state.userId!,
          phone:       state.phone!,
          name:        state.name!,
          role:        state.role!,
          companyName: state.companyName!,
          logoUrl:     state.logoUrl,
        }
        set({
          token:          data.token,
          userId:         data.userId,
          tenantId:       data.tenantId,
          phone:          data.phone,
          name:           data.name,
          role:           data.role,
          companyName:    data.companyName,
          logoUrl:        data.logoUrl ?? null,
          isAuthenticated: true,
          allowedModules: null, // Impersonating as ADMIN — all visible
          moduleType:     data.moduleType ?? null,
          currentMode:    'VEHICLES',
          canAccessVehicles:  null,
          canAccessEquipment: null,
          saSession,
        })
      },

      setLogoUrl: (url: string) => set({ logoUrl: url }),
      setSessionDisplaced: (val: boolean) => set({ sessionDisplaced: val }),
      setCurrentMode: (mode) => set({ currentMode: mode }),

      exitImpersonation: () => {
        const { saSession } = get()
        if (!saSession) return
        set({
          token:          saSession.token,
          userId:         saSession.userId,
          tenantId:       null,
          phone:          saSession.phone,
          name:           saSession.name,
          role:           saSession.role,
          companyName:    saSession.companyName,
          logoUrl:        saSession.logoUrl,
          isAuthenticated: true,
          allowedModules: null,
          saSession:      null,
        })
      },
    }),
    {
      name: 'feros_user',
      partialize: (state) => ({
        token: state.token, userId: state.userId, tenantId: state.tenantId,
        phone: state.phone, name: state.name, role: state.role,
        companyName: state.companyName, logoUrl: state.logoUrl,
        isAuthenticated: state.isAuthenticated, allowedModules: state.allowedModules,
        moduleType: state.moduleType, currentMode: state.currentMode,
        canAccessVehicles: state.canAccessVehicles, canAccessEquipment: state.canAccessEquipment,
        saSession: state.saSession,
        // sessionDisplaced intentionally excluded — must not survive page refresh
      }),
    }
  )
)
