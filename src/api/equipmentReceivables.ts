import apiClient from './client'
import type {
  ApiResponse,
  EquipmentPayment,
  EquipmentPaymentRequest,
  EquipmentAdvance,
  EquipmentAdvanceRequest,
  EquipmentRetentionRelease,
  EquipmentRetentionReleaseRequest,
  WoReceivablesSummary,
} from '@/types'

export const equipmentReceivablesApi = {
  // Payments
  recordPayment: (woId: number, invId: number, data: EquipmentPaymentRequest) =>
    apiClient.post<ApiResponse<EquipmentPayment>>(`/work-orders/${woId}/equipment-invoices/${invId}/payments`, data).then(r => r.data),

  listPayments: (woId: number, invId: number) =>
    apiClient.get<ApiResponse<EquipmentPayment[]>>(`/work-orders/${woId}/equipment-invoices/${invId}/payments`).then(r => r.data),

  deletePayment: (woId: number, invId: number, payId: number) =>
    apiClient.delete<ApiResponse<void>>(`/work-orders/${woId}/equipment-invoices/${invId}/payments/${payId}`).then(r => r.data),

  // Advances
  recordAdvance: (woId: number, data: EquipmentAdvanceRequest) =>
    apiClient.post<ApiResponse<EquipmentAdvance>>(`/work-orders/${woId}/advances`, data).then(r => r.data),

  listAdvances: (woId: number) =>
    apiClient.get<ApiResponse<EquipmentAdvance[]>>(`/work-orders/${woId}/advances`).then(r => r.data),

  deleteAdvance: (woId: number, advId: number) =>
    apiClient.delete<ApiResponse<void>>(`/work-orders/${woId}/advances/${advId}`).then(r => r.data),

  // Retention releases
  recordRetentionRelease: (woId: number, data: EquipmentRetentionReleaseRequest) =>
    apiClient.post<ApiResponse<EquipmentRetentionRelease>>(`/work-orders/${woId}/retention-releases`, data).then(r => r.data),

  listRetentionReleases: (woId: number) =>
    apiClient.get<ApiResponse<EquipmentRetentionRelease[]>>(`/work-orders/${woId}/retention-releases`).then(r => r.data),

  deleteRetentionRelease: (woId: number, relId: number) =>
    apiClient.delete<ApiResponse<void>>(`/work-orders/${woId}/retention-releases/${relId}`).then(r => r.data),

  // Summary
  getSummary: (woId: number) =>
    apiClient.get<ApiResponse<WoReceivablesSummary>>(`/work-orders/${woId}/receivables-summary`).then(r => r.data),
}
