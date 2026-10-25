import apiClient from './client'
import type { ApiResponse, LeaseInvoice, LeaseInvoicePrefill, LeaseInvoiceStatus } from '@/types'

// Day-wise / vehicle-wise / session-wise annexure for a lease invoice
export interface LeaseInvoiceAnnexureSession {
  divisionName?: string | null
  driverName?: string | null
  startTime?: string | null
  endTime?: string | null
  kmDriven?: number | null
  hoursWorked?: number | null
}
export interface LeaseInvoiceAnnexureVehicle {
  registrationNumber?: string | null
  sessions: LeaseInvoiceAnnexureSession[]
}
export interface LeaseInvoiceAnnexureDay {
  date: string
  vehicles: LeaseInvoiceAnnexureVehicle[]
}
export interface LeaseInvoiceAnnexureLease {
  leaseId: number
  leaseNumber?: string | null
  days: LeaseInvoiceAnnexureDay[]
}
export interface LeaseInvoiceAnnexure {
  leases: LeaseInvoiceAnnexureLease[]
}

export const leaseInvoicesApi = {
  getAll: () =>
    apiClient.get<ApiResponse<LeaseInvoice[]>>('/vehicle-leases/invoices').then(r => r.data),

  prefill: (leaseId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<LeaseInvoicePrefill[]>>(
      `/vehicle-leases/${leaseId}/invoices/prefill`, { params: { from, to } }
    ).then(r => r.data),

  // Client-level: gathers vehicle lines across ALL the client's leases
  prefillByClient: (clientId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<LeaseInvoicePrefill[]>>(
      '/vehicle-leases/invoices/prefill', { params: { clientId, from, to } }
    ).then(r => r.data),

  createForClient: (data: {
    clientId: number
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
    apiClient.post<ApiResponse<LeaseInvoice>>('/vehicle-leases/invoices', data).then(r => r.data),

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

  getAnnexure: (id: number) =>
    apiClient.get<ApiResponse<LeaseInvoiceAnnexure>>(`/vehicle-leases/invoices/${id}/annexure`).then(r => r.data),

  updateStatus: (id: number, status: LeaseInvoiceStatus) =>
    apiClient.put<ApiResponse<LeaseInvoice>>(`/vehicle-leases/invoices/${id}/status`, { status }).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/vehicle-leases/invoices/${id}`).then(r => r.data),
}
