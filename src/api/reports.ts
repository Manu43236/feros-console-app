import apiClient from './client'
import type { ApiResponse } from '@/types'
import type {
  FleetStatusRow,
  FuelMileageRow,
  BreakdownReportRow,
  DocumentExpiryRow,
  MaintenanceServiceRow,
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
}
