import { isAdminEmail, normalizeEmail } from '@/lib/admin';
import { db } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/types';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { UserProfile } from '@/types';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) throw new Error('Firestore is not initialized.');
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) };
}

export async function createUserProfile(
  uid: string,
  email: string,
  displayName: string,
): Promise<UserProfile> {
  if (!db) throw new Error('Firestore is not initialized.');
  const normalized = normalizeEmail(email);
  const role = isAdminEmail(normalized) ? 'admin' : 'employee';
  const profile: Omit<UserProfile, 'uid'> = {
    displayName,
    email: normalized,
    active: true,
    role,
    createdAt: null,
    updatedAt: null,
  };
  await setDoc(doc(db, 'users', uid), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { uid, ...profile };
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) return existing;
  return createUserProfile(uid, email, displayName);
}

export async function setUserActive(
  uid: string,
  active: boolean,
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  await updateDoc(doc(db, 'users', uid), {
    active,
    updatedAt: serverTimestamp(),
  });
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  const { getDocs, query, orderBy } = await import('firebase/firestore');
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as Omit<UserProfile, 'uid'>),
  }));
}

export const ADMIN_EMAIL_VALUE = ADMIN_EMAIL;
