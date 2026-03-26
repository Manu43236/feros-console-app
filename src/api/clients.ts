import apiClient from './client'
import type { ApiResponse, Client, ClientAdvance } from '@/types'

export const clientsApi = {
  getAll:    ()           => apiClient.get<ApiResponse<Client[]>>('/clients').then(r => r.data),
  getById:   (id: number) => apiClient.get<ApiResponse<Client>>(`/clients/${id}`).then(r => r.data),
  create:    (data: Partial<Client>) => apiClient.post<ApiResponse<Client>>('/clients', data).then(r => r.data),
  update:    (id: number, data: Partial<Client>) => apiClient.put<ApiResponse<Client>>(`/clients/${id}`, data).then(r => r.data),
  toggleStatus: (id: number, isActive: boolean) => apiClient.put<ApiResponse<Client>>(`/clients/${id}/status`, { isActive }).then(r => r.data),
  bulkUpload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<ApiResponse<import('@/types').BulkUploadResult>>('/clients/bulk-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

export const clientAdvancesApi = {
  getAll:      ()                         => apiClient.get<ApiResponse<ClientAdvance[]>>('/client-advances').then(r => r.data),
  getByClient: (clientId: number)         => apiClient.get<ApiResponse<ClientAdvance[]>>(`/client-advances/client/${clientId}`).then(r => r.data),
  getById:     (id: number)               => apiClient.get<ApiResponse<ClientAdvance>>(`/client-advances/${id}`).then(r => r.data),
  create:      (data: Partial<ClientAdvance>) => apiClient.post<ApiResponse<ClientAdvance>>('/client-advances', data).then(r => r.data),
  delete:      (id: number)               => apiClient.delete<ApiResponse<void>>(`/client-advances/${id}`).then(r => r.data),
}
