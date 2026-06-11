import apiClient from './client'
import type { ApiResponse, LoginRequest, LoginResponse } from '@/types'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data).then(r => r.data),

  logout: () =>
    apiClient.post<ApiResponse<void>>('/auth/logout').then(r => r.data),

  changePin: (data: { currentPin: string; newPin: string }) =>
    apiClient.patch<ApiResponse<void>>('/auth/change-pin', data).then(r => r.data),

  askPinReset: (phone: string) =>
    apiClient.post<ApiResponse<void>>(`/auth/ask-pin-reset?phone=${encodeURIComponent(phone)}`).then(r => r.data),
}
