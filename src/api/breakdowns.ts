import apiClient from './client'
import type { ApiResponse, Breakdown, BreakdownDuration, BreakdownType } from '@/types'

interface BreakdownRequest {
  breakdownType: BreakdownType
  breakdownDuration: BreakdownDuration
  breakdownDate: string   // ISO datetime
  location?: string
  reason: string
  notes?: string
}

interface BreakdownReplaceRequest {
  replacementVehicleId: number
  expectedDeliveryDate?: string
  transferStaff: boolean
  notes?: string
}

export const breakdownsApi = {
  report: (orderId: number, allocationId: number, data: BreakdownRequest) =>
    apiClient.post<ApiResponse<Breakdown>>(
      `/orders/${orderId}/vehicle-allocations/${allocationId}/breakdown`, data
    ).then(r => r.data),

  get: (orderId: number, allocationId: number) =>
    apiClient.get<ApiResponse<Breakdown>>(
      `/orders/${orderId}/vehicle-allocations/${allocationId}/breakdown`
    ).then(r => r.data),

  replace: (orderId: number, breakdownId: number, data: BreakdownReplaceRequest) =>
    apiClient.post<ApiResponse<Breakdown>>(
      `/orders/${orderId}/breakdowns/${breakdownId}/replace`, data
    ).then(r => r.data),

  resolve: (orderId: number, breakdownId: number) =>
    apiClient.post<ApiResponse<Breakdown>>(
      `/orders/${orderId}/breakdowns/${breakdownId}/resolve`
    ).then(r => r.data),

  cancel: (orderId: number, breakdownId: number) =>
    apiClient.delete<ApiResponse<null>>(
      `/orders/${orderId}/breakdowns/${breakdownId}`
    ).then(r => r.data),

  vehicleHistory: (vehicleId: number) =>
    apiClient.get<ApiResponse<Breakdown[]>>(
      `/vehicle-breakdowns`, { params: { vehicleId } }
    ).then(r => r.data),

  reportStandalone: (vehicleId: number, data: BreakdownRequest) =>
    apiClient.post<ApiResponse<Breakdown>>(
      `/vehicles/${vehicleId}/breakdown`, data
    ).then(r => r.data),

  resolveStandalone: (vehicleId: number, breakdownId: number) =>
    apiClient.post<ApiResponse<Breakdown>>(
      `/vehicles/${vehicleId}/breakdown/${breakdownId}/resolve`
    ).then(r => r.data),
}
