import apiClient from './client'
import type { ApiResponse, MasterItem, StateItem, CityItem, VehicleTypeItem, TaxItem, DocumentTypeItem, TenantMasterItem, DesignationItem, RouteItem, PaymentTermsItem, VehicleStatusItem, VehicleStatusType } from '@/types'

// Global Masters
export const globalMastersApi = {
  getStates:           () => apiClient.get<ApiResponse<StateItem[]>>('/masters/global/states').then(r => r.data),
  getStatesPaged:      (page: number, size: number, search?: string) => apiClient.get<ApiResponse<{ content: StateItem[]; totalElements: number; totalPages: number; number: number }>>(`/masters/global/states?page=${page}&size=${size}&search=${search ?? ''}`).then(r => r.data),
  getCitiesPaged:      (page: number, size: number, search?: string, stateId?: number) => apiClient.get<ApiResponse<{ content: CityItem[]; totalElements: number; totalPages: number; number: number }>>(`/masters/global/cities?page=${page}&size=${size}&search=${search ?? ''}${stateId ? `&stateId=${stateId}` : ''}`).then(r => r.data),
  getCities:           (stateId?: number) => apiClient.get<ApiResponse<CityItem[]>>(stateId ? `/masters/global/cities/state/${stateId}` : '/masters/global/cities').then(r => r.data),
  getVehicleBrands:    () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/vehicle-brands').then(r => r.data),
  getVehicleTypes:     () => apiClient.get<ApiResponse<VehicleTypeItem[]>>('/masters/global/vehicle-types').then(r => r.data),
  getFuelTypes:        () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/fuel-types').then(r => r.data),
  getMaterialTypes:    () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/material-types').then(r => r.data),
  getDocumentTypes:    () => apiClient.get<ApiResponse<DocumentTypeItem[]>>('/masters/global/document-types').then(r => r.data),
  getAttendanceTypes:  () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/attendance-types').then(r => r.data),
  getLeaveTypes:       () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/leave-types').then(r => r.data),
  getEmploymentTypes:  () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/employment-types').then(r => r.data),
  getOwnershipTypes:   () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/ownership-types').then(r => r.data),
  getDeductionTypes:   () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/deduction-types').then(r => r.data),
  getTaxes:            () => apiClient.get<ApiResponse<TaxItem[]>>('/masters/global/taxes').then(r => r.data),
  getPaymentStatuses:  () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/payment-statuses').then(r => r.data),
  getServiceTaskTypes: () => apiClient.get<ApiResponse<MasterItem[]>>('/masters/global/service-task-types').then(r => r.data),
  getRoles:            () => apiClient.get<ApiResponse<{ id: number; name: string; description: string }[]>>('/masters/global/roles').then(r => r.data),
}

// Tenant Masters
export const tenantMastersApi = {
  // Vehicle Statuses (global — no tenantId)
  getVehicleStatuses:    () => apiClient.get<ApiResponse<VehicleStatusItem[]>>('/masters/tenant/vehicle-statuses').then(r => r.data),
  createVehicleStatus:   (data: { name: string; statusType: VehicleStatusType }) => apiClient.post<ApiResponse<VehicleStatusItem>>('/masters/tenant/vehicle-statuses', data).then(r => r.data),
  updateVehicleStatus:   (id: number, data: { name: string; statusType: VehicleStatusType }) => apiClient.put<ApiResponse<VehicleStatusItem>>(`/masters/tenant/vehicle-statuses/${id}`, data).then(r => r.data),
  deleteVehicleStatus:   (id: number) => apiClient.delete(`/masters/tenant/vehicle-statuses/${id}`),

  // Client Types
  getClientTypes:    () => apiClient.get<ApiResponse<TenantMasterItem[]>>('/masters/tenant/client-types').then(r => r.data),
  createClientType:  (data: { name: string }) => apiClient.post<ApiResponse<TenantMasterItem>>('/masters/tenant/client-types', data).then(r => r.data),
  updateClientType:  (id: number, data: { name: string }) => apiClient.put<ApiResponse<TenantMasterItem>>(`/masters/tenant/client-types/${id}`, data).then(r => r.data),
  deleteClientType:  (id: number) => apiClient.delete(`/masters/tenant/client-types/${id}`),

  // Charge Types
  getChargeTypes:    () => apiClient.get<ApiResponse<TenantMasterItem[]>>('/masters/tenant/charge-types').then(r => r.data),
  createChargeType:  (data: { name: string; description?: string }) => apiClient.post<ApiResponse<TenantMasterItem>>('/masters/tenant/charge-types', data).then(r => r.data),
  updateChargeType:  (id: number, data: { name: string; description?: string }) => apiClient.put<ApiResponse<TenantMasterItem>>(`/masters/tenant/charge-types/${id}`, data).then(r => r.data),
  deleteChargeType:  (id: number) => apiClient.delete(`/masters/tenant/charge-types/${id}`),

  // Payment Terms
  getPaymentTerms:    () => apiClient.get<ApiResponse<PaymentTermsItem[]>>('/masters/tenant/payment-terms').then(r => r.data),
  createPaymentTerms: (data: { name: string; creditDays: number }) => apiClient.post<ApiResponse<PaymentTermsItem>>('/masters/tenant/payment-terms', data).then(r => r.data),
  updatePaymentTerms: (id: number, data: { name: string; creditDays: number }) => apiClient.put<ApiResponse<PaymentTermsItem>>(`/masters/tenant/payment-terms/${id}`, data).then(r => r.data),
  deletePaymentTerms: (id: number) => apiClient.delete(`/masters/tenant/payment-terms/${id}`),

  // Designations
  getDesignations:    () => apiClient.get<ApiResponse<DesignationItem[]>>('/masters/tenant/designations').then(r => r.data),
  createDesignation:  (data: { name: string; roleType: string; payPerDay?: number }) => apiClient.post<ApiResponse<DesignationItem>>('/masters/tenant/designations', data).then(r => r.data),
  updateDesignation:  (id: number, data: { name: string; roleType: string; payPerDay?: number }) => apiClient.put<ApiResponse<DesignationItem>>(`/masters/tenant/designations/${id}`, data).then(r => r.data),
  deleteDesignation:  (id: number) => apiClient.delete(`/masters/tenant/designations/${id}`),

  // Routes
  getRoutes:    () => apiClient.get<ApiResponse<RouteItem[]>>('/masters/tenant/routes').then(r => r.data),
  createRoute:  (data: { name: string; sourceCityId: number; destinationCityId: number; distanceInKm?: number; estimatedHours?: number }) => apiClient.post<ApiResponse<RouteItem>>('/masters/tenant/routes', data).then(r => r.data),
  updateRoute:  (id: number, data: { name: string; sourceCityId: number; destinationCityId: number; distanceInKm?: number; estimatedHours?: number }) => apiClient.put<ApiResponse<RouteItem>>(`/masters/tenant/routes/${id}`, data).then(r => r.data),
  deleteRoute:  (id: number) => apiClient.delete(`/masters/tenant/routes/${id}`),

  // Settings
  getSettings:     () => apiClient.get<ApiResponse<TenantMasterItem>>('/masters/tenant/settings').then(r => r.data),
  upsertSettings:  (data: object) => apiClient.post<ApiResponse<TenantMasterItem>>('/masters/tenant/settings', data).then(r => r.data),
}

// RBAC
export type RbacEntry = { role: string; platform: string; allowed: boolean }
export type RbacLoginAccessData = { entries: RbacEntry[] }

export const rbacApi = {
  getLoginAccess:  () => apiClient.get<{ data: RbacLoginAccessData }>('/masters/tenant/rbac/login-access').then(r => r.data),
  saveLoginAccess: (data: RbacLoginAccessData) => apiClient.put<{ data: RbacLoginAccessData }>('/masters/tenant/rbac/login-access', data).then(r => r.data),
}
