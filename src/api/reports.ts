import apiClient from './client'
import type {
  ApiResponse,
  LrRegisterRow,
  InvoiceOutstandingRow,
  PayrollSummaryRow,
  CollectionReportRow,
  ClientStatementResponse,
  VehicleTripRow,
  OrderStatusRow,
  AttendanceReportRow,
} from '@/types'

export const reportsApi = {
  getLrRegister: (from: string, to: string, clientId?: number) =>
    apiClient.get<ApiResponse<LrRegisterRow[]>>(
      `/reports/lr-register?from=${from}&to=${to}${clientId ? `&clientId=${clientId}` : ''}`
    ).then(r => r.data),

  getInvoiceOutstanding: (clientId?: number) =>
    apiClient.get<ApiResponse<InvoiceOutstandingRow[]>>(
      `/reports/invoice-outstanding${clientId ? `?clientId=${clientId}` : ''}`
    ).then(r => r.data),

  getPayrollSummary: (from: string, to: string) =>
    apiClient.get<ApiResponse<PayrollSummaryRow[]>>(`/reports/payroll-summary?from=${from}&to=${to}`).then(r => r.data),

  getCollectionReport: (from: string, to: string, clientId?: number) =>
    apiClient.get<ApiResponse<CollectionReportRow[]>>(
      `/reports/collections?from=${from}&to=${to}${clientId ? `&clientId=${clientId}` : ''}`
    ).then(r => r.data),

  getClientStatement: (clientId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<ClientStatementResponse>>(
      `/reports/client-statement?clientId=${clientId}&from=${from}&to=${to}`
    ).then(r => r.data),

  getVehicleTripReport: (from: string, to: string) =>
    apiClient.get<ApiResponse<VehicleTripRow[]>>(`/reports/vehicle-trips?from=${from}&to=${to}`).then(r => r.data),

  getOrderStatusReport: (from: string, to: string, status?: string) =>
    apiClient.get<ApiResponse<OrderStatusRow[]>>(
      `/reports/order-status?from=${from}&to=${to}${status ? `&status=${status}` : ''}`
    ).then(r => r.data),

  getAttendanceReport: (from: string, to: string) =>
    apiClient.get<ApiResponse<AttendanceReportRow[]>>(`/reports/attendance?from=${from}&to=${to}`).then(r => r.data),
}
