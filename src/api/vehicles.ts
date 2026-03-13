import apiClient from './client'
import type { ApiResponse, Vehicle } from '@/types'

export const vehiclesApi = {
  getAll:    ()           => apiClient.get<ApiResponse<Vehicle[]>>('/vehicles').then(r => r.data),
  getById:   (id: number) => apiClient.get<ApiResponse<Vehicle>>(`/vehicles/${id}`).then(r => r.data),
  create:    (data: Partial<Vehicle>) => apiClient.post<ApiResponse<Vehicle>>('/vehicles', data).then(r => r.data),
  update:    (id: number, data: Partial<Vehicle>) => apiClient.put<ApiResponse<Vehicle>>(`/vehicles/${id}`, data).then(r => r.data),
  remove:    (id: number) => apiClient.delete<ApiResponse<null>>(`/vehicles/${id}`).then(r => r.data),
  getDocuments:   (vehicleId: number) => apiClient.get<ApiResponse<unknown[]>>(`/staff/vehicles/${vehicleId}/documents`).then(r => r.data),
  addDocument:    (vehicleId: number, data: unknown) => apiClient.post<ApiResponse<unknown>>(`/staff/vehicles/${vehicleId}/documents`, data).then(r => r.data),
  verifyDocument: (docId: number, data: unknown) => apiClient.put<ApiResponse<unknown>>(`/staff/vehicles/documents/${docId}/verify`, data).then(r => r.data),
}
