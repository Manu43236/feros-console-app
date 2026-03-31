import apiClient from './client'
import type { ApiResponse, BreakdownDuration, BreakdownType, Vehicle, VehicleDocument, VehicleImage, VehicleServiceRecord } from '@/types'

export interface UpdateStatusPayload {
  currentStatusId: number
  breakdownType?: BreakdownType
  breakdownDuration?: BreakdownDuration
  reason?: string
  location?: string
  breakdownDate?: string
  notes?: string
}

export const vehiclesApi = {
  getAll:    (date?: string) => apiClient.get<ApiResponse<Vehicle[]>>('/vehicles', { params: date ? { date } : {} }).then(r => r.data),
  getById:   (id: number) => apiClient.get<ApiResponse<Vehicle>>(`/vehicles/${id}`).then(r => r.data),
  create:    (data: Partial<Vehicle>) => apiClient.post<ApiResponse<Vehicle>>('/vehicles', data).then(r => r.data),
  update:    (id: number, data: Partial<Vehicle>) => apiClient.put<ApiResponse<Vehicle>>(`/vehicles/${id}`, data).then(r => r.data),
  updateStatus:   (id: number, payload: UpdateStatusPayload) => apiClient.patch<ApiResponse<Vehicle>>(`/vehicles/${id}/status`, payload).then(r => r.data),
  toggleActive:   (id: number) => apiClient.patch<ApiResponse<Vehicle>>(`/vehicles/${id}/active`).then(r => r.data),
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
  verifyDocument:  (docId: number, data: { isVerified: boolean; remarks?: string }) => apiClient.put<ApiResponse<VehicleDocument>>(`/staff/vehicles/documents/${docId}/verify`, data).then(r => r.data),
  deleteDocument:  (docId: number) => apiClient.delete<ApiResponse<void>>(`/staff/vehicles/documents/${docId}`).then(r => r.data),
  uploadDocFile:  (vehicleId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', `tenants/images/vehicles/${vehicleId}/documents`)
    return apiClient.post<ApiResponse<{ key: string; url: string; publicUrl: string }>>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  getImages:      (vehicleId: number) => apiClient.get<ApiResponse<VehicleImage[]>>(`/staff/vehicles/${vehicleId}/images`).then(r => r.data),
  addImage:       (vehicleId: number, imageUrl: string, caption?: string) => apiClient.post<ApiResponse<VehicleImage>>(`/staff/vehicles/${vehicleId}/images`, { imageUrl, caption }).then(r => r.data),
  deleteImage:    (imageId: number) => apiClient.delete<ApiResponse<void>>(`/staff/vehicles/images/${imageId}`).then(r => r.data),
  uploadImageFile: (vehicleId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', `tenants/images/vehicles/${vehicleId}/images`)
    return apiClient.post<ApiResponse<{ key: string; url: string; publicUrl: string }>>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

export const vehicleServicesApi = {
  getAll:        ()                               => apiClient.get<ApiResponse<VehicleServiceRecord[]>>('/vehicle-services').then(r => r.data),
  getByVehicle:  (vehicleId: number)              => apiClient.get<ApiResponse<VehicleServiceRecord[]>>(`/vehicle-services/vehicle/${vehicleId}`).then(r => r.data),
  getById:       (id: number)                     => apiClient.get<ApiResponse<VehicleServiceRecord>>(`/vehicle-services/${id}`).then(r => r.data),
  create:        (data: unknown)                  => apiClient.post<ApiResponse<VehicleServiceRecord>>('/vehicle-services', data).then(r => r.data),
  start:         (id: number)                     => apiClient.put<ApiResponse<VehicleServiceRecord>>(`/vehicle-services/${id}/start`, {}).then(r => r.data),
  complete:      (id: number, data: { completedDate: string; odometer?: number }) => apiClient.put<ApiResponse<VehicleServiceRecord>>(`/vehicle-services/${id}/complete`, data).then(r => r.data),
  delete:        (id: number)                     => apiClient.delete<ApiResponse<void>>(`/vehicle-services/${id}`).then(r => r.data),
}
