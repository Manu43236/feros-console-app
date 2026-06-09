import apiClient from './client'
import type { ApiResponse, ServiceManagerDashboard, TechnicianSummary } from '@/types'

export const serviceManagerApi = {
  getDashboard: () =>
    apiClient.get<ApiResponse<ServiceManagerDashboard>>('/service-manager/dashboard').then(r => r.data),

  getTechnicians: () =>
    apiClient.get<ApiResponse<TechnicianSummary[]>>('/service-manager/technicians').then(r => r.data),

  assignTechnician: (serviceId: number, taskId: number, technicianId: number) =>
    apiClient.put<ApiResponse<unknown>>(
      `/vehicle-services/${serviceId}/tasks/${taskId}/assign`,
      { mechanicId: technicianId }
    ).then(r => r.data),

  addTask: (serviceId: number, body: { taskTypeId?: number; customName?: string }) =>
    apiClient.post<ApiResponse<unknown>>(
      `/vehicle-services/${serviceId}/tasks`,
      body
    ).then(r => r.data),
}
