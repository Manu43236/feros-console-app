import apiClient from './client'
import type { ApiResponse, ModuleAccessResponse, ModuleAccessRequest } from '@/types'

export const moduleAccessApi = {
  getAll: () =>
    apiClient.get<ApiResponse<ModuleAccessResponse>>('/role-module-access'),

  saveAll: (data: ModuleAccessRequest) =>
    apiClient.put<ApiResponse<void>>('/role-module-access', data),
}
