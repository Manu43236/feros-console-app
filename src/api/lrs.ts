import apiClient from './client'
import type { ApiResponse, Lr, LrCharge, LrCheckpost, LrStatus } from '@/types'

interface CreateLrPayload {
  vehicleAllocationId: number
  lrDate?: string
  loadedWeight?: number
  loadedAt?: string
  remarks?: string
}

interface UpdateLrPayload {
  loadedWeight?: number
  loadedAt?: string
  deliveredWeight?: number
  deliveredAt?: string
  lrStatus?: LrStatus
  remarks?: string
}

interface AddCheckpostPayload {
  checkpostName: string
  location?: string
  fineAmount?: number
  fineReceiptNumber?: string
  remarks?: string
}

interface AddChargePayload {
  chargeTypeId: number
  amount: number
  remarks?: string
}

export const lrsApi = {
  getAll:        ()           => apiClient.get<ApiResponse<Lr[]>>('/lrs').then(r => r.data),
  getById:       (id: number) => apiClient.get<ApiResponse<Lr>>(`/lrs/${id}`).then(r => r.data),
  getByOrder:    (orderId: number) => apiClient.get<ApiResponse<Lr[]>>(`/lrs/order/${orderId}`).then(r => r.data),
  create:        (data: CreateLrPayload) => apiClient.post<ApiResponse<Lr>>('/lrs', data).then(r => r.data),
  update:        (id: number, data: UpdateLrPayload) => apiClient.put<ApiResponse<Lr>>(`/lrs/${id}`, data).then(r => r.data),
  cancel:        (id: number) => apiClient.put<ApiResponse<Lr>>(`/lrs/${id}`, { lrStatus: 'CANCELLED' }).then(r => r.data),
  addCheckpost:  (id: number, data: AddCheckpostPayload) => apiClient.post<ApiResponse<LrCheckpost>>(`/lrs/${id}/checkposts`, data).then(r => r.data),
  getCheckposts: (id: number) => apiClient.get<ApiResponse<LrCheckpost[]>>(`/lrs/${id}/checkposts`).then(r => r.data),
  addCharge:     (id: number, data: AddChargePayload) => apiClient.post<ApiResponse<LrCharge>>(`/lrs/${id}/charges`, data).then(r => r.data),
  getCharges:    (id: number) => apiClient.get<ApiResponse<LrCharge[]>>(`/lrs/${id}/charges`).then(r => r.data),
}
