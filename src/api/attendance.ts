import apiClient from './client'
import type { ApiResponse, Attendance } from '@/types'

export interface AttendanceRequest {
  userId: number
  attendanceDate: string
  attendanceTypeId: number
  leaveTypeId?: number
  leaveReason?: string
  remarks?: string
}

export interface BulkAttendanceEntry {
  userId: number
  attendanceTypeId: number
  leaveTypeId?: number
  leaveReason?: string
  remarks?: string
}

export interface BulkAttendanceRequest {
  attendanceDate: string
  entries: BulkAttendanceEntry[]
}

export const attendanceApi = {
  mark:       (data: AttendanceRequest) => apiClient.post<ApiResponse<Attendance>>('/attendance', data).then(r => r.data),
  markBulk:   (data: BulkAttendanceRequest) => apiClient.post<ApiResponse<Attendance[]>>('/attendance/bulk', data).then(r => r.data),
  getByDate:  (date: string) => apiClient.get<ApiResponse<Attendance[]>>(`/attendance?date=${date}`).then(r => r.data),
  getByUser:  (userId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<Attendance[]>>(`/attendance/user/${userId}?from=${from}&to=${to}`).then(r => r.data),
  update:     (id: number, data: AttendanceRequest) => apiClient.put<ApiResponse<Attendance>>(`/attendance/${id}`, data).then(r => r.data),

  // Staff self-service
  markOwn:        (data: Pick<AttendanceRequest, 'attendanceTypeId' | 'leaveTypeId' | 'leaveReason' | 'remarks'>) =>
    apiClient.post<ApiResponse<Attendance>>('/attendance/my', data).then(r => r.data),
  getMyAttendance: (from: string, to: string) =>
    apiClient.get<ApiResponse<Attendance[]>>(`/attendance/my?from=${from}&to=${to}`).then(r => r.data),

  // Admin approval
  getPending: () => apiClient.get<ApiResponse<Attendance[]>>('/attendance/pending').then(r => r.data),
  approve:    (id: number) => apiClient.put<ApiResponse<Attendance>>(`/attendance/${id}/approve`).then(r => r.data),
  reject:     (id: number) => apiClient.put<ApiResponse<Attendance>>(`/attendance/${id}/reject`).then(r => r.data),
}
