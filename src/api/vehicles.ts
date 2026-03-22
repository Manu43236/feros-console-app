import apiClient from './client'
import type { ApiResponse, Vehicle, VehicleDocument } from '@/types'

export const vehiclesApi = {
  getAll:    ()           => apiClient.get<ApiResponse<Vehicle[]>>('/vehicles').then(r => r.data),
  getById:   (id: number) => apiClient.get<ApiResponse<Vehicle>>(`/vehicles/${id}`).then(r => r.data),
  create:    (data: Partial<Vehicle>) => apiClient.post<ApiResponse<Vehicle>>('/vehicles', data).then(r => r.data),
  update:    (id: number, data: Partial<Vehicle>) => apiClient.put<ApiResponse<Vehicle>>(`/vehicles/${id}`, data).then(r => r.data),
  updateStatus: (id: number, currentStatusId: number) => apiClient.patch<ApiResponse<Vehicle>>(`/vehicles/${id}/status`, { currentStatusId }).then(r => r.data),
  remove:    (id: number) => apiClient.delete<ApiResponse<null>>(`/vehicles/${id}`).then(r => r.data),
  bulkUpload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<ApiResponse<import('@/types').BulkUploadResult>>('/vehicles/bulk-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  getDocuments:   (vehicleId: number) => apiClient.get<ApiResponse<VehicleDocument[]>>(`/staff/vehicles/${vehicleId}/documents`).then(r => r.data),
  addDocument:    (vehicleId: number, data: Partial<VehicleDocument>) => apiClient.post<ApiResponse<VehicleDocument>>(`/staff/vehicles/${vehicleId}/documents`, data).then(r => r.data),
  verifyDocument: (docId: number, data: { isVerified: boolean; remarks?: string }) => apiClient.put<ApiResponse<VehicleDocument>>(`/staff/vehicles/documents/${docId}/verify`, data).then(r => r.data),
}
