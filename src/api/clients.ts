import apiClient from './client'
import type { ApiResponse, Client } from '@/types'

export const clientsApi = {
  getAll:    ()           => apiClient.get<ApiResponse<Client[]>>('/clients').then(r => r.data),
  getById:   (id: number) => apiClient.get<ApiResponse<Client>>(`/clients/${id}`).then(r => r.data),
  create:    (data: Partial<Client>) => apiClient.post<ApiResponse<Client>>('/clients', data).then(r => r.data),
  update:    (id: number, data: Partial<Client>) => apiClient.put<ApiResponse<Client>>(`/clients/${id}`, data).then(r => r.data),
  remove:    (id: number) => apiClient.delete<ApiResponse<null>>(`/clients/${id}`).then(r => r.data),
  bulkUpload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<ApiResponse<import('@/types').BulkUploadResult>>('/clients/bulk-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}
