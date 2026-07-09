import apiClient from './client'
import type { ApiResponse, LeaseInvoice, LeaseInvoicePrefill, LeaseInvoiceStatus } from '@/types'

export const leaseInvoicesApi = {
  getAll: () =>
    apiClient.get<ApiResponse<LeaseInvoice[]>>('/vehicle-leases/invoices').then(r => r.data),

  prefill: (leaseId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<LeaseInvoicePrefill[]>>(
      `/vehicle-leases/${leaseId}/invoices/prefill`, { params: { from, to } }
    ).then(r => r.data),

  create: (leaseId: number, data: {
    invoiceDate: string
    dueDate?: string
    billingPeriodStart: string
    billingPeriodEnd: string
    cgstPercentage?: number
    sgstPercentage?: number
    igstPercentage?: number
    notes?: string
    items: {
      leaseVehicleAssignmentId?: number
      registrationNumber?: string
      description?: string
      days?: number
      rate?: number
      amount: number
      sortOrder?: number
    }[]
  }) =>
    apiClient.post<ApiResponse<LeaseInvoice>>(`/vehicle-leases/${leaseId}/invoices`, data).then(r => r.data),

  getByLease: (leaseId: number) =>
    apiClient.get<ApiResponse<LeaseInvoice[]>>(`/vehicle-leases/${leaseId}/invoices`).then(r => r.data),

  getById: (id: number) =>
    apiClient.get<ApiResponse<LeaseInvoice>>(`/vehicle-leases/invoices/${id}`).then(r => r.data),

  updateStatus: (id: number, status: LeaseInvoiceStatus) =>
    apiClient.put<ApiResponse<LeaseInvoice>>(`/vehicle-leases/invoices/${id}/status`, { status }).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/vehicle-leases/invoices/${id}`).then(r => r.data),
}
