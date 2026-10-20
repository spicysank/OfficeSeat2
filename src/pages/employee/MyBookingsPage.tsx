import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Ban, Loader2, X } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { listBookingsForEmployee, cancelBooking } from '@/services/bookingService';
import { getSettings } from '@/services/settingsService';
import { formatDate, todayISO, parseISO } from '@/lib/date';
import type { Booking, AppSettings } from '@/types';

export default function MyBookingsPage() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      try {
        const [bs, s] = await Promise.all([
          listBookingsForEmployee(profile.uid),
          getSettings(),
        ]);
        setBookings(bs);
        setSettings(s);
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
  const canCancel = (b: Booking): boolean => {
    if (b.status !== 'active') return false;
    if (!settings || settings.cancellationDeadlineHours <= 0) return true;
    const bookingDate = parseISO(b.bookingDate);
    const deadline = new Date(bookingDate);
    deadline.setHours(deadline.getHours() - settings.cancellationDeadlineHours);
    return new Date() < deadline;
  };

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'active' && b.bookingDate >= today)
        .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate)),
    [bookings, today],
  );
  const past = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'cancelled' || b.bookingDate < today)
        .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate)),
    [bookings, today],
  );

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelBooking(cancelTarget.id);
      setBookings((bs) =>
        bs.map((b) => (b.id === cancelTarget.id ? { ...b, status: 'cancelled' } : b)),
      );
      show('Booking cancelled.', 'success');
    } catch (err) {
      console.error(err);
      show('Could not cancel booking.', 'error');
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  return (
    <DashboardShell title="My Bookings" subtitle="View and manage your seat reservations">
      {loading ? (
        <CardSpinner />
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-navy-800">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl bg-white py-12 text-center shadow-sm ring-1 ring-gray-200">
                <CalendarDays className="h-8 w-8 text-gray-400" />
                <p className="mt-3 text-sm text-gray-500">No upcoming bookings.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((b) => {
                  const cancellable = canCancel(b);
                  const isToday = b.bookingDate === today;
                  return (
                    <div
                      key={b.id}
                      className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${
                        isToday ? 'ring-2 ring-indigo-300' : 'ring-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">
                          {b.seatCode}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="mt-3 font-semibold text-navy-800">{formatDate(b.bookingDate)}</p>
                      <p className="text-xs text-gray-500">Seat {b.seatCode}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                        {cancellable ? (
                          <button
                            onClick={() => setCancelTarget(b)}
                            className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Past cancellation deadline
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-navy-800">History</h2>
            {past.length === 0 ? (
              <div className="rounded-xl bg-white py-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200">
                No past bookings.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-slate-50 text-xs uppercase text-gray-500">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Seat</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {past.map((b) => (
                        <tr key={b.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3 text-gray-600">{formatDate(b.bookingDate)}</td>
                          <td className="px-4 py-3 font-semibold text-navy-700">{b.seatCode}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                b.status === 'active'
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-rose-50 text-rose-600'
                              }`}
                            >
                              {b.status === 'active' ? 'Completed' : 'Cancelled'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this booking?"
        message={
          cancelTarget ? (
            <>
              Cancel your reservation for seat <strong>{cancelTarget.seatCode}</strong> on{' '}
              <strong>{formatDate(cancelTarget.bookingDate)}</strong>? The seat will become
              available to others.
            </>
          ) : (
            ''
          )
        }
        destructive
        confirmLabel={cancelling ? 'Cancelling…' : 'Cancel booking'}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </DashboardShell>
  );
}
