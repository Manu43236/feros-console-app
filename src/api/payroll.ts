import apiClient from './client'
import type { ApiResponse, Payroll, SalaryAdvance } from '@/types'

export const payrollApi = {
  createAdvance:      (data: unknown) => apiClient.post<ApiResponse<SalaryAdvance>>('/payroll/advances', data).then(r => r.data),
  getAllAdvances:      () => apiClient.get<ApiResponse<SalaryAdvance[]>>('/payroll/advances').then(r => r.data),
  getAdvancesByUser:  (userId: number) => apiClient.get<ApiResponse<SalaryAdvance[]>>(`/payroll/advances/user/${userId}`).then(r => r.data),
  getPendingAdvances: (userId: number) => apiClient.get<ApiResponse<SalaryAdvance[]>>(`/payroll/advances/user/${userId}/pending`).then(r => r.data),
  generate:           (data: unknown) => apiClient.post<ApiResponse<Payroll>>('/payroll/generate', data).then(r => r.data),
  getAll:             () => apiClient.get<ApiResponse<Payroll[]>>('/payroll').then(r => r.data),
  getById:            (id: number) => apiClient.get<ApiResponse<Payroll>>(`/payroll/${id}`).then(r => r.data),
  getByUser:          (userId: number) => apiClient.get<ApiResponse<Payroll[]>>(`/payroll/user/${userId}`).then(r => r.data),
  approve:            (id: number, data: unknown) => apiClient.put<ApiResponse<Payroll>>(`/payroll/${id}/approve`, data).then(r => r.data),
  cancel:             (id: number) => apiClient.delete<ApiResponse<Payroll>>(`/payroll/${id}`).then(r => r.data),
}
