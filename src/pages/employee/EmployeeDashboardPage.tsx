import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Armchair,
  Plus,
  TrendingUp,
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { listBookingsForEmployee } from '@/services/bookingService';
import { formatDate, todayISO, formatShortDate } from '@/lib/date';
import type { Booking } from '@/types';

export default function EmployeeDashboardPage() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const loadedProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile || loadedProfileRef.current === profile.uid) return;
    loadedProfileRef.current = profile.uid;
    (async () => {
      setLoading(true);
      try {
        setBookings(await listBookingsForEmployee(profile.uid));
      } catch (err) {
        console.error(err);
        show('Could not load your bookings.', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const today = todayISO();
  const todayBooking = bookings.find((b) => b.bookingDate === today && b.status === 'active');
  const upcoming = bookings
    .filter((b) => b.status === 'active' && b.bookingDate >= today)
    .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  const history = bookings
    .filter((b) => b.status === 'cancelled' || b.bookingDate < today)
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate))
    .slice(0, 5);

  return (
    <DashboardShell
      title="Dashboard"
      subtitle={profile ? `Welcome back, ${profile.displayName}` : undefined}
      actions={
        <Link
          to="/employee/book-seat"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Book a seat
        </Link>
      }
    >
      {loading ? (
        <CardSpinner />
      ) : (
        <div className="space-y-6">
          {/* Today's status */}
          <div
            className={`rounded-xl p-6 shadow-sm ring-1 ${
              todayBooking
                ? 'bg-gradient-to-br from-emerald-50 to-white ring-emerald-200'
                : 'bg-white ring-gray-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  todayBooking ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <CalendarCheck className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-navy-800">
                  {todayBooking
                    ? `You’re booked at seat ${todayBooking.seatCode} today`
                    : "You don’t have a seat booked today"}
                </h2>
                <p className="text-sm text-gray-500">
                  {todayBooking
                    ? formatDate(todayBooking.bookingDate)
                    : 'Reserve a seat to secure your spot for today.'}
                </p>
              </div>
            </div>
            {!todayBooking && (
              <Link
                to="/employee/book-seat"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Armchair className="h-4 w-4" />
                Book a seat now
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Upcoming bookings"
              value={upcoming.length}
              icon={<CalendarDays className="h-5 w-5" />}
              color="text-indigo-600 bg-indigo-50"
            />
            <StatCard
              label="Today’s booking"
              value={todayBooking ? todayBooking.seatCode : '—'}
              icon={<Clock className="h-5 w-5" />}
              color="text-emerald-600 bg-emerald-50"
            />
            <StatCard
              label="Total bookings"
              value={bookings.filter((b) => b.status === 'active').length}
              icon={<TrendingUp className="h-5 w-5" />}
              color="text-sky-600 bg-sky-50"
            />
            <StatCard
              label="Cancelled"
              value={bookings.filter((b) => b.status === 'cancelled').length}
              icon={<CalendarDays className="h-5 w-5" />}
              color="text-gray-600 bg-gray-100"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="mb-4 text-sm font-semibold text-navy-800">Upcoming bookings</h3>
              {upcoming.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  No upcoming bookings.{' '}
                  <Link to="/employee/book-seat" className="font-medium text-indigo-600">
                    Book a seat
                  </Link>
                </p>
              ) : (
                <div className="space-y-2">
                  {upcoming.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 font-semibold text-indigo-600">
                          {b.seatCode}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{formatDate(b.bookingDate)}</p>
                          <p className="text-xs text-gray-500">Seat {b.seatCode}</p>
                        </div>
                      </div>
                      <Link
                        to="/employee/my-bookings"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Manage
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="mb-4 text-sm font-semibold text-navy-800">Recent history</h3>
              {history.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No past bookings yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatShortDate(b.bookingDate)}
                        </p>
                        <p className="text-xs text-gray-500">Seat {b.seatCode}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          b.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {b.status === 'active' ? 'Completed' : 'Cancelled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-navy-800">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}
