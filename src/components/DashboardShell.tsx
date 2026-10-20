import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  PencilRuler,
  Armchair,
  CalendarDays,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const adminNav: NavItem[] = [
  { to: '/admin/dashboard', label: 'Overview', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/admin/layouts', label: 'Office Layouts', icon: <Map className="h-5 w-5" /> },
  { to: '/admin/layout-editor/new', label: 'Layout Editor', icon: <PencilRuler className="h-5 w-5" /> },
  { to: '/admin/seats', label: 'Seat Management', icon: <Armchair className="h-5 w-5" /> },
  { to: '/admin/bookings', label: 'All Bookings', icon: <CalendarDays className="h-5 w-5" /> },
  { to: '/admin/employees', label: 'Employees', icon: <Users className="h-5 w-5" /> },
  { to: '/admin/reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" /> },
  { to: '/admin/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
];

const employeeNav: NavItem[] = [
  { to: '/employee/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: '/employee/book-seat', label: 'Book a Seat', icon: <Armchair className="h-5 w-5" /> },
  { to: '/employee/my-bookings', label: 'My Bookings', icon: <CalendarDays className="h-5 w-5" /> },
];

export default function DashboardShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { profile, isAdmin, logout } = useAuth();
  const { show } = useToast();
  const nav = isAdmin ? adminNav : employeeNav;
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      show('Could not sign out. Please try again.', 'error');
    }
  };

  const isActive = (to: string) =>
    location.pathname === to ||
    (to !== '/admin/dashboard' &&
      to !== '/employee/dashboard' &&
      location.pathname.startsWith(to.replace('/new', '')));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar - desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy-800 text-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <Link to={isAdmin ? '/admin/dashboard' : '/employee/dashboard'}>
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.to)
                  ? 'bg-indigo-600 text-white'
                  : 'text-navy-100 hover:bg-navy-700'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-navy-700 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-100 transition-colors hover:bg-navy-700"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-navy-800 text-white animate-[slideIn_0.2s_ease-out]">
            <div className="flex h-16 items-center justify-between px-6">
              <Logo />
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(item.to)
                      ? 'bg-indigo-600 text-white'
                      : 'text-navy-100 hover:bg-navy-700'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-navy-700 p-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-100 hover:bg-navy-700"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-navy-800">{title}</h1>
              {subtitle && (
                <p className="text-xs text-gray-500">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                  {(profile?.displayName || profile?.email || '?').charAt(0).toUpperCase()}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              {userMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-lg bg-white py-1 shadow-lg ring-1 ring-gray-200"
                  onMouseLeave={() => setUserMenu(false)}
                >
                  <div className="border-b border-gray-100 px-4 py-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {profile?.displayName}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {profile?.email}
                    </p>
                    <p className="mt-1 text-xs font-medium text-indigo-600">
                      {isAdmin ? 'Administrator' : 'Employee'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
