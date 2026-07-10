import apiClient from './client'
import type { ApiResponse } from '@/types'

export type EquipmentOwnershipType = 'OWNED' | 'HIRED_IN'
export type EquipmentWorkStatus = 'AVAILABLE' | 'ASSIGNED' | 'BUSY' | 'BREAKDOWN' | 'IN_REPAIR'
export type HireRateUnit = 'PER_DAY' | 'PER_HOUR' | 'PER_MONTH'
export type MeterType = 'OMR' | 'HMR' | 'BOTH'

export interface Equipment {
  id: number
  equipmentTypeId: number
  equipmentTypeName: string
  capacity?: number | null
  capacityUnit?: string | null
  modelId: number
  modelName: string
  makeId: number
  makeName: string
  serialNumber: string | null
  registrationNumber: string | null
  manufactureYear: number | null
  color: string | null
  chassisNumber: string | null
  engineNumber: string | null
  fuelType: string | null
  fuelTankCapacity: number | null
  ownershipType: EquipmentOwnershipType
  isFinanced: boolean
  financerName: string | null
  financeStartDate: string | null
  financeEndDate: string | null
  hiredFrom: string | null
  hireStartDate: string | null
  hireEndDate: string | null
  hireRate: number | null
  hireRateUnit: HireRateUnit | null
  meterType: MeterType
  currentMeterReading: number | null
  workStatus: EquipmentWorkStatus
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface EquipmentRequest {
  equipmentTypeId: number
  serialNumber?: string
  registrationNumber?: string
  manufactureYear?: number
  color?: string
  chassisNumber?: string
  engineNumber?: string
  fuelType?: string
  fuelTankCapacity?: number
  ownershipType: EquipmentOwnershipType
  isFinanced?: boolean
  financerName?: string
  financeStartDate?: string
  financeEndDate?: string
  hiredFrom?: string
  hireStartDate?: string
  hireEndDate?: string
  hireRate?: number
  hireRateUnit?: HireRateUnit
  currentMeterReading?: number
  workStatus?: EquipmentWorkStatus
  isActive?: boolean
  notes?: string
}

export interface EquipmentDashboardResponse {
  totalMachines: number
  available: number
  assigned: number
  busy: number
  inRepair: number
  breakdown: number
  activeWorkOrders: number
  totalWorkOrders: number
  hoursToday: number | null
  hoursThisMonth: number | null
}

export interface EquipmentFuelLog {
  id: number
  equipmentId: number
  fillDate: string
  litresFilled: number
  hmrAtFill: number | null
  costPerLitre: number | null
  totalCost: number | null
  isFullTank: boolean
  paymentMode: 'CASH' | 'COMPANY_ACCOUNT' | 'REIMBURSEMENT' | null
  fuelStation: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface EquipmentFuelLogRequest {
  fillDate: string
  litresFilled: number
  hmrAtFill?: number
  costPerLitre?: number
  totalCost?: number
  isFullTank?: boolean
  paymentMode?: 'CASH' | 'COMPANY_ACCOUNT' | 'REIMBURSEMENT'
  fuelStation?: string
  notes?: string
}

export interface EquipmentMeterReading {
  id: number
  equipmentId: number
  readingDate: string
  readingValue: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface EquipmentMeterReadingRequest {
  readingDate: string
  readingValue: number
  notes?: string
}


export type ServiceTriggeredBy = 'SCHEDULED' | 'BREAKDOWN' | 'ACCIDENT' | 'COMPLIANCE' | 'WARRANTY'
export type EquipmentServiceType = 'INTERNAL' | 'THIRD_PARTY' | 'OEM_CENTER'
export type ServicePayerType = 'OWN_EXPENSE' | 'WARRANTY_OEM' | 'WARRANTY_ANC' | 'INSURANCE' | 'AMC'
export type ServiceStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
export type ServiceDisplayStatus = 'OPEN' | 'DUE_SOON' | 'OVERDUE' | 'IN_PROGRESS' | 'COMPLETED'
export type ServiceTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export interface EquipmentServiceTask {
  id: number
  taskTypeId: number | null
  taskTypeName: string | null
  customName: string | null
  displayName: string | null
  isRecurring: boolean
  frequencyHmr: number | null
  cost: number | null
  status: ServiceTaskStatus
  startedAt: string | null
  completedAt: string | null
}

export interface EquipmentServiceRecord {
  id: number
  equipmentId: number
  equipmentName?: string | null
  equipmentIdentifier: string | null
  serviceNumber: string
  triggeredBy: ServiceTriggeredBy
  serviceType: EquipmentServiceType
  payerType: ServicePayerType
  status: ServiceStatus
  displayStatus: ServiceDisplayStatus
  hmrAtService: number | null
  dueAtHmr: number | null
  vendorName: string | null
  location: string | null
  serviceDate: string | null
  completedDate: string | null
  completedHmr: number | null
  startedAt: string | null
  totalCost: number | null
  insuranceClaimNo: string | null
  insuranceClaimAmt: number | null
  certificateNumber: string | null
  certificateValidUntil: string | null
  isEscalated: boolean
  notes: string | null
  invoiceId: number | null
  tasks: EquipmentServiceTask[]
  createdAt: string
  updatedAt: string
}

export interface EquipmentServiceTaskRequest {
  taskTypeId?: number | null
  customName?: string | null
  recurring: boolean
  frequencyHmr?: number | null
  cost?: number | null
}

export interface EquipmentServiceRequest {
  triggeredBy: ServiceTriggeredBy
  serviceType: EquipmentServiceType
  payerType?: ServicePayerType
  vendorName?: string | null
  location?: string | null
  serviceDate?: string | null
  hmrAtService?: number | null
  dueAtHmr?: number | null
  notes?: string | null
  insuranceClaimNo?: string | null
  insuranceClaimAmt?: number | null
  certificateNumber?: string | null
  certificateValidUntil?: string | null
  isEscalated?: boolean
  tasks: EquipmentServiceTaskRequest[]
}

export type EquipmentBreakdownStatus = 'REPORTED' | 'IN_REPAIR' | 'RESOLVED'

export interface EquipmentBreakdown {
  id: number
  equipmentId: number
  equipmentName?: string | null
  equipmentIdentifier?: string | null
  breakdownDate: string
  location?: string | null
  reason: string
  notes?: string | null
  status: EquipmentBreakdownStatus
  reportedByName?: string | null
  resolvedAt?: string | null
  createdAt: string
}

export interface EquipmentBreakdownRequest {
  reason: string
  breakdownDate?: string | null
  location?: string | null
  notes?: string | null
}

export const equipmentApi = {
  getDashboard: () => apiClient.get<ApiResponse<EquipmentDashboardResponse>>('/equipment/dashboard').then(r => r.data),
  getAll: () => apiClient.get<ApiResponse<Equipment[]>>('/equipment').then(r => r.data),
  getById: (id: number) => apiClient.get<ApiResponse<Equipment>>(`/equipment/${id}`).then(r => r.data),
  create: (data: EquipmentRequest) => apiClient.post<ApiResponse<Equipment>>('/equipment', data).then(r => r.data),
  update: (id: number, data: EquipmentRequest) => apiClient.put<ApiResponse<Equipment>>(`/equipment/${id}`, data).then(r => r.data),
  updateWorkStatus: (id: number, workStatus: EquipmentWorkStatus) =>
    apiClient.patch<ApiResponse<Equipment>>(`/equipment/${id}/work-status`, { workStatus }).then(r => r.data),

  // Fuel logs
  getFuelLogs: (id: number) => apiClient.get<ApiResponse<EquipmentFuelLog[]>>(`/equipment/${id}/fuel-logs`).then(r => r.data),
  addFuelLog: (id: number, data: EquipmentFuelLogRequest) => apiClient.post<ApiResponse<EquipmentFuelLog>>(`/equipment/${id}/fuel-logs`, data).then(r => r.data),
  updateFuelLog: (id: number, logId: number, data: EquipmentFuelLogRequest) => apiClient.put<ApiResponse<EquipmentFuelLog>>(`/equipment/${id}/fuel-logs/${logId}`, data).then(r => r.data),
  deleteFuelLog: (id: number, logId: number) => apiClient.delete<ApiResponse<void>>(`/equipment/${id}/fuel-logs/${logId}`).then(r => r.data),

  // Meter readings
  getMeterReadings: (id: number) => apiClient.get<ApiResponse<EquipmentMeterReading[]>>(`/equipment/${id}/meter-readings`).then(r => r.data),
  addMeterReading: (id: number, data: EquipmentMeterReadingRequest) => apiClient.post<ApiResponse<EquipmentMeterReading>>(`/equipment/${id}/meter-readings`, data).then(r => r.data),
  updateMeterReading: (id: number, readingId: number, data: EquipmentMeterReadingRequest) => apiClient.put<ApiResponse<EquipmentMeterReading>>(`/equipment/${id}/meter-readings/${readingId}`, data).then(r => r.data),
  deleteMeterReading: (id: number, readingId: number) => apiClient.delete<ApiResponse<void>>(`/equipment/${id}/meter-readings/${readingId}`).then(r => r.data),

  // Service records
  getServices: (id: number) => apiClient.get<ApiResponse<EquipmentServiceRecord[]>>(`/equipment/${id}/services`).then(r => r.data),
  createService: (id: number, data: EquipmentServiceRequest) => apiClient.post<ApiResponse<EquipmentServiceRecord>>(`/equipment/${id}/services`, data).then(r => r.data),
  updateService: (id: number, serviceId: number, data: EquipmentServiceRequest) => apiClient.put<ApiResponse<EquipmentServiceRecord>>(`/equipment/${id}/services/${serviceId}`, data).then(r => r.data),
  startService: (id: number, serviceId: number) => apiClient.post<ApiResponse<EquipmentServiceRecord>>(`/equipment/${id}/services/${serviceId}/start`, {}).then(r => r.data),
  completeService: (id: number, serviceId: number, data: { completedHmr?: number | null; completedDate?: string | null }) => apiClient.post<ApiResponse<EquipmentServiceRecord>>(`/equipment/${id}/services/${serviceId}/complete`, data).then(r => r.data),
  deleteService: (id: number, serviceId: number) => apiClient.delete<ApiResponse<void>>(`/equipment/${id}/services/${serviceId}`).then(r => r.data),

  // Breakdowns
  getAllBreakdowns: () => apiClient.get<ApiResponse<EquipmentBreakdown[]>>('/equipment/breakdowns').then(r => r.data),
  getAllServices: () => apiClient.get<ApiResponse<EquipmentServiceRecord[]>>('/equipment/services').then(r => r.data),
  getBreakdowns: (id: number) => apiClient.get<ApiResponse<EquipmentBreakdown[]>>(`/equipment/${id}/breakdowns`).then(r => r.data),
  reportBreakdown: (id: number, data: EquipmentBreakdownRequest) => apiClient.post<ApiResponse<EquipmentBreakdown>>(`/equipment/${id}/breakdowns`, data).then(r => r.data),
  resolveBreakdown: (id: number, breakdownId: number) => apiClient.post<ApiResponse<EquipmentBreakdown>>(`/equipment/${id}/breakdowns/${breakdownId}/resolve`, {}).then(r => r.data),
}
