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

// ── Documents (KAN-14) ──────────────────────────────────────────────────────
export interface EquipmentDocument {
  id: number
  equipmentId: number
  serialNumber: string | null
  registrationNumber: string | null
  documentTypeId: number | null
  documentTypeName: string | null
  documentNumber: string | null
  issueDate: string | null
  expiryDate: string | null
  issuerName: string | null
  fileUrl: string | null
  isVerified: boolean
  cost: number | null
  paidOn: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string
}

export interface EquipmentDocumentInput {
  documentTypeId: number
  documentNumber?: string
  issueDate?: string
  expiryDate?: string
  issuerName?: string
  fileUrl?: string
  cost?: number
  paidOn?: string
  remarks?: string
  isVerified?: boolean
}

// ── Attachments (KAN-13) ────────────────────────────────────────────────────
export type AttachmentType = 'BUCKET' | 'BREAKER' | 'AUGER' | 'RIPPER' | 'GRAPPLE' | 'HAMMER' | 'OTHER'
export type OwnershipType = 'OWNED' | 'HIRED_IN'
export type HireRateUnit = 'PER_DAY' | 'PER_HOUR' | 'PER_MONTH'

export interface EquipmentAttachment {
  id: number
  name: string
  type: AttachmentType
  serialNumber: string | null
  ownershipType: OwnershipType
  hiredFrom: string | null
  hireStartDate: string | null
  hireEndDate: string | null
  defaultRate: number | null
  rateUnit: HireRateUnit | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EquipmentAttachmentInput {
  name: string
  type: AttachmentType
  serialNumber?: string
  ownershipType: OwnershipType
  hiredFrom?: string
  hireStartDate?: string
  hireEndDate?: string
  defaultRate?: number
  rateUnit?: HireRateUnit
  notes?: string
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

  // Documents
  getDocuments: (equipmentId: number) =>
    apiClient.get<ApiResponse<EquipmentDocument[]>>(`/equipment/${equipmentId}/documents`).then(r => r.data),

  addDocument: (equipmentId: number, data: EquipmentDocumentInput) =>
    apiClient.post<ApiResponse<EquipmentDocument>>(`/equipment/${equipmentId}/documents`, data).then(r => r.data),

  updateDocument: (equipmentId: number, docId: number, data: EquipmentDocumentInput) =>
    apiClient.put<ApiResponse<EquipmentDocument>>(`/equipment/${equipmentId}/documents/${docId}`, data).then(r => r.data),

  verifyDocument: (equipmentId: number, docId: number, verified: boolean) =>
    apiClient.put<ApiResponse<EquipmentDocument>>(`/equipment/${equipmentId}/documents/${docId}/verify`, { verified }).then(r => r.data),

  deleteDocument: (equipmentId: number, docId: number) =>
    apiClient.delete<ApiResponse<void>>(`/equipment/${equipmentId}/documents/${docId}`).then(r => r.data),

  getExpiringDocuments: (days = 30) =>
    apiClient.get<ApiResponse<EquipmentDocument[]>>(`/equipment/documents/expiring`, { params: { days } }).then(r => r.data),

  uploadDocFile: (equipmentId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', `tenants/images/equipment/${equipmentId}/documents`)
    return apiClient.post<ApiResponse<{ key: string; url: string; publicUrl: string }>>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}

export const equipmentAttachmentsApi = {
  getAll: () =>
    apiClient.get<ApiResponse<EquipmentAttachment[]>>(`/equipment/attachments`).then(r => r.data),

  getById: (id: number) =>
    apiClient.get<ApiResponse<EquipmentAttachment>>(`/equipment/attachments/${id}`).then(r => r.data),

  create: (data: EquipmentAttachmentInput) =>
    apiClient.post<ApiResponse<EquipmentAttachment>>(`/equipment/attachments`, data).then(r => r.data),

  update: (id: number, data: EquipmentAttachmentInput) =>
    apiClient.put<ApiResponse<EquipmentAttachment>>(`/equipment/attachments/${id}`, data).then(r => r.data),

  setActive: (id: number, isActive: boolean) =>
    apiClient.patch<ApiResponse<EquipmentAttachment>>(`/equipment/attachments/${id}/active`, { isActive }).then(r => r.data),

  remove: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/equipment/attachments/${id}`).then(r => r.data),
}
