import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  Send,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
  Undo2,
  Redo2,
  Trash2,
  Eye,
  X,
  Loader2,
  ImageOff,
  GripVertical,
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  getLayout,
  updateLayoutImage,
  updateLayoutMetadata,
  setLayoutStatus,
  removeLayoutImage,
  validateImagePayload,
  type ImagePayload,
} from '@/services/layoutService';
import {
  listSeats,
  persistSeatChanges,
  validateSeats,
  type SeatChange,
  type SeatInput,
} from '@/services/seatService';
import { optimizeImage, validateRawImage } from '@/lib/image';
import type { OfficeLayout, Seat } from '@/types';

interface EditorSeat extends Seat {
  __isNew?: boolean;
  __isDeleted?: boolean;
  __tempId?: string;
}

interface HistorySnapshot {
  seats: EditorSeat[];
}

const DEFAULT_WIDTH = 3;
const DEFAULT_HEIGHT = 3;

function nextSeatCode(seats: EditorSeat[]): string {
  const used = new Set(
    seats.filter((s) => !s.__isDeleted).map((s) => s.seatCode.toUpperCase()),
  );
  let n = 1;
  while (used.has(`S${String(n).padStart(2, '0')}`)) n++;
  return `S${String(n).padStart(2, '0')}`;
}

export default function LayoutEditorPage() {
  const { layoutId = '' } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const { profile } = useAuth();

  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [seats, setSeats] = useState<EditorSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState(false);

  // undo/redo
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const dragRef = useRef<{
    seatId: string;
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: EditorSeat;
  } | null>(null);
  const tempCounter = useRef(0);

  const load = useCallback(async () => {
    if (!layoutId) return;
    setLoading(true);
    try {
      const l = await getLayout(layoutId);
      if (!l) {
        show('Layout not found.', 'error');
        navigate('/admin/layouts');
        return;
      }
      setLayout(l);
      const s = await listSeats(layoutId);
      const es: EditorSeat[] = s.map((x) => ({ ...x }));
      setSeats(es);
      setHistory([]);
      setRedoStack([]);
      setDirty(false);
    } catch (err) {
      console.error(err);
      show('Could not load layout.', 'error');
    } finally {
      setLoading(false);
    }
  }, [layoutId, navigate, show]);

  useEffect(() => {
    load();
  }, [load]);

  const pushHistory = () => {
    setHistory((h) => [...h.slice(-29), { seats }]);
    setRedoStack([]);
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setRedoStack((r) => [...r, { seats }]);
      setSeats(last.seats);
      setDirty(true);
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const last = r[r.length - 1];
      setHistory((h) => [...h, { seats }]);
      setSeats(last.seats);
      setDirty(true);
      return r.slice(0, -1);
    });
  };

  const getRelativePoint = (clientX: number, clientY: number) => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (previewMode || dragRef.current || panning) return;
    if (!layout?.imageBase64) return;
    // Only add if clicking directly on image area, not a marker
    if (e.target !== imageRef.current && e.target !== imageContainerRef.current) return;
    pushHistory();
    const { x, y } = getRelativePoint(e.clientX, e.clientY);
    const tempId = `temp_${tempCounter.current++}`;
    const code = nextSeatCode(seats);
    const ns: EditorSeat = {
      id: tempId,
      seatCode: code,
      label: code,
      xPercent: x - DEFAULT_WIDTH / 2,
      yPercent: y - DEFAULT_HEIGHT / 2,
      widthPercent: DEFAULT_WIDTH,
      heightPercent: DEFAULT_HEIGHT,
      enabled: true,
      zone: '',
      department: '',
      notes: '',
      createdAt: null,
      updatedAt: null,
      __isNew: true,
      __tempId: tempId,
    };
    setSeats((s) => [...s, ns]);
    setSelectedId(tempId);
    setDirty(true);
  };

  // Drag marker
  const startDrag = (e: React.MouseEvent, seat: EditorSeat, type: 'move' | 'resize') => {
    if (previewMode) return;
    e.stopPropagation();
    pushHistory();
    setSelectedId(seat.__tempId || seat.id);
    dragRef.current = {
      seatId: seat.__tempId || seat.id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...seat },
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { x, y } = getRelativePoint(e.clientX, e.clientY);
      setSeats((ss) =>
        ss.map((s) => {
          const id = s.__tempId || s.id;
          if (id !== d.seatId) return s;
          if (d.type === 'move') {
            const nx = Math.max(0, Math.min(100 - s.widthPercent, x - s.widthPercent / 2));
            const ny = Math.max(0, Math.min(100 - s.heightPercent, y - s.heightPercent / 2));
            return { ...s, xPercent: nx, yPercent: ny };
          } else {
            const w = Math.max(1.5, Math.min(20, x - s.xPercent));
            const h = Math.max(1.5, Math.min(20, y - s.yPercent));
            return { ...s, widthPercent: w, heightPercent: h };
          }
        }),
      );
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setDirty(true);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan
  const startPan = (e: React.MouseEvent) => {
    if (previewMode) return;
    if (e.button !== 0) return;
    setPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panning || !panStartRef.current) return;
      setPan({
        x: panStartRef.current.px + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.py + (e.clientY - panStartRef.current.y),
      });
    };
    const onUp = () => {
      setPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // File upload
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateRawImage(file);
    if (err) {
      show(err, 'error');
      e.target.value = '';
      return;
    }
    setUploading(true);
    setUploadMsg('Processing image…');
    try {
      const optimized = await optimizeImage(file, setUploadMsg);
      if (!optimized) {
        show(
          'This image is too large to store even after optimization. Please choose a smaller or simpler floor plan.',
          'error',
        );
        return;
      }
      const payload: ImagePayload = optimized;
      const vErr = validateImagePayload(payload);
      if (vErr) {
        show(vErr, 'error');
        return;
      }
      await updateLayoutImage(layoutId, payload);
      setLayout((l) => (l ? { ...l, ...payload } : l));
      show('Floor plan uploaded and saved.', 'success');
    } catch (err) {
      console.error(err);
      show('Could not process or save the image.', 'error');
    } finally {
      setUploading(false);
      setUploadMsg('');
      e.target.value = '';
    }
  };

  const removeImage = async () => {
    setConfirmDeleteImage(false);
    try {
      await removeLayoutImage(layoutId);
      setLayout((l) => (l ? {
        ...l,
        imageBase64: '',
        imageMimeType: '',
        imageWidth: 0,
        imageHeight: 0,
        imageSizeBytes: 0,
      } : l));
      show('Image removed.', 'success');
    } catch (err) {
      console.error(err);
      show('Could not remove image.', 'error');
    }
  };

  // Save metadata
  const [meta, setMeta] = useState({ name: '', office: '', floor: '' });
  useEffect(() => {
    if (layout) setMeta({ name: layout.name, office: layout.office, floor: layout.floor });
  }, [layout]);

  const saveMetadata = async () => {
    try {
      await updateLayoutMetadata(layoutId, meta);
      setLayout((l) => (l ? { ...l, ...meta } : l));
      show('Layout details saved.', 'success');
    } catch (err) {
      console.error(err);
      show('Could not save layout details.', 'error');
    }
  };

  const visibleSeats = useMemo(
    () => seats.filter((s) => !s.__isDeleted),
    [seats],
  );

  const selected = useMemo(
    () => seats.find((s) => (s.__tempId || s.id) === selectedId) || null,
    [seats, selectedId],
  );

  // Save draft
  const saveDraft = async (): Promise<boolean> => {
    const active = seats.filter((s) => !s.__isDeleted);
    const vErr = validateSeats(active);
    if (vErr) {
      show(vErr, 'error');
      return false;
    }
    setSaving(true);
    try {
      const changes: SeatChange[] = [];
      for (const s of seats) {
        if (s.__isDeleted && !s.__isNew) {
          changes.push({
            type: 'delete',
            id: s.id,
            input: {
              seatCode: s.seatCode,
              label: s.label,
              xPercent: s.xPercent,
              yPercent: s.yPercent,
              widthPercent: s.widthPercent,
              heightPercent: s.heightPercent,
              enabled: s.enabled,
              zone: s.zone,
              department: s.department,
              notes: s.notes,
            },
          });
        } else if (s.__isNew) {
          changes.push({
            type: 'create',
            input: {
              seatCode: s.seatCode,
              label: s.label,
              xPercent: s.xPercent,
              yPercent: s.yPercent,
              widthPercent: s.widthPercent,
              heightPercent: s.heightPercent,
              enabled: s.enabled,
              zone: s.zone,
              department: s.department,
              notes: s.notes,
            },
          });
        } else {
          // We can't tell which changed cheaply; send all as updates.
          changes.push({
            type: 'update',
            id: s.id,
            input: {
              seatCode: s.seatCode,
              label: s.label,
              xPercent: s.xPercent,
              yPercent: s.yPercent,
              widthPercent: s.widthPercent,
              heightPercent: s.heightPercent,
              enabled: s.enabled,
              zone: s.zone,
              department: s.department,
              notes: s.notes,
            },
          });
        }
      }

      if (changes.length === 0) {
        show('Nothing to save.', 'info');
        setDirty(false);
        return true;
      }

      await persistSeatChanges(layoutId, changes);

      // Reload seats from Firestore to get real IDs and clean state
      const fresh = await listSeats(layoutId);
      setSeats(fresh.map((x) => ({ ...x })));
      setHistory([]);
      setRedoStack([]);
      setDirty(false);
      show('Draft saved successfully.', 'success');
      return true;
    } catch (err) {
      console.error(err);
      show('Save failed. Your unsaved changes are preserved. Please try again.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setConfirmPublish(false);
    if (!layout?.imageBase64) {
      show('Upload a floor-plan image before publishing.', 'error');
      return;
    }
    if (visibleSeats.length === 0) {
      show('Add at least one seat before publishing.', 'error');
      return;
    }
    setPublishing(true);
    // Save first
    if (dirty) {
      const ok = await saveDraft();
      if (!ok) {
        setPublishing(false);
        show('Publishing blocked because saving failed.', 'error');
        return;
      }
    }
    try {
      await setLayoutStatus(layoutId, 'published');
      setLayout((l) => (l ? { ...l, status: 'published' } : l));
      show('Layout published! Employees can now book seats.', 'success');
    } catch (err) {
      console.error(err);
      show('Publishing failed. Draft preserved.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const updateSelected = (patch: Partial<EditorSeat>) => {
    if (!selected) return;
    setSeats((ss) =>
      ss.map((s) =>
        (s.__tempId || s.id) === selectedId ? { ...s, ...patch } : s,
      ),
    );
    setDirty(true);
  };

  const deleteSelected = () => {
    if (!selected) return;
    pushHistory();
    setSeats((ss) =>
      ss.map((s) =>
        (s.__tempId || s.id) === selectedId
          ? s.__isNew
            ? { ...s, __isDeleted: true }
            : { ...s, __isDeleted: true }
          : s,
      ),
    );
    setSelectedId(null);
    setDirty(true);
  };

  if (loading) {
    return (
      <DashboardShell title="Layout Editor">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Layout Editor"
      subtitle={layout?.name}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              previewMode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Eye className="h-4 w-4" />
            {previewMode ? 'Exit preview' : 'Preview'}
          </button>
          <button
            onClick={saveDraft}
            disabled={saving || publishing}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-navy-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            onClick={() => setConfirmPublish(true)}
            disabled={saving || publishing}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publish
          </button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Canvas */}
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 shadow-sm ring-1 ring-gray-200">
            <button
              onClick={undo}
              disabled={history.length === 0 || previewMode}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0 || previewMode}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <div className="mx-1 h-5 w-px bg-gray-200" />
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={resetView}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
              title="Reset view"
            >
              <Maximize className="h-4 w-4" />
            </button>
            <div className="mx-1 h-5 w-px bg-gray-200" />
            <span className="px-2 text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
            {dirty && (
              <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Unsaved changes
              </span>
            )}
          </div>

          {/* Canvas */}
          <div className="relative overflow-hidden rounded-xl bg-slate-800 ring-1 ring-gray-200" style={{ height: '60vh' }}>
            {!layout?.imageBase64 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-slate-300">
                <ImageOff className="h-10 w-10" />
                <div>
                  <p className="text-sm font-medium">No floor plan uploaded</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Upload a PNG or JPEG of your office layout to begin placing seats.
                  </p>
                </div>
                <label className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  <Upload className="mr-1.5 inline h-4 w-4" />
                  Upload floor plan
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFileChange} />
                </label>
              </div>
            ) : (
              <div
                ref={imageContainerRef}
                className="absolute inset-0 flex items-center justify-center"
                onMouseDown={startPan}
                onClick={handleImageClick}
                style={{ cursor: panning ? 'grabbing' : previewMode ? 'default' : 'crosshair' }}
              >
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                    transition: panning ? 'none' : 'transform 0.1s ease-out',
                  }}
                  className="relative"
                >
                  <img
                    ref={imageRef}
                    src={layout.imageBase64}
                    alt={layout.name}
                    className="max-w-full select-none rounded-lg shadow-lg"
                    style={{ maxHeight: '55vh' }}
                    draggable={false}
                  />
                  {/* Seat markers */}
                  {visibleSeats.map((s) => {
                    const id = s.__tempId || s.id;
                    const isSel = id === selectedId && !previewMode;
                    return (
                      <div
                        key={id}
                        className={`absolute flex items-center justify-center rounded-full text-[10px] font-bold shadow-md transition-transform ${
                          previewMode
                            ? s.enabled
                              ? 'bg-emerald-500/80 text-white'
                              : 'bg-gray-500/80 text-white'
                            : isSel
                              ? 'ring-2 ring-indigo-500 ring-offset-2'
                              : ''
                        } ${
                          !previewMode && s.enabled
                            ? 'bg-emerald-500 text-white hover:scale-110'
                            : ''
                        } ${
                          !previewMode && !s.enabled
                            ? 'bg-gray-400 text-white hover:scale-110'
                            : ''
                        }`}
                        style={{
                          left: `${s.xPercent}%`,
                          top: `${s.yPercent}%`,
                          width: `${s.widthPercent}%`,
                          height: `${s.heightPercent}%`,
                          maxWidth: '8%',
                          maxHeight: '8%',
                          cursor: previewMode ? 'default' : 'move',
                        }}
                        onMouseDown={(e) => startDrag(e, s, 'move')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!previewMode) setSelectedId(id);
                        }}
                      >
                        {s.seatCode}
                        {!previewMode && (
                          <span
                            className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 cursor-se-resize items-center justify-center rounded-full bg-navy-700 text-white"
                            onMouseDown={(e) => startDrag(e, s, 'resize')}
                            title="Drag to resize"
                          >
                            <GripVertical className="h-2 w-2" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {uploading && (
              <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-white/95 p-3 shadow-lg">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  {uploadMsg}
                </div>
              </div>
            )}
          </div>

          {/* Upload / replace row */}
          {layout?.imageBase64 && !previewMode && (
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
                <Upload className="h-4 w-4" />
                Replace image
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onFileChange} />
              </label>
              <button
                onClick={() => setConfirmDeleteImage(true)}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove image
              </button>
              <p className="text-xs text-gray-500">
                {layout.imageWidth}×{layout.imageHeight}px · {(layout.imageSizeBytes / 1024).toFixed(0)} KB stored
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Layout details */}
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <h3 className="text-sm font-semibold text-navy-800">Layout details</h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                <input
                  value={meta.name}
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Office</label>
                  <input
                    value={meta.office}
                    onChange={(e) => setMeta({ ...meta, office: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Floor</label>
                  <input
                    value={meta.floor}
                    onChange={(e) => setMeta({ ...meta, floor: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
              <button
                onClick={saveMetadata}
                className="w-full rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Save details
              </button>
            </div>
          </div>

          {/* Seat editor */}
          {selected && !previewMode ? (
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy-800">Edit seat</h3>
                <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Seat code</label>
                    <input
                      value={selected.seatCode}
                      onChange={(e) => updateSelected({ seatCode: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Label</label>
                    <input
                      value={selected.label}
                      onChange={(e) => updateSelected({ label: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Zone</label>
                    <input
                      value={selected.zone}
                      onChange={(e) => updateSelected({ zone: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      placeholder="e.g. East wing"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
                    <input
                      value={selected.department}
                      onChange={(e) => updateSelected({ department: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      placeholder="e.g. Engineering"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
                  <textarea
                    value={selected.notes}
                    onChange={(e) => updateSelected({ notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={(e) => updateSelected({ enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Enabled (bookable)
                </label>
                <p className="text-xs text-gray-500">
                  Position: {selected.xPercent.toFixed(1)}%, {selected.yPercent.toFixed(1)}% · Size: {selected.widthPercent.toFixed(1)}×{selected.heightPercent.toFixed(1)}%
                </p>
                <button
                  onClick={deleteSelected}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete seat
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <h3 className="text-sm font-semibold text-navy-800">Seats ({visibleSeats.length})</h3>
              <p className="mt-2 text-xs text-gray-500">
                {previewMode
                  ? 'Preview mode: markers show how employees will see them. Green = available, gray = disabled.'
                  : 'Click on the floor plan to add a seat. Drag to move, drag the corner to resize. Click a seat to edit details.'}
              </p>
              {!previewMode && visibleSeats.length > 0 && (
                <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {visibleSeats.map((s) => (
                    <button
                      key={s.__tempId || s.id}
                      onClick={() => setSelectedId(s.__tempId || s.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium text-navy-700">{s.seatCode}</span>
                      <span className={`text-xs ${s.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {s.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        title="Publish this layout?"
        message={
          <>
            Publishing makes this layout visible to employees for booking.
            {dirty && (
              <span className="mt-2 block font-medium text-amber-700">
                You have unsaved changes — they will be saved first.
              </span>
            )}
          </>
        }
        confirmLabel="Publish"
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublish(false)}
      />

      <ConfirmDialog
        open={confirmDeleteImage}
        title="Remove floor plan image?"
        message="The image will be removed from this layout. Seat markers remain but will have no background. This cannot be undone."
        destructive
        confirmLabel="Remove image"
        onConfirm={removeImage}
        onCancel={() => setConfirmDeleteImage(false)}
      />
    </DashboardShell>
  );
}
