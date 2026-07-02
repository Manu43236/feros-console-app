// ─── Generic API Wrapper ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

// ─── Spring Page wrapper ───────────────────────────────────────────────────────
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number       // current page (0-based)
  size: number
  last: boolean
  first: boolean
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  phone: string
  pin: string
  deviceType: 'WEB' | 'MOBILE'
  deviceInfo?: string
  appVersion?: string
  fcmToken?: string
}
export type ModuleType = 'VEHICLES_ONLY' | 'EQUIPMENT_ONLY' | 'BOTH'

export interface LoginResponse {
  token: string
  userId: number
  tenantId: number
  phone: string
  name: string
  role: string
  companyName: string
  logoUrl?: string
  isPinResetRequired?: boolean
  allowedModules?: string[] | null
  moduleType?: ModuleType | null
  canAccessVehicles?: boolean | null
  canAccessEquipment?: boolean | null
}

// ─── Module Access ─────────────────────────────────────────────────────────────
export type ModuleKey =
  | 'DASHBOARD' | 'CLIENTS' | 'ORDERS' | 'ASSIGNMENTS' | 'LR_REGISTER'
  | 'INVOICES' | 'CREDIT_NOTES' | 'SERVICE_INVOICES' | 'ATTENDANCE' | 'REPORTS'
  | 'SPARE_PARTS' | 'TYRES' | 'PART_REQUESTS' | 'TYRE_REQUESTS' | 'VEHICLE_SERVICES'

export interface ModuleAccessEntry {
  role: string
  moduleKey: ModuleKey
  enabled: boolean
}

export interface ModuleAccessResponse {
  entries: ModuleAccessEntry[]
}

export interface ModuleAccessRequest {
  entries: ModuleAccessEntry[]
}

// ─── Master (shared) ──────────────────────────────────────────────────────────
export interface MasterItem {
  id: number
  name: string
  isActive: boolean
}
export interface StateItem extends MasterItem { code: string }
export interface CityItem  extends MasterItem { stateId: number; stateName: string }
export interface VehicleTypeItem extends MasterItem { capacityInTons: number; tyreCount: number }
export interface DocumentTypeItem extends MasterItem { applicableFor: 'VEHICLE' | 'DRIVER' | 'BOTH'; applicableRoles: string[] | null; allowMultiple: boolean }
export interface TaxItem extends MasterItem { rate: number; taxType: string }

// Vehicle status type enum
export type VehicleStatusType = 'AVAILABLE' | 'ASSIGNED' | 'ON_TRIP' | 'IN_REPAIR' | 'BREAKDOWN' | 'OTHER'

// Global vehicle status (no tenantId)
export interface VehicleStatusItem extends MasterItem {
  statusType: VehicleStatusType
  createdAt?: string; updatedAt?: string
}

// Tenant masters
export interface TenantMasterItem extends MasterItem {
  tenantId?: number
  description?: string
  createdAt?: string; updatedAt?: string
}
export interface DesignationItem extends TenantMasterItem { roleType: string; payPerDay?: number }
export interface RouteItem extends TenantMasterItem {
  sourceCityId: number; sourceCityName: string
  destinationCityId: number; destinationCityName: string
  distanceInKm?: number; estimatedHours?: number
}
export interface PaymentTermsItem extends TenantMasterItem { creditDays: number }
export interface TenantSettings {
  id: number; tenantId: number
  payCycle: string
  overtimeThresholdHours: number
  overtimeRateMultiplier: number
  maxAdvanceAmount: number
  maxAdvanceDeductionPerCycle: number
  isTripBonusEnabled: boolean
  tripBonusAmount: number
  driverBattaRate: number
  cleanerBattaRate: number
  tripMamuluAmount: number
  isActive: boolean
}

// ─── Tenant Target ────────────────────────────────────────────────────────────
export interface TenantTarget {
  id?: number
  year: number
  month: number
  targetTrips?: number
  targetTons?: number
  completedTrips: number
  pendingTrips: number
  localTrips: number
  nonLocalTrips: number
  completedTons: number
  pendingTons: number
  localTons: number
  nonLocalTons: number
  tripsProgressPct?: number
  tonsProgressPct?: number
}

// ─── Trip Expenses ────────────────────────────────────────────────────────────
export type TripExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'SETTLED' | 'REJECTED'

export interface TripExpenseItem {
  id: number
  description: string
  amount: number
  approvedAmount?: number
  receiptUrl?: string
  amountChanged: boolean
}

export interface TripExpense {
  id: number
  lrId: number
  lrNumber: string
  driverName?: string
  cleanerName?: string
  advanceAmount: number
  tripDays: number
  driverBatta: number
  cleanerBatta: number
  tripMamulu: number
  totalFixedAmount: number
  totalOperationalAmount: number
  totalSubmittedAmount: number
  totalApprovedAmount: number
  balanceAmount: number
  status: TripExpenseStatus
  submittedByName?: string
  submittedAt?: string
  approvedByName?: string
  approvedAt?: string
  settlementAmount?: number
  settlementNote?: string
  settledByName?: string
  settledAt?: string
  rejectedByName?: string
  rejectedAt?: string
  rejectionReason?: string
  items: TripExpenseItem[]
  createdAt: string
}

// ─── Client ───────────────────────────────────────────────────────────────────
export type ClientCategory = 'COMPANY' | 'INDIVIDUAL'

export interface ClientDivision {
  id: number
  name: string
}

export interface Client {
  id: number; tenantId: number
  clientName: string; clientCategory: ClientCategory; clientTypeId: number; clientTypeName: string
  phone: string; email?: string; address?: string
  cityId?: number; cityName?: string; stateId?: number; stateName?: string; pincode?: string
  gstin?: string; panNumber?: string
  contactPersonName?: string; contactPersonPhone?: string; contactPersonEmail?: string
  paymentTermsId?: number; paymentTermsName?: string
  creditLimit?: number; openingBalance?: number
  isActive: boolean; createdAt: string; updatedAt: string
  divisions?: ClientDivision[]
}

// ─── Work Orders ──────────────────────────────────────────────────────────────
export type WorkOrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'INVOICED' | 'CANCELLED'
export type RateType = 'HOURLY' | 'DAILY_SHIFT' | 'MONTHLY'
export type OperatorType = 'OWN_STAFF' | 'HIRED' | 'CLIENT_PROVIDED'
export type OperatorBilling = 'INCLUDED_IN_RATE' | 'BILLED_SEPARATELY' | 'NOT_BILLED'
export type DailyLogStatus = 'WORKING' | 'BREAKDOWN' | 'NO_MACHINE' | 'IDLE'
export type AssignmentEndReason = 'COMPLETED' | 'BREAKDOWN_REPLACED' | 'BREAKDOWN_RETURNED'

export interface WorkOrder {
  id: number; tenantId: number; woNumber: string
  clientId: number; clientName: string; site?: string
  rateType: RateType; rateAmount: number
  shiftHours?: number; overtimeRatePerHour?: number
  operatorType?: OperatorType; operatorStaffId?: number; operatorStaffName?: string
  hiredOperatorName?: string; hiredOperatorPhone?: string
  operatorBilling: OperatorBilling; operatorRatePerDay?: number
  mobilizationCharge?: number; demobilizationCharge?: number
  startDate: string; endDate?: string
  status: WorkOrderStatus; parentWoId?: number; notes?: string
  machineCount: number; createdAt: string; updatedAt: string
}

export type WorkEntryStatus = 'ACTIVE' | 'COMPLETED'

export interface WorkEntry {
  id: number; machineAssignmentId: number; status: WorkEntryStatus
  serialNumber?: string; equipmentTypeName?: string; divisionName?: string
  operatorType?: OperatorType; operatorStaffId?: number; operatorStaffName?: string; hiredOperatorName?: string
  startTime: string; endTime?: string
  startMeter?: number; endMeter?: number; hoursWorked?: number; notes?: string
}

export interface MachineAssignment {
  id: number; workOrderId: number; equipmentId: number
  serialNumber?: string; equipmentTypeName: string; makeName?: string; modelName?: string
  startDate: string; endDate?: string; endReason?: AssignmentEndReason; isActive: boolean
  operatorType?: OperatorType; operatorStaffId?: number; operatorStaffName?: string
  hiredOperatorName?: string; hiredOperatorPhone?: string
  activeWorkEntry?: WorkEntry | null
  divisionId?: number | null; divisionName?: string | null
}

export interface DailyLog {
  id: number; machineAssignmentId: number; workOrderId: number
  logDate: string; status: DailyLogStatus
  startHourMeter?: number; endHourMeter?: number; hoursWorked?: number; fuelConsumed?: number; notes?: string
  serialNumber?: string; equipmentTypeName?: string
  divisionName?: string; source?: string
  createdAt: string; updatedAt: string
}

export interface BillingSummary {
  machineRentalAmount: number; operatorAmount: number
  mobilizationCharge: number; demobilizationCharge: number
  totalAmount: number; totalHours?: number; totalWorkingDays: number
}

export interface WorkOrderDetail {
  workOrder: WorkOrder
  assignments: MachineAssignment[]
  logs: DailyLog[]
  billing: BillingSummary
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────
export interface Vehicle {
  id: number; tenantId: number
  registrationNumber: string
  brandId?: number; brandName?: string; model?: string
  vehicleTypeId?: number; vehicleTypeName?: string
  fuelTypeId?: number; fuelTypeName?: string
  ownershipTypeId?: number; ownershipTypeName?: string
  currentStatusId?: number; currentStatusName?: string; currentStatusType?: VehicleStatusType
  capacityInTons?: number; grossVehicleWeight?: number; manufactureYear?: number; color?: string
  chassisNumber?: string; engineNumber?: string
  ownerName?: string; ownerPhone?: string; ownerPan?: string; ownerAddress?: string
  agreementStartDate?: string; agreementEndDate?: string; agreementAmount?: number
  gpsDeviceNumber?: string; gpsDeviceImei?: string; gpsProvider?: string
  currentOdometerReading?: number; fuelTankCapacity?: number; currentFuelLevel?: number; notes?: string
  tyreRotationIntervalKm?: number
  isFinanced?: boolean; financerName?: string; financeStartDate?: string; financeEndDate?: string; financeMonthsRemaining?: number
  extraPayEnabled?: boolean; extraPayPerDay?: number
  tripScope?: 'INTRA_STATE' | 'INTER_STATE'
  isIot?: boolean
  isActive: boolean; createdAt: string; updatedAt: string
  currentDriverId?: number; currentDriverName?: string
  currentCleanerId?: number; currentCleanerName?: string
  isAssigned?: boolean; assignedOrderId?: number; assignedOrderNumber?: string
  coverImageUrl?: string
}

export interface VehicleDocument {
  id: number; vehicleId: number; tenantId: number
  documentTypeId: number; documentTypeName?: string
  documentNumber?: string; issuerName?: string; permitType?: string
  issueDate?: string; expiryDate?: string
  fileUrl?: string; isVerified: boolean; remarks?: string
  cost?: number; paidOn?: string
  isActive: boolean; createdAt: string
}

export interface VehicleImage {
  id: number
  imageUrl: string
  caption?: string
  createdAt: string
}

// ─── Order ────────────────────────────────────────────────────────────────────
export type OrderStatus = 'PENDING'|'PARTIALLY_ASSIGNED'|'FULLY_ASSIGNED'|'IN_TRANSIT'|'PARTIALLY_DELIVERED'|'DELIVERED'|'CANCELLED'|'COMPLETED'
export type OrderPaymentStatus = 'UNPAID'|'ADVANCE_PAID'|'PARTIALLY_PAID'|'PAID'
export type FreightRateType = 'PER_TON'|'PER_TRIP'|'PER_KM'
export type BillingOn = 'LOADED_WEIGHT'|'DELIVERED_WEIGHT'

export interface Order {
  id: number; tenantId: number; orderNumber: string
  orderDate: string; expectedDeliveryDate?: string
  createdById: number; createdByName: string
  clientId: number; clientName: string
  materialTypeId: number; materialTypeName: string
  totalWeight: number; totalWeightFulfilled: number; remainingWeight?: number
  sourceAddress?: string; sourceCityId: number; sourceCityName: string; sourceStateId: number; sourceStateName: string
  destinationAddress?: string; destinationCityId: number; destinationCityName: string; destinationStateId: number; destinationStateName: string
  routeId?: number; routeName?: string
  freightRateType: FreightRateType; freightRate: number; billingOn: BillingOn
  totalFreightAmount?: number; orderStatus: OrderStatus; orderPaymentStatus: OrderPaymentStatus
  specialInstructions?: string; remarks?: string
  vehicleAllocations?: VehicleAllocation[]
  isActive: boolean; createdAt: string; updatedAt: string
}

export interface StaffAllocation {
  id: number
  userId: number; userName: string; roleName: string
  expectedStartDate?: string; expectedEndDate?: string
  actualStartDate?: string; actualEndDate?: string
  allocationStatus: string; remarks?: string
  allocatedById?: number; allocatedByName?: string
  createdAt: string
}

export interface VehicleAllocation {
  id: number; orderId: number; vehicleId: number
  registrationNumber: string
  vehicleRegistrationNumber?: string  // backend alias
  vehicleTypeName?: string
  allocatedWeight: number
  expectedLoadDate?: string; expectedDeliveryDate?: string
  actualLoadDate?: string; actualDeliveryDate?: string
  allocationStatus: string; remarks?: string
  allocatedById?: number; allocatedByName?: string
  createdAt?: string
  currentDriverId?: number; currentDriverName?: string; currentDriverPhone?: string
  currentCleanerId?: number; currentCleanerName?: string; currentCleanerPhone?: string
  staffAllocations?: StaffAllocation[]
}

export interface VehicleAssignmentHistory {
  id: number
  orderId: number; orderNumber: string
  vehicleId: number; vehicleRegistrationNumber: string
  allocatedWeight: number; allocationStatus: string
  assignedByName?: string; assignedAt?: string
  unassignedByName?: string; unassignedAt?: string
}

export interface StaffAssignmentHistory {
  id: number
  vehicleId: number; vehicleRegistrationNumber: string
  userId: number; userName: string; userRole: string
  assignedByName?: string; assignedAt?: string
  unassignedByName?: string; unassignedAt?: string
}

// ─── Breakdown ────────────────────────────────────────────────────────────────
export type BreakdownStatus   = 'REPORTED' | 'IN_REPAIR' | 'RESOLVED' | 'VEHICLE_REPLACED'
export type BreakdownType     = 'MECHANICAL' | 'TYRE' | 'ENGINE' | 'ELECTRICAL' | 'ACCIDENT' | 'OTHER'
export type BreakdownDuration = 'SHORT' | 'LONG'

export interface Breakdown {
  id: number
  vehicleId: number
  vehicleRegistrationNumber: string
  vehicleAllocationId?: number
  orderId?: number
  orderNumber?: string
  breakdownDate: string
  location?: string
  breakdownType: BreakdownType
  breakdownDuration: BreakdownDuration
  reason: string
  status: BreakdownStatus
  replacementVehicleAllocationId?: number
  replacementVehicleRegistrationNumber?: string
  resolvedAt?: string
  reportedById: number
  reportedByName: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ─── LR ───────────────────────────────────────────────────────────────────────
export type LrStatus = 'CREATED'|'WEIGHT_LOADED'|'IN_TRANSIT'|'DELIVERED'|'CANCELLED'

export interface Lr {
  id: number; tenantId: number; lrNumber: string
  orderId: number; orderNumber: string
  vehicleAllocationId: number
  vehicleId?: number; vehicleRegistrationNumber: string; vehicleTypeName?: string
  clientId?: number; clientName?: string
  fromCity?: string; fromState?: string; toCity?: string; toState?: string
  lrDate: string; vehicleCapacity: number; allocatedWeight: number
  loadedWeight?: number; deliveredWeight?: number
  overloadWeight?: number; weightVariance?: number; isOverloaded?: boolean
  loadedAt?: string; deliveredAt?: string
  ewayBillNumber?: string; ewayBillDate?: string; ewayBillValidUpto?: string
  lrStatus: LrStatus; remarks?: string
  invoiceId?: number; invoiceNumber?: string
  checkposts?: LrCheckpost[]; charges?: LrCharge[]
  createdById: number; createdByName: string
  driverId?: number; driverName?: string; driverPhone?: string
  startedByName?: string; startedByRole?: string
  completedByName?: string; completedByRole?: string
  startOdometer?: number; endOdometer?: number
  isActive: boolean; createdAt: string; updatedAt: string
}

export interface LrCharge {
  id: number; chargeTypeId: number; chargeTypeName: string
  amount: number; remarks?: string; isActive: boolean
}
export interface LrCheckpost {
  id: number; checkpostName: string; location?: string
  fineAmount?: number; fineReceiptNumber?: string; finePaidAt?: string
  remarks?: string; isActive: boolean
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'DRAFT'|'SENT'|'PARTIALLY_PAID'|'PAID'|'OVERDUE'|'CANCELLED'
export type PaymentMode = 'CASH'|'CHEQUE'|'NEFT'|'UPI'|'RTGS'|'OTHER'

export interface InvoiceLrItem {
  id: number
  lrId: number; lrNumber: string; lrDate?: string
  orderId: number; orderNumber: string
  vehicleRegistrationNumber: string
  billingWeight?: number; freightRateType?: string; freightRate?: number
  freightAmount: number; chargesAmount: number; checkpostFineAmount: number; totalAmount: number
  remarks?: string; createdAt: string
}

export interface Invoice {
  id: number; tenantId: number; invoiceNumber: string
  clientId: number; clientName: string
  invoiceDate: string; dueDate?: string
  subtotal: number
  cgstPercentage: number; sgstPercentage: number; igstPercentage: number
  cgstAmount: number; sgstAmount: number; igstAmount: number
  taxAmount: number; totalAmount: number
  advanceAdjusted: number; creditNoteAdjusted: number
  amountPaid: number; balanceDue: number
  invoiceStatus: InvoiceStatus; remarks?: string
  // Tenant (for print)
  tenantCompanyName?: string; tenantLogoUrl?: string; tenantGstin?: string; tenantPan?: string
  tenantAddress?: string; tenantCity?: string; tenantState?: string; tenantPincode?: string
  tenantBankName?: string; tenantAccountNumber?: string; tenantIfscCode?: string
  tenantBranchName?: string; tenantAccountHolderName?: string; transportHsnSac?: string
  tenantInvoiceDescription?: string
  // Client (for print)
  clientGstin?: string; clientAddress?: string; clientCity?: string
  clientState?: string; clientPincode?: string
  lrItems?: InvoiceLrItem[]
  payments?: InvoicePayment[]
  createdById: number; createdByName: string
  isActive: boolean; createdAt: string; updatedAt: string
}

export interface InvoicePayment {
  id: number; invoiceId?: number
  paymentDate: string; amount: number; paymentMode: PaymentMode
  paymentModeLabel?: string
  referenceNumber?: string; remarks?: string
  createdById: number; createdByName: string
  isActive?: boolean; createdAt: string
}

// ─── Staff ────────────────────────────────────────────────────────────────────
export interface StaffProfile {
  userId: number; tenantId: number; userName: string; userPhone: string; roleName: string
  designationId?: number; designationName?: string; designationPayPerDay?: number
  employmentTypeId?: number; employmentTypeName?: string
  dateOfBirth?: string; joiningDate?: string
  address?: string; cityId?: number; cityName?: string; stateId?: number; stateName?: string; pincode?: string
  emergencyContactName?: string; emergencyContactPhone?: string
  bankName?: string; accountNumber?: string; ifscCode?: string; accountHolderName?: string
  licenseNumber?: string; licenseExpiryDate?: string
  profilePhotoUrl?: string
  salaryType?: 'DAILY' | 'MONTHLY'; monthlySalary?: number
  canAccessVehicles?: boolean
  canAccessEquipment?: boolean
  isActive: boolean
  createdAt: string; updatedAt: string
}

export interface StaffDocument {
  id: number; userId: number; documentTypeId: number; documentTypeName: string
  documentNumber?: string; issueDate?: string; expiryDate?: string
  fileUrl?: string; isVerified: boolean; remarks?: string; isActive: boolean
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export type AttendanceApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Attendance {
  id: number; userId: number; userName: string; userPhone: string; roleName: string
  attendanceDate: string; attendanceTypeId: number; attendanceTypeName: string
  leaveTypeId?: number; leaveTypeName?: string; leaveReason?: string
  markedById: number; markedByName: string; markedAt: string
  markedOutAt?: string; dutyLabel?: string; dutyHours?: number
  remarks?: string; selfieUrl?: string
  locationName?: string; latitude?: number | null; longitude?: number | null
  assignedVehicleNumber?: string
  approvalStatus: AttendanceApprovalStatus
  approvedById?: number; approvedByName?: string; approvedAt?: string
  createdAt: string; updatedAt: string
}

// ─── Payroll ──────────────────────────────────────────────────────────────────
export type PayrollStatus = 'DRAFT'|'APPROVED'|'PAID'|'CANCELLED'

export interface SalaryAdvance {
  id: number; userId: number; userName: string
  advanceDate: string; amount: number; reason?: string
  totalRepaid: number; balanceAmount: number; isFullyRepaid: boolean
  approvedById: number; approvedByName: string; approvedAt: string
  remarks?: string; isActive: boolean; createdAt: string
}

export interface Payroll {
  id: number; userId: number; userName: string; userPhone: string; roleName: string; designationName?: string
  payCycleStartDate: string; payCycleEndDate: string
  totalDays: number; presentDays: number; absentDays: number; halfDays: number; leaveDays: number
  overtimeHours: number; salaryType?: 'DAILY' | 'MONTHLY'; dailyRate?: number; monthlySalary?: number
  basicPay: number; overtimePay: number; tripBonus: number; vehicleExtraPay?: number
  grossPay: number; totalDeductions: number; netPay: number
  deductions: PayrollDeduction[]
  paymentDate?: string; paymentMode?: PaymentMode; referenceNumber?: string
  payrollStatus: PayrollStatus
  approvedById?: number; approvedByName?: string; approvedAt?: string
  remarks?: string; isActive: boolean; createdAt: string; updatedAt: string
}

export interface PayrollDeduction {
  id: number; deductionTypeId: number; deductionTypeName: string
  amount: number; salaryAdvanceId?: number; remarks?: string
}

export interface BulkPayrollResult {
  totalRequested: number
  successCount: number
  failedCount: number
  succeeded: Payroll[]
  failed: { userId: number; userName: string; reason: string }[]
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardResponse {
  orders: {
    total: number; pending: number; partiallyAssigned: number; fullyAssigned: number
    inTransit: number; partiallyDelivered: number; delivered: number; cancelled: number
  }
  vehicles: {
    total: number; available: number; assigned: number; onTrip: number
    underMaintenance: number; breakdown: number; inactive: number
  }
  invoices: {
    draft: number; sent: number; partiallyPaid: number; overdue: number; paid: number
    totalOutstanding: number; totalRevenue: number
  }
  todayAttendance: {
    date: string; present: number; absent: number; halfDay: number; onLeave: number; total: number
  }
}

export interface SupervisorDashboardResponse {
  orders:    { total: number; pending: number; active: number; completed: number; delivered: number; cancelled: number }
  vehicles:  { total: number; available: number; onTrip: number; breakdown: number; inactive: number }
  drivers:   { total: number; available: number; onTrip: number; todayPresent: number }
  cleaners:  { total: number; available: number; onTrip: number; todayPresent: number }
  lrs:       { total: number; created: number; loaded: number; inTransit: number; delivered: number; cancelled: number }
  attendance: { total: number; present: number; absent: number; halfDay: number; weeklyOff: number }
  unreadNotifications: number
}

export interface ExpiryAlertResponse {
  vehicleAlerts: VehicleAlert[]
  staffDocumentAlerts: StaffDocumentAlert[]
  totalAlerts: number
}
export interface VehicleAlert {
  vehicleId: number; registrationNumber: string
  alertType: string; documentName?: string
  expiryDate: string; daysLeft: number; expired: boolean
}
export interface StaffDocumentAlert {
  userId: number; userName: string
  documentType: string; documentNumber?: string
  expiryDate: string; daysLeft: number; expired: boolean
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export interface LrRegisterRow {
  lrId: number; lrNumber: string; lrDate: string
  orderNumber: string; clientName: string
  vehicleRegistrationNumber: string
  driverName: string; cleanerName: string
  fromCity: string; fromState: string; toCity: string; toState: string
  materialType: string
  allocatedWeight?: number; loadedWeight?: number; deliveredWeight?: number
  weightVariance?: number; isOverloaded?: boolean
  loadedAt?: string; deliveredAt?: string
  ewayBillNumber?: string; ewayBillDate?: string; ewayBillValidUpto?: string
  lrStatus: string; remarks?: string
}
export interface InvoiceOutstandingRow {
  invoiceId: number; invoiceNumber: string
  invoiceDate: string; dueDate?: string
  clientId: number; clientName: string
  totalAmount: number; amountPaid: number; balanceDue: number
  invoiceStatus: string; daysOverdue: number
}
export interface PayrollSummaryRow {
  payrollId: number; userId: number; userName: string; userPhone: string; roleName: string
  payCycleStartDate: string; payCycleEndDate: string
  totalDays: number; presentDays: number; absentDays: number; halfDays: number; leaveDays: number
  dailyRate: number; basicPay: number; overtimePay: number; tripBonus: number
  grossPay: number; totalDeductions: number; netPay: number; payrollStatus: string
}
export interface CollectionReportRow {
  paymentId: number; paymentDate: string; amount: number
  paymentMode: string; referenceNumber?: string; remarks?: string
  invoiceId: number; invoiceNumber: string; clientId: number; clientName: string
}
export interface ClientStatementRow {
  type: 'INVOICE' | 'PAYMENT'; date: string; referenceNumber?: string
  description: string; debit: number; credit: number; balance: number
}
export interface ClientStatementResponse {
  clientId: number; clientName: string; clientPhone?: string; gstin?: string
  totalInvoiced: number; totalPaid: number; closingBalance: number
  rows: ClientStatementRow[]
}
export interface VehicleTripRow {
  vehicleId: number; registrationNumber: string; vehicleType?: string; brand?: string
  totalTrips: number; totalAllocatedWeight: number; totalLoadedWeight: number; totalDeliveredWeight: number
}
export interface OrderStatusRow {
  orderId: number; orderNumber: string; orderDate: string; expectedDeliveryDate?: string
  clientId: number; clientName: string
  fromCity: string; fromState: string; toCity: string; toState: string
  materialType: string; totalWeight: number; totalFreightAmount?: number
  orderStatus: string; orderPaymentStatus: string
}
export interface AttendanceReportRow {
  userId: number; userName: string; userPhone: string; roleName: string
  totalDays: number; presentDays: number; absentDays: number; halfDays: number; leaveDays: number
  attendancePercentage: number
}
export interface TenantTargetResponse {
  id?: number; year: number; month: number
  targetTrips?: number; targetTons?: number
  actualTrips: number; actualTons: number
  tripsProgressPct?: number; tonsProgressPct?: number
}

// ─── Daily Ops Reports ────────────────────────────────────────────────────────
export interface VehicleActivityRow {
  vehicleId: number; registrationNumber: string; vehicleType?: string
  clientName?: string; fromCity?: string; toCity?: string
  lrNumber?: string; loadedAt?: string; deliveredAt?: string
}
export interface DailyVehicleActivityResponse {
  onRoadCount: number; startedTodayCount: number; deliveredTodayCount: number; idleCount: number
  onRoad: VehicleActivityRow[]; startedToday: VehicleActivityRow[]
  deliveredToday: VehicleActivityRow[]; idle: VehicleActivityRow[]
}
export interface LocalLongTripRow {
  tripType: string; lrNumber: string; registrationNumber: string
  clientName: string; fromCity: string; fromState: string; toCity: string; toState: string
}
export interface LocalLongTripSummaryResponse {
  localCount: number; longDistanceCount: number; totalToday: number
  trips: LocalLongTripRow[]
}
export interface IdleDriverResponse {
  userId: number; userName: string; phone: string; roleName?: string
}
export interface DocumentExpiryAlertResponse {
  vehicleId: number; registrationNumber: string; documentType: string
  documentNumber?: string; expiryDate: string; daysUntilExpiry: number; expired: boolean
}
export interface TodayAttendanceRow {
  userId: number; userName: string; phone: string; roleName?: string; attendanceStatus: string
}
export interface TodayAttendanceSummaryResponse {
  presentCount: number; absentCount: number; leaveCount: number; notMarkedCount: number; totalStaff: number
  records: TodayAttendanceRow[]
}
export interface DelayedTripResponse {
  lrId: number; lrNumber: string; registrationNumber: string
  clientName: string; fromCity: string; toCity: string
  expectedDeliveryDate: string; daysDelayed: number; loadedAt?: string
}
export interface OrdersBacklogResponse {
  orderId: number; orderNumber: string; orderDate: string
  clientName: string; fromCity: string; toCity: string
  materialType: string; totalWeight: number; orderStatus: string; daysWaiting: number
}

// ─── Section C — Orders & Assignments ────────────────────────────────────────
export interface OrderFulfillmentRateResponse {
  totalOrders: number; pending: number; partiallyAssigned: number; fullyAssigned: number
  inTransit: number; delivered: number; completed: number; cancelled: number; fulfillmentRate: number
}
export interface OrderLeadTimeResponse {
  fromCity: string; toCity: string; orderCount: number
  avgLeadTimeDays: number; minLeadTimeDays: number; maxLeadTimeDays: number
}
export interface UnassignedVehiclesResponse {
  orderId: number; orderNumber: string; orderDate: string
  clientName: string; fromCity: string; toCity: string
  materialType: string; totalWeight: number; vehiclesAssigned: number; orderStatus: string; daysWaiting: number
}
export interface DriverAssignmentHistoryResponse {
  allocationId: number; driverName: string; driverPhone: string; roleName?: string
  registrationNumber: string; orderNumber: string; clientName: string
  fromCity: string; toCity: string
  expectedStartDate?: string; expectedEndDate?: string; allocationStatus: string
}

// ─── Section D — Trips & LRs ─────────────────────────────────────────────────
export interface TripInProgressResponse {
  lrId: number; lrNumber: string; registrationNumber: string
  clientName: string; fromCity: string; toCity: string
  loadedAt?: string; expectedDeliveryDate?: string; daysInTransit: number; loadedWeight?: number
}
export interface LrStatusFunnelResponse {
  created: number; inTransit: number; delivered: number; cancelled: number; total: number
}
export interface UnbilledLrResponse {
  lrId: number; lrNumber: string; registrationNumber: string
  clientName: string; fromCity: string; toCity: string
  deliveredAt?: string; deliveredWeight?: number; daysSinceDelivery: number
}
export interface InvoiceTurnaroundResponse {
  clientName: string; lrCount: number; avgTurnaroundDays: number; maxTurnaroundDays: number
}
export interface TripDurationResponse {
  fromCity: string; toCity: string; tripCount: number
  avgDurationHours: number; minDurationHours: number; maxDurationHours: number
}
export interface WeightVarianceReportResponse {
  clientId: number; clientName: string; lrCount: number
  totalLoadedWeight: number; totalDeliveredWeight: number; totalVariance: number; avgVariancePct: number
}
export interface OverloadingIncidentResponse {
  lrId: number; lrNumber: string; registrationNumber: string
  clientName: string; fromCity: string; toCity: string
  lrDate: string; allocatedWeight: number; loadedWeight: number; overloadWeight: number
}

// ─── Section E — Vehicle Performance ──────────────────────────────────────────
export interface VehicleRevenueResponse {
  vehicleId: number; registrationNumber: string; vehicleType?: string
  tripCount: number; totalLoadedTons: number; estimatedRevenue: number
}
export interface VehicleIdleDaysResponse {
  vehicleId: number; registrationNumber: string; vehicleType?: string
  totalDays: number; activeDays: number; idleDays: number; idlePct: number
}
export interface VehicleTripCountResponse {
  vehicleId: number; registrationNumber: string; vehicleType?: string
  tripCount: number; totalLoadedTons: number; totalDeliveredTons: number
}
export interface BreakdownFrequencyResponse {
  vehicleId: number; registrationNumber: string; vehicleType?: string
  breakdownCount: number; breakdownTypes: string[]; lastBreakdownDate?: string
}
export interface VehicleServiceCostResponse {
  vehicleId: number; registrationNumber: string; vehicleType?: string
  serviceCount: number; totalServiceCost: number; lastServiceDate?: string
}

// ─── Section F — Driver & Staff Performance ────────────────────────────────────
export interface DriverPerformanceResponse {
  userId: number; driverName: string; phone: string; roleName?: string
  tripCount: number; totalLoadedTons: number; totalDeliveredTons: number
}
export interface AttendanceGapsResponse {
  userId: number; userName: string; roleName?: string
  totalGapDays: number; gapDates: string[]
}
export interface AttendanceTrendResponse {
  date: string; presentCount: number; absentCount: number
  leaveCount: number; notMarkedCount: number; totalStaff: number
}
export interface AttendanceCalendarResponse {
  year: number; month: number; daysInMonth: number
  users: {
    userId: number; userName: string; roleName?: string
    dailyStatus: Record<number, string>  // day (1-31) -> status
  }[]
}

// ─── Section G — Financial Intelligence ───────────────────────────────────────
export interface InvoiceAgingRow {
  invoiceId: number; invoiceNumber: string; clientName: string
  invoiceDate: string; balanceDue: number; ageInDays: number
}
export interface AgingBucket { count: number; amount: number; invoices: InvoiceAgingRow[] }
export interface InvoiceAgingResponse {
  totalOutstanding: number; totalAmount: number
  bucket0to30: AgingBucket; bucket31to60: AgingBucket
  bucket61to90: AgingBucket; bucket90plus: AgingBucket
}
export interface RevenueTrendResponse {
  period: string; year: number; month: number; invoiceCount: number
  subtotal: number; taxAmount: number; totalRevenue: number
}
export interface RouteProfitabilityResponse {
  fromCity: string; toCity: string; tripCount: number
  totalRevenue: number; totalCharges: number; netProfit: number; profitMarginPct: number
}
export interface GstSummaryResponse {
  period: string; year: number; month: number; invoiceCount: number
  subtotal: number; cgstAmount: number; sgstAmount: number; totalTax: number; totalAmount: number
}
export interface CreditNoteSummaryResponse {
  creditNoteId: number; creditNoteNumber: string; clientName: string
  creditNoteDate: string; amount: number; reason: string; status: string; invoiceNumber?: string
}
export interface ClientPendingBillingResponse {
  clientId: number; clientName: string; pendingLrCount: number
  totalDeliveredTons: number; oldestDeliveryDate?: string; daysPending: number
}

// ─── Section H — Monthly Business Intelligence ─────────────────────────────────
export interface TopClientResponse {
  clientId: number; clientName: string
  orderCount: number; tripCount: number; totalTonnage: number; totalRevenue: number
}
export interface TopMaterialResponse {
  materialType: string; orderCount: number; totalWeight: number; pct: number
}
export interface TopRouteResponse {
  fromCity: string; toCity: string; orderCount: number; totalWeight: number
}
export interface OnTimeDeliveryResponse {
  totalDelivered: number; onTime: number; delayed: number; onTimeRate: number
}
export interface OrderCancellationRateResponse {
  totalOrders: number; cancelled: number; active: number; cancellationRate: number
}

// ─── Section I — Inventory Reports ───────────────────────────────────────────
export interface StockLevelResponse {
  partId: number; partName: string; partNumber: string; category: string; unit: string
  currentStock: number; minStockLevel: number; isLowStock: boolean
}
export interface StockMovementResponse {
  transactionId: number; date: string; partId: number; partName: string
  partNumber: string; category: string; transactionType: string
  quantity: number; unitCost: number; totalCost: number; supplierName: string; notes: string
}
export interface VehiclePartConsumptionResponse {
  vehicleId: number; regNo: string; vehicleType: string
  partName: string; partNumber: string; category: string; totalQuantity: number
}
export interface PartConsumptionByTypeResponse {
  partId: number; partName: string; partNumber: string; category: string; unit: string
  totalQuantity: number; serviceCount: number
}
export interface ServiceCostBreakdownResponse {
  serviceId: number; vehicleId: number; regNo: string; vehicleType: string
  serviceDate: string; serviceType: string; status: string; totalCost: number; partsUsedCount: number
}

// ─── Section J — Tyre Reports ─────────────────────────────────────────────────
export interface TyreFittingItem {
  fittingId: number; tyreId: number; serialNumber: string; brand: string; size: string
  tyreType: string; positionCode: string; fittedDate: string; fittedAtKm: number; kmDriven: number
}
export interface TyresByVehicleResponse {
  vehicleId: number; regNo: string; vehicleType: string; activeTyreCount: number
  tyres: TyreFittingItem[]
}
export interface KmPerTyreResponse {
  fittingId: number; tyreId: number; serialNumber: string; brand: string; size: string
  tyreType: string; vehicleId: number; vehicleRegNo: string; positionCode: string
  fittedDate: string; fittedAtKm: number; removedAtKm: number; kmDriven: number; active: boolean
}
export interface TyreReplacementProjectionResponse {
  tyreId: number; serialNumber: string; brand: string; size: string
  vehicleId: number; vehicleRegNo: string; positionCode: string; fittedDate: string
  totalLifetimeKm: number; maxLifetimeKm: number; remainingKm: number; urgency: string
}
export interface TyreCostPerKmResponse {
  tyreId: number; serialNumber: string; brand: string; size: string; tyreType: string
  purchaseCost: number; totalLifetimeKm: number; costPerKm: number
}

// ─── Tenant ───────────────────────────────────────────────────────────────────
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'RENEWED'

export interface TenantDocument {
  id: number
  documentName: string
  originalFileName: string
  s3Key: string
  fileUrl: string
  createdAt: string
}

export interface Tenant {
  id: number
  companyName: string; email: string; phone: string
  address?: string; city?: string; state?: string; pincode?: string
  gstin?: string; panNumber?: string; tanNumber?: string; cinNumber?: string; transportLicenseNumber?: string
  bankName?: string; accountNumber?: string; ifscCode?: string; branchName?: string; accountHolderName?: string
  ownerName: string; ownerPhone: string; ownerEmail?: string
  prefix?: string; logoUrl?: string; totalSlotsCount?: number
  moduleType?: ModuleType
  subscriptionStatus: SubscriptionStatus
  trialStartDate?: string; trialEndDate?: string
  subscriptionStartDate?: string; subscriptionEndDate?: string
  isActive: boolean; createdAt: string; updatedAt: string
  // Subscription overview (SA views)
  currentPlanName?: string
  currentVehicleCount?: number
  currentPricePerVehicle?: number
  currentBillingCycle?: string
  customUserLimit?: number
  effectiveUserLimit?: number
  activeUserCount?: number
}

// ─── Subscription ─────────────────────────────────────────────────────────────
export interface SubscriptionPlan {
  id: number
  name: string
  pricePerVehicle?: number
  minVehicles?: number
  maxVehicles?: number
  maxLorries: number
  maxUsers: number
  priceMonthly: number
  priceYearly: number
  hasFuelLogs?: boolean
  hasMeterReadings?: boolean
  hasVehicleServices?: boolean
  hasAttendance?: boolean
  hasPayroll?: boolean
  hasInventory?: boolean
  hasReports?: boolean
  hasCreditNotes?: boolean
  features?: string
  isActive: boolean
}

export interface SubscriptionHistory {
  id: number
  tenantId: number
  companyName: string
  planId?: number
  planName: string
  vehicleCount?: number
  pricePerVehicle?: number
  maxLorries?: number
  maxUsers?: number
  hasFuelLogs?: boolean
  hasMeterReadings?: boolean
  hasVehicleServices?: boolean
  hasAttendance?: boolean
  hasPayroll?: boolean
  hasInventory?: boolean
  hasReports?: boolean
  hasCreditNotes?: boolean
  status: SubscriptionStatus
  billingCycle?: string
  startDate: string
  endDate?: string
  amount?: number
  gstAmount?: number
  totalAmount?: number
  paymentRef?: string
  notes?: string
  createdAt: string
}

export interface SubscriptionInvoice {
  id: number
  invoiceNumber: string
  tenantId: number
  companyName: string
  planName?: string
  billingCycle?: string
  vehicleCount?: number
  pricePerVehicle?: number
  periodStart?: string
  periodEnd?: string
  amount?: number
  gstAmount?: number
  totalAmount?: number
  paymentRef?: string
  createdAt: string
  tenantAddress?: string
  tenantCity?: string
  tenantState?: string
  tenantPincode?: string
  tenantGstin?: string
}

export interface UpgradeRequest {
  id: number
  tenantId: number
  companyName: string
  planId?: number
  planName?: string
  pricePerVehicle?: number
  vehicleCount?: number
  billingCycle?: string
  estimatedBase?: number
  estimatedTotal?: number
  notes?: string
  status: 'PENDING' | 'FULFILLED' | 'DISMISSED'
  createdAt: string
}

// ─── Notification ─────────────────────────────────────────────────────────────
export interface Notification {
  id: number
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

// ─── Vehicle Service ──────────────────────────────────────────────────────────
export type ServiceTriggeredBy = 'SCHEDULED' | 'BREAKDOWN' | 'ACCIDENT' | 'COMPLIANCE' | 'WARRANTY'
export type VehicleServiceType = 'INTERNAL' | 'THIRD_PARTY' | 'OEM_CENTER'
export type ServicePayerType = 'OWN_EXPENSE' | 'WARRANTY_OEM' | 'WARRANTY_ANC' | 'INSURANCE' | 'AMC'
export type ServiceStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
export type ServiceDisplayStatus = 'OPEN' | 'IN_PROGRESS' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED'
export type ServiceTaskStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'MECHANIC_CLOSED' | 'COMPLETED'

export interface VehicleServiceTask {
  id: number
  taskTypeId?: number
  taskTypeName?: string
  customName?: string
  displayName: string
  isRecurring: boolean
  frequencyKm?: number
  cost?: number
  status: ServiceTaskStatus
  assignedMechanicId?: number
  assignedMechanicName?: string
  mechanicStartedAt?: string
  mechanicClosedAt?: string
}

export interface VehicleServiceRecord {
  id: number
  tenantId: number
  vehicleId: number
  vehicleRegistrationNumber: string
  serviceNumber: string
  triggeredBy: ServiceTriggeredBy
  breakdownId?: number
  serviceType: VehicleServiceType
  payerType?: ServicePayerType
  vendorName?: string
  location?: string
  status: ServiceStatus
  displayStatus: ServiceDisplayStatus
  dueAtOdometer?: number
  serviceDate?: string
  completedDate?: string
  odometer?: number
  notes?: string
  totalCost?: number
  insuranceClaimNo?: string
  insuranceClaimAmt?: number
  certificateNumber?: string
  certificateValidUntil?: string
  isEscalated?: boolean
  tasks: VehicleServiceTask[]
  startedAt?: string
  createdAt: string
  updatedAt: string
  invoiceId?: number
  invoiceNumber?: string
}

// ─── Service Invoice ──────────────────────────────────────────────────────────
export type ServiceInvoiceType   = 'INTERNAL' | 'EXTERNAL'
export type ServiceInvoiceStatus = 'PENDING'  | 'PAID'

export interface ServiceInvoiceTaskLine {
  name: string
  cost: number
}

export interface ServiceInvoicePartLine {
  partName:   string
  partNumber: string
  unit:       string
  quantity:   number
  unitCost?:  number
  totalCost?: number
}

export interface ServiceInvoice {
  id:            number
  invoiceNumber: string
  invoiceType:   ServiceInvoiceType
  paymentStatus: ServiceInvoiceStatus
  serviceId:                 number
  serviceNumber:             string
  vehicleRegistrationNumber: string
  serviceType:               VehicleServiceType
  vendorName?:               string
  completedDate?:            string
  tasksTotal?:       number
  partsTotal?:       number
  labourCharges?:    number
  subTotal?:         number
  gstRate?:          number
  gstAmount?:        number
  totalAmount?:      number
  vendorAmount?:     number
  vendorInvoiceNo?:  string
  paidAt?:           string
  paidByName?:       string
  tasks: ServiceInvoiceTaskLine[]
  parts: ServiceInvoicePartLine[]
  createdAt: string
}

// ─── Credit Note ──────────────────────────────────────────────────────────────
export type CreditNoteStatus = 'DRAFT' | 'APPROVED' | 'ADJUSTED' | 'CANCELLED'

export interface CreditNote {
  id: number
  tenantId: number
  creditNoteNumber: string
  invoiceId?: number
  invoiceNumber?: string
  clientId: number
  clientName: string
  creditNoteDate: string
  amount: number
  reason: string
  creditNoteStatus: CreditNoteStatus
  remarks?: string
  createdById: number
  createdByName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Client Advance ───────────────────────────────────────────────────────────
export interface ClientAdvance {
  id: number
  tenantId: number
  clientId: number
  clientName: string
  receivedDate: string
  amount: number
  paymentMode: PaymentMode
  referenceNumber?: string
  isAdjusted: boolean
  adjustedAmount: number
  pendingAmount: number
  adjustedInvoiceId?: number
  adjustedInvoiceNumber?: string
  adjustedAt?: string
  remarks?: string
  createdById: number
  createdByName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Bulk Upload ──────────────────────────────────────────────────────────────
export interface BulkUploadResult {
  totalRows: number
  successCount: number
  failureCount: number
  errors: string[]
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: number; tenantId: number; name: string; phone: string
  roles: string[]; isActive: boolean; isPinResetRequired: boolean
  createdAt: string; updatedAt: string
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export interface SparePart {
  id: number; tenantId: number
  name: string; partNumber?: string; category?: string; unit: string
  minStockLevel: number; isActive: boolean
  createdAt: string; updatedAt: string
}

export interface StockItem {
  inventoryId: number; sparePartId: number
  partName: string; partNumber?: string; category?: string; unit: string
  quantity: number; minStockLevel: number; isLowStock: boolean
  lastUnitCost?: number
}

export type ServicePartStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED'
export type StockTransactionType = 'IN' | 'OUT' | 'DAMAGE'
export type StockReferenceType = 'PURCHASE' | 'SERVICE' | 'DAMAGE' | 'ADJUSTMENT'

export interface ServicePart {
  id: number; serviceId: number; serviceNumber: string; vehicleRegistrationNumber: string
  sparePartId: number; partName: string; partNumber?: string; unit: string
  quantityRequested: number; quantityApproved?: number
  status: ServicePartStatus; rejectionReason?: string
  requestedById: number; requestedByName: string
  approvedById?: number; approvedByName?: string
  approvedAt?: string; createdAt: string
  taskId?: number; taskDisplayName?: string
}

// ─── Service Manager ──────────────────────────────────────────────────────────
export interface TechnicianSummary {
  id: number
  name: string
  designation?: string
}

export interface SmPartItem {
  partId: number
  partName: string
  partNumber?: string
  quantityRequested: number
  quantityApproved?: number
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED'
}

export interface SmTaskItem {
  taskId: number
  displayName: string
  status: ServiceTaskStatus
  assignedMechanicId?: number
  assignedMechanicName?: string
  mechanicStartedAt?: string
  mechanicClosedAt?: string
  parts?: SmPartItem[]
}

export interface SmServiceItem {
  serviceId: number
  serviceNumber: string
  vehicleId: number
  vehicleRegistrationNumber: string
  serviceStatus: ServiceStatus
  serviceType: VehicleServiceType
  tasks: SmTaskItem[]
}

export interface SmBreakdownItem {
  breakdownId: number
  vehicleId: number
  vehicleRegistrationNumber: string
  breakdownDate: string
  location?: string
  breakdownType: BreakdownType
  status: BreakdownStatus
  service?: SmServiceItem
}

export interface ServiceManagerDashboard {
  breakdowns: SmBreakdownItem[]
  generalServices: SmServiceItem[]
}

export interface SparePartsTransaction {
  id: number; sparePartId: number; partName: string; unit: string
  transactionType: StockTransactionType; quantity: number
  unitCost?: number; totalCost?: number
  referenceType: StockReferenceType
  servicePartId?: number; serviceNumber?: string; vehicleRegistrationNumber?: string
  supplierName?: string; notes?: string
  createdById: number; createdByName: string; createdAt: string
}


// ─── Fuel Logs ────────────────────────────────────────────────────────────────
export type FuelPaymentMode = 'CASH' | 'COMPANY_ACCOUNT' | 'REIMBURSEMENT'

export interface FuelLog {
  id: number
  tenantId: number
  vehicleId: number
  vehicleRegistrationNumber: string
  orderId?: number
  orderNumber?: string
  filledById: number
  filledByName: string
  fillDate: string
  litresFilled: number
  odometerReading: number
  costPerLitre: number
  totalCost: number
  isFullTank: boolean
  paymentMode: FuelPaymentMode
  fuelStationName?: string
  fuelStationCity?: string
  receiptUrl?: string
  notes?: string
  mileageKmPerLitre?: number
  kmTravelled?: number
  createdAt: string
  updatedAt: string
}

// ─── Meter Readings ───────────────────────────────────────────────────────────
export type MeterReadingType = 'TRIP_START' | 'TRIP_END' | 'FUEL_FILL' | 'GENERAL'

export interface MeterReadingServiceAlert {
  serviceId: number
  serviceNumber?: string
  serviceType?: string
  dueAtOdometer: number
  status: 'DUE_SOON' | 'OVERDUE'
}

export interface MeterReading {
  id: number
  tenantId: number
  vehicleId: number
  vehicleRegistrationNumber: string
  readingKm: number
  readingType: MeterReadingType
  lrId?: number
  lrNumber?: string
  photoUrl?: string
  recordedById: number
  recordedByName: string
  recordedAt: string
  notes?: string
  createdAt: string
  serviceAlerts: MeterReadingServiceAlert[]
}

// ─── Tyres ────────────────────────────────────────────────────────────────────
export type TyreStatus = 'IN_STOCK' | 'FITTED' | 'RETREADING' | 'SCRAPPED' | 'DISPOSED'
export type TyreType = 'RADIAL' | 'BIAS' | 'TUBELESS' | 'TUBE_TYPE' | 'NYLON'
export type TyrePositionType = 'STEER' | 'DRIVE' | 'TRAILER' | 'SPARE'
export type TyreRemovalReason = 'ROTATION' | 'WORN' | 'PUNCTURE' | 'DAMAGE' | 'RETREAD' | 'SCRAP' | 'OTHER'
export type TyrePurchaseCondition = 'NEW' | 'SECOND_HAND' | 'RETREADED'

export interface Tyre {
  id: number
  tenantId: number
  serialNumber: string
  brand: string
  size: string
  tyreType: TyreType
  plyRating?: string
  purchaseDate?: string
  purchaseCost?: number
  status: TyreStatus
  retreadCount: number
  totalLifetimeKm: number
  notes?: string
  tyreLifeYears?: number
  expiryDate?: string
  maxLifetimeKm?: number
  retreaderName?: string
  expectedReturnDate?: string
  currentFittingId?: number
  currentVehicleRegistrationNumber?: string
  currentPositionCode?: string
  purchaseCondition?: TyrePurchaseCondition
  kmAtPurchase?: number
  totalRetreadingCost?: number
  scrapReason?: string
  scrapDate?: string
  supplierName?: string
  invoiceNumber?: string
  createdAt: string
  updatedAt: string
}

export interface TyreRetreadLog {
  id: number
  tyreId: number
  tyreSerialNumber: string
  retreadNumber: number
  sentDate?: string
  returnDate?: string
  retreaderName?: string
  kmAtSend?: number
  retreadingCost?: number
  newMaxLifetimeKm?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface TyrePosition {
  id: number
  tenantId: number
  vehicleId: number
  vehicleRegistrationNumber: string
  positionCode: string
  positionType: TyrePositionType
  displayOrder: number
  currentFitting?: TyreFitting
  createdAt: string
  updatedAt: string
}

export interface TyreFitting {
  id: number
  tenantId: number
  vehicleId: number
  vehicleRegistrationNumber: string
  tyreId: number
  tyreSerialNumber: string
  tyreBrand: string
  tyreSize: string
  tyreMaxLifetimeKm?: number
  tyreTotalLifetimeKm?: number
  positionId: number
  positionCode: string
  fittedAtKm: number
  fittedDate: string
  fittedById: number
  fittedByName: string
  removedAtKm?: number
  removedDate?: string
  removalReason?: TyreRemovalReason
  removedById?: number
  removedByName?: string
  rotationLogId?: number
  kmDriven?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface TyreRotationItem {
  id: number
  tyreId: number
  tyreSerialNumber: string
  fromPositionId: number
  fromPositionCode: string
  toPositionId: number
  toPositionCode: string
  oldFittingId: number
  newFittingId: number
}

export interface TyreRotationLog {
  id: number
  tenantId: number
  vehicleId: number
  vehicleRegistrationNumber: string
  rotationDate: string
  odometerKm: number
  performedById: number
  performedByName: string
  notes?: string
  items: TyreRotationItem[]
  createdAt: string
  updatedAt: string
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export interface VehicleMasterRow {
  vehicleId: number
  registrationNumber: string
  brand: string | null
  model: string | null
  vehicleType: string | null
  fuelType: string | null
  ownershipType: string | null
  currentStatus: string | null
  capacityInTons: number | null
  grossVehicleWeight: number | null
  manufactureYear: number | null
  fuelTankCapacity: number | null
  chassisNumber: string | null
  engineNumber: string | null
  rcNumber: string | null
  rcExpiry: string | null
  insuranceNumber: string | null
  insuranceExpiry: string | null
  permitExpiry: string | null
  fitnessExpiry: string | null
  pucNumber: string | null
  pucExpiry: string | null
  roadTaxExpiry: string | null
  isFinanced: boolean
  financerName: string | null
  financeFrom: string | null
  financeTo: string | null
  isIot: boolean
}

export interface FleetStatusRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  ownershipType: string
  currentStatus: string
  currentDriverName: string
  currentCleanerName: string
  tripScope: string
}

export interface FuelMileageRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  fillCount: number
  totalLitresFilled: number | null
  totalFuelCost: number | null
  openingOdometer: number | null
  closingOdometer: number | null
  totalKm: number | null
  mileageKmPerLitre: number | null
}

export interface BreakdownReportRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  breakdownDate: string | null
  location: string | null
  breakdownType: string
  reason: string | null
  status: string
  daysLost: number | null
  reportedBy: string
}

export interface DocumentExpiryRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  documentType: string
  documentNumber: string | null
  expiryDate: string
  daysLeft: number
  expiryStatus: 'GREEN' | 'AMBER' | 'RED'
}

export interface MaintenanceServiceRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  serviceNumber: string | null
  serviceDate: string | null
  completedDate: string | null
  serviceType: string
  triggeredBy: string
  taskCount: number
  totalCost: number | null
  status: string
  vendorName: string | null
  nextServiceDueOdometer: number | null
}

// ─── Attendance Report rows ────────────────────────────────────────────────────
export interface AttendanceDailyRow {
  employeeId: number
  employeeName: string
  role: string
  vehicleRegistrationNumber: string
  attendanceDate: string
  attendanceType: string
  markedAt: string | null
  markedOutAt: string | null
  hoursWorked: number | null
  approvalStatus: string
  leaveType: string | null
  remarks: string | null
  locationName: string | null
}

export interface AttendanceSummaryRow {
  employeeId: number
  employeeName: string
  role: string
  vehicleRegistrationNumber: string
  presentDays: number
  absentDays: number
  leaveDays: number
  halfDays: number
  otherDays: number
  totalRecords: number
  presentPercent: number
}

export interface WeightDiscrepancyRow {
  lrId: number
  lrNumber: string
  lrDate: string
  clientName: string
  vehicleRegistrationNumber: string
  fromCity: string
  toCity: string
  materialType: string
  allocatedWeight?: number
  loadedWeight?: number
  deliveredWeight?: number
  weightVariance?: number
  isOverloaded?: boolean
  lrStatus: string
}

export interface VehicleTripSummaryRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  totalTrips: number
  completedTrips: number
  inTransitTrips: number
  cancelledTrips: number
  totalAllocatedWeight: number
  totalLoadedWeight: number
  totalDeliveredWeight: number
}

export interface ClientTripSummaryRow {
  clientId: number
  clientName: string
  totalTrips: number
  completedTrips: number
  inTransitTrips: number
  cancelledTrips: number
  totalAllocatedWeight: number
  totalLoadedWeight: number
  totalDeliveredWeight: number
}

export interface DelayedDeliveryRow {
  lrId: number
  lrNumber: string
  lrDate: string
  clientName: string
  vehicleRegistrationNumber: string
  driverName: string
  fromCity: string
  toCity: string
  materialType: string
  loadedAt: string
  daysInTransit: number
  lrStatus: string
}

export interface OrderRegisterRow {
  orderId: number
  orderNumber: string
  orderDate: string
  expectedDeliveryDate?: string
  clientName: string
  materialType: string
  fromCity: string
  fromState: string
  toCity: string
  toState: string
  totalWeight: number
  totalWeightFulfilled?: number
  freightRateType: string
  freightRate?: number
  totalFreightAmount?: number
  orderStatus: string
  orderPaymentStatus: string
}

export interface OpenOrderRow {
  orderId: number
  orderNumber: string
  orderDate: string
  expectedDeliveryDate?: string
  clientName: string
  materialType: string
  fromCity: string
  toCity: string
  totalWeight: number
  totalWeightFulfilled?: number
  pendingWeight: number
  orderStatus: string
}

export interface OrderClientSummaryRow {
  clientId: number
  clientName: string
  totalOrders: number
  completedOrders: number
  inProgressOrders: number
  cancelledOrders: number
  totalWeight: number
  totalWeightFulfilled: number
  totalFreightAmount: number
}

export interface OverdueOrderRow {
  orderId: number
  orderNumber: string
  orderDate: string
  expectedDeliveryDate: string
  daysOverdue: number
  clientName: string
  materialType: string
  fromCity: string
  toCity: string
  totalWeight: number
  totalWeightFulfilled?: number
  orderStatus: string
}

export interface WeightFulfillmentRow {
  orderId: number
  orderNumber: string
  orderDate: string
  clientName: string
  materialType: string
  fromCity: string
  toCity: string
  totalWeight: number
  totalWeightFulfilled: number
  pendingWeight: number
  fulfillmentPercent: number
  orderStatus: string
}

export interface OrderRouteSummaryRow {
  fromCity: string
  fromState: string
  toCity: string
  toState: string
  totalOrders: number
  completedOrders: number
  totalWeight: number
  totalWeightFulfilled: number
  totalFreightAmount: number
}

export interface OrderPaymentStatusRow {
  orderId: number
  orderNumber: string
  orderDate: string
  clientName: string
  totalFreightAmount?: number
  orderStatus: string
  orderPaymentStatus: string
}

export interface InvoiceRegisterRow {
  invoiceId: number
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  clientName: string
  subtotal?: number
  taxAmount?: number
  totalAmount?: number
  amountPaid?: number
  balanceDue?: number
  invoiceStatus: string
}

export interface OutstandingInvoiceRow {
  invoiceId: number
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  clientName: string
  totalAmount?: number
  amountPaid?: number
  balanceDue?: number
  invoiceStatus: string
  daysOverdue?: number
}

export interface InvoiceAgingReportRow {
  invoiceId: number
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  clientName: string
  balanceDue?: number
  daysOverdue: number
  agingBucket: string
}

export interface CollectionRow {
  paymentId: number
  paymentDate: string
  invoiceNumber: string
  clientName: string
  amount?: number
  paymentMode: string
  referenceNumber?: string
  remarks?: string
}

export interface CreditNoteRegisterRow {
  creditNoteId: number
  creditNoteNumber: string
  creditNoteDate: string
  clientName: string
  linkedInvoiceNumber?: string
  amount?: number
  reason: string
  creditNoteStatus: string
}

export interface TripExpenseReportRow {
  lrId: number
  lrNumber: string
  lrDate: string
  vehicleNumber: string
  driverName: string
  cleanerName: string
  fromCity: string
  toCity: string
  advanceAmount?: number
  driverBatta?: number
  cleanerBatta?: number
  tripMamulu?: number
  itemsTotal?: number
  totalExpense?: number
  settlementAmount?: number
  status: string
}

export interface FuelCostRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  totalFills: number
  totalLitres?: number
  totalCost?: number
}

export interface MaintenanceCostRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  totalServices: number
  serviceCost?: number
  sparePartsCost?: number
  totalCost?: number
}

export interface DocumentCostRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  documentTypeName: string
  documentNumber?: string
  issuerName?: string
  paidOn?: string
  cost?: number
}

export interface TyreCostRow {
  vehicleId?: number
  registrationNumber: string
  vehicleType: string
  tyreCount: number
  purchaseCost?: number
  retreadingCost?: number
  totalCost?: number
}

export interface VehicleSalaryDayRow {
  day: number
  date: string
  driverName?: string
  driverRole?: string
  driverDailyRate?: number
  driverExtraPay?: number
  driverTotal?: number
  cleanerName?: string
  cleanerRole?: string
  cleanerDailyRate?: number
  cleanerExtraPay?: number
  cleanerTotal?: number
  dayTotal?: number
}

export interface DriverPerformanceRow {
  driverId: number
  driverName: string
  totalTrips: number
  totalWeight?: number
  deliveredTrips: number
  onTimeDeliveries: number
  onTimePct?: number
  presentDays: number
  totalAttendanceDays: number
  attendancePct?: number
}

export interface TechnicianPerformanceRow {
  technicianId: number
  technicianName: string
  designation: string
  tasksAssigned: number
  tasksCompleted: number
  tasksTechnicianClosed: number
  tasksInProgress: number
  servicesWorkedOn: number
  avgDurationMinutes?: number
}

export interface CleanerPerformanceRow {
  cleanerId: number
  cleanerName: string
  totalTrips: number
  totalWeight?: number
  presentDays: number
  totalAttendanceDays: number
  attendancePct?: number
}

export interface PnlSummaryRow {
  totalInvoiced: number
  totalCollected: number
  balanceDue: number
  tripExpenses: number
  fuelExpenses: number
  maintenanceExpenses: number
  tyreExpenses: number
  documentExpenses: number
  totalExpenses: number
  grossPnl: number
  netPnl: number
}

export interface ClientPnlRow {
  clientId: number
  clientName: string
  totalInvoiced: number
  totalCollected: number
  balanceDue: number
  tripExpenses: number
  netPnl: number
}

export interface VehiclePnlRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  revenue: number
  tripExpenses: number
  fuelCost: number
  maintenanceCost: number
  tyreCost: number
  documentCost: number
  totalExpenses: number
  netPnl: number
}

export interface RoutePnlRow {
  fromCity: string
  toCity: string
  totalTrips: number
  revenue: number
  tripExpenses: number
  netPnl: number
}

export interface ClientVehiclePnlRow {
  clientId: number
  clientName: string
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  totalTrips: number
  revenue: number
  tripExpenses: number
  netPnl: number
}

export interface TripPnlRow {
  lrId: number
  lrNumber: string
  lrDate: string
  registrationNumber: string
  clientName: string
  fromCity: string
  toCity: string
  revenue: number
  tripExpenses: number
  netPnl: number
}

// ─── Inventory Report rows ─────────────────────────────────────────────────────
export interface StockSummaryRow {
  partId: number
  partName: string
  partNumber?: string
  category?: string
  unit: string
  quantityOnHand: number
  minStockLevel: number
  stockStatus: 'OK' | 'LOW' | 'OUT'
}

export interface StockInwardRow {
  transactionId: number
  transactionDate: string
  partName: string
  partNumber?: string
  category?: string
  unit: string
  quantity: number
  unitCost?: number
  totalCost?: number
  supplierName?: string
  invoiceNo?: string
  invoiceDate?: string
  referenceType: string
  receivedBy: string
  notes?: string
}

export interface StockOutwardRow {
  transactionId: number
  transactionDate: string
  partName: string
  partNumber?: string
  category?: string
  unit: string
  quantity: number
  totalCost?: number
  transactionType: string
  vehicleRegistration?: string
  requestedBy?: string
  approvedBy?: string
  notes?: string
}

export interface PartRequestRow {
  servicePartId: number
  serviceDate?: string
  partName: string
  partNumber?: string
  category?: string
  unit: string
  quantityRequested: number
  quantityApproved: number
  vehicleRegistration?: string
  vehicleType?: string
  requestedBy?: string
  approvedBy?: string
  approvedAt?: string
  status: string
}

export interface ConsumptionByVehicleRow {
  vehicleId: number
  registrationNumber: string
  vehicleType: string
  partId: number
  partName: string
  partCategory?: string
  timesConsumed: number
  totalCost?: number
}

// ─── Tyre Report rows ──────────────────────────────────────────────────────────
export interface TyreInventoryRow {
  tyreId: number
  serialNumber: string
  brand: string
  size: string
  tyreType: string
  plyRating?: string
  purchaseDate?: string
  purchaseCost?: number
  status: string
  totalLifetimeKm: number
  maxLifetimeKm: number
  percentLifeUsed: number
  retreadCount: number
  expiryDate?: string
  fittedOnVehicle?: string
  fittedPosition?: string
}

export interface TyreFittingRow {
  fittingId: number
  fittedDate: string
  vehicleRegistration: string
  vehicleType: string
  tyreSerial: string
  tyreBrand: string
  tyreSize: string
  tyreType: string
  position: string
  fittedAtKm: number
  fittedBy: string
}

export interface TyreRemovalRow {
  fittingId: number
  removedDate: string
  vehicleRegistration: string
  vehicleType: string
  tyreSerial: string
  tyreBrand: string
  tyreSize: string
  position: string
  fittedAtKm: number
  removedAtKm: number
  kmDriven: number
  removalReason: string
  removedBy: string
}

export interface TyreLifeRow {
  tyreId: number
  serialNumber: string
  brand: string
  size: string
  tyreType: string
  totalLifetimeKm: number
  maxLifetimeKm: number
  percentLifeUsed: number
  retreadCount: number
  status: string
}

export interface TyreRequestRow {
  requestId: number
  createdAt: string
  vehicleRegistration: string
  vehicleType: string
  position: string
  requestedBy: string
  approvedBy?: string
  approvedAt?: string
  issuedTyreSerial?: string
  issuedTyreBrand?: string
  fittedAtKm: number
  status: string
}

export interface TyreMovement {
  tyreSerial: string
  tyreBrand: string
  fromPosition: string
  toPosition: string
}

export interface TyreRotationRow {
  rotationLogId: number
  rotationDate: string
  vehicleRegistration: string
  vehicleType: string
  odometerKm: number
  performedBy: string
  tyresRotated: number
  movements: TyreMovement[]
}

// ─── Payroll Reports ──────────────────────────────────────────────────────────

export interface PayrollSummaryReportRow {
  payrollId: number
  employeeName: string
  role: string
  designation: string
  payCycleStart: string
  payCycleEnd: string
  presentDays: number
  absentDays: number
  halfDays: number
  leaveDays: number
  totalDays: number
  basicPay: number
  overtimePay: number
  tripBonus: number
  vehicleExtraPay: number
  grossPay: number
  totalDeductions: number
  netPay: number
  payrollStatus: string
  paymentDate: string | null
  paymentMode: string
  bankName: string | null
  accountNumber: string | null
  ifscCode: string | null
  accountHolderName: string | null
}

export interface SalaryRegisterRow {
  payrollId: number
  employeeName: string
  role: string
  designation: string
  payCycleStart: string
  payCycleEnd: string
  presentDays: number
  absentDays: number
  halfDays: number
  leaveDays: number
  totalDays: number
  dailyRate: number
  basicPay: number
  overtimePay: number
  tripBonus: number
  vehicleExtraPay: number
  grossPay: number
  deductionsDetail: string
  totalDeductions: number
  netPay: number
  payrollStatus: string
  paymentDate: string | null
  paymentMode: string
  referenceNumber: string | null
  bankName: string | null
  accountNumber: string | null
  ifscCode: string | null
  accountHolderName: string | null
}

export interface AdvanceRegisterRow {
  advanceId: number
  employeeName: string
  role: string
  advanceDate: string
  amount: number
  totalRepaid: number
  balanceAmount: number
  fullyRepaid: boolean
  reason: string | null
  approvedBy: string
}

export interface PayrollByRoleRow {
  role: string
  employeeCount: number
  totalGrossPay: number
  totalDeductions: number
  totalNetPay: number
}

export interface PayrollYtdRow {
  employeeName: string
  role: string
  designation: string
  totalPresentDays: number
  totalGrossPay: number
  totalDeductions: number
  totalNetPay: number
  bankName: string | null
  accountNumber: string | null
  ifscCode: string | null
  accountHolderName: string | null
}

// ─── GPS Integration ───────────────────────────────────────────────────────────
export type GpsProviderType = 'TATA_FLEET_EDGE' | 'BLACKBUCK' | 'VAMOSYS' | 'FLEETX' | 'CUSTOM'
export type GpsVehicleStatus = 'MOVING' | 'IDLE' | 'STOPPED' | 'OFFLINE'
export type GpsSyncStatus = 'NEVER' | 'OK' | 'ERROR'

export interface GpsProviderConfig {
  id: number
  providerType: GpsProviderType
  displayName: string | null
  apiBaseUrl: string | null
  isActive: boolean
  lastSyncAt: string | null
  syncStatus: GpsSyncStatus
  syncErrorMsg: string | null
  createdAt: string
}

export interface GpsProviderVehicle {
  providerVehicleId: string
  registrationNumber: string
  vehicleModel: string | null
  ferosVehicleId: number | null
  autoMatched: boolean
}

export interface VehicleGpsMapping {
  id: number
  vehicleId: number
  registrationNumber: string
  gpsProviderConfigId: number
  providerType: GpsProviderType
  providerDisplayName: string | null
  providerVehicleId: string
  providerRegNumber: string | null
  isActive: boolean
}

export interface GpsFleetVehicle {
  vehicleId: number
  registrationNumber: string
  driverName: string | null
  latitude: number | null
  longitude: number | null
  speedKmh: number | null
  ignitionOn: boolean | null
  gpsStatus: GpsVehicleStatus
  lastUpdatedAt: string | null
  providerType: GpsProviderType
  providerVehicleId: string
}

export interface GpsProviderConfigRequest {
  providerType: GpsProviderType
  displayName?: string
  clientId: string
  clientSecret: string
  apiBaseUrl?: string
}

export interface VehicleGpsMappingRequest {
  vehicleId: number
  gpsProviderConfigId: number
  providerVehicleId: string
  providerRegNumber?: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

// ─── Demo Request ──────────────────────────────────────────────────────────────
export type DemoRequestStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'CLOSED'

export interface DemoRequest {
  id: number
  name: string
  phone: string
  company: string
  email?: string
  fleetSize?: string
  city?: string
  status: DemoRequestStatus
  notes?: string
  createdAt: string
  updatedAt?: string
}

// ─── Attendance Locations ──────────────────────────────────────────────────────
export interface AttendanceLocation {
  id: number
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AttendanceLocationRequest {
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
}
