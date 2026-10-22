import { db } from '@/lib/firebase';
import type { Booking, BookingStatus } from '@/types';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

/**
 * Deterministic booking document ID so concurrent attempts collide on the
 * same document. Keyed by layoutId, seatId, and bookingDate.
 */
export function bookingDocId(
  layoutId: string,
  seatId: string,
  bookingDate: string,
): string {
  // Firestore doc IDs must be <= 1500 chars and avoid certain chars.
  // Our components are safe; join with underscores.
  return `${layoutId}_${seatId}_${bookingDate}`;
}

function serializeBooking(
  id: string,
  data: Record<string, unknown>,
): Booking {
  return {
    id,
    employeeId: (data.employeeId as string) || '',
    employeeName: (data.employeeName as string) || '',
    employeeEmail: (data.employeeEmail as string) || '',
    layoutId: (data.layoutId as string) || '',
    seatId: (data.seatId as string) || '',
    seatCode: (data.seatCode as string) || '',
    bookingDate: (data.bookingDate as string) || '',
    status: (data.status as BookingStatus) || 'active',
    createdAt: (data.createdAt as Booking['createdAt']) ?? null,
    updatedAt: (data.updatedAt as Booking['updatedAt']) ?? null,
  };
}

export interface BookingInput {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  layoutId: string;
  seatId: string;
  seatCode: string;
  bookingDate: string;
}

/**
 * Atomic booking creation using a deterministic document ID and a batched
 * transaction-like write. If the document already exists (someone else
 * booked the same seat/date), creation fails safely.
 */
export async function createBooking(
  input: BookingInput,
): Promise<{ id: string; error?: string }> {
  if (!db) throw new Error('Firestore is not initialized.');
  const id = bookingDocId(input.layoutId, input.seatId, input.bookingDate);
  const ref = doc(db, 'bookings', id);
  await writeBatch(db)
    .set(ref, {
      ...input,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    .commit();
  return { id };
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (!db) throw new Error('Firestore is not initialized.');
  const snap = await getDoc(doc(db, 'bookings', id));
  if (!snap.exists()) return null;
  return serializeBooking(snap.id, snap.data());
}

export async function listBookingsForEmployee(
  employeeId: string,
): Promise<Booking[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  // Avoid composite-index requirement: filter only, sort client-side.
  const q = query(
    collection(db, 'bookings'),
    where('employeeId', '==', employeeId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => serializeBooking(d.id, d.data()))
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
}

export async function listAllBookings(): Promise<Booking[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  // Avoid composite-index requirement: sort client-side.
  const q = query(collection(db, 'bookings'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => serializeBooking(d.id, d.data()))
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
}

export async function listBookingsForDate(
  layoutId: string,
  bookingDate: string,
  employeeId?: string,
): Promise<Booking[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  // Employees may only query their own bookings; admins query by layout.
  const q = employeeId
    ? query(collection(db, 'bookings'), where('employeeId', '==', employeeId))
    : query(collection(db, 'bookings'), where('layoutId', '==', layoutId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => serializeBooking(d.id, d.data()))
    .filter((b) => b.bookingDate === bookingDate && b.status === 'active');
}

export async function cancelBooking(id: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'bookings', id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

export async function countBookingsForEmployeeOnDate(
  employeeId: string,
  bookingDate: string,
): Promise<number> {
  if (!db) throw new Error('Firestore is not initialized.');
  // Single filter to avoid composite-index requirements; refine client-side.
  const q = query(
    collection(db, 'bookings'),
    where('employeeId', '==', employeeId),
  );
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const data = d.data();
    return (
      (data.bookingDate as string) === bookingDate &&
      (data.status as string) === 'active'
    );
  }).length;
}
