import apiClient from './client'
import type { ApiResponse, Tyre, TyrePosition, TyreFitting, TyreRotationLog, TyreRetreadLog } from '@/types'

export const tyresApi = {
  // Tyre CRUD
  getAll: () =>
    apiClient.get<ApiResponse<Tyre[]>>('/tyres').then(r => r.data),
  getAvailable: () =>
    apiClient.get<ApiResponse<Tyre[]>>('/tyres/available').then(r => r.data),
  create: (data: unknown) =>
    apiClient.post<ApiResponse<Tyre>>('/tyres', data).then(r => r.data),
  update: (id: number, data: unknown) =>
    apiClient.put<ApiResponse<Tyre>>(`/tyres/${id}`, data).then(r => r.data),
  getTyreHistory: (id: number) =>
    apiClient.get<ApiResponse<TyreFitting[]>>(`/tyres/${id}/history`).then(r => r.data),
  backToStock: (id: number, data?: { retreadingCost?: number; newMaxLifetimeKm?: number; actualReturnDate?: string; notes?: string }) =>
    apiClient.patch<ApiResponse<Tyre>>(`/tyres/${id}/back-to-stock`, data ?? {}).then(r => r.data),
  scrapTyre: (id: number, data: { scrapReason?: string; scrapDate?: string; notes?: string }) =>
    apiClient.patch<ApiResponse<Tyre>>(`/tyres/${id}/scrap`, data).then(r => r.data),
  getRetreadHistory: (id: number) =>
    apiClient.get<ApiResponse<TyreRetreadLog[]>>(`/tyres/${id}/retread-history`).then(r => r.data),
  bulkCreate: (data: unknown) =>
    apiClient.post<ApiResponse<Tyre[]>>('/tyres/bulk', data).then(r => r.data),

  // Positions
  getPositions: (vehicleId: number) =>
    apiClient.get<ApiResponse<TyrePosition[]>>('/tyre-positions', { params: { vehicleId } }).then(r => r.data),
  getCurrentPositions: (vehicleId: number) =>
    apiClient.get<ApiResponse<TyrePosition[]>>('/tyre-positions/current', { params: { vehicleId } }).then(r => r.data),
  addPosition: (data: unknown) =>
    apiClient.post<ApiResponse<TyrePosition>>('/tyre-positions', data).then(r => r.data),
  updatePosition: (id: number, data: unknown) =>
    apiClient.put<ApiResponse<TyrePosition>>(`/tyre-positions/${id}`, data).then(r => r.data),
  deletePosition: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/tyre-positions/${id}`).then(r => r.data),

  // Fittings
  fitTyre: (data: unknown) =>
    apiClient.post<ApiResponse<TyreFitting>>('/tyre-fittings', data).then(r => r.data),
  removeTyre: (fittingId: number, data: unknown) =>
    apiClient.put<ApiResponse<TyreFitting>>(`/tyre-fittings/${fittingId}/remove`, data).then(r => r.data),
  getFittingHistory: (vehicleId: number) =>
    apiClient.get<ApiResponse<TyreFitting[]>>('/tyre-fittings', { params: { vehicleId } }).then(r => r.data),

  // Rotations
  performRotation: (data: unknown) =>
    apiClient.post<ApiResponse<TyreRotationLog>>('/tyre-rotations', data).then(r => r.data),
  getRotationHistory: (vehicleId: number) =>
    apiClient.get<ApiResponse<TyreRotationLog[]>>('/tyre-rotations', { params: { vehicleId } }).then(r => r.data),
}

export const tyreRequestsApi = {
  getPending: () =>
    apiClient.get<ApiResponse<TyreRequestItem[]>>('/tyre-requests/pending').then(r => r.data),
  approve: (id: number, data: { tyreId: number; fittedAtKm?: number }) =>
    apiClient.patch<ApiResponse<TyreRequestItem>>(`/tyre-requests/${id}/approve`, data).then(r => r.data),
  reject: (id: number, data: { rejectionReason: string }) =>
    apiClient.patch<ApiResponse<TyreRequestItem>>(`/tyre-requests/${id}/reject`, data).then(r => r.data),
}

export interface TyreRequestItem {
  id: number
  vehicleRegistrationNumber: string
  positionCode: string
  requestedByName: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string
  notes?: string
  createdAt: string
}
