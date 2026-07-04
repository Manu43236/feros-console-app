import apiClient from './client'
import type { ApiResponse } from '@/types'

export interface MachineAssignmentHistory {
  id: number
  workOrderId: number
  woNumber: string
  clientName: string
  site: string | null
  workOrderStatus: string
  startDate: string
  endDate: string | null
  isActive: boolean
  endReason: string | null
  rateType: string | null
  rateAmount: number | null
  totalHoursWorked: number
}

export interface MachineDailyLog {
  id: number
  machineAssignmentId: number
  workOrderId: number
  woNumber: string | null
  logDate: string
  status: string
  startHourMeter: number | null
  endHourMeter: number | null
  hoursWorked: number | null
  fuelConsumed: number | null
  notes: string | null
  serialNumber: string | null
  equipmentTypeName: string | null
  source: string
  createdAt: string
  updatedAt: string
}

export interface MachineInvoiceItem {
  id: number
  invoiceId: number
  invoiceNumber: string | null
  invoiceDate: string
  invoiceStatus: string
  clientName: string
  billingPeriodStart: string | null
  billingPeriodEnd: string | null
  description: string
  billingType: string | null
  quantity: number | null
  rate: number | null
  amount: number | null
}

export const machinesApi = {
  getHistory: (equipmentId: number) =>
    apiClient.get<ApiResponse<MachineAssignmentHistory[]>>(`/equipment/${equipmentId}/assignments`).then(r => r.data),

  getLogs: (equipmentId: number, from?: string, to?: string) =>
    apiClient.get<ApiResponse<MachineDailyLog[]>>(`/equipment/${equipmentId}/daily-logs`, {
      params: { from, to },
    }).then(r => r.data),

  getInvoiceItems: (equipmentId: number) =>
    apiClient.get<ApiResponse<MachineInvoiceItem[]>>(`/equipment/${equipmentId}/invoice-items`).then(r => r.data),
}
