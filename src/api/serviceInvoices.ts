import apiClient from './client'
import type { ApiResponse, ServiceInvoice } from '@/types'

export const serviceInvoicesApi = {
  getAll:             ()           => apiClient.get<ApiResponse<ServiceInvoice[]>>('/service-invoices').then(r => r.data),
  getById:            (id: number) => apiClient.get<ApiResponse<ServiceInvoice>>(`/service-invoices/${id}`).then(r => r.data),
  getByService:       (serviceId: number) => apiClient.get<ApiResponse<ServiceInvoice>>(`/service-invoices/service/${serviceId}`).then(r => r.data),
  updateVendorAmount: (id: number, data: { vendorAmount: number; vendorInvoiceNo?: string }) =>
    apiClient.put<ApiResponse<ServiceInvoice>>(`/service-invoices/${id}/vendor-amount`, data).then(r => r.data),
  markPaid:           (id: number) => apiClient.put<ApiResponse<ServiceInvoice>>(`/service-invoices/${id}/mark-paid`).then(r => r.data),
  downloadPdf:        (id: number) => apiClient.get<Blob>(`/service-invoices/${id}/pdf`, { responseType: 'blob' }).then(r => r.data),
}
