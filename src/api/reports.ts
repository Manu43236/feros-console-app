import apiClient from './client'
import type {
  ApiResponse,
  LrRegisterRow, InvoiceOutstandingRow, PayrollSummaryRow,
  CollectionReportRow, ClientStatementResponse, VehicleTripRow,
  OrderStatusRow, AttendanceReportRow, TenantTargetResponse,
  DailyVehicleActivityResponse, LocalLongTripSummaryResponse,
  IdleDriverResponse, DocumentExpiryAlertResponse,
  TodayAttendanceSummaryResponse, DelayedTripResponse, OrdersBacklogResponse,
  OrderFulfillmentRateResponse, OrderLeadTimeResponse,
  UnassignedVehiclesResponse, DriverAssignmentHistoryResponse,
  TripInProgressResponse, LrStatusFunnelResponse, UnbilledLrResponse,
  InvoiceTurnaroundResponse, TripDurationResponse,
  WeightVarianceReportResponse, OverloadingIncidentResponse,
  VehicleRevenueResponse, VehicleIdleDaysResponse, VehicleTripCountResponse,
  BreakdownFrequencyResponse, VehicleServiceCostResponse,
  DriverPerformanceResponse, AttendanceGapsResponse,
  AttendanceTrendResponse, AttendanceCalendarResponse,
  InvoiceAgingResponse, RevenueTrendResponse, RouteProfitabilityResponse,
  GstSummaryResponse, CreditNoteSummaryResponse, ClientPendingBillingResponse,
  TopClientResponse, TopMaterialResponse, TopRouteResponse,
  OnTimeDeliveryResponse, OrderCancellationRateResponse,
  StockLevelResponse, StockMovementResponse, VehiclePartConsumptionResponse,
  PartConsumptionByTypeResponse, ServiceCostBreakdownResponse,
  TiresByVehicleResponse, KmPerTireResponse,
  TireReplacementProjectionResponse, TireCostPerKmResponse,
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

  getTarget: (year: number, month: number) =>
    apiClient.get<ApiResponse<TenantTargetResponse>>(`/targets/${year}/${month}`).then(r => r.data),

  getAllTargets: () =>
    apiClient.get<ApiResponse<TenantTargetResponse[]>>('/targets').then(r => r.data),

  setTarget: (payload: { year: number; month: number; targetTrips?: number; targetTons?: number }) =>
    apiClient.put<ApiResponse<TenantTargetResponse>>('/targets', payload).then(r => r.data),

  // Section A — Daily Operations
  getDailyVehicleActivity: () =>
    apiClient.get<ApiResponse<DailyVehicleActivityResponse>>('/reports/daily-vehicles').then(r => r.data),

  getLocalLongTripSummary: () =>
    apiClient.get<ApiResponse<LocalLongTripSummaryResponse>>('/reports/local-long-trips').then(r => r.data),

  getIdleDrivers: () =>
    apiClient.get<ApiResponse<IdleDriverResponse[]>>('/reports/idle-drivers').then(r => r.data),

  getDocumentExpiryAlerts: (daysAhead = 60) =>
    apiClient.get<ApiResponse<DocumentExpiryAlertResponse[]>>(`/reports/document-expiry?daysAhead=${daysAhead}`).then(r => r.data),

  getTodayAttendance: () =>
    apiClient.get<ApiResponse<TodayAttendanceSummaryResponse>>('/reports/today-attendance').then(r => r.data),

  getDelayedTrips: () =>
    apiClient.get<ApiResponse<DelayedTripResponse[]>>('/reports/delayed-trips').then(r => r.data),

  getOrdersBacklog: () =>
    apiClient.get<ApiResponse<OrdersBacklogResponse[]>>('/reports/orders-backlog').then(r => r.data),

  // Section C — Orders & Assignments
  getOrderFulfillmentRate: (from: string, to: string) =>
    apiClient.get<ApiResponse<OrderFulfillmentRateResponse>>(`/reports/order-fulfillment?from=${from}&to=${to}`).then(r => r.data),

  getOrderLeadTime: (from: string, to: string) =>
    apiClient.get<ApiResponse<OrderLeadTimeResponse[]>>(`/reports/order-lead-time?from=${from}&to=${to}`).then(r => r.data),

  getUnassignedVehicles: () =>
    apiClient.get<ApiResponse<UnassignedVehiclesResponse[]>>('/reports/unassigned-vehicles').then(r => r.data),

  getDriverAssignmentHistory: (from: string, to: string) =>
    apiClient.get<ApiResponse<DriverAssignmentHistoryResponse[]>>(`/reports/driver-assignments?from=${from}&to=${to}`).then(r => r.data),

  // Section D — Trips & LRs
  getTripsInProgress: () =>
    apiClient.get<ApiResponse<TripInProgressResponse[]>>('/reports/trips-in-progress').then(r => r.data),

  getLrStatusFunnel: (from: string, to: string) =>
    apiClient.get<ApiResponse<LrStatusFunnelResponse>>(`/reports/lr-status-funnel?from=${from}&to=${to}`).then(r => r.data),

  getUnbilledLrs: () =>
    apiClient.get<ApiResponse<UnbilledLrResponse[]>>('/reports/unbilled-lrs').then(r => r.data),

  getInvoiceTurnaround: (from: string, to: string) =>
    apiClient.get<ApiResponse<InvoiceTurnaroundResponse[]>>(`/reports/invoice-turnaround?from=${from}&to=${to}`).then(r => r.data),

  getTripDurationAnalysis: (from: string, to: string) =>
    apiClient.get<ApiResponse<TripDurationResponse[]>>(`/reports/trip-duration?from=${from}&to=${to}`).then(r => r.data),

  getWeightVarianceReport: (from: string, to: string) =>
    apiClient.get<ApiResponse<WeightVarianceReportResponse[]>>(`/reports/weight-variance?from=${from}&to=${to}`).then(r => r.data),

  getOverloadingIncidents: (from: string, to: string) =>
    apiClient.get<ApiResponse<OverloadingIncidentResponse[]>>(`/reports/overloading?from=${from}&to=${to}`).then(r => r.data),

  // Section E — Vehicle Performance
  getVehicleRevenue: (from: string, to: string) =>
    apiClient.get<ApiResponse<VehicleRevenueResponse[]>>(`/reports/vehicle-revenue?from=${from}&to=${to}`).then(r => r.data),

  getVehicleIdleDays: (from: string, to: string) =>
    apiClient.get<ApiResponse<VehicleIdleDaysResponse[]>>(`/reports/vehicle-idle-days?from=${from}&to=${to}`).then(r => r.data),

  getVehicleTripCount: (from: string, to: string) =>
    apiClient.get<ApiResponse<VehicleTripCountResponse[]>>(`/reports/vehicle-trip-count?from=${from}&to=${to}`).then(r => r.data),

  getBreakdownFrequency: (from: string, to: string) =>
    apiClient.get<ApiResponse<BreakdownFrequencyResponse[]>>(`/reports/breakdown-frequency?from=${from}&to=${to}`).then(r => r.data),

  getVehicleServiceCost: (from: string, to: string) =>
    apiClient.get<ApiResponse<VehicleServiceCostResponse[]>>(`/reports/vehicle-service-cost?from=${from}&to=${to}`).then(r => r.data),

  // Section F — Driver & Staff Performance
  getDriverPerformance: (from: string, to: string) =>
    apiClient.get<ApiResponse<DriverPerformanceResponse[]>>(`/reports/driver-performance?from=${from}&to=${to}`).then(r => r.data),

  getAttendanceGaps: (from: string, to: string) =>
    apiClient.get<ApiResponse<AttendanceGapsResponse[]>>(`/reports/attendance-gaps?from=${from}&to=${to}`).then(r => r.data),

  getAttendanceTrend: (from: string, to: string) =>
    apiClient.get<ApiResponse<AttendanceTrendResponse[]>>(`/reports/attendance-trend?from=${from}&to=${to}`).then(r => r.data),

  getAttendanceCalendar: (year: number, month: number) =>
    apiClient.get<ApiResponse<AttendanceCalendarResponse>>(`/reports/attendance-calendar?year=${year}&month=${month}`).then(r => r.data),

  // Section G — Financial Intelligence
  getInvoiceAging: () =>
    apiClient.get<ApiResponse<InvoiceAgingResponse>>('/reports/invoice-aging').then(r => r.data),

  getRevenueTrend: () =>
    apiClient.get<ApiResponse<RevenueTrendResponse[]>>('/reports/revenue-trend').then(r => r.data),

  getRouteProfitability: (from: string, to: string) =>
    apiClient.get<ApiResponse<RouteProfitabilityResponse[]>>(`/reports/route-profitability?from=${from}&to=${to}`).then(r => r.data),

  getGstSummary: (from: string, to: string) =>
    apiClient.get<ApiResponse<GstSummaryResponse[]>>(`/reports/gst-summary?from=${from}&to=${to}`).then(r => r.data),

  getCreditNotesSummary: (from: string, to: string) =>
    apiClient.get<ApiResponse<CreditNoteSummaryResponse[]>>(`/reports/credit-notes-summary?from=${from}&to=${to}`).then(r => r.data),

  getClientPendingBilling: () =>
    apiClient.get<ApiResponse<ClientPendingBillingResponse[]>>('/reports/client-pending-billing').then(r => r.data),

  // Section H — Monthly Business Intelligence
  getTopClients: (from: string, to: string) =>
    apiClient.get<ApiResponse<TopClientResponse[]>>(`/reports/top-clients?from=${from}&to=${to}`).then(r => r.data),

  getTopMaterials: (from: string, to: string) =>
    apiClient.get<ApiResponse<TopMaterialResponse[]>>(`/reports/top-materials?from=${from}&to=${to}`).then(r => r.data),

  getTopRoutes: (from: string, to: string) =>
    apiClient.get<ApiResponse<TopRouteResponse[]>>(`/reports/top-routes?from=${from}&to=${to}`).then(r => r.data),

  getOnTimeDeliveryRate: (from: string, to: string) =>
    apiClient.get<ApiResponse<OnTimeDeliveryResponse>>(`/reports/on-time-delivery?from=${from}&to=${to}`).then(r => r.data),

  getOrderCancellationRate: (from: string, to: string) =>
    apiClient.get<ApiResponse<OrderCancellationRateResponse>>(`/reports/order-cancellation-rate?from=${from}&to=${to}`).then(r => r.data),

  // Section I — Inventory Reports
  getStockLevels: () =>
    apiClient.get<ApiResponse<StockLevelResponse[]>>('/reports/stock-levels').then(r => r.data),

  getStockMovement: (from: string, to: string) =>
    apiClient.get<ApiResponse<StockMovementResponse[]>>(`/reports/stock-movement?from=${from}&to=${to}`).then(r => r.data),

  getPartsByVehicle: (from: string, to: string) =>
    apiClient.get<ApiResponse<VehiclePartConsumptionResponse[]>>(`/reports/parts-by-vehicle?from=${from}&to=${to}`).then(r => r.data),

  getPartsByType: (from: string, to: string) =>
    apiClient.get<ApiResponse<PartConsumptionByTypeResponse[]>>(`/reports/parts-by-type?from=${from}&to=${to}`).then(r => r.data),

  getServiceCostBreakdown: (from: string, to: string) =>
    apiClient.get<ApiResponse<ServiceCostBreakdownResponse[]>>(`/reports/service-cost-breakdown?from=${from}&to=${to}`).then(r => r.data),

  // Section J — Tire Reports
  getTiresByVehicle: () =>
    apiClient.get<ApiResponse<TiresByVehicleResponse[]>>('/reports/tires-by-vehicle').then(r => r.data),

  getKmPerTire: () =>
    apiClient.get<ApiResponse<KmPerTireResponse[]>>('/reports/km-per-tire').then(r => r.data),

  getTireReplacementProjection: () =>
    apiClient.get<ApiResponse<TireReplacementProjectionResponse[]>>('/reports/tire-replacement-projection').then(r => r.data),

  getTireCostPerKm: () =>
    apiClient.get<ApiResponse<TireCostPerKmResponse[]>>('/reports/tire-cost-per-km').then(r => r.data),
}
