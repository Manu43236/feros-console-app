import apiClient from './client'
import type { ApiResponse, TripExpense, TripExpenseStatus } from '@/types'

interface TripExpenseItemPayload {
  description: string
  amount: number
  receiptUrl?: string
}

interface CreateTripExpensePayload {
  advanceAmount?: number
  tripDays?: number
  items?: TripExpenseItemPayload[]
}

interface ApproveTripExpensePayload {
  items: { itemId: number; approvedAmount: number }[]
}

interface SettleTripExpensePayload {
  settlementAmount: number
  settlementNote?: string
  paymentMode?: 'CASH' | 'NEFT' | 'UPI'
}

export const tripExpensesApi = {
  getByLrId:  (lrId: number) =>
    apiClient.get<ApiResponse<TripExpense>>(`/lr/${lrId}/trip-expense`).then(r => r.data),

  createDraft: (lrId: number, data: CreateTripExpensePayload) =>
    apiClient.post<ApiResponse<TripExpense>>(`/lr/${lrId}/trip-expense`, data).then(r => r.data),

  updateDraft: (lrId: number, data: CreateTripExpensePayload) =>
    apiClient.put<ApiResponse<TripExpense>>(`/lr/${lrId}/trip-expense`, data).then(r => r.data),

  submit: (lrId: number) =>
    apiClient.post<ApiResponse<TripExpense>>(`/lr/${lrId}/trip-expense/submit`).then(r => r.data),

  getAll: (status?: TripExpenseStatus) =>
    apiClient.get<ApiResponse<TripExpense[]>>('/trip-expenses', { params: status ? { status } : {} }).then(r => r.data),

  approve: (id: number, data: ApproveTripExpensePayload) =>
    apiClient.put<ApiResponse<TripExpense>>(`/trip-expenses/${id}/approve`, data).then(r => r.data),

  reject: (id: number, rejectionReason?: string) =>
    apiClient.put<ApiResponse<TripExpense>>(`/trip-expenses/${id}/reject`, { rejectionReason }).then(r => r.data),

  settle: (id: number, data: SettleTripExpensePayload) =>
    apiClient.post<ApiResponse<TripExpense>>(`/trip-expenses/${id}/settle`, data).then(r => r.data),

  deleteDraft: (lrId: number) =>
    apiClient.delete<ApiResponse<void>>(`/lr/${lrId}/trip-expense`).then(r => r.data),
}
