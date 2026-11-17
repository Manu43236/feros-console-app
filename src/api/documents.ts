import apiClient from './client'
import type { ApiResponse, DocumentListRow } from '@/types'

export type DocumentListParams = {
  entity?: 'VEHICLE' | 'STAFF' | 'ALL'
  status?: 'EXPIRED' | 'EXPIRING' | 'ACTIVE' | 'ALL'
  q?: string
  withinDays?: number
}

export const documentsApi = {
  list: (params: DocumentListParams = {}) =>
    apiClient.get<ApiResponse<DocumentListRow[]>>('/documents', { params }).then(r => r.data),
}
