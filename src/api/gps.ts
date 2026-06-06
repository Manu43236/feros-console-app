import apiClient from './client'
import type {
  ApiResponse,
  GpsProviderConfig,
  GpsProviderConfigRequest,
  GpsProviderVehicle,
  VehicleGpsMapping,
  VehicleGpsMappingRequest,
  GpsFleetVehicle,
} from '@/types'

export const gpsApi = {
  // Provider configs
  getConfigs: () =>
    apiClient.get<ApiResponse<GpsProviderConfig[]>>('/gps/configs').then(r => r.data),

  createConfig: (data: GpsProviderConfigRequest) =>
    apiClient.post<ApiResponse<GpsProviderConfig>>('/gps/configs', data).then(r => r.data),

  updateConfig: (id: number, data: GpsProviderConfigRequest) =>
    apiClient.put<ApiResponse<GpsProviderConfig>>(`/gps/configs/${id}`, data).then(r => r.data),

  deleteConfig: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/gps/configs/${id}`).then(r => r.data),

  testConnection: (id: number) =>
    apiClient.post<ApiResponse<boolean>>(`/gps/configs/${id}/test`).then(r => r.data),

  getProviderVehicles: (configId: number) =>
    apiClient.get<ApiResponse<GpsProviderVehicle[]>>(`/gps/configs/${configId}/provider-vehicles`).then(r => r.data),

  // Vehicle mappings
  getMappings: () =>
    apiClient.get<ApiResponse<VehicleGpsMapping[]>>('/gps/mappings').then(r => r.data),

  createMapping: (data: VehicleGpsMappingRequest) =>
    apiClient.post<ApiResponse<VehicleGpsMapping>>('/gps/mappings', data).then(r => r.data),

  deleteMapping: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/gps/mappings/${id}`).then(r => r.data),

  // Fleet map
  getFleet: () =>
    apiClient.get<ApiResponse<GpsFleetVehicle[]>>('/gps/fleet').then(r => r.data),
}
