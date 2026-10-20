import { db } from '@/lib/firebase';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BASE64_CHARS,
  type OfficeLayout,
  type LayoutStatus,
} from '@/types';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

function serializeLayout(
  id: string,
  data: Record<string, unknown>,
): OfficeLayout {
  return {
    id,
    name: (data.name as string) || '',
    office: (data.office as string) || '',
    floor: (data.floor as string) || '',
    imageBase64: (data.imageBase64 as string) || '',
    imageMimeType: (data.imageMimeType as string) || '',
    imageWidth: (data.imageWidth as number) || 0,
    imageHeight: (data.imageHeight as number) || 0,
    imageSizeBytes: (data.imageSizeBytes as number) || 0,
    status: (data.status as LayoutStatus) || 'draft',
    createdBy: (data.createdBy as string) || '',
    createdAt: (data.createdAt as OfficeLayout['createdAt']) ?? null,
    updatedAt: (data.updatedAt as OfficeLayout['updatedAt']) ?? null,
    publishedAt: (data.publishedAt as OfficeLayout['publishedAt']) ?? null,
  };
}

export async function listLayouts(): Promise<OfficeLayout[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  const q = query(collection(db, 'layouts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeLayout(d.id, d.data()));
}

export async function listPublishedLayouts(): Promise<OfficeLayout[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  const q = query(
    collection(db, 'layouts'),
    where('status', '==', 'published'),
    orderBy('name', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeLayout(d.id, d.data()));
}

export async function getLayout(id: string): Promise<OfficeLayout | null> {
  if (!db) throw new Error('Firestore is not initialized.');
  const snap = await getDoc(doc(db, 'layouts', id));
  if (!snap.exists()) return null;
  return serializeLayout(snap.id, snap.data());
}

export interface LayoutInput {
  name: string;
  office: string;
  floor: string;
}

export async function createLayout(
  input: LayoutInput,
  createdBy: string,
): Promise<string> {
  if (!db) throw new Error('Firestore is not initialized.');
  const ref = await addDoc(collection(db, 'layouts'), {
    ...input,
    imageBase64: '',
    imageMimeType: '',
    imageWidth: 0,
    imageHeight: 0,
    imageSizeBytes: 0,
    status: 'draft',
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
  });
  return ref.id;
}

export async function updateLayoutMetadata(
  id: string,
  input: LayoutInput,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'layouts', id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export interface ImagePayload {
  imageBase64: string;
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes: number;
}

export function validateImagePayload(p: ImagePayload): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(p.imageMimeType)) {
    return 'Only PNG and JPEG images are allowed.';
  }
  if (p.imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return (
      'The optimized image is still too large to store in Firestore ' +
      `(${p.imageBase64.length} chars; max ${MAX_IMAGE_BASE64_CHARS}). ` +
      'Please choose a smaller or simpler floor plan.'
    );
  }
  if (p.imageWidth <= 0 || p.imageHeight <= 0) {
    return 'Image dimensions are invalid.';
  }
  return null;
}

export async function updateLayoutImage(
  id: string,
  payload: ImagePayload,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const err = validateImagePayload(payload);
  if (err) throw new Error(err);
  await updateDoc(doc(db, 'layouts', id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function removeLayoutImage(id: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'layouts', id), {
    imageBase64: '',
    imageMimeType: '',
    imageWidth: 0,
    imageHeight: 0,
    imageSizeBytes: 0,
    updatedAt: serverTimestamp(),
  });
}

export async function setLayoutStatus(
  id: string,
  status: LayoutStatus,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const patch: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === 'published') patch.publishedAt = serverTimestamp();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, 'layouts', id), patch as any);
}

export async function duplicateLayout(id: string): Promise<string | null> {
  if (!db) throw new Error('Firestore is not initialized.');
  const original = await getLayout(id);
  if (!original) return null;
  const seats = await listSeatsDeep(id);
  const ref = await addDoc(collection(db, 'layouts'), {
    name: `${original.name} (copy)`,
    office: original.office,
    floor: original.floor,
    imageBase64: original.imageBase64,
    imageMimeType: original.imageMimeType,
    imageWidth: original.imageWidth,
    imageHeight: original.imageHeight,
    imageSizeBytes: original.imageSizeBytes,
    status: 'draft',
    createdBy: original.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
  });
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);
  for (const s of seats) {
    const sref = doc(db, 'layouts', ref.id, 'seats', s.id);
    batch.set(sref, {
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return ref.id;
}

export async function deleteLayout(id: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const seats = await listSeatsDeep(id);
  const { writeBatch, deleteDoc: batchDelete } = await import(
    'firebase/firestore'
  );
  const batch = writeBatch(db);
  for (const s of seats) {
    batch.delete(doc(db, 'layouts', id, 'seats', s.id));
  }
  await batch.commit();
  await deleteLayoutDoc(id);
}

async function deleteLayoutDoc(id: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  if (!db) throw new Error('Firestore is not initialized.');
  await deleteDoc(doc(db, 'layouts', id));
}

// --- Seats (kept in seatService import shape) ---
import { listSeatsDeep } from '@/services/seatService';
