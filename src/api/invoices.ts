import apiClient from './client'
import type { ApiResponse, Invoice, InvoicePayment, CreditNote } from '@/types'

export const invoicesApi = {
  getAll:       ()           => apiClient.get<ApiResponse<Invoice[]>>('/invoices').then(r => r.data),
  getById:      (id: number) => apiClient.get<ApiResponse<Invoice>>(`/invoices/${id}`).then(r => r.data),
  getByClient:  (clientId: number) => apiClient.get<ApiResponse<Invoice[]>>(`/invoices/client/${clientId}`).then(r => r.data),
  create:       (data: unknown) => apiClient.post<ApiResponse<Invoice>>('/invoices', data).then(r => r.data),
  updateStatus: (id: number, data: unknown) => apiClient.put<ApiResponse<Invoice>>(`/invoices/${id}/status`, data).then(r => r.data),
  addPayment:   (id: number, data: unknown) => apiClient.post<ApiResponse<InvoicePayment>>(`/invoices/${id}/payments`, data).then(r => r.data),
  getPayments:  (id: number) => apiClient.get<ApiResponse<InvoicePayment[]>>(`/invoices/${id}/payments`).then(r => r.data),
}

export const creditNotesApi = {
  getAll:      ()                  => apiClient.get<ApiResponse<CreditNote[]>>('/credit-notes').then(r => r.data),
  getByClient: (clientId: number)  => apiClient.get<ApiResponse<CreditNote[]>>(`/credit-notes/client/${clientId}`).then(r => r.data),
  getById:     (id: number)        => apiClient.get<ApiResponse<CreditNote>>(`/credit-notes/${id}`).then(r => r.data),
  create:      (data: unknown)     => apiClient.post<ApiResponse<CreditNote>>('/credit-notes', data).then(r => r.data),
  updateStatus:(id: number, status: string) => apiClient.put<ApiResponse<CreditNote>>(`/credit-notes/${id}/status?status=${status}`).then(r => r.data),
  delete:      (id: number)        => apiClient.delete<ApiResponse<void>>(`/credit-notes/${id}`).then(r => r.data),
}
