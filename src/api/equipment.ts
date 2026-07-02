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

export const equipmentApi = {
  getAll: () => apiClient.get<ApiResponse<Equipment[]>>('/equipment').then(r => r.data),
  getById: (id: number) => apiClient.get<ApiResponse<Equipment>>(`/equipment/${id}`).then(r => r.data),
  create: (data: EquipmentRequest) => apiClient.post<ApiResponse<Equipment>>('/equipment', data).then(r => r.data),
  update: (id: number, data: EquipmentRequest) => apiClient.put<ApiResponse<Equipment>>(`/equipment/${id}`, data).then(r => r.data),
  updateWorkStatus: (id: number, workStatus: EquipmentWorkStatus) =>
    apiClient.patch<ApiResponse<Equipment>>(`/equipment/${id}/work-status`, { workStatus }).then(r => r.data),
}
