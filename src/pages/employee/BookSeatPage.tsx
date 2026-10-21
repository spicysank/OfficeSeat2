import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Armchair,
  Loader2,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Maximize,
  Info,
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { CardSpinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { listPublishedLayouts } from '@/services/layoutService';
import { listSeats } from '@/services/seatService';
import {
  createBooking,
  listBookingsForDate,
  countBookingsForEmployeeOnDate,
} from '@/services/bookingService';
import { getSettings } from '@/services/settingsService';
import { todayISO, addDays, formatDate, parseISO } from '@/lib/date';
import type { OfficeLayout, Seat, Booking, AppSettings } from '@/types';

export default function BookSeatPage() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<OfficeLayout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [bookingsOnDate, setBookingsOnDate] = useState<Booking[]>([]);
  const [date, setDate] = useState(todayISO());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [booking, setBooking] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const loadedRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      setLoading(true);
      try {
        const ls = await listPublishedLayouts();
        setLayouts(ls);
        if (ls.length) setSelectedLayoutId(ls[0].id);
      } catch (err) {
        console.error('Failed to load floor plans:', err);
        show('Could not load floor plans. Please try again.', 'error');
      }
      try {
        setSettings(await getSettings());
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedLayout = layouts.find((l) => l.id === selectedLayoutId);

  useEffect(() => {
    if (!selectedLayoutId) return;
    (async () => {
      try {
        setSeats(await listSeats(selectedLayoutId));
      } catch (err) {
        console.error(err);
        show('Could not load seats.', 'error');
      }
    })();
  }, [selectedLayoutId, show]);

  useEffect(() => {
    if (!selectedLayoutId) return;
    (async () => {
      try {
        setBookingsOnDate(await listBookingsForDate(selectedLayoutId, date));
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedLayoutId, date]);

  const bookedSeatIds = useMemo(
    () => new Set(bookingsOnDate.map((b) => b.seatId)),
    [bookingsOnDate],
  );
  const myBookedSeatIds = useMemo(
    () =>
      new Set(
        bookingsOnDate.filter((b) => b.employeeId === profile?.uid).map((b) => b.seatId),
      ),
    [bookingsOnDate, profile],
  );

  const isWorkingDay = (iso: string) => {
    if (!settings) return true;
    const day = parseISO(iso).getDay();
    return settings.workingDays.includes(day);
  };

  const maxDate = settings ? addDays(todayISO(), settings.advanceBookingDays) : addDays(todayISO(), 14);
  const dateValid = date >= todayISO() && date <= maxDate && isWorkingDay(date);

  const seatStatus = (seat: Seat): 'available' | 'booked' | 'mine' | 'disabled' => {
    if (!seat.enabled) return 'disabled';
    if (myBookedSeatIds.has(seat.id)) return 'mine';
    if (bookedSeatIds.has(seat.id)) return 'booked';
    return 'available';
  };

  const handleConfirmBooking = async () => {
    if (!selectedSeat || !profile || !selectedLayoutId) return;
    if (!dateValid) {
      show('That date is not available for booking.', 'error');
      return;
    }
    setBooking(true);
    try {
      if (settings) {
        const count = await countBookingsForEmployeeOnDate(profile.uid, date);
        if (count >= settings.maxBookingsPerDay) {
          show(
            `You’ve reached the maximum of ${settings.maxBookingsPerDay} booking(s) for this day.`,
            'error',
          );
          setBooking(false);
          setSelectedSeat(null);
          return;
        }
      }
      const result = await createBooking({
        employeeId: profile.uid,
        employeeName: profile.displayName,
        employeeEmail: profile.email,
        layoutId: selectedLayoutId,
        seatId: selectedSeat.id,
        seatCode: selectedSeat.seatCode,
        bookingDate: date,
      });
      if (result.error) {
        show(result.error, 'error');
        setSelectedSeat(null);
      } else {
        show(`Seat ${selectedSeat.seatCode} booked for ${formatDate(date)}!`, 'success');
        setSelectedSeat(null);
        setBookingsOnDate(await listBookingsForDate(selectedLayoutId, date));
      }
    } catch (err) {
      console.error(err);
      show('Could not complete booking. Please try again.', 'error');
    } finally {
      setBooking(false);
    }
  };

  // Pan handlers
  const startPan = (e: React.MouseEvent) => {
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

  if (loading) {
    return (
      <DashboardShell title="Book a Seat">
        <CardSpinner />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Book a Seat" subtitle="Pick a date and reserve your spot">
      {layouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white py-16 text-center shadow-sm ring-1 ring-gray-200">
          <Armchair className="h-10 w-10 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-navy-800">No floor plans available</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Your administrator hasn’t published any office layouts yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Booking date</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  min={todayISO()}
                  max={maxDate}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>
            {layouts.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Floor plan</label>
                <select
                  value={selectedLayoutId || ''}
                  onChange={(e) => setSelectedLayoutId(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {l.office} · {l.floor}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!dateValid && (
              <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                <Info className="h-4 w-4" />
                {isWorkingDay(date) ? 'That date is outside the booking window.' : 'That’s not a working day.'}
              </p>
            )}
            {/* Legend */}
            <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
              <Legend color="bg-emerald-500" label="Available" />
              <Legend color="bg-rose-500" label="Booked" />
              <Legend color="bg-indigo-600" label="Your booking" />
              <Legend color="bg-gray-400" label="Disabled" />
            </div>
          </div>

          {/* Canvas + sidebar */}
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-2">
              {/* Zoom toolbar */}
              <div className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm ring-1 ring-gray-200">
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                  className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                  className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={resetView}
                  className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
                >
                  <Maximize className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
              </div>

              <div
                className="relative overflow-hidden rounded-xl bg-slate-800 ring-1 ring-gray-200"
                style={{ height: '55vh' }}
                onMouseDown={startPan}
              >
                {selectedLayout?.imageBase64 ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ cursor: panning ? 'grabbing' : 'default' }}
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
                        src={selectedLayout.imageBase64}
                        alt={selectedLayout.name}
                        className="max-w-full select-none rounded-lg shadow-lg"
                        style={{ maxHeight: '50vh' }}
                        draggable={false}
                      />
                      {seats.map((s) => {
                        const status = seatStatus(s);
                        const colors: Record<string, string> = {
                          available: 'bg-emerald-500 text-white hover:scale-110 hover:bg-emerald-600',
                          booked: 'bg-rose-500 text-white opacity-80',
                          mine: 'bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-2',
                          disabled: 'bg-gray-400 text-white opacity-60',
                        };
                        return (
                          <button
                            key={s.id}
                            disabled={status === 'booked' || status === 'disabled' || !dateValid}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (status === 'available') setSelectedSeat(s);
                            }}
                            className={`absolute flex items-center justify-center rounded-full text-[10px] font-bold shadow-md transition-transform ${colors[status]}`}
                            style={{
                              left: `${s.xPercent}%`,
                              top: `${s.yPercent}%`,
                              width: `${s.widthPercent}%`,
                              height: `${s.heightPercent}%`,
                              maxWidth: '8%',
                              maxHeight: '8%',
                              cursor:
                                status === 'available' && dateValid ? 'pointer' : 'default',
                            }}
                            title={`${s.seatCode} — ${status}`}
                          >
                            {s.seatCode}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <p className="text-sm">This layout has no floor-plan image.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-4">
              {selectedLayout && (
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                  <h3 className="text-sm font-semibold text-navy-800">{selectedLayout.name}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedLayout.office} · {selectedLayout.floor}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {seats.filter((s) => s.enabled).length} seats ·{' '}
                    <span className="text-emerald-600">
                      {seats.filter((s) => s.enabled && !bookedSeatIds.has(s.id)).length} available
                    </span>{' '}
                    on {formatDate(date)}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h3 className="text-sm font-semibold text-navy-800">How it works</h3>
                <ol className="mt-2 space-y-1.5 text-xs text-gray-600">
                  <li>1. Pick a date above.</li>
                  <li>2. Click a green (available) seat on the floor plan.</li>
                  <li>3. Review the details and confirm.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(selectedSeat)}
        title="Confirm your booking"
        message={
          selectedSeat ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg bg-indigo-50 p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">
                  {selectedSeat.seatCode}
                </span>
                <div>
                  <p className="font-semibold text-navy-800">Seat {selectedSeat.seatCode}</p>
                  {selectedSeat.label && (
                    <p className="text-xs text-gray-500">{selectedSeat.label}</p>
                  )}
                </div>
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="font-medium text-gray-900">{formatDate(date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Office</dt>
                  <dd className="font-medium text-gray-900">
                    {selectedLayout?.office} · {selectedLayout?.floor}
                  </dd>
                </div>
                {selectedSeat.zone && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Zone</dt>
                    <dd className="font-medium text-gray-900">{selectedSeat.zone}</dd>
                  </div>
                )}
                {selectedSeat.department && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Department</dt>
                    <dd className="font-medium text-gray-900">{selectedSeat.department}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel={booking ? 'Booking…' : 'Confirm booking'}
        onConfirm={handleConfirmBooking}
        onCancel={() => setSelectedSeat(null)}
      />
    </DashboardShell>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-gray-600">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}
