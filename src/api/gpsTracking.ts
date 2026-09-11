import apiClient from './client'
import type { ApiResponse } from '@/types'

export interface GpsLatest {
  vehicleId: number
  registrationNumber: string
  latitude: number
  longitude: number
  speedKmh: number | null
  heading: number | null
  ignitionOn: boolean | null
  lastPingUtc: string
  lastPingIst: string
  isLive: boolean
}

export interface GpsFleetItem {
  vehicleId: number
  registrationNumber: string
  latitude: number
  longitude: number
  speedKmh: number | null
  heading: number | null
  ignitionOn: boolean | null
  lastPingIst: string
  isLive: boolean
}

export interface GpsPingItem {
  id: number
  latitude: number
  longitude: number
  speedKmh: number | null
  heading: number | null
  ignitionOn: boolean | null
  recordedAtIst: string
  packetType: string | null
  alertId: number | null
}

export interface GpsRoutePoint {
  latitude: number
  longitude: number
  heading: number | null
  speedKmh: number | null
  recordedAtIst: string
}

const BASE = '/gps'

export const gpsTrackingApi = {
  getLatest: (vehicleId: number) =>
    apiClient.get<ApiResponse<GpsLatest | null>>(`${BASE}/vehicles/${vehicleId}/latest`).then(r => r.data),

  getFleet: () =>
    apiClient.get<ApiResponse<GpsFleetItem[]>>(`${BASE}/fleet`).then(r => r.data),

  getHistory: (vehicleId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<GpsPingItem[]>>(`${BASE}/vehicles/${vehicleId}/history`, {
      params: { from, to },
    }).then(r => r.data),

  getRoute: (vehicleId: number, from: string, to: string) =>
    apiClient.get<ApiResponse<GpsRoutePoint[]>>(`${BASE}/vehicles/${vehicleId}/route`, {
      params: { from, to },
    }).then(r => r.data),
}
