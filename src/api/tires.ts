import apiClient from './client'
import type { ApiResponse, Tire, TirePosition, TireFitting, TireRotationLog } from '@/types'

export const tiresApi = {
  // Tire CRUD
  getAll: () =>
    apiClient.get<ApiResponse<Tire[]>>('/tires').then(r => r.data),
  getAvailable: () =>
    apiClient.get<ApiResponse<Tire[]>>('/tires/available').then(r => r.data),
  create: (data: unknown) =>
    apiClient.post<ApiResponse<Tire>>('/tires', data).then(r => r.data),
  update: (id: number, data: unknown) =>
    apiClient.put<ApiResponse<Tire>>(`/tires/${id}`, data).then(r => r.data),
  getTireHistory: (id: number) =>
    apiClient.get<ApiResponse<TireFitting[]>>(`/tires/${id}/history`).then(r => r.data),

  // Positions
  autoSetup: (vehicleId: number) =>
    apiClient.post<ApiResponse<TirePosition[]>>('/tire-positions/auto-setup', null, { params: { vehicleId } }).then(r => r.data),
  getPositions: (vehicleId: number) =>
    apiClient.get<ApiResponse<TirePosition[]>>('/tire-positions', { params: { vehicleId } }).then(r => r.data),
  getCurrentPositions: (vehicleId: number) =>
    apiClient.get<ApiResponse<TirePosition[]>>('/tire-positions/current', { params: { vehicleId } }).then(r => r.data),
  addPosition: (data: unknown) =>
    apiClient.post<ApiResponse<TirePosition>>('/tire-positions', data).then(r => r.data),
  updatePosition: (id: number, data: unknown) =>
    apiClient.put<ApiResponse<TirePosition>>(`/tire-positions/${id}`, data).then(r => r.data),
  deletePosition: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/tire-positions/${id}`).then(r => r.data),

  // Fittings
  fitTire: (data: unknown) =>
    apiClient.post<ApiResponse<TireFitting>>('/tire-fittings', data).then(r => r.data),
  removeTire: (fittingId: number, data: unknown) =>
    apiClient.put<ApiResponse<TireFitting>>(`/tire-fittings/${fittingId}/remove`, data).then(r => r.data),
  getFittingHistory: (vehicleId: number) =>
    apiClient.get<ApiResponse<TireFitting[]>>('/tire-fittings', { params: { vehicleId } }).then(r => r.data),

  // Rotations
  performRotation: (data: unknown) =>
    apiClient.post<ApiResponse<TireRotationLog>>('/tire-rotations', data).then(r => r.data),
  getRotationHistory: (vehicleId: number) =>
    apiClient.get<ApiResponse<TireRotationLog[]>>('/tire-rotations', { params: { vehicleId } }).then(r => r.data),
}
