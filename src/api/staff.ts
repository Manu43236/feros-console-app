import apiClient from './client'
import type { ApiResponse, StaffProfile, StaffDocument } from '@/types'

export const staffApi = {
  createUser:     (data: unknown) => apiClient.post<ApiResponse<{ id: number; name: string; phone: string; generatedPin: string }>>('/users', data).then(r => r.data),
  getUsers:       () => apiClient.get<ApiResponse<{ id: number; name: string; phone: string; role: string; generatedPin: string | null; isActive: boolean; designationName: string | null; completedTripsCount: number; isAssigned: boolean; activeOrderNumber: string | null }[]>>('/users').then(r => r.data),
  resetPin:       (userId: number) => apiClient.put<ApiResponse<{ userId: number; name: string; phone: string; pin: string }>>(`/users/${userId}/reset-pin`).then(r => r.data),
  toggleStatus:   (userId: number, isActive: boolean) => apiClient.put<ApiResponse<unknown>>(`/users/${userId}/status`, { isActive }).then(r => r.data),
  getAll:         () => apiClient.get<ApiResponse<StaffProfile[]>>('/staff/profiles').then(r => r.data),
  getByUserId:    (userId: number) => apiClient.get<ApiResponse<StaffProfile>>(`/staff/profiles/${userId}`).then(r => r.data),
  upsert:         (userId: number, data: unknown) => apiClient.put<ApiResponse<StaffProfile>>(`/staff/profiles/${userId}`, data).then(r => r.data),
  getDocuments:   (userId: number) => apiClient.get<ApiResponse<StaffDocument[]>>(`/staff/${userId}/documents`).then(r => r.data),
  addDocument:    (userId: number, data: unknown) => apiClient.post<ApiResponse<StaffDocument>>(`/staff/${userId}/documents`, data).then(r => r.data),
  verifyDocument: (docId: number, data: unknown) => apiClient.put<ApiResponse<StaffDocument>>(`/staff/documents/${docId}/verify`, data).then(r => r.data),
  uploadDocFile:  (file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', 'tenants/staff/docs')
    return apiClient.post<ApiResponse<{ key: string; url: string; publicUrl: string }>>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}
