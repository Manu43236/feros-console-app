import apiClient from './client'
import type { ApiResponse, FuelLog, PageResponse } from '@/types'

export const fuelLogsApi = {
  uploadReceipt: (vehicleId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', `tenants/images/vehicles/${vehicleId}/fuel-receipts`)
    return apiClient.post<ApiResponse<{ key: string; url: string; publicUrl: string }>>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  getAll: (params?: { page?: number; size?: number; search?: string; paymentMode?: string; fullTank?: boolean; vehicleId?: number }) =>
    apiClient.get<ApiResponse<PageResponse<FuelLog>>>('/fuel-logs', { params }).then(r => r.data),
  getById:        (id: number) =>
    apiClient.get<ApiResponse<FuelLog>>(`/fuel-logs/${id}`).then(r => r.data),
  create:         (data: unknown) =>
    apiClient.post<ApiResponse<FuelLog>>('/fuel-logs', data).then(r => r.data),
  update:         (id: number, data: unknown) =>
    apiClient.put<ApiResponse<FuelLog>>(`/fuel-logs/${id}`, data).then(r => r.data),
  delete:         (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/fuel-logs/${id}`).then(r => r.data),
}
