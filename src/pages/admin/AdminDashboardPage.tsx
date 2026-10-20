import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Armchair,
  CalendarCheck,
  Users,
  TrendingUp,
  CircleDot,
  Ban,
  Plus,
  Map,
  PencilRuler,
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { listLayouts } from '@/services/layoutService';
import { listSeats } from '@/services/seatService';
import { listAllBookings, listBookingsForDate } from '@/services/bookingService';
import { listUserProfiles } from '@/services/userService';
import { todayISO, formatShortDate } from '@/lib/date';
import type { OfficeLayout, Seat, Booking, UserProfile } from '@/types';

export default function AdminDashboardPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<OfficeLayout[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const today = todayISO();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ls, allBookings, us] = await Promise.all([
          listLayouts(),
          listAllBookings(),
          listUserProfiles(),
        ]);
        setLayouts(ls);
        setBookings(allBookings);
        setUsers(us.filter((u) => u.role !== 'admin'));

        const published = ls.filter((l) => l.status === 'published');
        if (published.length) {
          const seatLists = await Promise.all(
            published.map((l) => listSeats(l.id)),
          );
          const allSeats = seatLists.flat();
          setSeats(allSeats);

          const todays = await Promise.all(
            published.map((l) => listBookingsForDate(l.id, today)),
          );
          setTodayBookings(todays.flat());
        }
      } catch (err) {
        console.error(err);
        show('Could not load dashboard data.', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSeats = seats.length;
  const enabledSeats = seats.filter((s) => s.enabled).length;
  const disabledSeats = totalSeats - enabledSeats;
  const bookedTodayIds = new Set(todayBookings.map((b) => `${b.layoutId}_${b.seatId}_${b.bookingDate}`));
  const availableToday = enabledSeats - todayBookings.length;
  const totalEmployees = users.length;
  const utilization = enabledSeats > 0 ? Math.round((todayBookings.length / enabledSeats) * 100) : 0;

  // 7-day trend
  const trend = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const count = bookings.filter(
      (b) => b.bookingDate === iso && b.status === 'active',
    ).length;
    return { date: formatShortDate(iso), count };
  });
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));

  const recent = [...bookings]
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
    .slice(0, 5);

  const stats = [
    { label: 'Total Seats', value: totalSeats, icon: <Armchair className="h-5 w-5" />, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Available Today', value: availableToday, icon: <CircleDot className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Booked Today', value: todayBookings.length, icon: <CalendarCheck className="h-5 w-5" />, color: 'text-sky-600 bg-sky-50' },
    { label: 'Disabled Seats', value: disabledSeats, icon: <Ban className="h-5 w-5" />, color: 'text-gray-600 bg-gray-100' },
    { label: 'Total Employees', value: totalEmployees, icon: <Users className="h-5 w-5" />, color: 'text-navy-600 bg-navy-50' },
    { label: 'Utilization', value: `${utilization}%`, icon: <TrendingUp className="h-5 w-5" />, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <DashboardShell title="Overview" subtitle="Office seat utilization at a glance">
      {loading ? (
        <CardSpinner />
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
              >
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                  {s.icon}
                </div>
                <p className="text-2xl font-bold text-navy-800">{s.value}</p>
                <p className="mt-0.5 text-xs font-medium text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Utilization chart */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 lg:col-span-2">
              <h3 className="text-sm font-semibold text-navy-800">Seat utilization — last 7 days</h3>
              <div className="mt-6 flex items-end justify-between gap-2" style={{ height: 200 }}>
                {trend.map((t, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div
                        className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-indigo-500 to-indigo-400 transition-all hover:from-indigo-600 hover:to-indigo-500"
                        style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: 4 }}
                        title={`${t.count} bookings`}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{t.date}</span>
                    <span className="text-xs font-semibold text-navy-700">{t.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="text-sm font-semibold text-navy-800">Quick actions</h3>
              <div className="mt-4 space-y-2">
                <QuickAction to="/admin/layout-editor/new" icon={<PencilRuler className="h-4 w-4" />} label="New layout" />
                <QuickAction to="/admin/layouts" icon={<Map className="h-4 w-4" />} label="Manage layouts" />
                <QuickAction to="/admin/bookings" icon={<CalendarCheck className="h-4 w-4" />} label="View bookings" />
                <QuickAction to="/admin/employees" icon={<Users className="h-4 w-4" />} label="Employees" />
                <QuickAction to="/admin/settings" icon={<Plus className="h-4 w-4" />} label="Settings" />
              </div>
            </div>
          </div>

          {/* Recent bookings */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-800">Recent bookings</h3>
              <Link to="/admin/bookings" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No bookings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="py-2 pr-4 font-medium">Employee</th>
                      <th className="py-2 pr-4 font-medium">Seat</th>
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{b.employeeName}</p>
                          <p className="text-xs text-gray-500">{b.employeeEmail}</p>
                        </td>
                        <td className="py-3 pr-4 font-medium text-navy-700">{b.seatCode}</td>
                        <td className="py-3 pr-4 text-gray-600">{formatShortDate(b.bookingDate)}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={b.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50"
    >
      <span className="text-indigo-600">{icon}</span>
      {label}
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600' },
    draft: { label: 'Draft', cls: 'bg-amber-100 text-amber-700' },
    published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700' },
    archived: { label: 'Archived', cls: 'bg-gray-100 text-gray-500' },
  };
  const m = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}
