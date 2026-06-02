import apiClient from './client'
import type { ApiResponse, PageResponse, Payroll, SalaryAdvance } from '@/types'

export const payrollApi = {
  createAdvance:      (data: unknown) => apiClient.post<ApiResponse<SalaryAdvance>>('/payroll/advances', data).then(r => r.data),
  getAllAdvances:      () => apiClient.get<ApiResponse<SalaryAdvance[]>>('/payroll/advances').then(r => r.data),
  getAdvancesByUser:  (userId: number) => apiClient.get<ApiResponse<SalaryAdvance[]>>(`/payroll/advances/user/${userId}`).then(r => r.data),
  getPendingAdvances: (userId: number) => apiClient.get<ApiResponse<SalaryAdvance[]>>(`/payroll/advances/user/${userId}/pending`).then(r => r.data),
  generate:           (data: unknown) => apiClient.post<ApiResponse<Payroll>>('/payroll/generate', data).then(r => r.data),
  getAll:             (params?: { page?: number; size?: number; search?: string }) =>
                        apiClient.get<ApiResponse<PageResponse<Payroll>>>('/payroll', { params }).then(r => r.data),
  getById:            (id: number) => apiClient.get<ApiResponse<Payroll>>(`/payroll/${id}`).then(r => r.data),
  getByUser:          (userId: number) => apiClient.get<ApiResponse<Payroll[]>>(`/payroll/user/${userId}`).then(r => r.data),
  approve:            (id: number, data: unknown) => apiClient.put<ApiResponse<Payroll>>(`/payroll/${id}/approve`, data).then(r => r.data),
  cancel:             (id: number) => apiClient.delete<ApiResponse<Payroll>>(`/payroll/${id}`).then(r => r.data),
  getPayslipPdf:      (id: number) => apiClient.get(`/payroll/${id}/payslip-pdf`, { responseType: 'blob' }).then(r => r.data as Blob),
}
