import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Map,
  Copy,
  Trash2,
  Eye,
  Send,
  Archive,
  FileText,
  Loader2,
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/pages/admin/AdminDashboardPage';
import {
  createLayout,
  deleteLayout,
  duplicateLayout,
  listLayouts,
  setLayoutStatus,
} from '@/services/layoutService';
import { useAuth } from '@/context/AuthContext';
import { formatTimestamp } from '@/lib/date';
import type { OfficeLayout } from '@/types';

export default function AdminLayoutsPage() {
  const { show } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<OfficeLayout[]>([]);
  const [action, setAction] = useState<{ type: string; layout: OfficeLayout } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setLayouts(await listLayouts());
    } catch (err) {
      console.error(err);
      show('Could not load layouts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createLayout(
        { name: 'Untitled layout', office: 'Main Office', floor: 'Ground' },
        profile?.uid || 'unknown',
      );
      show('Layout created. Open the editor to upload a floor plan.', 'success');
      navigate(`/admin/layout-editor/${id}`);
    } catch (err) {
      console.error(err);
      show('Could not create layout.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const confirmAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const { type, layout } = action;
      if (type === 'delete') {
        await deleteLayout(layout.id);
        show('Layout deleted.', 'success');
      } else if (type === 'duplicate') {
        const id = await duplicateLayout(layout.id);
        if (id) show('Layout duplicated as a draft.', 'success');
      } else if (type === 'publish') {
        await setLayoutStatus(layout.id, 'published');
        show('Layout published. Employees can now book seats.', 'success');
      } else if (type === 'unpublish') {
        await setLayoutStatus(layout.id, 'draft');
        show('Layout unpublished.', 'success');
      } else if (type === 'archive') {
        await setLayoutStatus(layout.id, 'archived');
        show('Layout archived.', 'success');
      }
      await load();
    } catch (err) {
      console.error(err);
      show('Action failed. Please try again.', 'error');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  return (
    <DashboardShell title="Office Layouts" subtitle="Create, edit, and publish floor plans">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {layouts.length} layout{layouts.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New layout
        </button>
      </div>

      {loading ? (
        <CardSpinner />
      ) : layouts.length === 0 ? (
        <EmptyState
          icon={<Map className="h-10 w-10 text-gray-400" />}
          title="No layouts yet"
          message="Create your first office layout, upload a floor plan, and place seat markers."
          action={
            <button
              onClick={handleCreate}
              className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create layout
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layouts.map((l) => (
            <div
              key={l.id}
              className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200"
            >
              <div className="relative aspect-video bg-slate-100">
                {l.imageBase64 ? (
                  <img
                    src={l.imageBase64}
                    alt={l.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    <Map className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <StatusBadge status={l.status} />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold text-navy-800">{l.name}</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {l.office} · {l.floor}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Updated {formatTimestamp(l.updatedAt)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/admin/layout-editor/${l.id}`}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <button
                    onClick={() => setAction({ type: 'duplicate', layout: l })}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate
                  </button>
                  {l.status === 'published' ? (
                    <button
                      onClick={() => setAction({ type: 'unpublish', layout: l })}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Unpublish
                    </button>
                  ) : (
                    <button
                      onClick={() => setAction({ type: 'publish', layout: l })}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => setAction({ type: 'archive', layout: l })}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                  <button
                    onClick={() => setAction({ type: 'delete', layout: l })}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(action)}
        title={
          action?.type === 'delete'
            ? 'Delete layout?'
            : action?.type === 'publish'
              ? 'Publish layout?'
              : action?.type === 'unpublish'
                ? 'Unpublish layout?'
                : action?.type === 'archive'
                  ? 'Archive layout?'
                  : 'Duplicate layout?'
        }
        message={
          action?.type === 'delete'
            ? `“${action?.layout.name}” and all its seats will be permanently removed. Existing bookings remain as records.`
            : action?.type === 'publish'
              ? `“${action?.layout.name}” will become visible to employees for booking. Make sure seats are placed.`
              : action?.type === 'unpublish'
                ? `“${action?.layout.name}” will revert to draft. Future bookings may be affected.`
                : action?.type === 'archive'
                  ? `“${action?.layout.name}” will be archived and hidden from employees.`
                  : `A draft copy of “${action?.layout.name}” will be created with the same seats.`
        }
        destructive={action?.type === 'delete'}
        confirmLabel={
          action?.type === 'delete'
            ? 'Delete'
            : action?.type === 'publish'
              ? 'Publish'
              : action?.type === 'unpublish'
                ? 'Unpublish'
                : action?.type === 'archive'
                  ? 'Archive'
                  : 'Duplicate'
        }
        onConfirm={confirmAction}
        onCancel={() => setAction(null)}
      />
    </DashboardShell>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white py-16 text-center shadow-sm ring-1 ring-gray-200">
      {icon}
      <h3 className="mt-4 text-lg font-semibold text-navy-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>
      {action}
    </div>
  );
}
