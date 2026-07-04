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
}
