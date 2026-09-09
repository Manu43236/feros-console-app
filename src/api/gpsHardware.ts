import apiClient from './client'
import type { ApiResponse } from '@/types'

export type GpsConnectionType = 'TCP' | 'REST_API' | 'WEBHOOK'

export interface GpsDeviceModel {
  id: number
  companyName: string
  modelName: string
  connectionType: GpsConnectionType
  parserKey: string
  protocolVersion: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GpsDeviceModelRequest {
  companyName: string
  modelName: string
  connectionType: GpsConnectionType
  parserKey: string
  protocolVersion: string
  description: string
}

const BASE = '/sa/gps'

export const gpsHardwareApi = {
  getAll: (company?: string) =>
    apiClient.get<ApiResponse<GpsDeviceModel[]>>(`${BASE}/models`, { params: company ? { company } : {} }).then(r => r.data),

  getAllActive: () =>
    apiClient.get<ApiResponse<GpsDeviceModel[]>>(`${BASE}/models/active`).then(r => r.data),

  create: (data: GpsDeviceModelRequest) =>
    apiClient.post<ApiResponse<GpsDeviceModel>>(`${BASE}/models`, data).then(r => r.data),

  update: (id: number, data: GpsDeviceModelRequest) =>
    apiClient.put<ApiResponse<GpsDeviceModel>>(`${BASE}/models/${id}`, data).then(r => r.data),

  toggle: (id: number) =>
    apiClient.patch<ApiResponse<GpsDeviceModel>>(`${BASE}/models/${id}/toggle`).then(r => r.data),
}
