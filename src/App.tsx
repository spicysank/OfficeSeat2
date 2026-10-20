import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import {
  ProtectedRoute,
  AdminRoute,
  PublicOnlyRoute,
  RootRedirect,
  ConfigErrorScreen,
} from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';

import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminLayoutsPage from '@/pages/admin/AdminLayoutsPage';
import LayoutEditorPage from '@/pages/admin/LayoutEditorPage';
import AdminSeatManagementPage from '@/pages/admin/AdminSeatManagementPage';
import AdminBookingsPage from '@/pages/admin/AdminBookingsPage';
import AdminEmployeesPage from '@/pages/admin/AdminEmployeesPage';
import AdminReportsPage from '@/pages/admin/AdminReportsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';

import EmployeeDashboardPage from '@/pages/employee/EmployeeDashboardPage';
import BookSeatPage from '@/pages/employee/BookSeatPage';
import MyBookingsPage from '@/pages/employee/MyBookingsPage';

function ConfigGate({ children }: { children: React.ReactNode }) {
  const { configError } = useAuth();
  if (configError) return <ConfigErrorScreen messages={configError} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ConfigGate>
            <Routes>
              <Route path="/" element={<RootRedirect />} />

              {/* Public-only routes */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>

              {/* Employee routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/employee/dashboard" element={<EmployeeDashboardPage />} />
                <Route path="/employee/book-seat" element={<BookSeatPage />} />
                <Route path="/employee/my-bookings" element={<MyBookingsPage />} />
              </Route>

              {/* Admin routes */}
              <Route element={<AdminRoute />}>
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/layouts" element={<AdminLayoutsPage />} />
                <Route path="/admin/layout-editor/:layoutId" element={<LayoutEditorPage />} />
                <Route path="/admin/seats" element={<AdminSeatManagementPage />} />
                <Route path="/admin/bookings" element={<AdminBookingsPage />} />
                <Route path="/admin/employees" element={<AdminEmployeesPage />} />
                <Route path="/admin/reports" element={<AdminReportsPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
              </Route>

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </ConfigGate>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
