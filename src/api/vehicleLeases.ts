import apiClient from './client'
import type { ApiResponse, PageResponse, VehicleLease, LeaseVehicleAssignment, LeaseBilling, LeaseDailyLog, LeaseStatus, LeaseVehicleSession } from '@/types'

export const vehicleLeasesApi = {
  getAll: (params?: { page?: number; size?: number; status?: LeaseStatus; clientId?: number }) =>
    apiClient.get<ApiResponse<PageResponse<VehicleLease>>>('/vehicle-leases', { params }).then(r => r.data),

  getById: (id: number) =>
    apiClient.get<ApiResponse<VehicleLease>>(`/vehicle-leases/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<ApiResponse<VehicleLease>>('/vehicle-leases', data).then(r => r.data),

  update: (id: number, data: Record<string, unknown>) =>
    apiClient.put<ApiResponse<VehicleLease>>(`/vehicle-leases/${id}`, data).then(r => r.data),

  updateStatus: (id: number, status: LeaseStatus) =>
    apiClient.put<ApiResponse<VehicleLease>>(`/vehicle-leases/${id}/status`, { status }).then(r => r.data),

  extend: (id: number, newEndDate: string) =>
    apiClient.put<ApiResponse<VehicleLease>>(`/vehicle-leases/${id}/extend`, { newEndDate }).then(r => r.data),

  getVehicles: (leaseId: number) =>
    apiClient.get<ApiResponse<LeaseVehicleAssignment[]>>(`/vehicle-leases/${leaseId}/vehicles`).then(r => r.data),

  addVehicle: (leaseId: number, data: Record<string, unknown>) =>
    apiClient.post<ApiResponse<LeaseVehicleAssignment>>(`/vehicle-leases/${leaseId}/vehicles`, data).then(r => r.data),

  closeVehicle: (leaseId: number, assignmentId: number, odometerAtEnd?: number) =>
    apiClient.put<ApiResponse<LeaseVehicleAssignment>>(
      `/vehicle-leases/${leaseId}/vehicles/${assignmentId}/close`,
      odometerAtEnd != null ? { odometerAtEnd: String(odometerAtEnd) } : {}
    ).then(r => r.data),

  assignDivision: (leaseId: number, assignmentId: number, divisionId: number | null) =>
    apiClient.put<ApiResponse<LeaseVehicleAssignment>>(
      `/vehicle-leases/${leaseId}/vehicles/${assignmentId}/division`,
      { divisionId }
    ).then(r => r.data),

  getBilling: (leaseId: number) =>
    apiClient.get<ApiResponse<LeaseBilling>>(`/vehicle-leases/${leaseId}/billing`).then(r => r.data),

  startSession: (leaseId: number, assignmentId: number, data: {
    startTime?: string
    driverStaffId?: number | null
    divisionId?: number | null
    odometerStart?: number | null
    notes?: string
  }) =>
    apiClient.post<ApiResponse<LeaseVehicleSession>>(
      `/vehicle-leases/${leaseId}/vehicles/${assignmentId}/sessions`, data
    ).then(r => r.data),

  endSession: (leaseId: number, assignmentId: number, data?: { endTime?: string; odometerEnd?: number | null; notes?: string }) =>
    apiClient.put<ApiResponse<LeaseVehicleSession>>(
      `/vehicle-leases/${leaseId}/vehicles/${assignmentId}/sessions/end`, data ?? {}
    ).then(r => r.data),

  getSessions: (leaseId: number, assignmentId?: number) =>
    apiClient.get<ApiResponse<LeaseVehicleSession[]>>(`/vehicle-leases/${leaseId}/sessions`, {
      params: assignmentId ? { assignmentId } : undefined,
    }).then(r => r.data),

  getDailyLogs: (leaseId: number) =>
    apiClient.get<ApiResponse<LeaseDailyLog[]>>(`/vehicle-leases/${leaseId}/daily-logs`).then(r => r.data),

  createDailyLog: (leaseId: number, assignmentId: number, date: string) =>
    apiClient.post<ApiResponse<LeaseDailyLog>>(
      `/vehicle-leases/${leaseId}/vehicles/${assignmentId}/daily-logs`, { date }
    ).then(r => r.data),
}
