import apiClient from './client'
import type { ApiResponse, MasterItem, StateItem, CityItem, VehicleTypeItem, TaxItem, DocumentTypeItem } from '@/types'
import type { Tenant } from '@/types'

// ── Tenants ──────────────────────────────────────────────────────────────────
export const tenantsApi = {
  getAll:       () => apiClient.get<ApiResponse<Tenant[]>>('/tenants').then(r => r.data),
  getById:      (id: number) => apiClient.get<ApiResponse<Tenant>>(`/tenants/${id}`).then(r => r.data),
  create:       (data: unknown) => apiClient.post<ApiResponse<Tenant>>('/tenants', data).then(r => r.data),
  update:       (id: number, data: unknown) => apiClient.put<ApiResponse<Tenant>>(`/tenants/${id}`, data).then(r => r.data),
  delete:       (id: number) => apiClient.delete<ApiResponse<void>>(`/tenants/${id}`).then(r => r.data),
  impersonate:  (id: number) => apiClient.post<ApiResponse<import('@/types').LoginResponse>>(`/tenants/${id}/impersonate`).then(r => r.data),
}

// ── Global Masters (write operations, read is in masters.ts) ─────────────────
export const globalMastersWriteApi = {
  // States
  createState:  (data: { name: string; code: string }) => apiClient.post<ApiResponse<StateItem>>('/masters/global/states', data).then(r => r.data),
  updateState:  (id: number, data: { name: string; code: string }) => apiClient.put<ApiResponse<StateItem>>(`/masters/global/states/${id}`, data).then(r => r.data),
  deleteState:  (id: number) => apiClient.delete(`/masters/global/states/${id}`),

  // Cities
  createCity:  (data: { name: string; stateId: number }) => apiClient.post<ApiResponse<CityItem>>('/masters/global/cities', data).then(r => r.data),
  updateCity:  (id: number, data: { name: string; stateId: number }) => apiClient.put<ApiResponse<CityItem>>(`/masters/global/cities/${id}`, data).then(r => r.data),
  deleteCity:  (id: number) => apiClient.delete(`/masters/global/cities/${id}`),

  // Vehicle Brands
  createVehicleBrand:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/vehicle-brands', data).then(r => r.data),
  updateVehicleBrand:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/vehicle-brands/${id}`, data).then(r => r.data),
  deleteVehicleBrand:  (id: number) => apiClient.delete(`/masters/global/vehicle-brands/${id}`),

  // Vehicle Types
  createVehicleType:  (data: { name: string; capacityInTons?: number; tyreCount?: number }) => apiClient.post<ApiResponse<VehicleTypeItem>>('/masters/global/vehicle-types', data).then(r => r.data),
  updateVehicleType:  (id: number, data: { name: string; capacityInTons?: number; tyreCount?: number }) => apiClient.put<ApiResponse<VehicleTypeItem>>(`/masters/global/vehicle-types/${id}`, data).then(r => r.data),
  deleteVehicleType:  (id: number) => apiClient.delete(`/masters/global/vehicle-types/${id}`),

  // Fuel Types
  createFuelType:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/fuel-types', data).then(r => r.data),
  updateFuelType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/fuel-types/${id}`, data).then(r => r.data),
  deleteFuelType:  (id: number) => apiClient.delete(`/masters/global/fuel-types/${id}`),

  // Material Types
  createMaterialType:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/material-types', data).then(r => r.data),
  updateMaterialType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/material-types/${id}`, data).then(r => r.data),
  deleteMaterialType:  (id: number) => apiClient.delete(`/masters/global/material-types/${id}`),

  // Document Types
  createDocumentType:  (data: { name: string; applicableFor: string }) => apiClient.post<ApiResponse<DocumentTypeItem>>('/masters/global/document-types', data).then(r => r.data),
  updateDocumentType:  (id: number, data: { name: string; applicableFor: string }) => apiClient.put<ApiResponse<DocumentTypeItem>>(`/masters/global/document-types/${id}`, data).then(r => r.data),
  deleteDocumentType:  (id: number) => apiClient.delete(`/masters/global/document-types/${id}`),

  // Attendance Types
  createAttendanceType:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/attendance-types', data).then(r => r.data),
  updateAttendanceType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/attendance-types/${id}`, data).then(r => r.data),
  deleteAttendanceType:  (id: number) => apiClient.delete(`/masters/global/attendance-types/${id}`),

  // Leave Types
  createLeaveType:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/leave-types', data).then(r => r.data),
  updateLeaveType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/leave-types/${id}`, data).then(r => r.data),
  deleteLeaveType:  (id: number) => apiClient.delete(`/masters/global/leave-types/${id}`),

  // Employment Types
  createEmploymentType:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/employment-types', data).then(r => r.data),
  updateEmploymentType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/employment-types/${id}`, data).then(r => r.data),
  deleteEmploymentType:  (id: number) => apiClient.delete(`/masters/global/employment-types/${id}`),

  // Ownership Types
  createOwnershipType:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/ownership-types', data).then(r => r.data),
  updateOwnershipType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/ownership-types/${id}`, data).then(r => r.data),
  deleteOwnershipType:  (id: number) => apiClient.delete(`/masters/global/ownership-types/${id}`),

  // Deduction Types
  createDeductionType:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/deduction-types', data).then(r => r.data),
  updateDeductionType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/deduction-types/${id}`, data).then(r => r.data),
  deleteDeductionType:  (id: number) => apiClient.delete(`/masters/global/deduction-types/${id}`),

  // Taxes
  createTax:  (data: { name: string; rate: number; taxType: string }) => apiClient.post<ApiResponse<TaxItem>>('/masters/global/taxes', data).then(r => r.data),
  updateTax:  (id: number, data: { name: string; rate: number; taxType: string }) => apiClient.put<ApiResponse<TaxItem>>(`/masters/global/taxes/${id}`, data).then(r => r.data),
  deleteTax:  (id: number) => apiClient.delete(`/masters/global/taxes/${id}`),

  // Payment Statuses
  createPaymentStatus:  (data: { name: string }) => apiClient.post<ApiResponse<MasterItem>>('/masters/global/payment-statuses', data).then(r => r.data),
  updatePaymentStatus:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<MasterItem>>(`/masters/global/payment-statuses/${id}`, data).then(r => r.data),
  deletePaymentStatus:  (id: number) => apiClient.delete(`/masters/global/payment-statuses/${id}`),
}
