import apiClient from './client'
import type { ApiResponse, Order, VehicleAllocation } from '@/types'

export const ordersApi = {
  getAll:        ()           => apiClient.get<ApiResponse<Order[]>>('/orders').then(r => r.data),
  getById:       (id: number) => apiClient.get<ApiResponse<Order>>(`/orders/${id}`).then(r => r.data),
  create:        (data: Partial<Order>) => apiClient.post<ApiResponse<Order>>('/orders', data).then(r => r.data),
  update:        (id: number, data: Partial<Order>) => apiClient.put<ApiResponse<Order>>(`/orders/${id}`, data).then(r => r.data),
  cancel:        (id: number) => apiClient.delete<ApiResponse<null>>(`/orders/${id}`).then(r => r.data),
  assignVehicle: (id: number, data: unknown) => apiClient.post<ApiResponse<VehicleAllocation>>(`/orders/${id}/assign-vehicle`, data).then(r => r.data),
  assignStaff:   (id: number, data: unknown) => apiClient.post<ApiResponse<unknown>>(`/orders/${id}/assign-staff`, data).then(r => r.data),
}
