import apiClient from './client'
import type { ApiResponse, Vehicle } from '@/types'

export type WatchlistUser = {
  id: number
  name: string
  phone: string
  role: string
  isActive: boolean
  isAssigned: boolean
  activeOrderNumber: string | null
  designationName: string | null
  profilePhotoUrl: string | null
}

export const watchlistApi = {
  // Vehicle watchlist
  getVehicles:    () => apiClient.get<ApiResponse<Vehicle[]>>('/supervisor/watchlist/vehicles').then(r => r.data),
  getVehicleIds:  () => apiClient.get<ApiResponse<number[]>>('/supervisor/watchlist/vehicles/ids').then(r => r.data),
  addVehicle:     (vehicleId: number) => apiClient.post<ApiResponse<Vehicle>>('/supervisor/watchlist/vehicles', { vehicleId }).then(r => r.data),
  removeVehicle:  (vehicleId: number) => apiClient.delete<ApiResponse<null>>(`/supervisor/watchlist/vehicles/${vehicleId}`).then(r => r.data),

  // Staff watchlist
  getStaff:       () => apiClient.get<ApiResponse<WatchlistUser[]>>('/supervisor/watchlist/staff').then(r => r.data),
  getStaffIds:    () => apiClient.get<ApiResponse<number[]>>('/supervisor/watchlist/staff/ids').then(r => r.data),
  addStaff:       (userId: number) => apiClient.post<ApiResponse<WatchlistUser>>('/supervisor/watchlist/staff', { userId }).then(r => r.data),
  removeStaff:    (userId: number) => apiClient.delete<ApiResponse<null>>(`/supervisor/watchlist/staff/${userId}`).then(r => r.data),
}
