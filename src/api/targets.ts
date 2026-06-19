import apiClient from './client'
import type { ApiResponse, TenantTarget } from '@/types'

export const targetsApi = {
  getCurrent: () =>
    apiClient.get<ApiResponse<TenantTarget>>('/dashboard/monthly-targets').then(r => r.data),

  set: (data: { year: number; month: number; targetTrips?: number; targetTons?: number }) =>
    apiClient.put<ApiResponse<TenantTarget>>('/targets', data).then(r => r.data),
}
