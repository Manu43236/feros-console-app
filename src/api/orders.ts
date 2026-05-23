import apiClient from './client'
import type { ApiResponse, Order, OrderPaymentStatus, OrderStatus, PageResponse, VehicleAllocation, StaffAllocation } from '@/types'

interface AssignVehicleRequest {
  vehicleId: number; allocatedWeight: number
  expectedLoadDate?: string; expectedDeliveryDate?: string; remarks?: string
}
interface AssignStaffRequest {
  vehicleAllocationId: number; userId: number
  slotRole?: 'DRIVER' | 'CLEANER'
  expectedStartDate?: string; expectedEndDate?: string; remarks?: string
}

export interface OrdersParams {
  page?: number; size?: number; search?: string; status?: OrderStatus | ''
}

export const ordersApi = {
  getAll:        (params?: OrdersParams) =>
    apiClient.get<ApiResponse<PageResponse<Order>>>('/orders', { params }).then(r => r.data),
  getById:       (id: number) => apiClient.get<ApiResponse<Order>>(`/orders/${id}`).then(r => r.data),
  create:        (data: Partial<Order>) => apiClient.post<ApiResponse<Order>>('/orders', data).then(r => r.data),
  update:        (id: number, data: Partial<Order>) => apiClient.put<ApiResponse<Order>>(`/orders/${id}`, data).then(r => r.data),
  cancel:        (id: number) => apiClient.delete<ApiResponse<null>>(`/orders/${id}`).then(r => r.data),
  assignVehicle:       (id: number, data: AssignVehicleRequest) => apiClient.post<ApiResponse<VehicleAllocation>>(`/orders/${id}/assign-vehicle`, data).then(r => r.data),
  unassignVehicle:     (id: number, allocationId: number)       => apiClient.delete<ApiResponse<null>>(`/orders/${id}/allocations/${allocationId}`).then(r => r.data),
  assignStaff:         (id: number, data: AssignStaffRequest)   => apiClient.post<ApiResponse<StaffAllocation>>(`/orders/${id}/assign-staff`, data).then(r => r.data),
  unassignStaff:       (id: number, staffAllocationId: number)  => apiClient.delete<ApiResponse<null>>(`/orders/${id}/staff-allocations/${staffAllocationId}`).then(r => r.data),
  updatePaymentStatus: (id: number, status: OrderPaymentStatus) => apiClient.patch<ApiResponse<Order>>(`/orders/${id}/payment-status`, null, { params: { status } }).then(r => r.data),
}
