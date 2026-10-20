import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Loader2 } from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { useToast } from '@/components/Toast';
import { getSettings, saveSettings } from '@/services/settingsService';
import type { AppSettings } from '@/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AdminSettingsPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setSettings(await getSettings());
      } catch (err) {
        console.error(err);
        show('Could not load settings.', 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      show('Settings saved.', 'success');
    } catch (err) {
      console.error(err);
      show('Could not save settings. Requires Admin privileges.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    if (!settings) return;
    const has = settings.workingDays.includes(day);
    setSettings({
      ...settings,
      workingDays: has
        ? settings.workingDays.filter((d) => d !== day)
        : [...settings.workingDays, day].sort(),
    });
  };

  if (loading || !settings) {
    return (
      <DashboardShell title="Settings" subtitle="Configure booking rules">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Settings" subtitle="Configure booking rules for employees">
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <SettingsIcon className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-navy-800">Booking Rules</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Advance booking days
              </label>
              <p className="mb-2 text-xs text-gray-500">
                How many days in advance employees can book a seat.
              </p>
              <input
                type="number"
                min={1}
                max={90}
                value={settings.advanceBookingDays}
                onChange={(e) =>
                  setSettings({ ...settings, advanceBookingDays: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Max bookings per day
              </label>
              <p className="mb-2 text-xs text-gray-500">
                How many seats an employee can reserve on a single day.
              </p>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.maxBookingsPerDay}
                onChange={(e) =>
                  setSettings({ ...settings, maxBookingsPerDay: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cancellation deadline (hours before booking date)
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Employees cannot cancel within this many hours of the booking date.
              </p>
              <input
                type="number"
                min={0}
                max={72}
                value={settings.cancellationDeadlineHours}
                onChange={(e) =>
                  setSettings({ ...settings, cancellationDeadlineHours: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Working days</label>
              <p className="mb-3 text-xs text-gray-500">
                Days employees are allowed to book seats.
              </p>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(i)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      settings.workingDays.includes(i)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
