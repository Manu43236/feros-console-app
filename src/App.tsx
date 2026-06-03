import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { RoleRedirect } from '@/components/shared/RoleRedirect'
import { useAuthStore } from '@/store/authStore'

// Auth
import { LoginPage } from '@/pages/auth/LoginPage'

// Admin pages
import { DashboardPage }           from '@/pages/dashboard/DashboardPage'
import { SupervisorDashboardPage } from '@/pages/dashboard/SupervisorDashboardPage'
import { ClientsPage }    from '@/pages/clients/ClientsPage'
import ClientAdvancesPage from '@/pages/clients/ClientAdvancesPage'
import { VehiclesPage }        from '@/pages/vehicles/VehiclesPage'
import { VehicleDetailPage }   from '@/pages/vehicles/VehicleDetailPage'
import VehicleServicesPage     from '@/pages/vehicles/VehicleServicesPage'
import FuelLogsPage            from '@/pages/vehicles/FuelLogsPage'
import MeterReadingsPage       from '@/pages/vehicles/MeterReadingsPage'
import TyreInventoryPage       from '@/pages/inventory/TyreInventoryPage'
import TyreRequestsPage        from '@/pages/inventory/TyreRequestsPage'
import { OrdersPage }       from '@/pages/orders/OrdersPage'
import { OrderDetailPage }  from '@/pages/orders/OrderDetailPage'
import AssignmentsPage      from '@/pages/orders/AssignmentsPage'
import { LrsPage }           from '@/pages/lrs/LrsPage'
import { LrDetailPage }     from '@/pages/lrs/LrDetailPage'
import { TripExpensesPage } from '@/pages/lrs/TripExpensesPage'
import { InvoicesPage }       from '@/pages/invoices/InvoicesPage'
import { InvoiceDetailPage } from '@/pages/invoices/InvoiceDetailPage'
import { InvoicePrintPage }  from '@/pages/invoices/InvoicePrintPage'
import { SubscriptionInvoicePrintPage } from '@/pages/subscription/SubscriptionInvoicePrintPage'
import CreditNotesPage           from '@/pages/invoices/CreditNotesPage'
import { ServiceInvoicesPage }  from '@/pages/invoices/ServiceInvoicesPage'
import { StaffPage }       from '@/pages/staff/StaffPage'
import { StaffDetailPage } from '@/pages/staff/StaffDetailPage'
import { AttendancePage }           from '@/pages/attendance/AttendancePage'
import { SupervisorAttendancePage } from '@/pages/attendance/SupervisorAttendancePage'
import { PayrollPage }    from '@/pages/payroll/PayrollPage'
import { MastersPage }    from '@/pages/masters/MastersPage'
import InventoryPage      from '@/pages/inventory/InventoryPage'

// Super Admin pages
import { SADashboardPage }   from '@/pages/superadmin/SADashboardPage'
import { TenantsPage }       from '@/pages/superadmin/TenantsPage'
import { SubscriptionsPage } from '@/pages/superadmin/SubscriptionsPage'
import { SAUsersPage }       from '@/pages/superadmin/SAUsersPage'
import { GlobalMastersPage } from '@/pages/superadmin/GlobalMastersPage'
import { SASettingsPage }    from '@/pages/superadmin/SASettingsPage'

// Subscription
import { SubscriptionPage } from '@/pages/subscription/SubscriptionPage'

// Profile
import { ProfilePage } from '@/pages/profile/ProfilePage'

// Notifications
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'

// Staff portal pages
import { MyTripsPage }      from '@/pages/staff-portal/MyTripsPage'
import { MyAttendancePage } from '@/pages/staff-portal/MyAttendancePage'
import { MyPayslipPage }    from '@/pages/staff-portal/MyPayslipPage'

function DashboardRouter() {
  const role = useAuthStore(s => s.role)
  return role === 'SUPERVISOR' ? <SupervisorDashboardPage /> : <DashboardPage />
}

function AttendanceRouter() {
  const role = useAuthStore(s => s.role)
  return role === 'SUPERVISOR' ? <SupervisorAttendancePage /> : <AttendancePage />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invoices/:invoiceId/print" element={<InvoicePrintPage />} />
        <Route path="/subscription/invoice/:invoiceId/print" element={<SubscriptionInvoicePrintPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleRedirect />} />

          <Route path="dashboard" element={<DashboardRouter />} />
          {/* Billing & clients — office only */}
          <Route path="clients"         element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><ClientsPage /></ProtectedRoute>} />
          <Route path="client-advances" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><ClientAdvancesPage /></ProtectedRoute>} />
          <Route path="invoices"            element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><InvoicesPage /></ProtectedRoute>} />
          <Route path="invoices/:invoiceId" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><InvoiceDetailPage /></ProtectedRoute>} />
          <Route path="credit-notes"        element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><CreditNotesPage /></ProtectedRoute>} />
          <Route path="service-invoices"    element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><ServiceInvoicesPage /></ProtectedRoute>} />

          {/* Vehicles — admin + office + supervisor + driver (read) */}
          <Route path="vehicles"            element={<VehiclesPage />} />
          <Route path="vehicles/:vehicleId" element={<VehicleDetailPage />} />
          <Route path="vehicle-services"    element={<VehicleServicesPage />} />
          <Route path="fuel-logs"           element={<FuelLogsPage />} />
          <Route path="meter-readings"      element={<MeterReadingsPage />} />

          {/* Inventory */}
          <Route path="inventory/tyres"         element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF','STORE_KEEPER']}><TyreInventoryPage /></ProtectedRoute>} />
          <Route path="inventory/tyre-requests" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','STORE_KEEPER']}><TyreRequestsPage /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF','STORE_KEEPER','SERVICE_MEN']}><InventoryPage /></ProtectedRoute>} />

          {/* Orders & LRs */}
          <Route path="orders"          element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="assignments"     element={<AssignmentsPage />} />
          <Route path="lrs"              element={<LrsPage />} />
          <Route path="lrs/:lrId"        element={<LrDetailPage />} />
          <Route path="trip-expenses"    element={<TripExpensesPage />} />

          {/* Staff & HR — admin + office only */}
          <Route path="staff"         element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF','SUPERVISOR']}><StaffPage /></ProtectedRoute>} />
          <Route path="staff/:userId" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF','SUPERVISOR']}><StaffDetailPage /></ProtectedRoute>} />
          <Route path="attendance"    element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF','SUPERVISOR']}><AttendanceRouter /></ProtectedRoute>} />
          <Route path="payroll"       element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><PayrollPage /></ProtectedRoute>} />

          {/* Masters — admin + office only */}
          <Route path="masters"    element={<ProtectedRoute allowedRoles={['SUPER_ADMIN','ADMIN','OFFICE_STAFF']}><MastersPage /></ProtectedRoute>} />

          {/* SUPER_ADMIN */}
          <Route path="sa/dashboard"      element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SADashboardPage /></ProtectedRoute>} />
          <Route path="sa/tenants"        element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><TenantsPage /></ProtectedRoute>} />
          <Route path="sa/subscriptions"  element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SubscriptionsPage /></ProtectedRoute>} />
          <Route path="sa/users"          element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SAUsersPage /></ProtectedRoute>} />
          <Route path="sa/global-masters" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><GlobalMastersPage /></ProtectedRoute>} />
          <Route path="sa/settings"       element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SASettingsPage /></ProtectedRoute>} />

          {/* Subscription */}
          <Route path="subscription" element={<SubscriptionPage />} />

          {/* Profile */}
          <Route path="profile" element={<ProfilePage />} />

          {/* Notifications */}
          <Route path="notifications" element={<NotificationsPage />} />

          {/* STAFF self-service */}
          <Route path="my/trips"      element={<ProtectedRoute allowedRoles={['DRIVER', 'CLEANER', 'SUPERVISOR', 'SERVICE_MEN', 'STORE_KEEPER']}><MyTripsPage /></ProtectedRoute>} />
          <Route path="my/attendance" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OFFICE_STAFF', 'DRIVER', 'CLEANER', 'SUPERVISOR', 'SERVICE_MEN', 'STORE_KEEPER']}><MyAttendancePage /></ProtectedRoute>} />
          <Route path="my/payslip"    element={<ProtectedRoute allowedRoles={['DRIVER', 'CLEANER', 'SUPERVISOR', 'SERVICE_MEN', 'STORE_KEEPER']}><MyPayslipPage /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
