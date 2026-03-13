import apiClient from './client'
import type { ApiResponse, DashboardResponse, ExpiryAlertResponse } from '@/types'

export const dashboardApi = {
  getSummary: () =>
    apiClient.get<ApiResponse<DashboardResponse>>('/dashboard').then(r => r.data),
  getExpiryAlerts: (days = 30) =>
    apiClient.get<ApiResponse<ExpiryAlertResponse>>(`/dashboard/expiry-alerts?days=${days}`).then(r => r.data),
}
