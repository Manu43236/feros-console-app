import apiClient from './client'
import type { ApiResponse, ServiceManagerDashboard, MechanicSummary } from '@/types'

export const serviceManagerApi = {
  getDashboard: () =>
    apiClient.get<ApiResponse<ServiceManagerDashboard>>('/service-manager/dashboard').then(r => r.data),

  getMechanics: () =>
    apiClient.get<ApiResponse<MechanicSummary[]>>('/service-manager/mechanics').then(r => r.data),

  assignMechanic: (serviceId: number, taskId: number, mechanicId: number) =>
    apiClient.put<ApiResponse<unknown>>(
      `/vehicle-services/${serviceId}/tasks/${taskId}/assign`,
      { mechanicId }
    ).then(r => r.data),
}
