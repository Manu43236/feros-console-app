import apiClient from './client'
import type { ApiResponse, PageResponse, EquipmentInvoice, EquipmentInvoicePrefill, EquipmentInvoiceStatus } from '@/types'

export const equipmentInvoicesApi = {
  create: (woId: number, data: Record<string, unknown>) =>
    apiClient.post<ApiResponse<EquipmentInvoice>>(`/work-orders/${woId}/equipment-invoices`, data).then(r => r.data),

  getByWorkOrder: (woId: number) =>
    apiClient.get<ApiResponse<EquipmentInvoice[]>>(`/work-orders/${woId}/equipment-invoices`).then(r => r.data),

  getAll: (params?: { page?: number; size?: number; status?: string }) =>
    apiClient.get<ApiResponse<PageResponse<EquipmentInvoice>>>('/equipment-invoices', { params }).then(r => r.data),

  getById: (id: number) =>
    apiClient.get<ApiResponse<EquipmentInvoice>>(`/equipment-invoices/${id}`).then(r => r.data),

  update: (id: number, data: Record<string, unknown>) =>
    apiClient.put<ApiResponse<EquipmentInvoice>>(`/equipment-invoices/${id}`, data).then(r => r.data),

  updateStatus: (id: number, status: EquipmentInvoiceStatus) =>
    apiClient.patch<ApiResponse<EquipmentInvoice>>(`/equipment-invoices/${id}/status`, { status }).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/equipment-invoices/${id}`).then(r => r.data),

  prefill: (woId: number, params?: { from?: string; to?: string }) =>
    apiClient.get<ApiResponse<EquipmentInvoicePrefill[]>>(
      `/work-orders/${woId}/equipment-invoices/prefill`, { params }
    ).then(r => r.data),

  createForClient: (data: Record<string, unknown>) =>
    apiClient.post<ApiResponse<EquipmentInvoice>>('/equipment-invoices', data).then(r => r.data),

  prefillByClient: (clientId: number, params?: { from?: string; to?: string }) =>
    apiClient.get<ApiResponse<EquipmentInvoicePrefill[]>>(
      '/equipment-invoices/prefill', { params: { clientId, ...params } }
    ).then(r => r.data),
}
