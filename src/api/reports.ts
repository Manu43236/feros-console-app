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
  VehicleTripSummaryRow,
  ClientTripSummaryRow,
  OrderRegisterRow,
  OpenOrderRow,
  OrderClientSummaryRow,
  OverdueOrderRow,
  WeightFulfillmentRow,
  OrderRouteSummaryRow,
  OrderPaymentStatusRow,
  InvoiceRegisterRow,
  OutstandingInvoiceRow,
  InvoiceAgingReportRow,
  CollectionRow,
  CreditNoteRegisterRow,
  TripExpenseReportRow,
  FuelCostRow,
  MaintenanceCostRow,
  DocumentCostRow,
  DriverPerformanceRow,
  CleanerPerformanceRow,
  PnlSummaryRow,
  ClientPnlRow,
  VehiclePnlRow,
  RoutePnlRow,
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

  // ── Vehicle Trip Summary ──────────────────────────────────────────────────
  getVehicleTripSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<VehicleTripSummaryRow[]>>('/reports/trips/vehicle-summary', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportVehicleTripSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/trips/vehicle-summary/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `vehicle-trip-summary-${startDate}-${endDate}.${format}`)
  },

  // ── Client Trip Summary ───────────────────────────────────────────────────
  getClientTripSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<ClientTripSummaryRow[]>>('/reports/trips/client-summary', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportClientTripSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/trips/client-summary/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `client-trip-summary-${startDate}-${endDate}.${format}`)
  },

  // ── Order Register ────────────────────────────────────────────────────────
  getOrderRegister: (startDate: string, endDate: string, status?: string) =>
    apiClient.get<ApiResponse<OrderRegisterRow[]>>('/reports/orders/register', {
      params: { startDate, endDate, ...(status ? { status } : {}) },
    }).then(r => r.data),

  exportOrderRegister: async (startDate: string, endDate: string, format: 'csv' | 'pdf', status?: string) => {
    const res = await apiClient.get('/reports/orders/register/export', {
      params: { startDate, endDate, format, ...(status ? { status } : {}) }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `order-register-${startDate}-${endDate}.${format}`)
  },

  // ── Open Orders ───────────────────────────────────────────────────────────
  getOpenOrders: () =>
    apiClient.get<ApiResponse<OpenOrderRow[]>>('/reports/orders/open').then(r => r.data),

  exportOpenOrders: async (format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/orders/open/export', {
      params: { format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `open-orders.${format}`)
  },

  // ── Order Client Summary ──────────────────────────────────────────────────
  getOrderClientSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<OrderClientSummaryRow[]>>('/reports/orders/client-summary', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportOrderClientSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/orders/client-summary/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `order-client-summary-${startDate}-${endDate}.${format}`)
  },

  // ── Overdue Orders ────────────────────────────────────────────────────────
  getOverdueOrders: (thresholdDays: number) =>
    apiClient.get<ApiResponse<OverdueOrderRow[]>>('/reports/orders/overdue', {
      params: { thresholdDays },
    }).then(r => r.data),

  exportOverdueOrders: async (thresholdDays: number, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/orders/overdue/export', {
      params: { thresholdDays, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `overdue-orders.${format}`)
  },

  // ── Weight Fulfillment ────────────────────────────────────────────────────
  getWeightFulfillment: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<WeightFulfillmentRow[]>>('/reports/orders/weight-fulfillment', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportWeightFulfillment: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/orders/weight-fulfillment/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `weight-fulfillment-${startDate}-${endDate}.${format}`)
  },

  // ── Route Summary ─────────────────────────────────────────────────────────
  getOrderRouteSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<OrderRouteSummaryRow[]>>('/reports/orders/route-summary', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportOrderRouteSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/orders/route-summary/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `order-route-summary-${startDate}-${endDate}.${format}`)
  },

  // ── Order Payment Status ──────────────────────────────────────────────────
  getOrderPaymentStatus: (startDate: string, endDate: string, paymentStatus?: string) =>
    apiClient.get<ApiResponse<OrderPaymentStatusRow[]>>('/reports/orders/payment-status', {
      params: { startDate, endDate, ...(paymentStatus ? { paymentStatus } : {}) },
    }).then(r => r.data),

  exportOrderPaymentStatus: async (startDate: string, endDate: string, format: 'csv' | 'pdf', paymentStatus?: string) => {
    const res = await apiClient.get('/reports/orders/payment-status/export', {
      params: { startDate, endDate, format, ...(paymentStatus ? { paymentStatus } : {}) }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `order-payment-status-${startDate}-${endDate}.${format}`)
  },

  // ── Invoice Register ──────────────────────────────────────────────────────────
  getInvoiceRegister: (startDate: string, endDate: string, status?: string) =>
    apiClient.get<ApiResponse<InvoiceRegisterRow[]>>('/reports/invoices/register', {
      params: { startDate, endDate, ...(status ? { status } : {}) },
    }).then(r => r.data),

  exportInvoiceRegister: async (startDate: string, endDate: string, format: 'csv' | 'pdf', status?: string) => {
    const res = await apiClient.get('/reports/invoices/register/export', {
      params: { startDate, endDate, format, ...(status ? { status } : {}) }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `invoice-register-${startDate}-${endDate}.${format}`)
  },

  // ── Outstanding Invoices ──────────────────────────────────────────────────────
  getOutstandingInvoices: () =>
    apiClient.get<ApiResponse<OutstandingInvoiceRow[]>>('/reports/invoices/outstanding').then(r => r.data),

  exportOutstandingInvoices: async (format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/invoices/outstanding/export', {
      params: { format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `outstanding-invoices.${format}`)
  },

  // ── Invoice Aging ─────────────────────────────────────────────────────────────
  getInvoiceAging: () =>
    apiClient.get<ApiResponse<InvoiceAgingReportRow[]>>('/reports/invoices/aging').then(r => r.data),

  exportInvoiceAging: async (format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/invoices/aging/export', {
      params: { format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `invoice-aging.${format}`)
  },

  // ── Collections ───────────────────────────────────────────────────────────────
  getCollections: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<CollectionRow[]>>('/reports/invoices/collections', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportCollections: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/invoices/collections/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `collections-${startDate}-${endDate}.${format}`)
  },

  // ── Credit Note Register ──────────────────────────────────────────────────────
  getCreditNoteRegister: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<CreditNoteRegisterRow[]>>('/reports/invoices/credit-notes', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportCreditNoteRegister: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/invoices/credit-notes/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `credit-notes-${startDate}-${endDate}.${format}`)
  },

  // ── Trip Expenses ─────────────────────────────────────────────────────────────
  getTripExpenses: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<TripExpenseReportRow[]>>('/reports/expenses/trips', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportTripExpenses: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/expenses/trips/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `trip-expenses-${startDate}-${endDate}.${format}`)
  },

  // ── Fuel Cost Summary ─────────────────────────────────────────────────────────
  getFuelCostSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<FuelCostRow[]>>('/reports/expenses/fuel', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportFuelCostSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/expenses/fuel/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `fuel-cost-${startDate}-${endDate}.${format}`)
  },

  // ── Maintenance Cost Summary ──────────────────────────────────────────────────
  getMaintenanceCostSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<MaintenanceCostRow[]>>('/reports/expenses/maintenance', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportMaintenanceCostSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/expenses/maintenance/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `maintenance-cost-${startDate}-${endDate}.${format}`)
  },

  // ── Document Cost Summary ──────────────────────────────────────────────────────
  getDocumentCostSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<DocumentCostRow[]>>('/reports/expenses/documents', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportDocumentCostSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/expenses/documents/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `document-cost-${startDate}-${endDate}.${format}`)
  },

  // ── Staff Performance ─────────────────────────────────────────────────────────
  getDriverPerformance: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<DriverPerformanceRow[]>>('/reports/staff/drivers', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportDriverPerformance: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/staff/drivers/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `driver-performance-${startDate}-${endDate}.${format}`)
  },

  getCleanerPerformance: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<CleanerPerformanceRow[]>>('/reports/staff/cleaners', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportCleanerPerformance: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/staff/cleaners/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `cleaner-performance-${startDate}-${endDate}.${format}`)
  },

  getPnlSummary: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<PnlSummaryRow>>('/reports/pnl/summary', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportPnlSummary: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/pnl/summary/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `pnl-summary-${startDate}-${endDate}.${format}`)
  },

  getClientPnl: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<ClientPnlRow[]>>('/reports/pnl/clients', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportClientPnl: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/pnl/clients/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `client-pnl-${startDate}-${endDate}.${format}`)
  },

  getVehiclePnl: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<VehiclePnlRow[]>>('/reports/pnl/vehicles', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportVehiclePnl: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/pnl/vehicles/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `vehicle-pnl-${startDate}-${endDate}.${format}`)
  },

  getRoutePnl: (startDate: string, endDate: string) =>
    apiClient.get<ApiResponse<RoutePnlRow[]>>('/reports/pnl/routes', {
      params: { startDate, endDate },
    }).then(r => r.data),

  exportRoutePnl: async (startDate: string, endDate: string, format: 'csv' | 'pdf') => {
    const res = await apiClient.get('/reports/pnl/routes/export', {
      params: { startDate, endDate, format }, responseType: 'blob',
    })
    triggerDownload(res.data as Blob, `route-pnl-${startDate}-${endDate}.${format}`)
  },
}
