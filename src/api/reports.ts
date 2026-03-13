import apiClient from './client'
import type { ApiResponse, LrRegisterRow, InvoiceOutstandingRow, PayrollSummaryRow } from '@/types'

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
}
