import { useEffect, useMemo, useState } from 'react';
import { Search, Users, Loader2 } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { listUserProfiles, setUserActive } from '@/services/userService';
import { formatTimestamp } from '@/lib/date';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { UserProfile } from '@/types';

export default function AdminEmployeesPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toggleTarget, setToggleTarget] = useState<UserProfile | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await listUserProfiles();
      setUsers(all.filter((u) => u.role !== 'admin'));
    } catch (err) {
      console.error(err);
      show('Could not load employees.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let r = users;
    if (statusFilter !== 'all')
      r = r.filter((u) => (statusFilter === 'active' ? u.active : !u.active));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    return [...r].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [users, search, statusFilter]);

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await setUserActive(toggleTarget.uid, !toggleTarget.active);
      setUsers((us) =>
        us.map((u) => (u.uid === toggleTarget.uid ? { ...u, active: !u.active } : u)),
      );
      show(
        `${toggleTarget.displayName} is now ${!toggleTarget.active ? 'active' : 'disabled'}.`,
        'success',
      );
    } catch (err) {
      console.error(err);
      show('Could not update account status. This requires Admin privileges.', 'error');
    } finally {
      setToggling(false);
      setToggleTarget(null);
    }
  };

  return (
    <DashboardShell title="Employees" subtitle="Directory of all non-admin users">
      {loading ? (
        <CardSpinner />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </select>
          </div>

          <p className="text-sm text-gray-500">
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
          </p>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-white py-16 text-center shadow-sm ring-1 ring-gray-200">
              <Users className="h-10 w-10 text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold text-navy-800">No employees found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Employees appear here automatically after they register.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-slate-50 text-xs uppercase text-gray-500">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Joined</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.uid} className="border-b border-gray-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                              {u.displayName.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-medium text-gray-900">{u.displayName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              u.active
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {u.active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatTimestamp(u.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setToggleTarget(u)}
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              u.active
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {u.active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={toggleTarget?.active ? 'Disable this account?' : 'Enable this account?'}
        message={
          toggleTarget?.active
            ? `${toggleTarget.displayName} will not be able to sign in until re-enabled.`
            : `${toggleTarget?.displayName ?? ''} will be able to sign in again.`
        }
        destructive={toggleTarget?.active}
        confirmLabel={toggling ? 'Updating…' : 'Confirm'}
        onConfirm={handleToggle}
        onCancel={() => setToggleTarget(null)}
      />
    </DashboardShell>
  );
}
