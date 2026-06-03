import apiClient from './client'
import type { ApiResponse } from '@/types'
import type {
  FleetStatusRow,
  FuelMileageRow,
  BreakdownReportRow,
  DocumentExpiryRow,
  MaintenanceServiceRow,
  AttendanceDailyRow,
  AttendanceSummaryRow,
  LrRegisterRow,
  WeightDiscrepancyRow,
  DelayedDeliveryRow,
} from '@/types'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const reportsApi = {
  // ── Fleet Status ──────────────────────────────────────────────────────────
  getFleetStatus: (date: string) =>
    apiClient.get<ApiResponse<FleetStatusRow[]>>('/reports/vehicles/fleet-status', { params: { date } }).then(r => r.data),

  exportFleetStatus: async (date: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/vehicles/fleet-status/export', {
      params: { date, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `fleet-status-${date}.${format}`)
  },

  // ── Fuel & Mileage ────────────────────────────────────────────────────────
  getFuelMileage: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<FuelMileageRow[]>>('/reports/vehicles/fuel-mileage', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportFuelMileage: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/vehicles/fuel-mileage/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `fuel-mileage-${startDate}-${endDate}.${format}`)
  },

  // ── Breakdowns ────────────────────────────────────────────────────────────
  getBreakdowns: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<BreakdownReportRow[]>>('/reports/vehicles/breakdowns', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportBreakdowns: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/vehicles/breakdowns/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `breakdowns-${startDate}-${endDate}.${format}`)
  },

  // ── Document Expiry ───────────────────────────────────────────────────────
  getDocumentExpiry: (days: number) =>
    apiClient.get<ApiResponse<DocumentExpiryRow[]>>('/reports/vehicles/document-expiry', {
      params: { days },
    }).then(r => r.data),

  exportDocumentExpiry: async (days: number, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/vehicles/document-expiry/export', {
      params: { days, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `document-expiry.${format}`)
  },

  // ── Maintenance & Service ─────────────────────────────────────────────────
  getMaintenanceService: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<MaintenanceServiceRow[]>>('/reports/vehicles/maintenance-service', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportMaintenanceService: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/vehicles/maintenance-service/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `maintenance-service-${startDate}-${endDate}.${format}`)
  },

  // ── Attendance Daily ──────────────────────────────────────────────────────
  getAttendanceDaily: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<AttendanceDailyRow[]>>('/reports/attendance/daily', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportAttendanceDaily: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/attendance/daily/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `attendance-daily-${startDate}-${endDate}.${format}`)
  },

  // ── Attendance Summary ────────────────────────────────────────────────────
  getAttendanceSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<AttendanceSummaryRow[]>>('/reports/attendance/summary', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportAttendanceSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/attendance/summary/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `attendance-summary-${startDate}-${endDate}.${format}`)
  },

  // ── LR Register ───────────────────────────────────────────────────────────
  getLrRegister: (startDate: string, endDate: string, clientId?: number) =>
    apiClient.get<ApiResponse<LrRegisterRow[]>>('/reports/trips/lr-register', {
      params: { startDate, endDate, ...(clientId ? { clientId } : {}) },
    }).then(r => r.data),

  exportLrRegister: async (startDate: string, endDate: string, format: 'csv' | 'pdf', clientId?: number) => {
    const res = await apiClient.get('/reports/trips/lr-register/export', {
      params: { startDate, endDate, format, ...(clientId ? { clientId } : {}) }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `lr-register-${startDate}-${endDate}.${format}`)
  },

  // ── Weight Discrepancy ────────────────────────────────────────────────────
  getWeightDiscrepancy: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<WeightDiscrepancyRow[]>>('/reports/trips/weight-discrepancy', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportWeightDiscrepancy: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/trips/weight-discrepancy/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `weight-discrepancy-${startDate}-${endDate}.${format}`)
  },

  // ── Delayed Deliveries ────────────────────────────────────────────────────
  getDelayedDeliveries: (startDate: string, endDate: string, thresholdDays: number) =>
    apiClient.get<ApiResponse<DelayedDeliveryRow[]>>('/reports/trips/delayed-deliveries', {
      params: { startDate, endDate, thresholdDays },
    }).then(r => r.data),

  exportDelayedDeliveries: async (startDate: string, endDate: string, thresholdDays: number, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/trips/delayed-deliveries/export', {
      params: { startDate, endDate, thresholdDays, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `delayed-deliveries-${startDate}-${endDate}.${format}`)
  },
}
