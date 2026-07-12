import apiClient from './client'
import type { ApiResponse, EquipmentAnalytics } from '../types'

export const equipmentAnalyticsApi = {
  getAnalytics: (from: string, to: string) =>
    apiClient.get<ApiResponse<EquipmentAnalytics>>(`/equipment/analytics?from=${from}&to=${to}`),
}
