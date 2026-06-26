import apiClient from './client'
import type { ApiResponse } from '@/types'

export interface EquipmentMake {
  id: number
  name: string
  isActive: boolean
}

export interface EquipmentModel {
  id: number
  name: string
  makeId: number
  makeName: string
  isActive: boolean
}

export interface EquipmentType {
  id: number
  name: string
  modelId: number
  modelName: string
  makeId: number
  makeName: string
  defaultMeterType: 'OMR' | 'HMR' | 'BOTH'
  isActive: boolean
}

const BASE = '/equipment/masters'

export const equipmentMastersApi = {
  // Makes
  getMakes: () => apiClient.get<ApiResponse<EquipmentMake[]>>(`${BASE}/makes`).then(r => r.data),
  createMake: (data: { name: string }) => apiClient.post<ApiResponse<EquipmentMake>>(`${BASE}/makes`, data).then(r => r.data),
  updateMake: (id: number, data: { name: string }) => apiClient.put<ApiResponse<EquipmentMake>>(`${BASE}/makes/${id}`, data).then(r => r.data),
  deleteMake: (id: number) => apiClient.delete(`${BASE}/makes/${id}`),

  // Models
  getModels: (makeId?: number) => apiClient.get<ApiResponse<EquipmentModel[]>>(`${BASE}/models`, { params: makeId ? { makeId } : {} }).then(r => r.data),
  createModel: (data: { makeId: number; name: string }) => apiClient.post<ApiResponse<EquipmentModel>>(`${BASE}/models`, data).then(r => r.data),
  updateModel: (id: number, data: { makeId: number; name: string }) => apiClient.put<ApiResponse<EquipmentModel>>(`${BASE}/models/${id}`, data).then(r => r.data),
  deleteModel: (id: number) => apiClient.delete(`${BASE}/models/${id}`),

  // Types
  getTypes: (modelId?: number) => apiClient.get<ApiResponse<EquipmentType[]>>(`${BASE}/types`, { params: modelId ? { modelId } : {} }).then(r => r.data),
  createType: (data: { modelId: number; name: string; defaultMeterType: string }) => apiClient.post<ApiResponse<EquipmentType>>(`${BASE}/types`, data).then(r => r.data),
  updateType: (id: number, data: { modelId: number; name: string; defaultMeterType: string }) => apiClient.put<ApiResponse<EquipmentType>>(`${BASE}/types/${id}`, data).then(r => r.data),
  deleteType: (id: number) => apiClient.delete(`${BASE}/types/${id}`),
}
