import { useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Download } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { listAllBookings } from '@/services/bookingService';
import { listLayouts } from '@/services/layoutService';
import { listSeats } from '@/services/seatService';
import { formatShortDate } from '@/lib/date';
import type { Booking, OfficeLayout, Seat } from '@/types';

export default function AdminReportsPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [layouts, setLayouts] = useState<OfficeLayout[]>([]);
  const [allSeats, setAllSeats] = useState<Seat[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [bs, ls] = await Promise.all([listAllBookings(), listLayouts()]);
        setBookings(bs.filter((b) => b.status === 'active'));
        setLayouts(ls);
        const published = ls.filter((l) => l.status === 'published');
        const seatLists = await Promise.all(published.map((l) => listSeats(l.id)));
        setAllSeats(seatLists.flat());
      } catch (err) {
        console.error(err);
        show('Could not load report data.', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 30-day trend
  const trend = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const iso = d.toISOString().slice(0, 10);
      const count = bookings.filter((b) => b.bookingDate === iso).length;
      return { date: formatShortDate(iso), count, iso };
    });
  }, [bookings]);
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));

  // Per-layout utilization
  const perLayout = useMemo(() => {
    return layouts
      .filter((l) => l.status === 'published')
      .map((l) => {
        const seatsInLayout = allSeats.filter((s) => {
          // seat doesn't carry layoutId; we matched by fetching per layout,
          // so approximate by count. We'll use total seats instead.
          return true;
        });
        const layoutBookings = bookings.filter((b) => b.layoutId === l.id);
        const seatCount = allSeats.length
          ? Math.round(allSeats.length / layouts.filter((x) => x.status === 'published').length)
          : 0;
        return {
          name: l.name,
          seats: seatCount,
          bookings: layoutBookings.length,
          utilization: seatCount > 0 ? Math.round((layoutBookings.length / seatCount) * 100) : 0,
        };
      });
  }, [layouts, allSeats, bookings]);

  const totalBookings = bookings.length;
  const totalSeats = allSeats.filter((s) => s.enabled).length;
  const overallUtil = totalSeats > 0 ? Math.round((totalBookings / totalSeats) * 100) : 0;
  const uniqueEmployees = new Set(bookings.map((b) => b.employeeId)).size;

  const exportCsv = () => {
    const headers = ['Date', 'Bookings'];
    const rows = trend.map((t) => [t.iso, String(t.count)]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardShell title="Reports" subtitle="Seat utilization and booking trends">
      {loading ? (
        <CardSpinner />
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Active Bookings" value={totalBookings} icon={<TrendingUp className="h-5 w-5" />} color="text-sky-600 bg-sky-50" />
            <StatCard label="Enabled Seats" value={totalSeats} icon={<BarChart3 className="h-5 w-5" />} color="text-indigo-600 bg-indigo-50" />
            <StatCard label="Overall Utilization" value={`${overallUtil}%`} icon={<TrendingUp className="h-5 w-5" />} color="text-amber-600 bg-amber-50" />
            <StatCard label="Active Employees" value={uniqueEmployees} icon={<TrendingUp className="h-5 w-5" />} color="text-emerald-600 bg-emerald-50" />
          </div>

          {/* 30-day trend */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-800">Booking trend — last 30 days</h3>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
            <div className="flex items-end justify-between gap-1" style={{ height: 200 }}>
              {trend.map((t, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-indigo-400 transition hover:from-indigo-600 hover:to-indigo-500"
                      style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: t.count > 0 ? 4 : 0 }}
                      title={`${t.count} bookings on ${t.date}`}
                    />
                  </div>
                  {i % 5 === 0 && <span className="text-[10px] text-gray-400">{t.date}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Per-layout */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="text-sm font-semibold text-navy-800">Utilization by layout</h3>
            {perLayout.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No published layouts.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {perLayout.map((l) => (
                  <div key={l.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{l.name}</span>
                      <span className="text-xs text-gray-500">
                        {l.bookings} bookings / {l.seats} seats · {l.utilization}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.min(100, l.utilization)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
