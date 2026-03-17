import apiClient from './client'
import type { ApiResponse, Attendance } from '@/types'


export const attendanceApi = {
  mark:       (data: unknown) => apiClient.post<ApiResponse<Attendance>>('/attendance', data).then(r => r.data),
  markBulk:   (data: unknown) => apiClient.post<ApiResponse<Attendance[]>>('/attendance/bulk', data).then(r => r.data),
  getByDate:  (date: string)  => apiClient.get<ApiResponse<Attendance[]>>(`/attendance?date=${date}`).then(r => r.data),
  getByUser:  (userId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<Attendance[]>>(`/attendance/user/${userId}?from=${from}&to=${to}`).then(r => r.data),
  update:     (id: number, data: unknown) => apiClient.put<ApiResponse<Attendance>>(`/attendance/${id}`, data).then(r => r.data),
}
