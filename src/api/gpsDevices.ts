import apiClient from './client'
import type { ApiResponse } from '@/types'
import type { GpsConnectionType } from './gpsHardware'

export interface GpsDevice {
  id: number
  vehicleId: number
  vehicleRegistrationNumber: string
  modelId: number
  companyName: string
  modelName: string
  connectionType: GpsConnectionType
  parserKey: string
  deviceIdentifier: string
  status: 'ACTIVE' | 'INACTIVE'
  notes: string | null
  lastPingAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GpsDeviceRequest {
  vehicleId: number
  modelId: number
  deviceIdentifier: string
  credentials: string
  notes: string
}

const BASE = '/gps/devices'

export const gpsDevicesApi = {
  getAll: () =>
    apiClient.get<ApiResponse<GpsDevice[]>>(BASE).then(r => r.data),

  getByVehicle: (vehicleId: number) =>
    apiClient.get<ApiResponse<GpsDevice | null>>(`${BASE}/vehicle/${vehicleId}`).then(r => r.data),

  register: (data: GpsDeviceRequest) =>
    apiClient.post<ApiResponse<GpsDevice>>(BASE, data).then(r => r.data),

  update: (id: number, data: GpsDeviceRequest) =>
    apiClient.put<ApiResponse<GpsDevice>>(`${BASE}/${id}`, data).then(r => r.data),

  deactivate: (id: number) =>
    apiClient.patch<ApiResponse<GpsDevice>>(`${BASE}/${id}/deactivate`).then(r => r.data),
}
