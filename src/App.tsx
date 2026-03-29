import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { RoleRedirect } from '@/components/shared/RoleRedirect'

// Auth
import { LoginPage } from '@/pages/auth/LoginPage'

// Admin pages
import { DashboardPage }  from '@/pages/dashboard/DashboardPage'
import { ClientsPage }    from '@/pages/clients/ClientsPage'
import ClientAdvancesPage from '@/pages/clients/ClientAdvancesPage'
import { VehiclesPage }        from '@/pages/vehicles/VehiclesPage'
import { VehicleDetailPage }   from '@/pages/vehicles/VehicleDetailPage'
import VehicleServicesPage     from '@/pages/vehicles/VehicleServicesPage'
import { OrdersPage }       from '@/pages/orders/OrdersPage'
import { OrderDetailPage }  from '@/pages/orders/OrderDetailPage'
import AssignmentsPage      from '@/pages/orders/AssignmentsPage'
import { LrsPage }        from '@/pages/lrs/LrsPage'
import { LrDetailPage }  from '@/pages/lrs/LrDetailPage'
import { InvoicesPage }       from '@/pages/invoices/InvoicesPage'
import { InvoiceDetailPage } from '@/pages/invoices/InvoiceDetailPage'
import CreditNotesPage       from '@/pages/invoices/CreditNotesPage'
import { StaffPage }       from '@/pages/staff/StaffPage'
import { StaffDetailPage } from '@/pages/staff/StaffDetailPage'
import { AttendancePage } from '@/pages/attendance/AttendancePage'
import { PayrollPage }    from '@/pages/payroll/PayrollPage'
import { ReportsPage }    from '@/pages/reports/ReportsPage'
import { MastersPage }    from '@/pages/masters/MastersPage'

// Super Admin pages
import { SADashboardPage }   from '@/pages/superadmin/SADashboardPage'
import { TenantsPage }       from '@/pages/superadmin/TenantsPage'
import { SubscriptionsPage } from '@/pages/superadmin/SubscriptionsPage'
import { SAUsersPage }       from '@/pages/superadmin/SAUsersPage'
import { GlobalMastersPage } from '@/pages/superadmin/GlobalMastersPage'
import { SASettingsPage }    from '@/pages/superadmin/SASettingsPage'

// Profile
import { ProfilePage } from '@/pages/profile/ProfilePage'

// Staff portal pages
import { MyTripsPage }      from '@/pages/staff-portal/MyTripsPage'
import { MyAttendancePage } from '@/pages/staff-portal/MyAttendancePage'
import { MyPayslipPage }    from '@/pages/staff-portal/MyPayslipPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleRedirect />} />

          {/* ADMIN */}
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="clients"          element={<ClientsPage />} />
          <Route path="client-advances" element={<ClientAdvancesPage />} />
          <Route path="vehicles"            element={<VehiclesPage />} />
          <Route path="vehicles/:vehicleId" element={<VehicleDetailPage />} />
          <Route path="vehicle-services"    element={<VehicleServicesPage />} />
          <Route path="orders"          element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="assignments"     element={<AssignmentsPage />} />
          <Route path="lrs"          element={<LrsPage />} />
          <Route path="lrs/:lrId"  element={<LrDetailPage />} />
          <Route path="invoices"            element={<InvoicesPage />} />
          <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="credit-notes"        element={<CreditNotesPage />} />
          <Route path="staff"           element={<StaffPage />} />
          <Route path="staff/:userId"   element={<StaffDetailPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="payroll"    element={<PayrollPage />} />
          <Route path="reports"    element={<ReportsPage />} />
          <Route path="masters"    element={<MastersPage />} />

          {/* SUPER_ADMIN */}
          <Route path="sa/dashboard"      element={<SADashboardPage />} />
          <Route path="sa/tenants"        element={<TenantsPage />} />
          <Route path="sa/subscriptions"  element={<SubscriptionsPage />} />
          <Route path="sa/users"          element={<SAUsersPage />} />
          <Route path="sa/global-masters" element={<GlobalMastersPage />} />
          <Route path="sa/settings"       element={<SASettingsPage />} />

          {/* Profile */}
          <Route path="profile" element={<ProfilePage />} />

          {/* STAFF */}
          <Route path="my/trips"      element={<MyTripsPage />} />
          <Route path="my/attendance" element={<MyAttendancePage />} />
          <Route path="my/payslip"    element={<MyPayslipPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
