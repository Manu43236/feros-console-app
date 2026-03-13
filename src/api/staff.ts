import apiClient from './client'
import type { ApiResponse, StaffProfile, StaffDocument } from '@/types'

export const staffApi = {
  getAll:         () => apiClient.get<ApiResponse<StaffProfile[]>>('/staff/profiles').then(r => r.data),
  getByUserId:    (userId: number) => apiClient.get<ApiResponse<StaffProfile>>(`/staff/profiles/${userId}`).then(r => r.data),
  upsert:         (userId: number, data: unknown) => apiClient.put<ApiResponse<StaffProfile>>(`/staff/profiles/${userId}`, data).then(r => r.data),
  getDocuments:   (userId: number) => apiClient.get<ApiResponse<StaffDocument[]>>(`/staff/${userId}/documents`).then(r => r.data),
  addDocument:    (userId: number, data: unknown) => apiClient.post<ApiResponse<StaffDocument>>(`/staff/${userId}/documents`, data).then(r => r.data),
  verifyDocument: (docId: number, data: unknown) => apiClient.put<ApiResponse<StaffDocument>>(`/staff/documents/${docId}/verify`, data).then(r => r.data),
}
