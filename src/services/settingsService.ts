import { db } from '@/lib/firebase';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

export async function getSettings(): Promise<AppSettings> {
  if (!db) throw new Error('Firestore is not initialized.');
  const snap = await getDoc(doc(db, 'settings', 'general'));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const data = snap.data();
  return {
    advanceBookingDays: data.advanceBookingDays ?? DEFAULT_SETTINGS.advanceBookingDays,
    maxBookingsPerDay: data.maxBookingsPerDay ?? DEFAULT_SETTINGS.maxBookingsPerDay,
    cancellationDeadlineHours:
      data.cancellationDeadlineHours ?? DEFAULT_SETTINGS.cancellationDeadlineHours,
    workingDays: data.workingDays ?? DEFAULT_SETTINGS.workingDays,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await setDoc(doc(db, 'settings', 'general'), {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
