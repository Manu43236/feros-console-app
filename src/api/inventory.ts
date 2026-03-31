import apiClient from './client'
import type { ApiResponse, SparePart, StockItem, ServicePart, SparePartsTransaction } from '@/types'

export const sparePartsApi = {
  getAll:      () => apiClient.get<ApiResponse<SparePart[]>>('/inventory/spare-parts').then(r => r.data),
  getById:     (id: number) => apiClient.get<ApiResponse<SparePart>>(`/inventory/spare-parts/${id}`).then(r => r.data),
  create:      (data: Partial<SparePart>) => apiClient.post<ApiResponse<SparePart>>('/inventory/spare-parts', data).then(r => r.data),
  update:      (id: number, data: Partial<SparePart>) => apiClient.put<ApiResponse<SparePart>>(`/inventory/spare-parts/${id}`, data).then(r => r.data),
  delete:      (id: number) => apiClient.delete<ApiResponse<void>>(`/inventory/spare-parts/${id}`).then(r => r.data),
  bulkUpload:  (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<ApiResponse<import('@/types').BulkUploadResult>>('/inventory/spare-parts/bulk-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

export const stockApi = {
  getStock:    () => apiClient.get<ApiResponse<StockItem[]>>('/inventory/stock').then(r => r.data),
  stockIn:     (data: { sparePartId: number; quantity: number; unitCost?: number; supplierName?: string; notes?: string }) =>
    apiClient.post<ApiResponse<void>>('/inventory/stock-in', data).then(r => r.data),
  bulkStockIn: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient.post<ApiResponse<import('@/types').BulkUploadResult>>('/inventory/stock-in/bulk-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

export const servicePartsApi = {
  getPending:       () => apiClient.get<ApiResponse<ServicePart[]>>('/inventory/service-parts/pending').then(r => r.data),
  getByService:     (serviceId: number) => apiClient.get<ApiResponse<ServicePart[]>>(`/inventory/service-parts/service/${serviceId}`).then(r => r.data),
  request:          (serviceId: number, data: { sparePartId: number; quantityRequested: number }) =>
    apiClient.post<ApiResponse<ServicePart>>(`/inventory/service-parts/service/${serviceId}`, data).then(r => r.data),
  approve:          (servicePartId: number, data: { status: string; quantityApproved?: number; rejectionReason?: string }) =>
    apiClient.put<ApiResponse<ServicePart>>(`/inventory/service-parts/${servicePartId}/approve`, data).then(r => r.data),
  remove:           (servicePartId: number) => apiClient.delete<ApiResponse<void>>(`/inventory/service-parts/${servicePartId}`).then(r => r.data),
}

export const inventoryTransactionsApi = {
  getAll:    () => apiClient.get<ApiResponse<SparePartsTransaction[]>>('/inventory/transactions').then(r => r.data),
  getByPart: (sparePartId: number) => apiClient.get<ApiResponse<SparePartsTransaction[]>>(`/inventory/transactions/part/${sparePartId}`).then(r => r.data),
}
