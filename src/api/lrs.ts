import apiClient from './client'
import type { ApiResponse, Lr, LrCharge, LrCheckpost } from '@/types'

export const lrsApi = {
  getAll:         ()           => apiClient.get<ApiResponse<Lr[]>>('/lrs').then(r => r.data),
  getById:        (id: number) => apiClient.get<ApiResponse<Lr>>(`/lrs/${id}`).then(r => r.data),
  getByOrder:     (orderId: number) => apiClient.get<ApiResponse<Lr[]>>(`/lrs/order/${orderId}`).then(r => r.data),
  create:         (data: unknown) => apiClient.post<ApiResponse<Lr>>('/lrs', data).then(r => r.data),
  update:         (id: number, data: unknown) => apiClient.put<ApiResponse<Lr>>(`/lrs/${id}`, data).then(r => r.data),
  addCheckpost:   (id: number, data: unknown) => apiClient.post<ApiResponse<LrCheckpost>>(`/lrs/${id}/checkposts`, data).then(r => r.data),
  getCheckposts:  (id: number) => apiClient.get<ApiResponse<LrCheckpost[]>>(`/lrs/${id}/checkposts`).then(r => r.data),
  addCharge:      (id: number, data: unknown) => apiClient.post<ApiResponse<LrCharge>>(`/lrs/${id}/charges`, data).then(r => r.data),
  getCharges:     (id: number) => apiClient.get<ApiResponse<LrCharge[]>>(`/lrs/${id}/charges`).then(r => r.data),
}
