import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Armchair, Plus, Loader2, ChevronRight } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/pages/admin/AdminLayoutsPage';
import { listLayouts } from '@/services/layoutService';
import { listSeats } from '@/services/seatService';
import type { OfficeLayout, Seat } from '@/types';

export default function AdminSeatManagementPage() {
  const { show } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<OfficeLayout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ls = await listLayouts();
        setLayouts(ls);
        if (ls.length && !selectedLayoutId) {
          setSelectedLayoutId(ls[0].id);
        }
      } catch (err) {
        console.error(err);
        show('Could not load layouts.', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedLayoutId) return;
    (async () => {
      setSeatsLoading(true);
      try {
        setSeats(await listSeats(selectedLayoutId));
      } catch (err) {
        console.error(err);
        show('Could not load seats.', 'error');
      } finally {
        setSeatsLoading(false);
      }
    })();
  }, [selectedLayoutId, show]);

  const selectedLayout = layouts.find((l) => l.id === selectedLayoutId);

  return (
    <DashboardShell title="Seat Management" subtitle="View and manage seats across layouts">
      {loading ? (
        <CardSpinner />
      ) : layouts.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-10 w-10 text-gray-400" />}
          title="No layouts with seats"
          message="Create a layout and place seats in the Layout Editor first."
          action={
            <button
              onClick={() => navigate('/admin/layout-editor/new')}
              className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Open Layout Editor
            </button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Layout selector */}
          <div className="space-y-1 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <h3 className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-500">Layouts</h3>
            {layouts.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLayoutId(l.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  l.id === selectedLayoutId
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div>
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-gray-500">{l.office} · {l.floor}</p>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>

          {/* Seats table */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <div>
                <h3 className="font-semibold text-navy-800">
                  {selectedLayout?.name || 'Select a layout'}
                </h3>
                <p className="text-xs text-gray-500">
                  {seats.length} seat{seats.length !== 1 ? 's' : ''}
                </p>
              </div>
              {selectedLayoutId && (
                <Link
                  to={`/admin/layout-editor/${selectedLayoutId}`}
                  className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Open in editor
                </Link>
              )}
            </div>
            {seatsLoading ? (
              <CardSpinner />
            ) : seats.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">
                No seats placed yet. Use the Layout Editor to add seats.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="px-4 py-2 font-medium">Code</th>
                      <th className="px-4 py-2 font-medium">Label</th>
                      <th className="px-4 py-2 font-medium">Zone</th>
                      <th className="px-4 py-2 font-medium">Department</th>
                      <th className="px-4 py-2 font-medium">Position</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seats.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 font-semibold text-navy-700">{s.seatCode}</td>
                        <td className="px-4 py-3 text-gray-600">{s.label || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{s.zone || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{s.department || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {s.xPercent.toFixed(1)}%, {s.yPercent.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              s.enabled
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {s.enabled ? 'Enabled' : 'Disabled'}
                          </span>
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
