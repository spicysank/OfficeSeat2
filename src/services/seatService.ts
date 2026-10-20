import { db } from '@/lib/firebase';
import type { Seat } from '@/types';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

function serializeSeat(id: string, data: Record<string, unknown>): Seat {
  return {
    id,
    seatCode: (data.seatCode as string) || '',
    label: (data.label as string) || '',
    xPercent: (data.xPercent as number) || 0,
    yPercent: (data.yPercent as number) || 0,
    widthPercent: (data.widthPercent as number) ?? 3,
    heightPercent: (data.heightPercent as number) ?? 3,
    enabled: data.enabled !== false,
    zone: (data.zone as string) || '',
    department: (data.department as string) || '',
    notes: (data.notes as string) || '',
    createdAt: (data.createdAt as Seat['createdAt']) ?? null,
    updatedAt: (data.updatedAt as Seat['updatedAt']) ?? null,
  };
}

export async function listSeats(layoutId: string): Promise<Seat[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  const q = query(
    collection(db, 'layouts', layoutId, 'seats'),
    orderBy('seatCode', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeSeat(d.id, d.data()));
}

export async function listSeatsDeep(layoutId: string): Promise<Seat[]> {
  return listSeats(layoutId);
}

export async function getSeat(
  layoutId: string,
  seatId: string,
): Promise<Seat | null> {
  if (!db) throw new Error('Firestore is not initialized.');
  const snap = await getDoc(doc(db, 'layouts', layoutId, 'seats', seatId));
  if (!snap.exists()) return null;
  return serializeSeat(snap.id, snap.data());
}

export interface SeatInput {
  seatCode: string;
  label: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  enabled: boolean;
  zone: string;
  department: string;
  notes: string;
}

export async function createSeat(
  layoutId: string,
  input: SeatInput,
): Promise<string> {
  if (!db) throw new Error('Firestore is not initialized.');
  const ref = await addDoc(collection(db, 'layouts', layoutId, 'seats'), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSeat(
  layoutId: string,
  seatId: string,
  input: Partial<SeatInput>,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'layouts', layoutId, 'seats', seatId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSeat(
  layoutId: string,
  seatId: string,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await deleteDoc(doc(db, 'layouts', layoutId, 'seats', seatId));
}

export interface SeatChange {
  type: 'create' | 'update' | 'delete';
  id?: string;
  input: SeatInput;
}

/**
 * Persist a batch of seat changes. Creates get new IDs, updates patch
 * existing docs, deletes remove existing docs. Uses a single batch when
 * under the 500-write limit, otherwise falls back to sequential batches.
 */
export async function persistSeatChanges(
  layoutId: string,
  changes: SeatChange[],
): Promise<Record<string, string>> {
  if (!db) throw new Error('Firestore is not initialized.');
  const idMap: Record<string, string> = {};
  const BATCH_LIMIT = 450;

  // Simpler, correct approach: group into batches of writes.
  const ops: { kind: 'set' | 'update' | 'delete'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }[] = [];
  let tempCounter = 0;
  for (const c of changes) {
    if (c.type === 'create') {
      const tempId = `__new_${tempCounter++}`;
      const ref = doc(collection(db, 'layouts', layoutId, 'seats'));
      idMap[tempId] = ref.id;
      ops.push({
        kind: 'set',
        ref,
        data: {
          ...c.input,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    } else if (c.type === 'update' && c.id) {
      idMap[c.id] = c.id;
      ops.push({
        kind: 'update',
        ref: doc(db, 'layouts', layoutId, 'seats', c.id),
        data: { ...c.input, updatedAt: serverTimestamp() },
      });
    } else if (c.type === 'delete' && c.id) {
      ops.push({
        kind: 'delete',
        ref: doc(db, 'layouts', layoutId, 'seats', c.id),
      });
    }
  }

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const slice = ops.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const op of slice) {
      if (op.kind === 'set') batch.set(op.ref, op.data! as any);
      else if (op.kind === 'update') batch.update(op.ref, op.data! as any);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }

  return idMap;
}

export function validateSeats(seats: Seat[]): string | null {
  const codes = seats.map((s) => s.seatCode.trim());
  if (codes.some((c) => !c)) {
    return 'Every seat must have a seat code.';
  }
  const lower = codes.map((c) => c.toLowerCase());
  const dupes = lower.filter((c, i) => lower.indexOf(c) !== i);
  if (dupes.length) {
    return `Duplicate seat code: ${dupes[0].toUpperCase()}`;
  }
  for (const s of seats) {
    if (
      s.xPercent < 0 ||
      s.xPercent > 100 ||
      s.yPercent < 0 ||
      s.yPercent > 100
    ) {
      return `Seat ${s.seatCode} is positioned outside the floor plan.`;
    }
  }
  return null;
}
