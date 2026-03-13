import apiClient from './client'
import type { ApiResponse, MasterItem, StateItem, CityItem, VehicleTypeItem, TaxItem, DocumentTypeItem, TenantMasterItem, DesignationItem, PayRateItem, RouteItem, PaymentTermsItem } from '@/types'

// Global Masters
export const globalMastersApi = {
  getStates:           () => apiClient.get<ApiResponse<StateItem[]>>('/masters/global/states').then(r => r.data),
  getCities:           (stateId?: number) => apiClient.get<ApiResponse<CityItem[]>>(`/masters/global/cities${stateId ? `?stateId=${stateId}` : ''}`).then(r => r.data),
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
}

// Tenant Masters
export const tenantMastersApi = {
  getVehicleStatuses: () => apiClient.get<ApiResponse<TenantMasterItem[]>>('/masters/tenant/vehicle-statuses').then(r => r.data),
  getRoutes:          () => apiClient.get<ApiResponse<RouteItem[]>>('/masters/tenant/routes').then(r => r.data),
  getDesignations:    () => apiClient.get<ApiResponse<DesignationItem[]>>('/masters/tenant/designations').then(r => r.data),
  getPayRates:        () => apiClient.get<ApiResponse<PayRateItem[]>>('/masters/tenant/pay-rates').then(r => r.data),
  getChargeTypes:     () => apiClient.get<ApiResponse<TenantMasterItem[]>>('/masters/tenant/charge-types').then(r => r.data),
  getPaymentTerms:    () => apiClient.get<ApiResponse<PaymentTermsItem[]>>('/masters/tenant/payment-terms').then(r => r.data),
  getClientTypes:     () => apiClient.get<ApiResponse<TenantMasterItem[]>>('/masters/tenant/client-types').then(r => r.data),
  getSettings:        () => apiClient.get<ApiResponse<unknown>>('/masters/tenant/settings').then(r => r.data),
  upsertSettings:     (data: unknown) => apiClient.post<ApiResponse<unknown>>('/masters/tenant/settings', data).then(r => r.data),
}
