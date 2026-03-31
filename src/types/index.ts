// ─── Generic API Wrapper ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  phone: string
  pin: string
}
export interface LoginResponse {
  token: string
  userId: number
  tenantId: number
  phone: string
  name: string
  role: string
  companyName: string
  logoUrl?: string
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
export interface DocumentTypeItem extends MasterItem { applicableFor: 'VEHICLE' | 'DRIVER' | 'BOTH'; applicableRoles: string[] | null }
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
export interface DesignationItem extends TenantMasterItem { roleType: string }
export interface PayRateItem extends TenantMasterItem {
  designationId: number; designationName: string
  vehicleTypeId?: number; vehicleTypeName?: string
  payPerDay: number; effectiveFrom: string; effectiveTo?: string
}
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
  isActive: boolean
}

// ─── Client ───────────────────────────────────────────────────────────────────
export interface Client {
  id: number; tenantId: number
  clientName: string; clientTypeId: number; clientTypeName: string
  phone: string; email?: string; address?: string
  cityId?: number; cityName?: string; stateId?: number; stateName?: string; pincode?: string
  gstin?: string; panNumber?: string
  contactPersonName?: string; contactPersonPhone?: string; contactPersonEmail?: string
  paymentTermsId?: number; paymentTermsName?: string
  creditLimit?: number; openingBalance?: number
  isActive: boolean; createdAt: string; updatedAt: string
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────
export interface Vehicle {
  id: number; tenantId: number
  registrationNumber: string
  brandId?: number; brandName?: string
  vehicleTypeId?: number; vehicleTypeName?: string
  fuelTypeId?: number; fuelTypeName?: string
  ownershipTypeId?: number; ownershipTypeName?: string
  currentStatusId?: number; currentStatusName?: string; currentStatusType?: VehicleStatusType
  capacityInTons?: number; manufactureYear?: number; color?: string
  chassisNumber?: string; engineNumber?: string
  rcNumber?: string; rcExpiryDate?: string; rcExpired?: boolean
  insuranceCompanyName?: string; insurancePolicyNumber?: string
  insuranceStartDate?: string; insuranceExpiryDate?: string; insuranceExpired?: boolean
  permitNumber?: string; permitType?: string
  permitStartDate?: string; permitExpiryDate?: string; permitExpired?: boolean
  fitnessCertificateNumber?: string; fitnessExpiryDate?: string; fitnessExpired?: boolean
  pucNumber?: string; pollutionExpiryDate?: string; pollutionExpired?: boolean
  roadTaxPaidDate?: string; roadTaxExpiryDate?: string; roadTaxExpired?: boolean
  ownerName?: string; ownerPhone?: string; ownerPan?: string; ownerAddress?: string
  agreementStartDate?: string; agreementEndDate?: string; agreementAmount?: number
  gpsDeviceNumber?: string; gpsDeviceImei?: string; gpsProvider?: string
  currentOdometerReading?: number; notes?: string
  isActive: boolean; createdAt: string; updatedAt: string
  isAssigned?: boolean; assignedOrderId?: number; assignedOrderNumber?: string
}

export interface VehicleDocument {
  id: number; vehicleId: number; tenantId: number
  documentTypeId: number; documentTypeName?: string
  documentNumber?: string; issueDate?: string; expiryDate?: string
  fileUrl?: string; isVerified: boolean; remarks?: string
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
  staffAllocations?: StaffAllocation[]
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
export type LrStatus = 'CREATED'|'IN_TRANSIT'|'DELIVERED'|'CANCELLED'

export interface Lr {
  id: number; tenantId: number; lrNumber: string
  orderId: number; orderNumber: string
  vehicleAllocationId: number
  vehicleId?: number; vehicleRegistrationNumber: string; vehicleTypeName?: string
  clientId?: number; clientName?: string
  lrDate: string; vehicleCapacity: number; allocatedWeight: number
  loadedWeight?: number; deliveredWeight?: number
  overloadWeight?: number; weightVariance?: number; isOverloaded?: boolean
  loadedAt?: string; deliveredAt?: string
  lrStatus: LrStatus; remarks?: string
  checkposts?: LrCheckpost[]; charges?: LrCharge[]
  createdById: number; createdByName: string
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
export type PaymentMode = 'CASH'|'CHEQUE'|'NEFT'|'UPI'|'RTGS'

export interface InvoiceLrItem {
  id: number
  lrId: number; lrNumber: string
  orderId: number; orderNumber: string
  vehicleRegistrationNumber: string
  freightAmount: number; chargesAmount: number; checkpostFineAmount: number; totalAmount: number
  remarks?: string; createdAt: string
}

export interface Invoice {
  id: number; tenantId: number; invoiceNumber: string
  clientId: number; clientName: string
  invoiceDate: string; dueDate?: string
  subtotal: number; taxAmount: number; totalAmount: number
  advanceAdjusted: number; creditNoteAdjusted: number
  amountPaid: number; balanceDue: number
  invoiceStatus: InvoiceStatus; remarks?: string
  lrItems?: InvoiceLrItem[]
  payments?: InvoicePayment[]
  createdById: number; createdByName: string
  isActive: boolean; createdAt: string; updatedAt: string
}

export interface InvoicePayment {
  id: number; invoiceId?: number
  paymentDate: string; amount: number; paymentMode: PaymentMode
  referenceNumber?: string; remarks?: string
  createdById: number; createdByName: string
  isActive?: boolean; createdAt: string
}

// ─── Staff ────────────────────────────────────────────────────────────────────
export interface StaffProfile {
  userId: number; tenantId: number; userName: string; userPhone: string; roleName: string
  designationId?: number; designationName?: string
  employmentTypeId?: number; employmentTypeName?: string
  dateOfBirth?: string; joiningDate?: string
  address?: string; cityId?: number; cityName?: string; stateId?: number; stateName?: string; pincode?: string
  emergencyContactName?: string; emergencyContactPhone?: string
  bankName?: string; accountNumber?: string; ifscCode?: string; accountHolderName?: string
  licenseNumber?: string; licenseExpiryDate?: string
  profilePhotoUrl?: string; isActive: boolean
  createdAt: string; updatedAt: string
}

export interface StaffDocument {
  id: number; userId: number; documentTypeId: number; documentTypeName: string
  documentNumber?: string; issueDate?: string; expiryDate?: string
  fileUrl?: string; isVerified: boolean; remarks?: string; isActive: boolean
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export interface Attendance {
  id: number; userId: number; userName: string; userPhone: string; roleName: string
  attendanceDate: string; attendanceTypeId: number; attendanceTypeName: string
  leaveTypeId?: number; leaveTypeName?: string; leaveReason?: string
  markedById: number; markedByName: string; markedAt: string
  remarks?: string; createdAt: string; updatedAt: string
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
  id: number; userId: number; userName: string; userPhone: string; roleName: string
  payCycleStartDate: string; payCycleEndDate: string
  totalDays: number; presentDays: number; absentDays: number; halfDays: number; leaveDays: number
  overtimeHours: number; dailyRate: number
  basicPay: number; overtimePay: number; tripBonus: number
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardResponse {
  orders: {
    total: number; pending: number; partiallyAssigned: number; fullyAssigned: number
    inTransit: number; partiallyDelivered: number; delivered: number; cancelled: number
  }
  vehicles: { total: number; onTrip: number; available: number }
  invoices: {
    draft: number; sent: number; partiallyPaid: number; overdue: number; paid: number
    totalOutstanding: number
  }
  todayAttendance: {
    date: string; present: number; absent: number; halfDay: number; onLeave: number; total: number
  }
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
  orderNumber: string; clientId: number; clientName: string
  vehicleRegistrationNumber: string
  fromCity: string; fromState: string; toCity: string; toState: string
  materialType: string
  allocatedWeight?: number; loadedWeight?: number; deliveredWeight?: number
  weightVariance?: number; isOverloaded?: boolean
  loadedAt?: string; deliveredAt?: string
  freightRateType: string; freightRate: number; lrStatus: string
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

// ─── Tenant ───────────────────────────────────────────────────────────────────
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'

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
  prefix?: string; logoUrl?: string; lorryCount?: number
  subscriptionStatus: SubscriptionStatus
  trialStartDate?: string; trialEndDate?: string
  subscriptionStartDate?: string; subscriptionEndDate?: string
  isActive: boolean; createdAt: string; updatedAt: string
}

// ─── Subscription ─────────────────────────────────────────────────────────────
export interface SubscriptionPlan {
  id: number
  name: string
  maxLorries: number
  maxUsers: number
  priceMonthly: number
  priceYearly: number
  features?: string
  isActive: boolean
}

export interface SubscriptionHistory {
  id: number
  tenantId: number
  companyName: string
  planName: string
  status: SubscriptionStatus
  billingCycle?: string
  startDate: string
  endDate: string
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
  periodStart?: string
  periodEnd?: string
  amount?: number
  gstAmount?: number
  totalAmount?: number
  paymentRef?: string
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
export type ServiceTriggeredBy = 'SCHEDULED' | 'BREAKDOWN'
export type VehicleServiceType = 'INTERNAL' | 'EXTERNAL'
export type ServiceStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'
export type ServiceDisplayStatus = 'OPEN' | 'IN_PROGRESS' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED'
export type ServiceTaskStatus = 'PENDING' | 'COMPLETED'

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
  tasks: VehicleServiceTask[]
  createdAt: string
  updatedAt: string
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
