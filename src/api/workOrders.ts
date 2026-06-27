import apiClient from './client'
import type { ApiResponse, PageResponse, WorkOrder, WorkOrderDetail, MachineAssignment, DailyLog } from '@/types'

export const workOrdersApi = {
  getAll: (params?: { page?: number; size?: number; status?: string; clientId?: number }) =>
    apiClient.get<ApiResponse<PageResponse<WorkOrder>>>('/work-orders', { params }).then(r => r.data),

  getById: (id: number) =>
    apiClient.get<ApiResponse<WorkOrderDetail>>(`/work-orders/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<ApiResponse<WorkOrder>>('/work-orders', data).then(r => r.data),

  update: (id: number, data: Record<string, unknown>) =>
    apiClient.put<ApiResponse<WorkOrder>>(`/work-orders/${id}`, data).then(r => r.data),

  updateStatus: (id: number, status: string) =>
    apiClient.put<ApiResponse<WorkOrder>>(`/work-orders/${id}/status`, { status }).then(r => r.data),

  extend: (id: number, newEndDate: string) =>
    apiClient.put<ApiResponse<WorkOrder>>(`/work-orders/${id}/extend`, { newEndDate }).then(r => r.data),

  addMachine: (woId: number, data: { equipmentId: number; startDate?: string }) =>
    apiClient.post<ApiResponse<MachineAssignment>>(`/work-orders/${woId}/machines`, data).then(r => r.data),

  closeMachine: (woId: number, assignmentId: number, data: { endDate?: string; endReason: string }) =>
    apiClient.put<ApiResponse<void>>(`/work-orders/${woId}/machines/${assignmentId}/close`, data).then(r => r.data),

  addLog: (woId: number, data: Record<string, unknown>) =>
    apiClient.post<ApiResponse<DailyLog>>(`/work-orders/${woId}/logs`, data).then(r => r.data),

  updateLog: (woId: number, logId: number, data: Record<string, unknown>) =>
    apiClient.put<ApiResponse<DailyLog>>(`/work-orders/${woId}/logs/${logId}`, data).then(r => r.data),

  deleteLog: (woId: number, logId: number) =>
    apiClient.delete<ApiResponse<void>>(`/work-orders/${woId}/logs/${logId}`).then(r => r.data),
}
