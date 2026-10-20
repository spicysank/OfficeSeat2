import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  Ban,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/pages/admin/AdminDashboardPage';
import { listAllBookings, cancelBooking } from '@/services/bookingService';
import { listLayouts } from '@/services/layoutService';
import { formatTimestamp, formatDate } from '@/lib/date';
import type { Booking, OfficeLayout } from '@/types';

const PAGE_SIZE = 10;

export default function AdminBookingsPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [layouts, setLayouts] = useState<OfficeLayout[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [layoutFilter, setLayoutFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'bookingDate' | 'createdAt'>('bookingDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [bs, ls] = await Promise.all([listAllBookings(), listLayouts()]);
        setBookings(bs);
        setLayouts(ls);
      } catch (err) {
        console.error(err);
        show('Could not load bookings.', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layoutMap = useMemo(
    () => Object.fromEntries(layouts.map((l) => [l.id, l])),
    [layouts],
  );

  const filtered = useMemo(() => {
    let r = bookings;
    if (statusFilter !== 'all') r = r.filter((b) => b.status === statusFilter);
    if (layoutFilter !== 'all') r = r.filter((b) => b.layoutId === layoutFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (b) =>
          b.employeeName.toLowerCase().includes(q) ||
          b.employeeEmail.toLowerCase().includes(q) ||
          b.seatCode.toLowerCase().includes(q),
      );
    }
    r = [...r].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (sortKey === 'createdAt') {
        const am = av && typeof av === 'object' && 'toMillis' in av ? av.toMillis() : 0;
        const bm = bv && typeof bv === 'object' && 'toMillis' in bv ? bv.toMillis() : 0;
        cmp = am - bm;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [bookings, statusFilter, layoutFilter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const headers = [
      'Reference',
      'Employee Name',
      'Employee Email',
      'Seat Code',
      'Office',
      'Floor',
      'Booking Date',
      'Status',
      'Created At',
    ];
    const rows = filtered.map((b) => {
      const l = layoutMap[b.layoutId];
      return [
        b.id,
        b.employeeName,
        b.employeeEmail,
        b.seatCode,
        l?.office || '',
        l?.floor || '',
        b.bookingDate,
        b.status,
        b.createdAt ? b.createdAt.toDate().toISOString() : '',
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: 'bookingDate' | 'createdAt') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

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
    <DashboardShell title="All Bookings" subtitle="Search, filter, and manage every reservation">
      {loading ? (
        <CardSpinner />
      ) : (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search employee, email, or seat…"
                className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={layoutFilter}
              onChange={(e) => {
                setLayoutFilter(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All layouts</option>
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <p className="text-sm text-gray-500">
            {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
          </p>

          {/* Table */}
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50 text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Seat</th>
                    <th className="px-4 py-3 font-medium">Office / Floor</th>
                    <th
                      className="cursor-pointer px-4 py-3 font-medium hover:text-gray-700"
                      onClick={() => toggleSort('bookingDate')}
                    >
                      Date {sortKey === 'bookingDate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th
                      className="cursor-pointer px-4 py-3 font-medium hover:text-gray-700"
                      onClick={() => toggleSort('createdAt')}
                    >
                      Created {sortKey === 'createdAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        <CalendarDays className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                        No bookings match your filters.
                      </td>
                    </tr>
                  ) : (
                    paged.map((b) => {
                      const l = layoutMap[b.layoutId];
                      return (
                        <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">
                            {b.id.slice(0, 16)}…
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{b.employeeName}</p>
                            <p className="text-xs text-gray-500">{b.employeeEmail}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-navy-700">{b.seatCode}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {l ? `${l.office} · ${l.floor}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(b.bookingDate)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {formatTimestamp(b.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            {b.status === 'active' && (
                              <button
                                onClick={() => setCancelTarget(b)}
                                className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                              >
                                <Ban className="h-3 w-3" />
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">
                  Page {currentPage + 1} of {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
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
              Cancel <strong>{cancelTarget.employeeName}</strong>’s reservation for seat{' '}
              <strong>{cancelTarget.seatCode}</strong> on{' '}
              <strong>{formatDate(cancelTarget.bookingDate)}</strong>?
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
