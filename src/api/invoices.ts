import apiClient from './client'
import type { ApiResponse, Invoice, InvoicePayment } from '@/types'

export const invoicesApi = {
  getAll:       ()           => apiClient.get<ApiResponse<Invoice[]>>('/invoices').then(r => r.data),
  getById:      (id: number) => apiClient.get<ApiResponse<Invoice>>(`/invoices/${id}`).then(r => r.data),
  getByClient:  (clientId: number) => apiClient.get<ApiResponse<Invoice[]>>(`/invoices/client/${clientId}`).then(r => r.data),
  create:       (data: unknown) => apiClient.post<ApiResponse<Invoice>>('/invoices', data).then(r => r.data),
  updateStatus: (id: number, data: unknown) => apiClient.put<ApiResponse<Invoice>>(`/invoices/${id}/status`, data).then(r => r.data),
  addPayment:   (id: number, data: unknown) => apiClient.post<ApiResponse<InvoicePayment>>(`/invoices/${id}/payments`, data).then(r => r.data),
  getPayments:  (id: number) => apiClient.get<ApiResponse<InvoicePayment[]>>(`/invoices/${id}/payments`).then(r => r.data),
}
