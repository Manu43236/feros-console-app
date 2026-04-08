import apiClient from './client'
import type { ApiResponse, MeterReading } from '@/types'

export const meterReadingsApi = {
  uploadPhoto: (vehicleId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', `tenants/images/vehicles/${vehicleId}/meter-readings`)
    return apiClient.post<ApiResponse<{ key: string; url: string; publicUrl: string }>>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  getAll: (vehicleId?: number) =>
    apiClient.get<ApiResponse<MeterReading[]>>('/meter-readings', { params: vehicleId ? { vehicleId } : {} }).then(r => r.data),
  create: (data: unknown) =>
    apiClient.post<ApiResponse<MeterReading>>('/meter-readings', data).then(r => r.data),
  update: (id: number, data: unknown) =>
    apiClient.put<ApiResponse<MeterReading>>(`/meter-readings/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/meter-readings/${id}`).then(r => r.data),
}
